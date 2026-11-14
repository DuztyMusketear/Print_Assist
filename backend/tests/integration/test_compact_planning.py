from copy import deepcopy
from uuid import uuid4
from fastapi.testclient import TestClient
from print_assist.api import create_app


def command(client,payload):
    state=client.get('/api/state').json()
    return dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=payload)


def order(**changes):
    return dict(artifact_id='figure-pla-blue',quantity=4,priority=0,production_due='2026-11-15T12:00:00Z',ship_by='2026-11-16T00:00:00Z',**changes)


def test_queued_edit_and_delete_require_confirmation_release_stock_and_never_reschedule(tmp_path):
    with TestClient(create_app(tmp_path/'manage.sqlite3')) as client:
        state=client.post('/api/orders/plan',json=command(client,dict(order=order(),mode='manual'))).json()
        oid=state['orders'][0]['id'];stock=deepcopy(state['printers'])
        edit=dict(order_id=oid,order={**order(),'quantity':2})
        assert client.post('/api/orders/revise',json=command(client,edit)).status_code==409
        edit['confirmed']=True;body=command(client,edit)
        response=client.post('/api/orders/revise',json=body)
        assert response.status_code==200,response.text
        state=response.json();assert all(job['status']=='cancelled' for job in state['jobs'])
        assert all(row['reserved_grams']==0 for row in state['material_reservations'])
        assert all(printer['status']=='idle' for printer in state['printers'])
        assert [p['material'] for p in state['printers']]==[p['material'] for p in stock]
        assert state['orders'][0]['requires_schedule_review'] and state['orders'][0]['quantity']==2
        assert client.post('/api/orders/revise',json=body).json()==state
        assert client.post('/api/orders/delete',json=command(client,dict(order_id=oid))).status_code==409
        body=command(client,dict(order_id=oid,confirmed=True));response=client.post('/api/orders/delete',json=body)
        assert response.status_code==200,response.text
        assert response.json()['orders'][0]['status']=='cancelled'
        assert client.post('/api/orders/delete',json=body).json()==response.json()
        assert client.post('/api/schedule',json=command(client,dict(mode='automatic'))).status_code==200
        state=client.get('/api/state').json();assert all(job['status']=='cancelled' for job in state['jobs'])
        assert not state['forecasts'] and not client.get('/api/schedule/proposal').json()['assignments']


def test_started_work_and_stale_confirmations_are_protected(tmp_path):
    with TestClient(create_app(tmp_path/'active.sqlite3')) as client:
        state=client.post('/api/orders/plan',json=command(client,dict(order=order(),mode='automatic'))).json();oid=state['orders'][0]['id']
        assert client.post('/api/orders/delete',json=command(client,dict(order_id=oid,confirmed=True))).status_code==409
        assert client.post('/api/orders/revise',json=command(client,dict(order_id=oid,order=order(),confirmed=True))).status_code==409
        assert client.post('/api/orders/delete',json=command(client,dict(order_id='missing',confirmed=True))).status_code==409


def test_readonly_draft_estimate_proposes_realistic_quantity_and_date_alternatives(tmp_path):
    with TestClient(create_app(tmp_path/'estimate.sqlite3')) as client:
        before=client.get('/api/state').json()
        request=dict(session_id=before['session_id'],order={**order(),'quantity':20,'production_due':'2026-11-15T03:00:00Z'})
        response=client.post('/api/orders/estimate',json=request)
        assert response.status_code==200,response.text
        estimate=response.json();assert not estimate['feasible'] and estimate['on_time_quantity']==3
        assert estimate['estimated_finish']=='2026-11-15T14:00:00Z'
        assert client.get('/api/state').json()==before
        request['order']['quantity']=3
        assert client.post('/api/orders/estimate',json=request).json()['feasible']
        request['order']['artifact_id']='missing';assert client.post('/api/orders/estimate',json=request).status_code==422
        request['session_id']=str(uuid4());assert client.post('/api/orders/estimate',json=request).status_code==409


def test_individual_incoming_simulations_support_manual_and_automatic_review_without_starting(tmp_path):
    with TestClient(create_app(tmp_path/'incoming.sqlite3')) as client:
        payload={**order(),'mode':'manual'};body=command(client,payload)
        response=client.post('/api/shop/simulate',json=body)
        assert response.status_code==200,response.text
        state=response.json();assert len(state['shop_requests'])==1 and not state['orders']
        assert client.post('/api/shop/simulate',json=body).json()==state
        response=client.post('/api/shop/simulate',json=command(client,{**payload,'mode':'automatic'}))
        assert response.status_code==200,response.text
        state=response.json();assert len(state['shop_requests'])==2 and len(state['orders'])==1
        assert state['orders'][0]['requires_schedule_review'] and not state['jobs'] and not state['running']
        oid=state['orders'][0]['id'];response=client.post('/api/orders/delete',json=command(client,dict(order_id=oid,confirmed=True)))
        assert response.status_code==200 and response.json()['shop_requests'][-1]['status']=='cancelled'


def test_invalid_and_partial_estimates_and_unmatched_simulations_remain_safe(tmp_path):
    with TestClient(create_app(tmp_path/'edge.sqlite3')) as client:
        session=client.get('/api/state').json()['session_id']
        assert client.post('/api/orders/estimate',json=dict(session_id=session,order={**order(),'quantity':10001})).status_code==422
        result=client.post('/api/orders/estimate',json=dict(session_id=session,order={**order(),'quantity':200})).json()
        assert not result['feasible'] and result['estimated_finish'] is None and 'filament' in result['reason']
        assert client.post('/api/shop/simulate',json=command(client,{**order(),'mode':'automatic','artifact_id':'missing'})).status_code==409
        response=client.post('/api/shop/simulate',json=command(client,{**order(),'mode':'automatic','artifact_id':None}))
        assert response.status_code==200 and response.json()['shop_requests'][-1]['status']=='pending'
        state=client.post('/api/orders/plan',json=command(client,dict(order=order(),mode='manual'))).json();oid=state['orders'][0]['id']
        assert client.post('/api/orders/revise',json=command(client,dict(order_id=oid,confirmed=True,order={**order(),'artifact_id':'missing'}))).status_code==409
        stale=command(client,dict(order_id=oid,confirmed=True))
        client.post('/api/shop/example',json=command(client,{}))
        assert client.post('/api/orders/delete',json=stale).status_code==409


def test_manual_incoming_model_matches_and_example_batch_stay_usable_together(tmp_path):
    with TestClient(create_app(tmp_path/'mixed-feed.sqlite3')) as client:
        state=client.post('/api/shop/simulate',json=command(client,{**order(),'mode':'manual'})).json()
        incoming=state['shop_requests'][0]
        response=client.post('/api/shop/decisions',json=command(client,dict(request_id=incoming['id'],decision='accept')))
        assert response.status_code==200,response.text
        state=client.post('/api/shop/example',json=command(client,{})).json()
        assert next(row for row in state['shop_requests'] if row['id']=='EXAMPLE-001')['artifact_id']=='figure-pla-blue'

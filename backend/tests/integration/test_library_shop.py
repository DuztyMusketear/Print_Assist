import base64
import struct
import sqlite3
from contextlib import closing
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from print_assist.api import create_app

STL=b'solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 0 10 1\nendloop\nendfacet\nendsolid test'


def upload(**changes):
    return dict(name='Uploaded bracket',filename='bracket.stl',stl_base64=base64.b64encode(STL).decode(),
                duration_seconds=3600,filament_grams=20,filament_type='PLA',color='blue',
                support_assessment={'supports_required':False},**changes)


def envelope(client,payload):
    state=client.get('/api/state').json()
    return dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=payload)


def test_uploaded_model_is_reviewed_persisted_previewable_and_replay_safe(tmp_path):
    path=tmp_path/'library.sqlite3'
    with TestClient(create_app(path)) as client:
        command=envelope(client,upload())
        response=client.post('/api/library/models',json=command)
        assert response.status_code==200,response.text
        state=response.json();artifact=state['artifacts'][-1]
        assert artifact['name']=='Uploaded bracket' and artifact['support_task']['assessment_status']=='not-required'
        assert state['modeling_tasks'][-1]['stage']=='approved'
        asset=state['visual_assets'][-1]
        assert client.get(asset['path']).content==STL
        assert client.post('/api/library/models',json=command).json()==state
        assert 'stl_base64' not in response.text
        with closing(sqlite3.connect(path)) as db:
            assert 'stl_base64' not in db.execute('SELECT payload FROM commands').fetchone()[0]
        assert client.get('/api/models/'+'0'*64+'.stl').status_code==404
        profile=dict(title='Alternate print profile',modelReference='bracket.stl',duration_seconds=5400,filament_grams=25,filament_type='PLA',color='blue',required_capabilities=['FFF'],visual_asset_id=asset['id'])
        prepared=client.post('/api/modeling/tasks',json=envelope(client,profile))
        assert prepared.status_code==200,prepared.text
        assert prepared.json()['modeling_tasks'][-1]['visual_asset_id']==asset['id']
        forged={**profile,'visual_asset_id':'upload-'+'0'*64}
        assert client.post('/api/modeling/tasks',json=envelope(client,forged)).status_code==422
    with TestClient(create_app(path)) as client:
        state=client.get('/api/state').json()
        assert state['artifacts'][-1]['id']==artifact['id']
        assert client.get(asset['path']).content==STL
        reset=envelope(client,{'scenario':'empty'})
        assert client.post('/api/scenarios/reset',json=reset).status_code==200
        assert client.get(asset['path']).status_code==404
        assert client.post('/api/library/models',json=command).status_code==409


@pytest.mark.parametrize('data',[
    b'invalid',b'solid empty\nendsolid empty',STL.replace(b'10 0 0',b'nan 0 0'),
    STL.replace(b'10 0 0',b'230 0 0'),STL.replace(b'0 10 1',b'0 0 0'),
    b'\xff'*90,b' '* (10*1024*1024+1),b'header'.ljust(80,b' ')+struct.pack('<I',100001),
    b'header'.ljust(80,b' ')+struct.pack('<I',1),
    b'solid loose\nvertex 0 0 0\nvertex 10 0 0\nvertex 0 10 1\nendsolid loose',
    STL.replace(b'normal 0 0 1',b'normal nan 0 1'),
    b'solid far\nfacet normal 0 0 1\nouter loop\nvertex 1e39 0 0\nvertex 1e39 10 0\nvertex 1e39 0 10\nendloop\nendfacet\nendsolid far',
    b'solid precision\nfacet normal 0 0 1\nouter loop\nvertex 10000000000 0 0\nvertex 10000000010 0 0\nvertex 10000000000 10 0\nendloop\nendfacet\nendsolid precision',
])
def test_invalid_upload_does_not_change_state(tmp_path,data):
    with TestClient(create_app(tmp_path/'invalid.sqlite3')) as client:
        before=client.get('/api/state').json()
        payload=upload();payload['stl_base64']=base64.b64encode(data).decode()
        result=client.post('/api/library/models',json=envelope(client,payload))
        assert result.status_code==422,result.text
        assert client.get('/api/state').json()==before


def test_binary_upload_and_support_metadata_and_invalid_profiles(tmp_path):
    data=b'binary'.ljust(80,b' ')+struct.pack('<I12fH',1,0,0,1,0,0,0,10,0,0,0,10,1,0)
    with TestClient(create_app(tmp_path/'binary.sqlite3')) as client:
        payload=upload();payload['stl_base64']=base64.b64encode(data).decode()
        payload['support_assessment']={'supports_required':True,'support_material_grams':2,'removal_notes':'Remove base supports'}
        result=client.post('/api/library/models',json=envelope(client,payload))
        assert result.status_code==200,result.text
        assert result.json()['artifacts'][-1]['support_task']['supports_required']
        before_assets=len(result.json()['visual_assets'])
        duplicate=client.post('/api/library/models',json=envelope(client,{**payload,'name':'Same mesh, different profile'}))
        assert duplicate.status_code==200 and len(duplicate.json()['visual_assets'])==before_assets
        for key,value in [('stl_base64','!!!'),('filename','part.obj'),('filename','../part.stl'),('duration_seconds',0),('filament_grams',0),('name','')]:
            invalid={**payload,key:value}
            assert client.post('/api/library/models',json=envelope(client,invalid)).status_code==422


def test_local_feed_acceptance_is_held_mapped_persisted_and_never_duplicated(tmp_path):
    path=tmp_path/'shop.sqlite3'
    with TestClient(create_app(path)) as client:
        response=client.post('/api/shop/example',json=envelope(client,{}))
        assert response.status_code==200,response.text
        state=response.json();assert len(state['shop_requests'])==3 and not state['orders']
        assert client.post('/api/shop/example',json=envelope(client,{})).json()['shop_requests']==state['shop_requests']
        request=state['shop_requests'][0]
        command=envelope(client,{'request_id':request['id'],'decision':'accept'})
        accepted=client.post('/api/shop/decisions',json=command)
        assert accepted.status_code==200,accepted.text
        accepted=accepted.json();assert len(accepted['orders'])==1 and not accepted['jobs'] and not accepted['running']
        assert accepted['orders'][0]['quantity']==request['quantity']
        assert accepted['orders'][0]['requires_schedule_review']
        assert accepted['shop_requests'][0]['status']=='accepted'
        assert client.post('/api/shop/decisions',json=command).json()==accepted
        assert client.post('/api/shop/decisions',json=envelope(client,{'request_id':request['id'],'decision':'accept'})).status_code==409
        unmatched=next(row for row in accepted['shop_requests'] if row['artifact_id'] is None)
        for payload in [dict(request_id='missing',decision='accept'),dict(request_id=unmatched['id'],decision='accept'),dict(request_id=unmatched['id'],decision='accept',artifact_id='missing')]:
            assert client.post('/api/shop/decisions',json=envelope(client,payload)).status_code==409
        payload=dict(request_id=unmatched['id'],decision='accept',artifact_id='figure-pla-blue')
        assert client.post('/api/shop/decisions',json=envelope(client,payload)).status_code==200
        remaining=next(row for row in accepted['shop_requests'] if row['id'] not in {request['id'],unmatched['id']})
        assert client.post('/api/shop/decisions',json=envelope(client,dict(request_id=remaining['id'],decision='reject'))).status_code==200
    with TestClient(create_app(path)) as client:
        state=client.get('/api/state').json()
        assert len(state['orders'])==2 and [r['status'] for r in state['shop_requests']].count('rejected')==1
        assert not state['jobs'] and not state['running']


def test_guided_schedule_refuses_late_or_partial_plans_atomically(tmp_path):
    with TestClient(create_app(tmp_path/'deadlines.sqlite3')) as client:
        order=dict(artifact_id='figure-pla-blue',quantity=1,production_due='2026-11-15T00:30:00Z',ship_by='2026-11-16T00:00:00Z')
        assert client.post('/api/orders/plan',json=envelope(client,dict(order=order,mode='automatic',review_only=True))).status_code==200
        before=client.get('/api/state').json();proposal=client.get('/api/schedule/proposal').json()
        command=envelope(client,dict(proposal_id=proposal['id'],mode='automatic',require_on_time=True))
        response=client.post('/api/schedule/apply',json=command)
        assert response.status_code==409 and 'deadline' in response.json()['detail'].lower()
        assert client.get('/api/state').json()==before
        # Advanced/manual review retains explicit late-work behavior.
        command['payload']['require_on_time']=False
        assert client.post('/api/schedule/apply',json=command).status_code==200


def test_held_order_can_be_corrected_then_confirmed_but_committed_work_is_protected(tmp_path):
    with TestClient(create_app(tmp_path/'revise.sqlite3')) as client:
        order=dict(artifact_id='figure-pla-blue',quantity=1,production_due='2026-11-15T00:30:00Z',ship_by='2026-11-16T00:00:00Z')
        state=client.post('/api/orders/plan',json=envelope(client,dict(order=order,mode='automatic',review_only=True))).json()
        order_id=state['orders'][0]['id'];updated={**order,'production_due':'2026-11-15T12:00:00Z','quantity':2}
        for payload in [dict(order_id='unknown',order=updated),dict(order_id=order_id,order={**updated,'artifact_id':'missing'})]:
            assert client.post('/api/orders/revise',json=envelope(client,payload)).status_code==409
        command=envelope(client,dict(order_id=order_id,order=updated,confirmed=True))
        result=client.post('/api/orders/revise',json=command)
        assert result.status_code==200,result.text
        assert client.post('/api/orders/revise',json=command).json()==result.json()
        assert result.json()['orders'][0]['quantity']==2 and not result.json()['jobs']
        proposal=client.get('/api/schedule/proposal').json()
        result=client.post('/api/schedule/apply',json=envelope(client,dict(proposal_id=proposal['id'],mode='automatic',require_on_time=True)))
        assert result.status_code==200,result.text
        assert result.json()['running']
        assert client.post('/api/orders/revise',json=envelope(client,dict(order_id=order_id,order=updated,confirmed=True))).status_code==409


def test_partial_guided_plan_and_stale_feed_are_rejected_without_starting(tmp_path):
    with TestClient(create_app(tmp_path/'partial.sqlite3')) as client:
        old=envelope(client,{})
        assert client.post('/api/shop/example',json=old).status_code==200
        old['idempotency_key']=str(uuid4())
        assert client.post('/api/shop/example',json=old).status_code==409
        order=dict(artifact_id='figure-pla-blue',quantity=1000,production_due='2026-11-25T00:00:00Z',ship_by='2026-11-26T00:00:00Z')
        assert client.post('/api/orders/plan',json=envelope(client,dict(order=order,mode='automatic',review_only=True))).status_code==200
        proposal=client.get('/api/schedule/proposal').json();assert proposal['blocked']
        assert client.post('/api/schedule/apply',json=envelope(client,dict(proposal_id=proposal['id'],mode='automatic',require_on_time=True))).status_code==409
        assert not client.get('/api/state').json()['jobs']


def test_review_corrections_cannot_rewrite_partial_or_active_production():
    from print_assist.order_review import revise
    from print_assist.scenarios import initial_state
    state=initial_state();order=dict(status='queued',id='order',artifact_id='figure-pla-blue',quantity=2,priority=0,production_due='2026-11-16T00:00:00Z',ship_by='2026-11-17T00:00:00Z',successful_quantity=1,requires_schedule_review=True)
    state['orders']=[order]
    with pytest.raises(ValueError,match='uncommitted'):revise(state,dict(order_id='order',order=order))
    order['successful_quantity']=0;state['jobs']=[dict(order_id='order',status='running')]
    with pytest.raises(ValueError,match='uncommitted'):revise(state,dict(order_id='order',order=order))


def test_confirmed_product_match_updates_other_pending_requests_for_the_same_sku():
    from print_assist.shop import load_examples, decide
    from print_assist.scenarios import initial_state
    state=load_examples(initial_state())
    state['artifacts'].append({**state['artifacts'][0],'id':'alternate-profile'})
    state=decide(state,dict(request_id='EXAMPLE-001',decision='accept',artifact_id='alternate-profile'))
    assert state['shop_requests'][1]['artifact_id']=='alternate-profile'
    assert state['shop_requests'][1]['status']=='pending' and len(state['orders'])==1 and not state['jobs']


def test_competing_shop_acceptances_create_only_one_order(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    with TestClient(create_app(tmp_path/'concurrent-shop.sqlite3')) as client:
        client.post('/api/shop/example',json=envelope(client,{}))
        command=envelope(client,dict(request_id='EXAMPLE-001',decision='accept'))
        other={**command,'idempotency_key':str(uuid4())}
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda body:client.post('/api/shop/decisions',json=body).status_code,[command,other]))
        assert sorted(results)==[200,409]
        assert len(client.get('/api/state').json()['orders'])==1

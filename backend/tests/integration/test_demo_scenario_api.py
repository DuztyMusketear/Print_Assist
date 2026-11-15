"""Scenario commands share transactional state, replay and reset behavior."""
from uuid import uuid4
from fastapi.testclient import TestClient
from print_assist.api import create_app


def command(state,payload):
    return dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=payload)


def test_marketplace_event_persists_notification_and_replays_without_duplicate_orders(tmp_path):
    with TestClient(create_app(tmp_path/'scenarios.sqlite3')) as client:
        state=client.get('/api/state').json()
        payload=dict(event='marketplace_order',event_id='market-1',product_id='BLUE-FIGURE',order=dict(artifact_id='figure-pla-blue',quantity=2,priority=0,production_due='2026-11-15T12:00:00Z',ship_by='2026-11-16T00:00:00Z',mode='manual'))
        request=command(state,payload)
        response=client.post('/api/scenarios/events',json=request)
        assert response.status_code==200,response.text
        result=response.json()
        assert result['scenario_events'][0]['event_id']=='market-1'
        assert len(result['shop_requests'])==1 and result['shop_requests'][0]['sku']=='BLUE-FIGURE'
        assert client.post('/api/scenarios/events',json=request).json()==result
        assert client.get('/api/state').json()==result
        duplicate=client.post('/api/scenarios/events',json=command(result,payload)).json()
        assert len(duplicate['shop_requests'])==1 and len(duplicate['scenario_events'])==1
        conflict=client.post('/api/scenarios/events',json=command(duplicate,{**payload,'product_id':'DIFFERENT'}))
        assert conflict.status_code==409
        invalid=client.post('/api/scenarios/events',json=command(duplicate,dict(event='unknown',event_id='bad')))
        assert invalid.status_code==422
        reset=client.post('/api/scenarios/reset',json=command(duplicate,dict(scenario='empty'))).json()
        assert reset['scenario_events']==[] and reset['shop_requests']==[]

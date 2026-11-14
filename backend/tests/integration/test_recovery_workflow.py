from uuid import uuid4
from fastapi.testclient import TestClient
from print_assist.api import create_app
from print_assist.service import FactoryService


def command(snapshot,payload):
    return dict(session_id=snapshot['session_id'],expected_revision=snapshot['revision'],idempotency_key=str(uuid4()),payload=payload)


def test_recovery_api_roundtrip_and_idempotency(tmp_path):
    path=tmp_path/'recovery.sqlite3'; client=TestClient(create_app(path))
    state=client.get('/api/state').json()
    state=client.post('/api/scenarios/reset',json=command(state,dict(scenario='seeded'))).json()
    state=client.post('/api/schedule',json=command(state,dict(mode='automatic'))).json()
    state=client.post('/api/incidents/inject',json=command(state,dict(printer_id=state['printers'][0]['id'],fault_type='thermal',event_id=str(uuid4())))).json()
    incident=state['incidents'][0]
    proposal=client.get(f"/api/incidents/{incident['id']}/proposal").json()
    apply=command(state,dict(incident_id=incident['id'],proposal_id=proposal['id'],confirmed=True))
    response=client.post('/api/incidents/recover',json=apply)
    assert response.status_code==200,response.text
    assert client.post('/api/incidents/recover',json=apply).json()==response.json()
    state=response.json()
    assert client.get('/api/incidents/unknown/proposal').status_code==409
    stale=command(state,dict(incident_id=incident['id'],proposal_id=proposal['id'],confirmed=True))
    assert client.post('/api/incidents/recover',json=stale).status_code==409
    policy=client.post('/api/incidents/policy',json=command(state,dict(mode='automatic')))
    assert policy.status_code==200,policy.text
    assert policy.json()['recovery_policy']=='automatic'
    assert client.post('/api/incidents/policy',json=command(state,dict(mode='review'))).status_code==409
    restarted=FactoryService(path).snapshot()
    assert restarted['recovery_policy']=='review'
    assert restarted['incidents'][0]['applied']==state['incidents'][0]['applied']


def test_reject_and_clear_api_validation(tmp_path):
    client=TestClient(create_app(tmp_path/'api.sqlite3')); state=client.get('/api/state').json()
    state=client.post('/api/incidents/inject',json=command(state,dict(printer_id=state['printers'][0]['id'],fault_type='filament_runout',event_id=str(uuid4())))).json()
    iid=state['incidents'][0]['id']
    for endpoint in ['clear','reject']:
        assert client.post('/api/incidents/'+endpoint,json=command(state,dict(incident_id=iid,confirmed=False))).status_code==409
    assert client.post('/api/incidents/clear',json=command(state,dict(incident_id=iid,confirmed=True))).status_code==409
    state=client.post('/api/incidents/reject',json=command(state,dict(incident_id=iid,confirmed=True))).json()
    response=client.post('/api/incidents/clear',json=command(state,dict(incident_id=iid,confirmed=True,refill_grams=100)))
    assert response.status_code==200,response.text
    assert response.json()['printers'][0]['material']['grams']==100

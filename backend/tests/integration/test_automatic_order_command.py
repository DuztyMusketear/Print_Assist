from uuid import uuid4
from fastapi.testclient import TestClient
from print_assist.api import create_app


def command(client,payload):
    state=client.get('/api/state').json()
    return dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=payload)


def test_explicit_end_to_end_command_runs_once_and_tracks_completion(tmp_path):
    client=TestClient(create_app(tmp_path/'automatic.sqlite3'))
    payload=dict(artifact_id='figure-pla-blue',quantity=2,mode='end_to_end',clock_speed=3600,priority=0,
                 production_due='2026-11-15T12:00:00Z',ship_by='2026-11-16T00:00:00Z')
    body=command(client,payload)
    response=client.post('/api/shop/simulate',json=body)
    assert response.status_code==200,response.text
    state=response.json()
    assert state['running'] and state['clock_speed']==3600
    assert len(state['jobs'])==2 and state['order_demonstrations'][0]['status']=='running'
    assert client.post('/api/shop/simulate',json=body).json()==state
    for _ in range(2):
        response=client.post('/api/advance',json=command(client,dict(seconds=3600)))
        assert response.status_code==200,response.text
    finished=response.json()
    assert finished['orders'][0]['successful_quantity']==2
    assert finished['order_demonstrations'][0]['status']=='completed'

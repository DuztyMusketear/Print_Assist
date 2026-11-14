from uuid import uuid4
from fastapi.testclient import TestClient
from print_assist.api import create_app


def command(client,payload):
    state=client.get('/api/state').json()
    return dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=payload)


def test_incident_command_persists_deduplicates_and_rejects_invalid_input(tmp_path):
    path=tmp_path/'incidents.sqlite3'
    with TestClient(create_app(path)) as client:
        payload=dict(printer_id='printer-1',fault_type='thermal',event_id=str(uuid4()))
        body=command(client,payload)
        response=client.post('/api/incidents/inject',json=body)
        assert response.status_code==200,response.text
        state=response.json()
        assert state['printers'][0]['fault']['type']=='thermal'
        assert len(state['incidents'])==1
        assert client.post('/api/incidents/inject',json=body).json()==state
        assert client.post('/api/incidents/inject',json=command(client,{**payload,'event_id':str(uuid4())})).status_code==409
        assert client.post('/api/incidents/inject',json=command(client,{**payload,'fault_type':'other'})).status_code==422
    with TestClient(create_app(path)) as client:
        assert client.get('/api/state').json()['incidents']==state['incidents']

from uuid import uuid4
from fastapi.testclient import TestClient
from print_assist.api import create_app


def command(state,payload):return dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=payload)


def test_loaded_spool_changes_are_validated_transactional_and_replay_safe(tmp_path):
    with TestClient(create_app(tmp_path/'filament.sqlite3')) as client:
        state=client.get('/api/state').json()
        payload=dict(printer_id=state['printers'][0]['id'],filament_type='PLA',color=' black ',grams=500,confirmed=True)
        request=command(state,payload)
        response=client.post('/api/printers/material',json=request)
        assert response.status_code==200,response.text
        result=response.json();assert result['printers'][0]['material']['color']=='black'
        assert client.post('/api/printers/material',json=request).json()==result
        assert client.post('/api/printers/material',json=command(result,{**payload,'confirmed':False})).status_code==409
        assert client.post('/api/printers/material',json=command(result,{**payload,'grams':0})).status_code==422
        assert client.get('/api/state').json()==result



def test_faulted_matching_refill_resolves_atomically_and_is_replay_safe(tmp_path):
    with TestClient(create_app(tmp_path/'refill.sqlite3')) as client:
        state=client.get('/api/state').json()
        state=client.post('/api/scenarios/reset',json=command(state,dict(scenario='fault-demo'))).json()
        printer_id=state['printers'][0]['id']
        state=client.post('/api/incidents/inject',json=command(state,dict(printer_id=printer_id,fault_type='filament_runout',event_id=str(uuid4())))).json()
        payload=dict(printer_id=printer_id,mode='refill',filament_type='PLA',color='blue',grams=250,confirmed=True)
        request=command(state,payload)
        refill=client.post('/api/printers/material',json=request)
        assert refill.status_code==200,refill.text
        refilled=refill.json()
        assert refilled['printers'][0]['status']=='running'
        assert refilled['incidents'][0]['equipment_cleared']
        assert refilled['printers'][0]['material']['grams']==250
        assert client.post('/api/printers/material',json=request).json()==refilled
        result=refilled
        assert result['incidents'][0]['refilled_grams']==250
        assert len(result['jobs'])==len(state['jobs'])
        assert client.post('/api/printers/material',json=command(result,{**payload,'color':'black'})).status_code==409
        assert client.post('/api/printers/material',json=command(result,{**payload,'grams':0})).status_code==422

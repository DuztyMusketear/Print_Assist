"""Ordinary controls persist and replay exactly one healthy transfer decision."""
from uuid import uuid4

from fastapi.testclient import TestClient
from print_assist.api import create_app


def envelope(state, payload):
    return dict(session_id=state['session_id'], expected_revision=state['revision'],
        idempotency_key=str(uuid4()), payload=payload)


def test_pause_transfers_approved_parts_persists_impacts_and_replays_without_duplication(tmp_path):
    path = tmp_path / 'transfer.sqlite3'
    with TestClient(create_app(path)) as client:
        state = client.get('/api/state').json()
        state = client.post('/api/scenarios/reset', json=envelope(state, {'scenario': 'seeded'})).json()
        state = client.post('/api/schedule', json=envelope(state, {'mode': 'automatic'})).json()
        state = client.post('/api/advance', json=envelope(state, {'seconds': 3600})).json()
        request = envelope(state, {'printer_id': 'printer-1', 'action': 'pause'})
        response = client.post('/api/printers/control', json=request)
        assert response.status_code == 200, response.text
        result = response.json()
        assert len(result['workload_transfers']) == 1
        report = result['workload_transfers'][0]
        assert report['waste_grams'] == 12.5 and not report['blocked']
        assert report['impacts'][0]['delta_seconds'] is not None
        assert result['incidents'] == []
        assert result['printers'][0]['status'] == 'paused'
        assert all(j['printer_id'] != 'printer-1' for j in result['jobs'] if j['status'] in {'planned', 'running'})
        assert client.post('/api/printers/control', json=request).json() == result
        assert client.get('/api/state').json() == result
    with TestClient(create_app(path)) as reopened:
        persisted = reopened.get('/api/state').json()
        assert persisted['workload_transfers'] == result['workload_transfers']
        assert len(persisted['jobs']) == len(result['jobs'])
        assert persisted['incidents'] == []
        # Startup safety pauses active work; explicit resume continues that same
        # printer's part, without another interruption or cross-printer resume.
        paused = next(j for j in persisted['jobs'] if j['status'] == 'paused')
        resumed_response = reopened.post('/api/printers/control', json=envelope(persisted,
            {'printer_id': paused['printer_id'], 'action': 'resume'}))
        assert resumed_response.status_code == 200, resumed_response.text
        resumed = resumed_response.json()
        job = next(j for j in resumed['jobs'] if j['id'] == paused['id'])
        assert job['status'] == 'running'
        assert job['elapsed_seconds'] == paused['elapsed_seconds']
        assert job['printer_id'] == paused['printer_id']
        assert resumed['workload_transfers'] == persisted['workload_transfers']



def test_resumed_capacity_rebalances_approved_queue_atomically_and_replay_is_stable(tmp_path):
    with TestClient(create_app(tmp_path/'rejoin.sqlite3')) as client:
        state=client.get('/api/state').json()
        state=client.post('/api/scenarios/reset',json=envelope(state,{'scenario':'seeded'})).json()
        state=client.post('/api/schedule',json=envelope(state,{'mode':'automatic'})).json()
        state=client.post('/api/printers/control',json=envelope(state,{'printer_id':'printer-1','action':'pause'})).json()
        request=envelope(state,{'printer_id':'printer-1','action':'resume'})
        response=client.post('/api/printers/control',json=request)
        assert response.status_code==200,response.text
        result=response.json()
        assert result['printers'][0]['status']=='running'
        assert result['workload_transfers'][-1]['action']=='rebalance'
        assert client.post('/api/printers/control',json=request).json()==result
        assert client.get('/api/state').json()==result
        assert len(result['jobs'])==len(state['jobs'])

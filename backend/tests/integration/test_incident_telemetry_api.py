from copy import deepcopy
from uuid import uuid4

from fastapi.testclient import TestClient

from print_assist.api import create_app
from print_assist.service import FactoryService


def command(state, payload):
    return dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()), payload=payload)


def test_simulated_network_signal_is_guarded_replayable_and_persisted(tmp_path):
    path = tmp_path / 'telemetry.sqlite3'; client = TestClient(create_app(path))
    state = client.get('/api/state').json()
    state = client.post('/api/scenarios/reset', json=command(state, dict(scenario='seeded'))).json()
    state = client.post('/api/schedule', json=command(state, dict(mode='automatic'))).json()
    state = client.post('/api/incidents/inject', json=command(state, dict(printer_id='printer-1', fault_type='network_disconnect', event_id=str(uuid4())))).json()
    iid = state['incidents'][0]['id']; endpoint = '/api/incidents/telemetry'
    payload = dict(incident_id=iid, connected=True, safe_to_resume=False)
    assert state['telemetry'][0]['connected'] is False
    for field, value in [('connected', 'true'), ('safe_to_resume', 1), ('unknown', True)]:
        invalid = {**payload, field: value}
        assert client.post(endpoint, json=command(state, invalid)).status_code == 422
    missing = dict(payload); missing.pop('safe_to_resume')
    assert client.post(endpoint, json=command(state, missing)).status_code == 422
    assert client.post(endpoint, json=command(state, {**payload, 'incident_id': 'unknown'})).status_code == 409
    unsafe = command(state, payload)
    response = client.post(endpoint, json=unsafe)
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated['revision'] == state['revision'] + 1
    assert updated['printers'][0]['status'] == 'faulted'
    assert updated['telemetry'][0]['connected'] is True
    assert updated['orders'] == state['orders'] and updated['jobs'] == state['jobs']
    assert client.post(endpoint, json=unsafe).json() == updated
    changed_key = deepcopy(unsafe); changed_key['payload']['safe_to_resume'] = True
    assert client.post(endpoint, json=changed_key).status_code == 409
    assert client.post(endpoint, json=command(state, payload)).status_code == 409
    safe = command(updated, {**payload, 'safe_to_resume': True})
    response = client.post(endpoint, json=safe)
    assert response.status_code == 200, response.text
    cleared = response.json()
    assert cleared['printers'][0]['status'] == 'idle'
    assert cleared['incidents'][0]['resolution_source'] == 'printer_telemetry'
    assert cleared['orders'] == state['orders'] and cleared['jobs'] == state['jobs']
    assert client.post(endpoint, json=safe).json() == cleared
    assert client.post(endpoint, json=command(cleared, payload)).status_code == 409
    persisted = FactoryService(path).snapshot()
    assert persisted['incidents'] == cleared['incidents']
    assert persisted['incidents'][0]['actions'][-1]['action'] == 'printer_telemetry'
    assert client.post(endpoint, json=safe).status_code == 409


def test_physical_fault_signal_rejected_and_old_session_cannot_clear_reset_fault(tmp_path):
    client = TestClient(create_app(tmp_path / 'physical.sqlite3'))
    state = client.get('/api/state').json()
    state = client.post('/api/incidents/inject', json=command(state, dict(printer_id='printer-1', fault_type='thermal', event_id=str(uuid4())))).json()
    payload = dict(incident_id=state['incidents'][0]['id'], connected=True, safe_to_resume=True)
    old = command(state, payload)
    assert client.post('/api/incidents/telemetry', json=old).status_code == 409
    assert client.get('/api/state').json() == state
    cleared = client.post('/api/incidents/clear', json=command(state, dict(incident_id=payload['incident_id'], confirmed=True))).json()
    assert cleared['incidents'][0]['resolution_source'] == 'operator'
    reset = client.post('/api/scenarios/reset', json=command(cleared, dict(scenario='empty'))).json()
    assert client.post('/api/incidents/telemetry', json=old).status_code == 409
    assert client.get('/api/state').json() == reset

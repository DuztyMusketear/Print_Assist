from uuid import uuid4
from fastapi.testclient import TestClient
from print_assist.api import create_app


def test_model_approval_persists_and_becomes_orderable(tmp_path):
    path = tmp_path / 'modeling.sqlite3'
    with TestClient(create_app(path)) as client:
        def send(route, payload):
            state = client.get('/api/state').json()
            body = dict(session_id=state['session_id'], expected_revision=state['revision'],
                        idempotency_key=str(uuid4()), payload=payload)
            response = client.post(route, json=body)
            assert response.status_code == 200, response.text
            assert client.post(route, json=body).json() == response.json()
            return response.json()
        state = send('/api/modeling/tasks', dict(title='Planter', modelReference='planter.stl',
                     duration_seconds=3600, filament_grams=30, filament_type='PLA', color='blue', required_capabilities=['FFF'], visual_asset_id='example-tower'))
        task = state['modeling_tasks'][0]
        assert not any(a['name'] == 'Planter' for a in state['artifacts'])
        for action in ['prepare-supports', 'submit-review', 'approve']:
            state = send('/api/modeling/actions', dict(task_id=task['id'], action=action))
        artifact = next(a for a in state['artifacts'] if a['name'] == 'Planter')
        assert artifact['duration_seconds'] == 3600
        assert artifact['reference'] == 'planter.stl'
        assert artifact['visual_asset_id'] == 'example-tower'
    with TestClient(create_app(path)) as client:
        state = client.get('/api/state').json()
        assert state['modeling_tasks'][0]['stage'] == 'approved'
        body = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()),
                    payload=dict(artifact_id=artifact['id'], quantity=1, production_due='2026-11-20T12:00:00Z', ship_by='2026-11-21T12:00:00Z'))
        assert client.post('/api/orders', json=body).status_code == 201


def test_modeling_rejects_invalid_and_conflicting_changes(tmp_path):
    with TestClient(create_app(tmp_path / 'state.sqlite3')) as client:
        state = client.get('/api/state').json()
        envelope = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()))
        payload = dict(title='Model', modelReference='model.stl', duration_seconds=60, filament_grams=1,
                       filament_type='PLA', color='blue', required_capabilities=['FFF'])
        assert client.post('/api/modeling/tasks', json=dict(envelope, payload=dict(payload, duration_seconds=0))).status_code == 422
        assert client.post('/api/modeling/tasks', json=dict(envelope, payload=dict(payload, visual_asset_id='https://elsewhere.invalid/model.stl'))).status_code == 422
        assert state['visual_assets'][0]['path'] == '/models/example-tower.stl'
        assert client.post('/api/modeling/tasks', json=dict(envelope, session_id=str(uuid4()), payload=payload)).status_code == 409
        state = client.post('/api/modeling/tasks', json=dict(envelope, payload=payload)).json()
        task = state['modeling_tasks'][0]
        envelope.update(expected_revision=state['revision'], idempotency_key=str(uuid4()))
        assert client.post('/api/modeling/actions', json=dict(envelope,payload=dict(task_id='missing', action='approve'))).status_code == 409
        assert client.post('/api/modeling/actions', json=dict(envelope,payload=dict(task_id=task['id'], action='approve'))).status_code == 409
        for action in ['prepare-supports','submit-review','request-changes']:
            state = client.post('/api/modeling/actions', json=dict(envelope,payload=dict(task_id=task['id'], action=action))).json()
            envelope.update(expected_revision=state['revision'],idempotency_key=str(uuid4()))
        assert state['modeling_tasks'][0]['reviewOutcome'] == 'changes-requested'


def test_removed_visual_asset_does_not_break_persisted_task_snapshots(tmp_path, monkeypatch):
    from print_assist import visual_assets, contracts
    path=tmp_path/'removed-asset.sqlite3'
    with TestClient(create_app(path)) as client:
        state=client.get('/api/state').json()
        body=dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),
                  payload=dict(title='Saved part',modelReference='part.stl',duration_seconds=120,filament_grams=10,
                               filament_type='PLA',color='blue',required_capabilities=['FFF'],visual_asset_id='example-tower'))
        assert client.post('/api/modeling/tasks',json=body).status_code==200
    monkeypatch.setattr(visual_assets,'ASSETS',[])
    monkeypatch.setattr(contracts,'ASSETS',[])
    with TestClient(create_app(path)) as client:
        state=client.get('/api/state').json()
        assert state['visual_assets']==[]
        assert state['modeling_tasks'][0]['visual_asset_id']=='example-tower'
        body.update(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()))
        assert client.post('/api/modeling/tasks',json=body).status_code==422

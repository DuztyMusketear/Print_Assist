from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from print_assist.api import create_app
from print_assist.modeling import move_task


def support_assessment():
    return {'supports_required': True, 'support_reference': 'planter-supports.3mf',
            'support_material_grams': 4.5, 'removal_notes': 'Remove the supports below the handles after printing.'}


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
                     duration_seconds=3600, filament_grams=30, filament_type='PLA', color='blue', required_capabilities=['FFF']))
        task = state['modeling_tasks'][0]
        assert not any(a['name'] == 'Planter' for a in state['artifacts'])
        for action in ['prepare-supports', 'submit-review', 'approve']:
            payload = dict(task_id=task['id'], action=action)
            if action == 'submit-review':
                payload['support_assessment'] = support_assessment()
            state = send('/api/modeling/actions', payload)
        artifact = next(a for a in state['artifacts'] if a['name'] == 'Planter')
        assert artifact['duration_seconds'] == 3600
        assert artifact['reference'] == 'planter.stl'
    with TestClient(create_app(path)) as client:
        state = client.get('/api/state').json()
        assert state['modeling_tasks'][0]['stage'] == 'approved'
        body = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()),
                    payload=dict(artifact_id=artifact['id'], quantity=1, production_due='2026-11-20T12:00:00Z', ship_by='2026-11-21T12:00:00Z'))
        assert client.post('/api/orders', json=body).status_code == 201


def test_model_and_support_task_are_approved_and_stored_together(tmp_path):
    path = tmp_path / 'model-with-supports.sqlite3'
    assessment = support_assessment()
    with TestClient(create_app(path)) as client:
        def send(route, payload):
            state = client.get('/api/state').json()
            body = dict(session_id=state['session_id'], expected_revision=state['revision'],
                        idempotency_key=str(uuid4()), payload=payload)
            response = client.post(route, json=body)
            assert response.status_code == 200, response.text
            return response.json()

        state = send('/api/modeling/tasks', dict(title='Planter', modelReference='planter.stl',
            duration_seconds=3600, filament_grams=30, filament_type='PLA', color='blue',
            required_capabilities=['FFF']))
        task_id = state['modeling_tasks'][0]['id']
        state = send('/api/modeling/actions', dict(task_id=task_id, action='prepare-supports'))
        support_task = state['modeling_tasks'][0]['support_task']
        assert support_task['assessment_status'] == 'pending'
        state = send('/api/modeling/actions', dict(task_id=task_id, action='submit-review', support_assessment=assessment))
        support_task = state['modeling_tasks'][0]['support_task']
        assert support_task['supports_required'] is True
        assert support_task['support_reference'] == assessment['support_reference']
        assert support_task['id']
        state = send('/api/modeling/actions', dict(task_id=task_id, action='approve'))
        artifact = next(item for item in state['artifacts'] if item['name'] == 'Planter')
        assert artifact['reference'] == 'planter.stl'
        assert artifact['support_task'] == support_task

    with TestClient(create_app(path)) as client:
        artifact = next(item for item in client.get('/api/state').json()['artifacts'] if item['name'] == 'Planter')
        assert artifact['reference'] == 'planter.stl'
        assert artifact['support_task']['support_reference'] == assessment['support_reference']
        assert artifact['support_task']['removal_notes'] == assessment['removal_notes']


def test_model_without_supports_goes_directly_to_review_with_assessment(tmp_path):
    with TestClient(create_app(tmp_path / 'model-without-supports.sqlite3')) as client:
        state = client.get('/api/state').json()
        envelope = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()))
        task = client.post('/api/modeling/tasks', json=dict(envelope, payload=dict(
            title='Flat bracket', modelReference='bracket.stl', duration_seconds=1800, filament_grams=12,
            filament_type='PLA', color='gray', required_capabilities=['FFF']))).json()['modeling_tasks'][0]
        state = client.get('/api/state').json()
        envelope.update(expected_revision=state['revision'], idempotency_key=str(uuid4()))
        state = client.post('/api/modeling/actions', json=dict(envelope,
            payload=dict(task_id=task['id'], action='prepare-supports'))).json()
        state = client.get('/api/state').json()
        envelope.update(expected_revision=state['revision'], idempotency_key=str(uuid4()))
        result = client.post('/api/modeling/actions', json=dict(envelope,
            payload=dict(task_id=task['id'], action='submit-review',
                         support_assessment={'supports_required': False})))
        assert result.status_code == 200, result.text
        review = result.json()
        reviewed_task = review['modeling_tasks'][0]
        assert reviewed_task['stage'] == 'review'
        assert reviewed_task['support_task']['assessment_status'] == 'not-required'
        state = client.get('/api/state').json()
        envelope.update(expected_revision=state['revision'], idempotency_key=str(uuid4()))
        approved = client.post('/api/modeling/actions', json=dict(envelope,
            payload=dict(task_id=task['id'], action='approve'))).json()
        approved_task = approved['modeling_tasks'][0]
        artifact = next(item for item in approved['artifacts'] if item['name'] == 'Flat bracket')
        assert approved_task['stage'] == 'approved'
        assert artifact['support_task'] == approved_task['support_task']


def test_support_assessment_is_required_before_review(tmp_path):
    with TestClient(create_app(tmp_path / 'assessment-required.sqlite3')) as client:
        state = client.get('/api/state').json()
        envelope = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()))
        task = client.post('/api/modeling/tasks', json=dict(envelope, payload=dict(
            title='Planter', modelReference='planter.stl', duration_seconds=3600, filament_grams=30,
            filament_type='PLA', color='blue', required_capabilities=['FFF']))).json()['modeling_tasks'][0]
        state = client.get('/api/state').json()
        envelope.update(expected_revision=state['revision'], idempotency_key=str(uuid4()))
        assert client.post('/api/modeling/actions', json=dict(envelope,
            payload=dict(task_id=task['id'], action='prepare-supports'))).status_code == 200
        state = client.get('/api/state').json()
        envelope.update(expected_revision=state['revision'], idempotency_key=str(uuid4()))
        response = client.post('/api/modeling/actions', json=dict(envelope,
            payload=dict(task_id=task['id'], action='submit-review')))
        assert response.status_code == 409
        assert 'support assessment' in response.json()['detail'].lower()
        assert client.get('/api/state').json()['modeling_tasks'][0]['stage'] == 'supports'


@pytest.mark.parametrize('support_task', [None, {'id': 'support-1', 'assessment_status': 'ready-for-review'}])
def test_support_transition_rejects_missing_or_already_assessed_support_tasks(support_task):
    state = {'modeling_tasks': [{'id': 'model-1', 'title': 'Model', 'modelReference': 'model.stl',
        'stage': 'supports', 'support_task': support_task}], 'artifacts': [], 'orders': []}
    with pytest.raises(ValueError, match='support assessment'):
        move_task(state, {'task_id': 'model-1', 'action': 'submit-review',
                          'support_assessment': {'supports_required': True}})


def test_review_cannot_approve_without_a_completed_support_task():
    state = {'modeling_tasks': [{'id': 'model-1', 'title': 'Model', 'modelReference': 'model.stl',
        'stage': 'review', 'support_task': None}], 'artifacts': [], 'orders': []}
    with pytest.raises(ValueError, match='completed support assessment'):
        move_task(state, {'task_id': 'model-1', 'action': 'approve'})


def test_modeling_rejects_invalid_and_conflicting_changes(tmp_path):
    with TestClient(create_app(tmp_path / 'state.sqlite3')) as client:
        state = client.get('/api/state').json()
        envelope = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()))
        payload = dict(title='Model', modelReference='model.stl', duration_seconds=60, filament_grams=1,
                       filament_type='PLA', color='blue', required_capabilities=['FFF'])
        assert client.post('/api/modeling/tasks', json=dict(envelope, payload=dict(payload, duration_seconds=0))).status_code == 422
        assert client.post('/api/modeling/tasks', json=dict(envelope, session_id=str(uuid4()), payload=payload)).status_code == 409
        state = client.post('/api/modeling/tasks', json=dict(envelope, payload=payload)).json()
        task = state['modeling_tasks'][0]
        envelope.update(expected_revision=state['revision'], idempotency_key=str(uuid4()))
        assert client.post('/api/modeling/actions', json=dict(envelope,payload=dict(task_id='missing', action='approve'))).status_code == 409
        assert client.post('/api/modeling/actions', json=dict(envelope,payload=dict(task_id=task['id'], action='approve'))).status_code == 409
        for action in ['prepare-supports','submit-review','request-changes']:
            payload = dict(task_id=task['id'], action=action)
            if action == 'submit-review':
                payload['support_assessment'] = support_assessment()
            state = client.post('/api/modeling/actions', json=dict(envelope,payload=payload)).json()
            envelope.update(expected_revision=state['revision'],idempotency_key=str(uuid4()))
        assert state['modeling_tasks'][0]['reviewOutcome'] == 'changes-requested'
        assert state['modeling_tasks'][0]['support_task'] is None


def test_modeling_task_can_be_removed_and_persists(tmp_path):
    path = tmp_path / 'removable-model.sqlite3'
    with TestClient(create_app(path)) as client:
        state = client.get('/api/state').json()
        envelope = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()))
        task = client.post('/api/modeling/tasks', json=dict(envelope, payload=dict(
            title='Planter', modelReference='planter.stl', duration_seconds=3600, filament_grams=30,
            filament_type='PLA', color='blue', required_capabilities=['FFF']))).json()['modeling_tasks'][0]
        state = client.get('/api/state').json()
        removal = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()),
                       payload=dict(task_id=task['id'], action='remove'))
        response = client.post('/api/modeling/actions', json=removal)
        assert response.status_code == 200, response.text
        assert response.json()['modeling_tasks'] == []
        assert client.post('/api/modeling/actions', json=removal).json() == response.json()
    with TestClient(create_app(path)) as client:
        assert client.get('/api/state').json()['modeling_tasks'] == []


def test_removing_an_approved_task_removes_its_unused_artifact(tmp_path):
    with TestClient(create_app(tmp_path / 'approved-model.sqlite3')) as client:
        state = client.get('/api/state').json()
        payload = dict(title='Planter', modelReference='planter.stl', duration_seconds=3600, filament_grams=30,
                       filament_type='PLA', color='blue', required_capabilities=['FFF'])
        command = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()), payload=payload)
        task = client.post('/api/modeling/tasks', json=command).json()['modeling_tasks'][0]
        for action in ['prepare-supports', 'submit-review', 'approve']:
            state = client.get('/api/state').json()
            payload = dict(task_id=task['id'], action=action)
            if action == 'submit-review':
                payload['support_assessment'] = support_assessment()
            command = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()),
                           payload=payload)
            result = client.post('/api/modeling/actions', json=command)
            assert result.status_code == 200, result.text
        state = result.json()
        artifact_id = next(item['id'] for item in state['artifacts'] if item['name'] == 'Planter')
        removal = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()),
                       payload=dict(task_id=task['id'], action='remove'))
        removed = client.post('/api/modeling/actions', json=removal)
        assert removed.status_code == 200, removed.text
        assert removed.json()['modeling_tasks'] == []
        assert not any(item['id'] == artifact_id for item in removed.json()['artifacts'])


def test_approved_model_cannot_be_removed_after_an_order_uses_it(tmp_path):
    with TestClient(create_app(tmp_path / 'ordered-model.sqlite3')) as client:
        state = client.get('/api/state').json()
        payload = dict(title='Planter', modelReference='planter.stl', duration_seconds=3600, filament_grams=30,
                       filament_type='PLA', color='blue', required_capabilities=['FFF'])
        task = client.post('/api/modeling/tasks', json=dict(session_id=state['session_id'], expected_revision=state['revision'],
            idempotency_key=str(uuid4()), payload=payload)).json()['modeling_tasks'][0]
        for action in ['prepare-supports', 'submit-review', 'approve']:
            state = client.get('/api/state').json()
            payload = dict(task_id=task['id'], action=action)
            if action == 'submit-review':
                payload['support_assessment'] = support_assessment()
            client.post('/api/modeling/actions', json=dict(session_id=state['session_id'], expected_revision=state['revision'],
                idempotency_key=str(uuid4()), payload=payload))
        state = client.get('/api/state').json()
        artifact = next(item for item in state['artifacts'] if item['name'] == 'Planter')
        order = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()),
                     payload=dict(artifact_id=artifact['id'], quantity=1, production_due='2026-11-20T12:00:00Z', ship_by='2026-11-21T12:00:00Z'))
        assert client.post('/api/orders', json=order).status_code == 201
        state = client.get('/api/state').json()
        removal = dict(session_id=state['session_id'], expected_revision=state['revision'], idempotency_key=str(uuid4()),
                       payload=dict(task_id=task['id'], action='remove'))
        response = client.post('/api/modeling/actions', json=removal)
        assert response.status_code == 409
        assert client.get('/api/state').json()['modeling_tasks'][0]['id'] == task['id']

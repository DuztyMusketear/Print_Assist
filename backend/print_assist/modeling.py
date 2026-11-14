"""Validated operator-owned modeling workflow and production handoff."""
from copy import deepcopy
from uuid import uuid4


def create_task(state, payload):
    result = deepcopy(state)
    result.setdefault('modeling_tasks', []).append(dict(payload, id=str(uuid4()), stage='modeling'))
    return result


def move_task(state, payload):
    result = deepcopy(state)
    task = next((item for item in result.get('modeling_tasks', []) if item['id'] == payload['task_id']), None)
    if task is None:
        raise ValueError('Unknown modeling task')
    transitions = {('modeling', 'prepare-supports'): 'supports', ('supports', 'submit-review'): 'review',
                   ('review', 'approve'): 'approved', ('review', 'request-changes'): 'modeling'}
    stage = transitions.get((task['stage'], payload['action']))
    if stage is None:
        raise ValueError('Invalid modeling transition')
    task['stage'] = stage
    task['reviewOutcome'] = 'changes-requested' if payload['action'] == 'request-changes' else None
    if stage == 'approved':
        result['artifacts'].append(dict(id='model-'+task['id'], name=task['title'], revision=1,
            reference=task['modelReference'], duration_seconds=task['duration_seconds'],
            filament_grams=task['filament_grams'], filament_type=task['filament_type'],
            color=task['color'], required_capabilities=task['required_capabilities']))
    return result

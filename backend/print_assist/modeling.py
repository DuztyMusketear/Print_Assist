"""Validated operator-owned modeling workflow and production handoff."""
from copy import deepcopy
from uuid import uuid4


def initialize_support_tasks(state):
    """Return older unassessed tasks to Supports; preserve approved history."""
    for task in state.get('modeling_tasks', []):
        if task['stage'] in {'supports','review'} and not task.get('support_task'):
            task['stage']='supports'
            task['reviewOutcome']=None
            task['support_task']=dict(id=str(uuid4()),assessment_status='pending',supports_required=None,
                support_reference=None,support_material_grams=None,removal_notes=None)


def create_task(state, payload):
    from .visual_assets import ASSETS
    asset_id=payload.get('visual_asset_id')
    if asset_id is not None and not any(asset['id']==asset_id for asset in state.get('visual_assets',ASSETS)):
        raise ValueError('Unknown visual asset')
    result = deepcopy(state)
    result.setdefault('modeling_tasks', []).append(dict(payload, id=str(uuid4()), stage='modeling', support_task=None))
    return result


def move_task(state, payload):
    result = deepcopy(state)
    task = next((item for item in result.get('modeling_tasks', []) if item['id'] == payload['task_id']), None)
    if task is None:
        raise ValueError('Unknown modeling task')
    if payload['action'] == 'remove':
        if task['stage'] == 'approved':
            artifact_id = 'model-' + task['id']
            if any(order['artifact_id'] == artifact_id for order in result['orders']):
                raise ValueError('Cannot remove an approved model already used by an order')
            result['artifacts'] = [artifact for artifact in result['artifacts'] if artifact['id'] != artifact_id]
        result['modeling_tasks'] = [item for item in result['modeling_tasks'] if item['id'] != task['id']]
        return result
    action = payload['action']
    if action == 'prepare-supports' and task['stage'] == 'modeling':
        task['stage'] = 'supports'
        task['support_task'] = {
            'id': str(uuid4()), 'assessment_status': 'pending', 'supports_required': None,
            'support_reference': None, 'support_material_grams': None, 'removal_notes': None,
        }
        task['reviewOutcome'] = None
        return result
    if action == 'submit-review' and task['stage'] == 'supports':
        assessment = payload.get('support_assessment')
        support_task = task.get('support_task')
        if not support_task or support_task.get('assessment_status') != 'pending' or assessment is None:
            raise ValueError('Complete the support assessment before continuing')
        support_task.update(assessment)
        if assessment['supports_required']:
            support_task['assessment_status'] = 'ready-for-review'
        else:
            support_task['assessment_status'] = 'not-required'
        task['stage'] = 'review'
        task['reviewOutcome'] = None
    elif action == 'approve' and task['stage'] == 'review':
        if not task.get('support_task') or task['support_task'].get('assessment_status') not in {'ready-for-review', 'not-required'}:
            raise ValueError('A completed support assessment is required before approval')
        task['stage'] = 'approved'
        task['reviewOutcome'] = None
    elif action == 'request-changes' and task['stage'] == 'review':
        task['stage'] = 'modeling'
        task['support_task'] = None
        task['reviewOutcome'] = 'changes-requested'
    else:
        raise ValueError('Invalid modeling transition')
    if task['stage'] == 'approved':
        result['artifacts'].append(dict(id='model-'+task['id'], name=task['title'], revision=1,
            reference=task['modelReference'], duration_seconds=task['duration_seconds'],
            filament_grams=task['filament_grams'], filament_type=task['filament_type'],
            color=task['color'], required_capabilities=task['required_capabilities'],
            visual_asset_id=task.get('visual_asset_id'), support_task=deepcopy(task.get('support_task'))))
    return result

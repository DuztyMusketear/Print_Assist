from uuid import uuid4
from print_assist.service import FactoryService
from print_assist.contracts import ModelActionCommand


def test_upgrade_repairs_unassessed_support_review_tasks_without_touching_approved_history(tmp_path):
 path=tmp_path/'upgrade.sqlite3';service=FactoryService(path)
 with service.store.transaction() as db:
  state=service.store.load(db)
  base=dict(title='Legacy',modelReference='legacy.stl',duration_seconds=60,filament_grams=5,filament_type='PLA',color='blue',required_capabilities=['FFF'])
  state['modeling_tasks']=[dict(base,id=stage,stage=stage) for stage in ['supports','review','approved','modeling']]
  service.store.save(db,state)
 upgraded=FactoryService(path);state=upgraded.snapshot()
 assert [task['stage'] for task in state['modeling_tasks']]==['supports','supports','approved','modeling']
 for task in state['modeling_tasks'][:2]: assert task['support_task']['assessment_status']=='pending'
 task=state['modeling_tasks'][0]
 command=ModelActionCommand.model_validate(dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=dict(task_id=task['id'],action='submit-review',support_assessment=dict(supports_required=False))))
 assert upgraded.move_model_task(command)['modeling_tasks'][0]['stage']=='review'
 assert FactoryService(path).snapshot()['modeling_tasks'][0]['support_task']==upgraded.snapshot()['modeling_tasks'][0]['support_task']


def test_bundled_nist_model_flows_through_support_approval_into_default_printer(tmp_path):
 from fastapi.testclient import TestClient
 from print_assist.api import create_app
 with TestClient(create_app(tmp_path/'nist.sqlite3')) as client:
  def send(path,payload):
   state=client.get('/api/state').json()
   response=client.post(path,json=dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=payload))
   assert response.status_code==200,response.text
   return response.json()
  state=send('/api/modeling/tasks',dict(title='NIST',modelReference='/demo-models/nist-test-artifact.stl',duration_seconds=7200,filament_grams=35,filament_type='PLA',color='blue',required_capabilities=['FFF'],visual_asset_id='nist-test-artifact'))
  task=state['modeling_tasks'][0]['id'];send('/api/modeling/actions',dict(task_id=task,action='prepare-supports'))
  send('/api/modeling/actions',dict(task_id=task,action='submit-review',support_assessment=dict(supports_required=False)))
  state=send('/api/modeling/actions',dict(task_id=task,action='approve'))
  artifact=state['artifacts'][-1];assert artifact['support_task']['assessment_status']=='not-required'
  state=send('/api/orders/plan',dict(mode='automatic',order=dict(artifact_id=artifact['id'],quantity=1,production_due='2026-11-20T00:00:00Z',ship_by='2026-11-21T00:00:00Z')))
  assert state['jobs'][0]['status']=='running' and state['running']
  assert state['artifacts'][-1]['visual_asset_id']=='nist-test-artifact'

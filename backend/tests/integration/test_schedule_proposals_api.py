from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from print_assist.api import create_app

def envelope(state,payload):
 return dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=payload)

def test_preview_apply_stale_replay_and_reservations(tmp_path):
 with TestClient(create_app(tmp_path/'state.sqlite3')) as client:
  state=client.get('/api/state').json()
  state=client.post('/api/scenarios/reset',json=envelope(state,dict(scenario='seeded'))).json()
  proposal=client.get('/api/schedule/proposal').json()
  assert client.get('/api/state').json()==state
  command=envelope(state,dict(proposal_id=proposal['id'],mode='automatic'))
  applied=client.post('/api/schedule/apply',json=command)
  assert applied.status_code==200,applied.text
  applied=applied.json()
  assert sum(r['reserved_grams'] for r in applied['material_reservations'])==125
  assert client.post('/api/schedule/apply',json=command).json()==applied
  assert client.post('/api/schedule/apply',json=envelope(applied,dict(proposal_id=proposal['id'],mode='automatic'))).status_code==409
  assert client.get('/api/schedule/proposal?mode=wrong').status_code==422
  newer=client.post('/api/scenarios/reset',json=envelope(applied,dict(scenario='empty'))).json()
  assert client.post('/api/schedule/apply',json=command).status_code==409
  assert client.get('/api/state').json()==newer

def test_competing_applies_commit_reservations_once(tmp_path):
 from print_assist.service import FactoryService
 from print_assist.contracts import ResetCommand,ApplyScheduleCommand
 service=FactoryService(tmp_path/'state.sqlite3')
 state=service.reset(ResetCommand.model_validate(envelope(service.snapshot(),dict(scenario='seeded'))))
 proposal=service.proposal('manual')
 commands=[ApplyScheduleCommand.model_validate(envelope(state,dict(proposal_id=proposal['id'],mode='manual'))) for _ in range(2)]
 def apply(command):
  try: service.apply_schedule(command);return True
  except ValueError:return False
 with ThreadPoolExecutor(2) as pool: assert sum(pool.map(apply,commands))==1
 assert len(service.snapshot()['jobs'])==5

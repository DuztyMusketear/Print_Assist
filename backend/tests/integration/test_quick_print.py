from uuid import uuid4
from fastapi.testclient import TestClient
from print_assist.api import create_app


def test_quick_print_is_atomic_replay_safe_and_respects_manual_mode(tmp_path):
 with TestClient(create_app(tmp_path/'state.sqlite3')) as client:
  state=client.get('/api/state').json()
  def command(state,mode,artifact='figure-pla-blue'):
   return dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=dict(mode=mode,order=dict(artifact_id=artifact,quantity=2,priority=0,production_due='2026-11-20T00:00:00Z',ship_by='2026-11-21T00:00:00Z')))
  request=command(state,'manual')
  response=client.post('/api/orders/plan',json=request)
  assert response.status_code==200,response.text
  planned=response.json()
  assert not planned['running'] and len(planned['jobs'])==2
  assert all(job['status']=='pending' for job in planned['jobs'])
  assert client.post('/api/orders/plan',json=request).json()==planned
  assert client.post('/api/orders/plan',json=command(planned,'automatic','missing')).status_code==409
  assert client.get('/api/state').json()==planned
  planned=client.post('/api/clock',json=envelope_clock(planned)).json()
  automatic=client.post('/api/orders/plan',json=command(planned,'automatic')).json()
  assert automatic['orders'][0]['schedule_mode']=='manual'
  assert automatic['clock_speed']==60
  assert automatic['running'] and len(automatic['orders'])==2
  assert any(job['status']=='running' for job in automatic['jobs'])
  assert not automatic['controls']['agents_enabled']


def envelope_clock(state):
 return dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=dict(running=False,speed=300))


def test_review_first_orders_cannot_start_or_reserve_before_apply(tmp_path):
 with TestClient(create_app(tmp_path/'review.sqlite3')) as client:
  state=client.get('/api/state').json()
  request=dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=dict(review_only=True,mode='automatic',order=dict(artifact_id='figure-pla-blue',quantity=2,priority=0,production_due='2026-11-20T00:00:00Z',ship_by='2026-11-21T00:00:00Z')))
  response=client.post('/api/orders/plan',json=request)
  assert response.status_code==200,response.text
  state=response.json();assert state['jobs']==[]
  advanced=client.post('/api/advance',json=dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=dict(seconds=3600))).json()
  assert advanced['jobs']==[] and sum(r['reserved_grams'] for r in advanced['material_reservations'])==0
  proposal=client.get('/api/schedule/proposal').json();assert len(proposal['assignments'])==2
  applied=client.post('/api/schedule/apply',json=dict(session_id=advanced['session_id'],expected_revision=advanced['revision'],idempotency_key=str(uuid4()),payload=dict(proposal_id=proposal['id'],mode='automatic'))).json()
  assert len(applied['jobs'])==2 and applied['running']

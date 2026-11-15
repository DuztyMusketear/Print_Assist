from copy import deepcopy
from print_assist.scenarios import scenario_state


def test_proposal_plans_future_capacity_without_mutating_or_double_reserving():
 from print_assist.proposals import propose,apply_proposal
 from print_assist.reservations import ledger
 from print_assist.simulation import advance
 state=scenario_state('seeded');original=deepcopy(state)
 proposal=propose(state,'automatic')
 assert state==original and len(proposal['assignments'])==5
 assert proposal==propose(state,'automatic')
 assert proposal['assignments'][3]['start']=='2026-11-15T02:00:00+00:00'
 planned=apply_proposal(state,proposal['id'],'automatic')
 assert len(planned['jobs'])==5
 assert sum(row['reserved_grams'] for row in ledger(planned))==125
 assert all(p['material']['grams']==1000 for p in planned['printers'])
 done=advance(planned,14400)
 assert all(o['quantity']==o['successful_quantity'] for o in done['orders'])
 assert sum(row['reserved_grams'] for row in ledger(done))==0
 assert sum(p['material']['grams'] for p in done['printers'])==2875


def test_manual_proposal_keeps_future_attempts_pending_until_user_starts():
 from print_assist.proposals import propose,apply_proposal
 from print_assist.scheduling import start_job
 from print_assist.simulation import advance
 state=scenario_state('seeded');p=propose(state,'manual')
 state=apply_proposal(state,p['id'],'manual')
 assert [j['status'] for j in state['jobs']].count('pending')==3
 for job in list(state['jobs']):
  if job['status']=='pending': state=start_job(state,job['id'])
 state=advance(state,7200)
 assert sum(o['successful_quantity'] for o in state['orders'])==3
 assert [j['status'] for j in state['jobs']].count('pending')==2


def test_proposal_reports_shortages_and_excludes_held_equipment():
 from print_assist.proposals import propose,apply_proposal
 from print_assist.scheduling import schedule
 import pytest
 state=scenario_state('seeded');state['printers'][0]['material']['grams']=25
 state['printers'][1]['status']='offline';state['printers'][2]['material']['type']='PETG'
 result=propose(state,'automatic')
 assert len(result['assignments'])==1 and sum(b['quantity'] for b in result['blocked'])==4
 state=schedule(scenario_state('seeded'),'manual')
 empty=propose(state,'automatic');assert empty['assignments']==[]
 with pytest.raises(ValueError,match='No feasible'): apply_proposal(state,empty['id'],'automatic')
 with pytest.raises(ValueError,match='stale'): apply_proposal(state,'wrong','automatic')
 state=schedule(scenario_state('seeded'))
 future=propose(state,'automatic');assert future['assignments'][0]['start']=='2026-11-15T02:00:00+00:00'
 state['printers'][0]['status']='offline'
 assert all(a['printer_id']!='printer-1' for a in propose(state,'automatic')['assignments'])
 planned=apply_proposal(scenario_state('seeded'),propose(scenario_state('seeded'),'automatic')['id'],'automatic')
 assert propose(planned,'automatic')['assignments']==[]


def test_forecast_does_not_skip_a_manual_slot_ahead_of_automatic_work():
 from print_assist.proposals import propose,apply_proposal
 from print_assist.scheduling import schedule,start_job
 from print_assist.monitoring import project
 from print_assist.simulation import advance
 state=scenario_state('seeded');state['printers']=state['printers'][:1];base=state['orders'][0];state['orders']=[dict(base,id='a',quantity=1)]
 state=schedule(state)
 state['orders'].append(dict(base,id='b',quantity=1))
 state=apply_proposal(state,propose(state,'manual')['id'],'manual')
 state['orders'].append(dict(base,id='c',quantity=1))
 state=apply_proposal(state,propose(state,'automatic')['id'],'automatic')
 forecast=next(f for f in project(state)['forecasts'] if f['order_id']=='c')
 assert forecast['completion'] is None
 state=advance(state,7200);assert state['jobs'][1]['status']=='pending' and state['jobs'][2]['status']=='planned'
 state=start_job(state,state['jobs'][1]['id']);state=advance(state,7200)
 assert state['jobs'][2]['status']=='running'


def test_offline_and_paused_work_keep_future_filament_committed():
 from print_assist.proposals import propose,apply_proposal
 from print_assist.controls import control_printer
 from print_assist.reservations import ledger
 from print_assist.simulation import advance
 state=scenario_state('seeded');state['printers']=state['printers'][:1];state['printers'][0]['material']['grams']=100
 state=apply_proposal(state,propose(state,'automatic')['id'],'automatic')
 assert ledger(state)[0]['reserved_grams']==100 and ledger(state)[0]['available_grams']==0
 state=control_printer(state,'printer-1','offline');state=advance(state,7200)
 assert ledger(state)[0]['reserved_grams']==100 and state['printers'][0]['material']['grams']==100
 state=control_printer(state,'printer-1','online')
 assert state['printers'][0]['status']=='running'
 assert len([j for j in state['jobs'] if j['status']=='failed'])==1
 state=advance(state,28800)
 assert ledger(state)[0]['reserved_grams']==0 and state['printers'][0]['material']['grams']==0
 assert sum(o['successful_quantity'] for o in state['orders'])==4


def test_partial_review_keeps_unassigned_copies_held_and_apply_honors_playback():
 from print_assist.proposals import propose,apply_proposal
 from print_assist.controls import control_printer
 state=scenario_state('seeded');state['orders']=state['orders'][:1];state['orders'][0].update(quantity=2,requires_schedule_review=True)
 state['printers'][0]['material']['grams']=25
 for printer in state['printers'][1:]:printer['status']='offline'
 p=propose(state,'automatic');assert len(p['assignments'])==1
 state=apply_proposal(state,p['id'],'automatic',1)
 assert state['clock_speed']==1 and state['orders'][0]['requires_schedule_review']
 state=control_printer(state,'printer-2','online');assert len(state['jobs'])==1
 next_plan=propose(state,'automatic');assert len(next_plan['assignments'])==1
 state=apply_proposal(state,next_plan['id'],'automatic',60)
 assert not state['orders'][0]['requires_schedule_review'] and len(state['jobs'])==2

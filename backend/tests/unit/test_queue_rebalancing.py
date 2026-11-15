"""Returning healthy capacity takes approved queued work without restarting active parts."""
from copy import deepcopy
import pytest
from print_assist.scenarios import scenario_state
from print_assist.scheduling import schedule
from print_assist.controls import control_printer
from print_assist.proposals import propose, apply_proposal
from print_assist.monitoring import project
from print_assist.simulation import advance


def queued():
    state=scenario_state('seeded')
    state['orders']=state['orders'][:1]
    state['orders'][0]['quantity']=6
    return apply_proposal(state,propose(state,'automatic')['id'],'automatic')


@pytest.mark.parametrize('away,back',[('pause','resume'),('offline','online')])
def test_returned_printer_takes_queued_work_and_preserves_active_parts(away,back):
    state=advance(queued(),1800)
    state=control_printer(state,'printer-1',away)
    active=deepcopy([job for job in state['jobs'] if job['status']=='running'])
    before=deepcopy(state)
    result=control_printer(state,'printer-1',back)
    assert state==before
    assert result['printers'][0]['status']=='running'
    restored=next(job for job in result['jobs'] if job['printer_id']=='printer-1' and job['status']=='running')
    assert restored['id'] in {job['id'] for job in state['jobs'] if job['status']=='planned'}
    assert restored['elapsed_seconds']==0
    assert [job for job in result['jobs'] if job['id'] in {row['id'] for row in active}]==active
    assert len(result['jobs'])==len(state['jobs'])
    assert result['workload_transfers'][-1]['action']=='rebalance'
    assert result['workload_transfers'][-1]['waste_grams']==0
    done=advance(result,36000)
    assert done['orders'][0]['successful_quantity']==6


def test_rejoining_capacity_takes_soonest_deadline_before_higher_priority():
    state=queued()
    state=control_printer(state,'printer-1','offline')
    original=state['orders'][0]
    state['orders'].append(dict(original,id='urgent',quantity=1,priority=0,production_due='2026-11-15T01:00:00Z'))
    future=[job for job in state['jobs'] if job['status']=='planned']
    future[-1]['order_id']='urgent'
    original['quantity']-=1
    original['priority']=10
    result=control_printer(state,'printer-1','online')
    assert next(job for job in result['jobs'] if job['printer_id']=='printer-1' and job['status']=='running')['order_id']=='urgent'
    assert project(result)['forecasts'][0]['order_id']=='urgent'


def test_initial_dispatch_and_proposals_use_deadline_then_priority():
    state=scenario_state('empty')
    template=dict(artifact_id='figure-pla-blue',quantity=1,successful_quantity=0,status='queued')
    state['orders']=[dict(template,id='later',priority=10,production_due='2026-11-15T12:00:00Z'),
                     dict(template,id='sooner-low',priority=0,production_due='2026-11-15T03:00:00Z'),
                     dict(template,id='sooner-high',priority=2,production_due='2026-11-15T03:00:00Z')]
    expected=['sooner-high','sooner-low','later']
    assert [job['order_id'] for job in schedule(state)['jobs']]==expected
    assert [row['order_id'] for row in propose(state,'automatic')['assignments']]==expected
    assert [row['order_id'] for row in project(state)['forecasts']]==expected


@pytest.mark.parametrize('change',[
    {'status':'offline'}, {'status':'paused'}, {'status':'faulted'},
    {'fault':{'type':'thermal'}}, {'capabilities':[]},
    {'material':dict(type='PETG',color='blue',grams=1000)},
    {'material':dict(type='PLA',color='red',grams=1000)},
    {'material':dict(type='PLA',color='blue',grams=0)},
])
def test_unhealthy_or_incompatible_idle_capacity_cannot_take_queued_work(change):
    from print_assist.queue_rebalancing import rebalance_queues
    state=control_printer(queued(),'printer-1','offline')
    state['printers'][0].update(status='idle')
    state['printers'][0].update(change)
    assert rebalance_queues(state)==state


@pytest.mark.parametrize('status,mode,elapsed',[
    ('pending','manual',0),('planned','manual',0),('recovery_pending','automatic',0),
    ('paused','automatic',0),('planned','automatic',30),
])
def test_rebalancing_preserves_manual_incident_and_partially_started_attempts(status,mode,elapsed):
    from print_assist.queue_rebalancing import rebalance_queues
    state=queued()
    state['printers'][0]['status']='idle'
    state['jobs']=[dict(state['jobs'][-1],printer_id='printer-2',status=status,schedule_mode=mode,elapsed_seconds=elapsed)]
    assert rebalance_queues(state)==state


def test_completed_and_cancelled_work_and_manual_destination_reservations_stay_fixed():
    from print_assist.queue_rebalancing import rebalance_queues
    state=queued()
    state['printers'][0]['status']='idle'
    state['jobs']=[dict(state['jobs'][-1],printer_id='printer-2')]
    state['orders'][0]['status']='cancelled'
    assert rebalance_queues(state)==state
    state['orders'][0]['status']='queued'
    state['jobs'].append(dict(state['jobs'][0],id='manual-hold',printer_id='printer-1',schedule_mode='manual'))
    assert rebalance_queues(state)==state


def test_approved_recovery_attempt_can_rebalance_without_releasing_sibling_incident_hold():
    state=control_printer(queued(),'printer-1','offline')
    planned=next(job for job in state['jobs'] if job['status']=='planned')
    planned['recovery_incident_id']='historical-approved'
    state['orders'][0]['recovery_holds']=['unrelated-held-part']
    result=control_printer(state,'printer-1','online')
    assert result['printers'][0]['status']=='running'
    assert result['orders'][0]['recovery_holds']==['unrelated-held-part']
    assert len(result['jobs'])==len(state['jobs'])



def test_forecast_and_impact_project_queued_jobs_in_dispatch_deadline_order():
    from print_assist.schedule_impact import capture_schedule
    state=queued()
    later=state['orders'][0]
    state['orders'].append(dict(later,id='early',quantity=1,priority=0,production_due='2026-11-15T03:00:00Z'))
    later['quantity']-=1
    early=state['jobs'][-1]
    early.update(order_id='early',printer_id='printer-1',estimated_start='2026-11-15T20:00:00Z')
    other=state['jobs'][-2]
    other['printer_id']='printer-1'
    forecasts={row['order_id']:row for row in project(state)['forecasts']}
    assert forecasts['early']['completion']=='2026-11-15T04:00:00+00:00'
    snapshot=next(job for job in capture_schedule(state)['jobs'] if job['id']==early['id'])
    assert snapshot['finish']=='2026-11-15T04:00:00+00:00'


@pytest.mark.parametrize('away,back',[('pause','resume'),('offline','online')])
def test_returned_printer_receives_a_balanced_future_backlog_from_queue_tails(away,back):
    state=scenario_state('seeded')
    state['orders']=state['orders'][:1]
    state['orders'][0]['quantity']=15
    state=apply_proposal(state,propose(state,'automatic')['id'],'automatic')
    state=advance(state,1800)
    state=control_printer(state,'printer-1',away)
    active=deepcopy([j for j in state['jobs'] if j['status']=='running'])
    result=control_printer(state,'printer-1',back)
    counts=[sum(j['printer_id']==p['id'] and j['status'] in {'running','planned'} for j in result['jobs']) for p in result['printers']]
    assert min(counts)>=4 and max(counts)-min(counts)<=1
    assert sum(j['printer_id']=='printer-1' and j['status']=='planned' for j in result['jobs'])>=3
    assert [j for j in result['jobs'] if j['id'] in {a['id'] for a in active}]==active
    assert len(result['jobs'])==len(state['jobs'])
    assert advance(result,50000)['orders'][0]['successful_quantity']==15



def test_backlog_replan_rolls_back_every_reservation_if_complete_pool_no_longer_fits():
    from print_assist.queue_rebalancing import rebalance_queues
    state=queued()
    state['printers'].append(dict(id='extra-idle',status='idle',capabilities=[],material=dict(type='PETG',color='red',grams=0)))
    for printer in state['printers'][:3]:printer['material']['grams']=1
    before=deepcopy(state)
    assert rebalance_queues(state)==before
    assert state==before



def test_backlog_keeps_restricted_parts_stock_reserved_when_generic_work_can_move_elsewhere():
    state=scenario_state('empty')
    artifact=state['artifacts'][0]
    state['artifacts'].append(dict(artifact,id='special',required_capabilities=['FFF','X']))
    template=dict(quantity=1,successful_quantity=0,status='queued',priority=0,schedule_mode='automatic')
    state['orders']=[dict(template,id='generic',artifact_id=artifact['id'],quantity=4,production_due='2026-11-15T03:00:00Z'),dict(template,id='special',artifact_id='special',production_due='2026-11-15T04:00:00Z')]
    state['printers'][0]['material']['grams']=25
    state['printers'][1].update(status='running');state['printers'][1]['material']['grams']=75
    state['printers'][2].update(status='running',capabilities=['FFF','X']);state['printers'][2]['material']['grams']=50
    job=dict(order_id='generic',duration_seconds=7200,elapsed_seconds=0,schedule_mode='automatic')
    state['jobs']=[dict(job,id='active-2',printer_id='printer-2',status='running'),dict(job,id='active-3',printer_id='printer-3',status='running',elapsed_seconds=7190),dict(job,id='generic-1',printer_id='printer-2',status='planned'),dict(job,id='generic-2',printer_id='printer-2',status='planned'),dict(job,id='special-1',order_id='special',printer_id='printer-3',status='planned')]
    result=schedule(state,'automatic',preserve_mode=True)
    assert result['printers'][0]['status']=='running'
    assert next(j for j in result['jobs'] if j['id']=='special-1')['printer_id']=='printer-3'
    assert len(result['jobs'])==len(state['jobs'])
    assert result['jobs'][:2]==state['jobs'][:2]

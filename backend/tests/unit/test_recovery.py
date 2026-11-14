from copy import deepcopy
import pytest
from print_assist.scenarios import scenario_state
from print_assist.scheduling import schedule
from print_assist.simulation import advance
from print_assist.incidents import inject_fault


def faulted():
    state = schedule(scenario_state('seeded'))
    state = advance(state, 360)
    return inject_fault(state, dict(printer_id=state['printers'][0]['id'], fault_type='nozzle_clog', event_id='event'))


def test_recovery_preview_and_full_retry_preserve_healthy_work():
    from print_assist.recovery import propose_recovery, apply_recovery
    state = faulted(); before = deepcopy(state); incident = state['incidents'][0]
    proposal = propose_recovery(state, incident['id'])
    assert state == before
    assert proposal['assignments'][0]['duration_seconds'] == 7200
    assert len(proposal['impacts']) == 2
    result = apply_recovery(state, dict(incident_id=incident['id'], proposal_id=proposal['id'], confirmed=True))
    assert [j for j in result['jobs'] if j['status']=='running'] == [j for j in state['jobs'] if j['status']=='running']
    replacement = next(j for j in result['jobs'] if j.get('replaces_job_id'))
    assert replacement['part_key'] == incident['job_ids'][0]
    assert replacement['elapsed_seconds'] == 0
    assert result['orders'][0]['successful_quantity'] == 0
    assert result['printers'][0]['status'] == 'faulted'
    assert result['incidents'][0]['applied']['orders']


def test_shared_order_incidents_release_only_owned_hold():
    from print_assist.recovery import propose_recovery, apply_recovery
    state = faulted()
    state = inject_fault(state, dict(printer_id=state['printers'][1]['id'],fault_type='thermal',event_id='two'))
    first, second = state['incidents']
    proposal = propose_recovery(state, first['id'])
    assert proposal['impacts'][0]['revised_completion'] is None
    result = apply_recovery(state,dict(incident_id=first['id'],proposal_id=proposal['id'],confirmed=True))
    assert result['orders'][0]['recovery_holds'] == [second['id']]


def test_recovery_revalidates_stock_and_reject_retains_hold():
    from print_assist.recovery import propose_recovery, apply_recovery, reject_recovery, clear_fault
    state = faulted(); incident=state['incidents'][0]
    proposal=propose_recovery(state,incident['id'])
    changed=deepcopy(state); changed['printers'][1]['material']['grams']=0
    with pytest.raises(ValueError,match='stale'):
        apply_recovery(changed,dict(incident_id=incident['id'],proposal_id=proposal['id'],confirmed=True))
    rejected=reject_recovery(state,dict(incident_id=incident['id'],confirmed=True))
    assert rejected['orders'][0]['recovery_holds']==[incident['id']]
    cleared=clear_fault(rejected,dict(incident_id=incident['id'],confirmed=True))
    assert cleared['printers'][0]['status']=='idle'
    assert cleared['orders'][0]['recovery_holds']==[incident['id']]


def test_runout_boundary_does_not_rollback_other_printers():
    state=schedule(scenario_state('seeded'))
    state['printers'][0]['material']['grams']=1.25
    result=advance(state,7200)
    assert result['printers'][0]['status']=='faulted'
    assert result['printers'][0]['material']['grams']==0
    assert len(result['incidents'])==1
    assert result['orders'][0]['successful_quantity']==2
    assert result['incidents'][0]['waste_grams']==pytest.approx(1.25)


def test_partial_recovery_can_be_completed_after_refill():
    from print_assist.recovery import propose_recovery, apply_recovery, clear_fault
    state=schedule(scenario_state('seeded'))
    # Queue a second approved part on the soon-to-fail printer.
    job=deepcopy(state['jobs'][0]);job.update(id='queued-part',status='planned',schedule_mode='automatic')
    state['jobs'].append(job)
    state=inject_fault(state,dict(printer_id=state['printers'][0]['id'],fault_type='thermal',event_id='partial'))
    iid=state['incidents'][0]['id']
    for printer in state['printers'][1:]:printer['material']['grams']=25
    # Active work reserves all stock; one spare part fits after a partial spool refill.
    state['printers'][1]['material']['grams']=50
    proposal=propose_recovery(state,iid)
    assert len(proposal['assignments'])==1 and len(proposal['blocked'])==1
    state=apply_recovery(state,dict(incident_id=iid,proposal_id=proposal['id'],confirmed=True))
    assert state['orders'][0]['recovery_holds']==[iid]
    state=clear_fault(state,dict(incident_id=iid,confirmed=True))
    proposal=propose_recovery(state,iid)
    state=apply_recovery(state,dict(incident_id=iid,proposal_id=proposal['id'],confirmed=True))
    assert state['orders'][0]['recovery_holds']==[]
    assert len([j for j in state['jobs'] if j.get('replaces_job_id')])==1
    assert next(j for j in state['jobs'] if j['id']=='queued-part')['status'] in {'running','planned'}


def test_part_comparison_links_failed_attempt_to_full_duration_replacement():
    from print_assist.recovery import propose_recovery
    state=faulted(); proposal=propose_recovery(state,state['incidents'][0]['id'])
    part=next(p for p in proposal['part_impacts'] if p['action']=='restarted')
    assert part['original_finish'] is not None
    assert part['revised_finish'] is not None
    assert part['original_printer']!=part['revised_printer']
    assert part['duration_seconds']==7200


def test_recovery_dispatch_obeys_reviewed_queue_sequence():
    from print_assist.recovery import propose_recovery, apply_recovery
    state=faulted(); lower=deepcopy(state['jobs'][0])
    lower.update(id='healthy-queued',order_id=state['orders'][1]['id'],printer_id=state['printers'][1]['id'],status='planned',schedule_mode='automatic',elapsed_seconds=0)
    lower.pop('incident_id');state['jobs'].insert(0,lower)
    state['printers'][2]['status']='paused';state['jobs'][-1]['status']='paused'
    proposal=propose_recovery(state,state['incidents'][0]['id'])
    lower_impact=next(i for i in proposal['impacts'] if i['order_id']==state['orders'][1]['id'])
    assert lower_impact['change']=='indirect'
    assert lower_impact['delta_seconds']>0
    state=apply_recovery(state,dict(incident_id=state['incidents'][0]['id'],proposal_id=proposal['id'],confirmed=True))
    state=advance(state,6840)
    # High priority replacement gets the first free slot, despite older list insertion.
    replacement=next(j for j in state['jobs'] if j.get('replaces_job_id'))
    assert replacement['status']=='running'


def test_recovery_reports_progress_and_keeps_applied_comparison_immutable():
    from print_assist.recovery import propose_recovery, apply_recovery, clear_fault
    state=faulted(); iid=state['incidents'][0]['id']; proposal=propose_recovery(state,iid)
    state=apply_recovery(state,dict(incident_id=iid,proposal_id=proposal['id'],confirmed=True))
    applied=deepcopy(state['incidents'][0]['applied'])
    assert 'recovering' in state['incidents'][0]['summary']
    assert proposal['mitigations']
    state=advance(state,21600)
    assert state['incidents'][0]['status']=='production_restored'
    assert state['incidents'][0]['progress']['remaining']==0
    assert state['incidents'][0]['applied']==applied
    state=clear_fault(state,dict(incident_id=iid,confirmed=True))
    assert state['incidents'][0]['status']=='resolved'
    assert 'resolved' in state['incidents'][0]['summary']


@pytest.mark.parametrize('restriction',['manual','late','blocked','other_hold'])
def test_automatic_policy_escalates_uncertain_or_late_plans(restriction):
    from print_assist.recovery import set_recovery_policy, automatic_recovery
    state=faulted();state=set_recovery_policy(state,dict(mode='automatic'))
    if restriction=='manual':state['orders'][0]['schedule_mode']='manual'
    if restriction=='late':state['orders'][0]['production_due']='2026-11-15T00:00:01Z'
    if restriction=='blocked':
        for p in state['printers'][1:]:p['material']['grams']=0
    if restriction=='other_hold':state['orders'][0]['recovery_holds'].append('other')
    result=automatic_recovery(state,state['incidents'][0]['id'])
    assert result==state


def test_opt_in_automatic_policy_restores_production_without_repairing_equipment():
    from print_assist.recovery import set_recovery_policy
    state=schedule(scenario_state('seeded'))
    state=set_recovery_policy(state,dict(mode='automatic'))
    result=inject_fault(state,dict(printer_id=state['printers'][0]['id'],fault_type='thermal',event_id='auto'))
    assert result['incidents'][0]['status']=='recovering'
    assert result['printers'][0]['status']=='faulted'
    assert result['orders'][0]['recovery_holds']==[]


def test_no_feasible_capacity_confirmation_and_clearance_are_guarded():
    from print_assist.recovery import propose_recovery, apply_recovery, clear_fault, set_recovery_policy
    state=faulted();iid=state['incidents'][0]['id']
    for p in state['printers'][1:]:p['capabilities']=[]
    proposal=propose_recovery(state,iid)
    assert proposal['assignments']==[]
    with pytest.raises(ValueError,match='No feasible'):
        apply_recovery(state,dict(incident_id=iid,proposal_id=proposal['id'],confirmed=True))
    with pytest.raises(ValueError,match='positive'):
        clear_fault(state,dict(incident_id=iid,confirmed=True,refill_grams=0))
    state=clear_fault(state,dict(incident_id=iid,confirmed=True,refill_grams=100))
    with pytest.raises(ValueError,match='current equipment'):
        clear_fault(state,dict(incident_id=iid,confirmed=True))
    with pytest.raises(ValueError,match='policy'):
        set_recovery_policy(state,dict(mode='other'))


def test_healthy_manual_queue_is_moved_without_automatic_start():
    from print_assist.recovery import propose_recovery,apply_recovery
    state=schedule(scenario_state('seeded'),'manual')
    state=inject_fault(state,dict(printer_id=state['printers'][0]['id'],fault_type='thermal',event_id='manual'))
    proposal=propose_recovery(state,state['incidents'][0]['id'])
    assert all(a['action']=='moved' for a in proposal['assignments'])
    result=apply_recovery(state,dict(incident_id=proposal['incident_id'],proposal_id=proposal['id'],confirmed=True))
    assert not any(j['status']=='running' for j in result['jobs'])
    assert all(o['schedule_mode']=='manual' for o in result['orders'] if o.get('schedule_mode'))


def test_healthy_queue_reservations_are_preserved_when_replacement_competes_for_stock():
    from print_assist.recovery import propose_recovery
    state=faulted();job=deepcopy(state['jobs'][0]);job.update(id='queue',order_id=state['orders'][1]['id'],
        printer_id=state['printers'][1]['id'],status='planned',elapsed_seconds=0,schedule_mode='automatic')
    job.pop('incident_id');state['jobs'].append(job)
    state['printers'][1]['material']['grams']=48.75
    state['printers'][2]['status']='paused';state['jobs'][2]['status']='paused'
    proposal=propose_recovery(state,state['incidents'][0]['id'])
    assert not proposal['assignments']
    assert proposal['blocked']
    assert next(j for j in proposal['revised']['jobs'] if j['id']=='queue')['status']=='planned'


def test_completed_part_evidence_includes_recorded_completion():
    from print_assist.schedule_impact import capture_schedule
    state=advance(schedule(scenario_state('seeded')),7200)
    captured=capture_schedule(state)
    completed=[j for j in captured['jobs'] if j['status']=='completed']
    assert all(j['finish']=='2026-11-15T02:00:00+00:00' for j in completed)
    state['events']=[]
    assert all(j['finish'] is None for j in capture_schedule(state)['jobs'] if j['status']=='completed')


def test_idle_fault_clearance_resolves_without_production_work():
    from print_assist.recovery import clear_fault
    state=inject_fault(scenario_state('empty'),dict(printer_id='printer-1',fault_type='thermal',event_id='idle'))
    state=clear_fault(state,dict(incident_id=state['incidents'][0]['id'],confirmed=True))
    assert state['incidents'][0]['status']=='resolved'


def test_schedule_evidence_includes_every_required_unallocated_part():
    from print_assist.schedule_impact import capture_schedule
    state=schedule(scenario_state('seeded'))
    captured=capture_schedule(state)
    assert len(captured['jobs'])==sum(o['quantity'] for o in state['orders'])
    missing=[j for j in captured['jobs'] if j['status']=='unassigned']
    assert len(missing)==2
    assert all(j['start'] is None and j['finish'] is None and j['printer_id'] is None for j in missing)
    state['orders'][1]['status']='cancelled'
    assert not any(j['order_id']==state['orders'][1]['id'] for j in capture_schedule(state)['jobs'])


def test_unassigned_required_parts_are_distinct_from_blocked_incident_parts():
    from print_assist.recovery import propose_recovery
    state=faulted()
    proposal=propose_recovery(state,state['incidents'][0]['id'])
    assert not proposal['blocked']
    unassigned=[p for p in proposal['part_impacts'] if ':unassigned:' in p['part_key']]
    assert unassigned and all(p['action']=='unassigned' for p in unassigned)
    for printer in state['printers'][1:]:printer['capabilities']=[]
    blocked=propose_recovery(state,state['incidents'][0]['id'])
    assert any(p['action']=='blocked' for p in blocked['part_impacts'] if ':unassigned:' not in p['part_key'])

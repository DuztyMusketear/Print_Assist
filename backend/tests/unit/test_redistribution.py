"""Approved work survives ordinary equipment unavailability without fake resumes."""
from copy import deepcopy

import pytest

from print_assist.controls import control_printer
from print_assist.scenarios import initial_state
from print_assist.scheduling import schedule
from print_assist.simulation import advance


def working(quantity=1, mode='automatic'):
    state = initial_state()
    state['orders'] = [dict(id='order', artifact_id='figure-pla-blue', quantity=quantity,
        successful_quantity=0, status='queued', priority=1,
        production_due='2026-11-15T03:00:00Z')]
    return schedule(state, mode)


@pytest.mark.parametrize('action', ['pause', 'offline'])
def test_interrupted_part_restarts_in_full_on_healthy_printer_and_records_waste(action):
    state = advance(working(), 3600)
    before = deepcopy(state)
    result = control_printer(state, 'printer-1', action)
    assert state == before
    failed, retry = result['jobs']
    assert failed['status'] == 'failed' and failed['waste_grams'] == 12.5
    assert retry['printer_id'] == 'printer-2' and retry['elapsed_seconds'] == 0
    assert retry['part_key'] == failed['part_key'] == failed['id']
    assert retry['replaces_job_id'] == failed['id']
    assert result['printers'][0]['material']['grams'] == 987.5
    assert not result.get('incidents')
    report = result['workload_transfers'][-1]
    assert report['waste_grams'] == 12.5 and not report['blocked']
    assert report['part_impacts'][0]['action'] == 'restarted'
    assert report['impacts'][0]['risk'] == 'on_time'
    assert report['impacts'][0]['delta_seconds'] == 3600
    assert advance(result, 7200)['orders'][0]['successful_quantity'] == 1


def test_active_healthy_jobs_stay_put_and_retry_queues_behind_them_with_late_eta():
    state = advance(working(3), 3600)
    result = control_printer(state, 'printer-1', 'offline')
    assert result['jobs'][1:3] == state['jobs'][1:3]
    retry = result['jobs'][-1]
    assert retry['status'] == 'planned' and retry['printer_id'] == 'printer-2'
    assert retry['estimated_finish'] == '2026-11-15T04:00:00+00:00'
    assert result['workload_transfers'][-1]['impacts'][0]['risk'] == 'late'
    finished = advance(result, 10800)
    assert finished['orders'][0]['successful_quantity'] == 3
    assert len(finished['jobs']) == 4


def test_manual_unstarted_work_moves_same_identity_without_consumption_or_automatic_start():
    state = working(mode='manual')
    result = control_printer(state, 'printer-1', 'pause')
    assert len(result['jobs']) == 1
    assert result['jobs'][0]['id'] == state['jobs'][0]['id']
    assert result['jobs'][0]['printer_id'] == 'printer-2'
    assert result['jobs'][0]['status'] == 'pending'
    assert result['workload_transfers'][-1]['waste_grams'] == 0


def test_no_capacity_keeps_one_explicit_blocked_part_then_retries_when_equipment_returns():
    state = working()
    state['printers'][1]['status'] = 'faulted'
    state['printers'][2]['status'] = 'offline'
    result = control_printer(state, 'printer-1', 'pause')
    assert result['workload_transfers'][-1]['blocked'][0]['job_id'] == result['jobs'][-1]['id']
    assert result['jobs'][-1]['workload_transfer_pending']
    assert len(schedule(result)['jobs']) == 2
    restored = control_printer(result, 'printer-3', 'online')
    assert restored['jobs'][-1]['printer_id'] == 'printer-3'
    assert restored['jobs'][-1]['status'] == 'running'
    assert len(restored['jobs']) == 2
    assert restored['workload_transfers'][-1]['source_printer'] == 'printer-1'


def test_existing_future_queue_stock_and_completed_work_are_preserved():
    from print_assist.proposals import propose, apply_proposal
    state = working(3)
    state['orders'][0]['quantity'] = 4
    proposal = propose(state, 'automatic')
    state = apply_proposal(state, proposal['id'], 'automatic')
    # Printer 1 already has a future part. Both of its unfinished parts move.
    completed = dict(id='historic', order_id='order', printer_id='printer-1',
        status='completed', elapsed_seconds=7200, duration_seconds=7200)
    state['jobs'].append(completed)
    state['orders'][0]['quantity'] = 5
    state['orders'][0]['successful_quantity'] = 1
    state['events'].append(dict(type='job_completed', timestamp=state['simulation_time'], job_id='historic'))
    state['printers'][1]['material']['grams'] = 50
    result = control_printer(state, 'printer-1', 'offline')
    assert next(j for j in result['jobs'] if j['id'] == 'historic') == completed
    assert result['jobs'][3]['id'] == state['jobs'][3]['id']
    assert result['jobs'][3]['printer_id'] != 'printer-1'
    assert len(result['jobs']) == 6
    assert len([j for j in result['jobs'] if j['status'] in {'running', 'planned'}]) == 4
    report = result['workload_transfers'][-1]
    assert next(p for p in report['part_impacts'] if p['part_key'] == 'historic')['action'] == 'preserved'


@pytest.mark.parametrize('hold', ['requires_schedule_review', 'recovery_holds', 'cancelled'])
def test_deferred_approved_part_preserves_other_order_holds_and_cancelled_work_stays_blocked(hold):
    state = working()
    state['printers'][1]['status'] = state['printers'][2]['status'] = 'offline'
    state = control_printer(state, 'printer-1', 'offline')
    if hold == 'cancelled':
        state['orders'][0]['status'] = 'cancelled'
    else:
        state['orders'][0][hold] = ['incident'] if hold == 'recovery_holds' else True
    result = control_printer(state, 'printer-2', 'online')
    if hold == 'cancelled':
        assert result['jobs'][-1]['workload_transfer_pending']
        assert not any(j['status'] == 'running' for j in result['jobs'])
    else:
        assert result['jobs'][-1]['status'] == 'running'
        assert result['orders'][0][hold] == state['orders'][0][hold]
        assert len(result['jobs']) == 2


def test_incident_owned_work_is_never_transferred_by_normal_controls():
    state = working(mode='manual')
    state['jobs'][0].update(incident_id='held', status='recovery_pending')
    state['orders'][0]['recovery_holds'] = ['held']
    result = control_printer(state, 'printer-1', 'offline')
    assert result['jobs'] == state['jobs']
    assert not result.get('workload_transfers')


@pytest.mark.parametrize('action', ['pause', 'offline'])
def test_approved_recovery_is_transferred_despite_metadata_and_other_incident_hold(action):
    from print_assist.incidents import inject_fault
    from print_assist.recovery import propose_recovery, apply_recovery, clear_fault
    state = working(2)
    for pid in ['printer-1', 'printer-2']:
        state = inject_fault(state, dict(printer_id=pid, fault_type='thermal', event_id=pid))
    first, second = state['incidents']
    proposal = propose_recovery(state, first['id'])
    state = apply_recovery(state, dict(incident_id=first['id'], proposal_id=proposal['id'], confirmed=True))
    state = advance(state, 3600)
    state = clear_fault(state, dict(incident_id=first['id'], confirmed=True))
    recovered = next(j for j in state['jobs'] if j['status'] == 'running')
    held = deepcopy(next(j for j in state['jobs'] if j.get('incident_id') == second['id']))
    result = control_printer(state, recovered['printer_id'], action)
    interrupted = next(j for j in result['jobs'] if j['id'] == recovered['id'])
    assert interrupted['status'] == 'failed' and interrupted['waste_grams'] == 12.5
    retry = result['jobs'][-1]
    assert retry['printer_id'] == 'printer-1' and retry['elapsed_seconds'] == 0
    assert retry['part_key'] == recovered['part_key']
    assert retry['replaces_job_id'] == recovered['id']
    assert next(j for j in result['jobs'] if j['id'] == held['id']) == held
    assert result['orders'][0]['recovery_holds'] == [second['id']]
    assert len(result['incidents']) == 2
    finished = advance(result, 7200)
    assert finished['orders'][0]['successful_quantity'] == 1
    assert len(finished['jobs']) == 4
    assert next(j for j in finished['jobs'] if j['id'] == held['id']) == held


def test_manual_future_queue_blocks_automatic_transfer_eta_until_user_starts_queue():
    state = working(2)
    state['orders'].append(dict(state['orders'][0], id='manual', quantity=1, schedule_mode='manual'))
    state['jobs'].append(dict(id='manual-1', order_id='manual', printer_id='printer-2',
        status='planned', elapsed_seconds=0, duration_seconds=7200, schedule_mode='manual'))
    state['printers'][2]['status'] = 'offline'
    result = control_printer(state, 'printer-1', 'offline')
    assert result['jobs'][-1]['workload_transfer_pending']
    report = result['workload_transfers'][-1]
    part = next(p for p in report['part_impacts'] if p['part_key'] == state['jobs'][0]['id'])
    assert part['revised_finish'] is None and part['risk'] == 'unavailable'
    assert report['blocked']


@pytest.mark.parametrize('other_transfer', [False, True])
def test_fault_on_blocked_transfer_never_reapproves_incident_owned_retry(other_transfer):
    from print_assist.incidents import inject_fault
    state = working()
    state['printers'][1]['status'] = state['printers'][2]['status'] = 'offline'
    state = control_printer(state, 'printer-1', 'pause')
    state = inject_fault(state, dict(printer_id='printer-1', fault_type='thermal', event_id='blocked-fault'))
    held = deepcopy(state['jobs'][-1])
    assert held['status'] == 'recovery_pending' and held['workload_transfer_pending']
    if other_transfer:
        # Another legitimate approved transfer still runs through planning;
        # its planning copy must retain this incident-owned flagged attempt.
        state['orders'].append(dict(state['orders'][0], id='other', recovery_holds=[]))
        state['jobs'].append(dict(id='other-1', order_id='other', printer_id='printer-3',
            part_key='other-1', status='paused', elapsed_seconds=0, duration_seconds=7200,
            schedule_mode='automatic', workload_transfer_pending=True, transfer_source='printer-3'))
    result = control_printer(state, 'printer-2', 'online')
    assert next(j for j in result['jobs'] if j['id'] == held['id']) == held
    assert result['orders'][0]['recovery_holds'] == state['orders'][0]['recovery_holds']
    assert len(result['jobs']) == len(state['jobs'])
    assert result['incidents'] == state['incidents']
    if other_transfer:
        assert result['jobs'][-1]['status'] == 'running'
        assert result['jobs'][-1]['order_id'] == 'other'
    else:
        assert result['workload_transfers'] == state['workload_transfers']


def test_deadline_then_priority_controls_transferred_queue_with_limited_stock():
    state = working()
    state['jobs'][0]['status'] = 'planned'
    state['jobs'][0]['schedule_mode'] = 'automatic'
    state['printers'][0]['status'] = 'reserved'
    for oid, priority, due in [('later', 2, '2026-11-15T05:00:00Z'), ('earlier', 2, '2026-11-15T04:00:00Z')]:
        state['orders'].append(dict(state['orders'][0], id=oid, priority=priority, production_due=due))
        state['jobs'].append(dict(state['jobs'][0], id=oid+'-1', order_id=oid))
    state['printers'][1]['material']['grams'] = 50
    state['printers'][2]['material']['color'] = 'red'
    result = control_printer(state, 'printer-1', 'pause')
    assert result['jobs'][0]['status'] == 'running'
    assert next(j for j in result['jobs'] if j['order_id'] == 'earlier')['status'] == 'planned'
    assert next(j for j in result['jobs'] if j['order_id'] == 'later')['workload_transfer_pending']
    assert result['workload_transfers'][-1]['blocked'][0]['order_id'] == 'later'

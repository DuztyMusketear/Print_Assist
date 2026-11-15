from copy import deepcopy
import pytest
from print_assist.scenarios import scenario_state
from print_assist.proposals import propose, apply_proposal


def test_targeted_proposal_reviews_only_selected_order_and_reserves_existing_work():
    state = scenario_state('seeded')
    for row in state['orders']:
        row['requires_schedule_review'] = True
    target = state['orders'][1]['id']
    before = deepcopy(state)
    plan = propose(state, 'automatic', order_ids=[target])
    assert state == before
    assert {item['order_id'] for item in plan['assignments']} == {target}
    result = apply_proposal(state, plan['id'], 'automatic', order_ids=[target])
    assert result['orders'][0]['requires_schedule_review']
    assert not result['orders'][1]['requires_schedule_review']
    assert len(result['jobs']) == 1
    assert propose(state, 'automatic', order_ids=[])['assignments'] == []
    with pytest.raises(ValueError, match='stale'):
        apply_proposal(state, plan['id'], 'automatic')


def test_end_to_end_intake_only_confirms_new_order_and_completes(order):
    from print_assist.order_demo import simulate_automatic_order, refresh_order_demonstrations
    from print_assist.simulation import advance
    state = scenario_state('seeded')
    for row in state['orders']:
        row['requires_schedule_review'] = True
    before = deepcopy(state)
    result = simulate_automatic_order(state, {**order, 'mode':'end_to_end', 'quantity':4})
    assert state == before
    assert result['running'] and result['clock_speed'] == 3600
    demonstration = result['order_demonstrations'][0]
    assert demonstration['status'] == 'running'
    assert len(result['jobs']) == 4
    assert all(job['order_id'] == demonstration['order_id'] for job in result['jobs'])
    assert all(row['requires_schedule_review'] for row in result['orders'][:2])
    assert result['shop_requests'][-1]['status'] == 'accepted'
    assert result['orders'][-1]['quantity'] == 4
    assert result['orders'][-1]['production_due'] == order['production_due']
    assert [step['status'] for step in demonstration['steps']] == ['completed'] * 3 + ['running', 'pending']
    done = refresh_order_demonstrations(advance(result,14400))
    assert done['order_demonstrations'][0]['status'] == 'completed'
    assert all(step['status'] == 'completed' for step in done['order_demonstrations'][0]['steps'])
    assert refresh_order_demonstrations(done) == done


@pytest.mark.parametrize('change,reason', [
    ({'artifact_id':None}, 'saved model'),
    ({'quantity':200}, 'filament'),
    ({'production_due':'2026-11-15T00:00:01Z'}, 'deadline'),
])
def test_unsafe_intake_stays_visible_held_and_does_not_autostart(order, change, reason):
    from print_assist.order_demo import simulate_automatic_order, refresh_order_demonstrations
    result = simulate_automatic_order(scenario_state('empty'), {**order, 'mode':'end_to_end', **change})
    demo = result['order_demonstrations'][0]
    assert demo['status'] == 'needs_attention' and reason in demo['reason']
    assert result['shop_requests'] and not result['jobs'] and not result['running']
    assert not result['orders'] or result['orders'][0]['requires_schedule_review']
    assert refresh_order_demonstrations(result) == result


def test_demo_tracks_waiting_then_printing_and_unavailable_equipment(order):
    from print_assist.order_demo import simulate_automatic_order, refresh_order_demonstrations
    from print_assist.simulation import advance
    state = scenario_state('empty')
    state['printers'] = state['printers'][:1]
    first = simulate_automatic_order(state, {**order, 'quantity':1, 'mode':'end_to_end', 'clock_speed':60})
    second = simulate_automatic_order(first, {**order, 'quantity':1, 'mode':'end_to_end'})
    assert second['order_demonstrations'][1]['steps'][3]['status'] == 'pending'
    running = refresh_order_demonstrations(advance(second,7200))
    assert running['order_demonstrations'][1]['steps'][3]['status'] == 'running'
    running['printers'][0]['status'] = 'offline'
    held = refresh_order_demonstrations(running)
    assert held['order_demonstrations'][1]['status'] == 'needs_attention'
    assert 'unavailable' in held['order_demonstrations'][1]['reason']
    held['printers'][0]['status'] = 'running'
    resumed = refresh_order_demonstrations(held)
    assert resumed['order_demonstrations'][1]['status'] == 'running'
    assert 'reason' not in resumed['order_demonstrations'][1]


@pytest.mark.parametrize('status',['offline','paused','faulted'])
def test_demo_never_uses_unavailable_printer(order,status):
    from print_assist.order_demo import simulate_automatic_order
    state = scenario_state('empty')
    for printer in state['printers']:
        printer['status'] = status
    result = simulate_automatic_order(state, {**order, 'mode':'end_to_end'})
    assert result['order_demonstrations'][0]['status'] == 'needs_attention'
    assert not result['jobs']


def test_refresh_empty_and_cancelled_or_missing_orders(order):
    from print_assist.order_demo import simulate_automatic_order, refresh_order_demonstrations
    state = scenario_state('empty')
    assert refresh_order_demonstrations(state) == state
    result = simulate_automatic_order(state,{**order, 'mode':'end_to_end'})
    result['orders'][0]['status'] = 'cancelled'
    assert refresh_order_demonstrations(result)['order_demonstrations'][0]['status'] == 'needs_attention'
    result['orders'] = []
    assert refresh_order_demonstrations(result)['order_demonstrations'][0]['status'] == 'needs_attention'

def test_manual_queue_cannot_be_automatically_promised(order):
    from print_assist.order_demo import simulate_automatic_order
    from print_assist.scheduling import schedule
    state = scenario_state('seeded')
    state['orders'] = [dict(state['orders'][0], quantity=1)]
    state['printers'] = state['printers'][:1]
    state = schedule(state,'automatic')
    state['orders'].append(dict(state['orders'][0],id='manual',successful_quantity=0))
    state = apply_proposal(state,propose(state,'manual')['id'],'manual')
    result = simulate_automatic_order(state,{**order,'mode':'end_to_end'})
    assert result['order_demonstrations'][0]['status'] == 'needs_attention'
    assert 'capacity' in result['order_demonstrations'][0]['reason']
    assert len(result['jobs']) == len(state['jobs'])


def test_demo_activity_uses_supported_event_status(order):
    from print_assist.order_demo import simulate_automatic_order
    result = simulate_automatic_order(scenario_state('empty'), {**order,'mode':'end_to_end'})
    assert result['events'][-1]['status'] == 'accepted'


def test_automatic_intake_uses_healthy_alternative_to_manual_queue(order):
    from print_assist.order_demo import simulate_automatic_order
    from print_assist.scheduling import schedule
    state = scenario_state('seeded')
    state['orders'] = [dict(state['orders'][0], quantity=1)]
    state = schedule(state,'automatic')
    state['jobs'][0]['elapsed_seconds'] = 3600
    state['orders'].append(dict(state['orders'][0],id='manual',successful_quantity=0))
    state = apply_proposal(state,propose(state,'manual')['id'],'manual')
    manual = next(job for job in state['jobs'] if job['order_id'] == 'manual')
    manual.update(printer_id='printer-1', status='planned')
    state['printers'][1]['status'] = 'idle'
    state['printers'][2]['status'] = 'offline'
    before = deepcopy(state['jobs'])
    result = simulate_automatic_order(state,{**order,'quantity':3,'production_due':'2026-11-15T12:00:00Z','mode':'end_to_end'})
    assert result['order_demonstrations'][0]['status'] == 'running'
    assert result['jobs'][:2] == before
    assert len(result['jobs'][2:]) == 3
    assert {job['printer_id'] for job in result['jobs'][2:]} == {'printer-2'}


def test_urgent_automatic_intake_replans_approved_future_queues_preserving_active_jobs(order):
    from print_assist.order_demo import simulate_automatic_order
    from print_assist.proposals import propose,apply_proposal
    state=scenario_state('seeded')
    state['orders']=state['orders'][:1]
    state['orders'][0]['quantity']=15
    state=apply_proposal(state,propose(state,'automatic')['id'],'automatic')
    active=deepcopy([j for j in state['jobs'] if j['status']=='running'])
    old_ids={j['id'] for j in state['jobs']}
    result=simulate_automatic_order(state,{**order,'quantity':1,'priority':10,'production_due':'2026-11-15T05:00:00Z','mode':'end_to_end'})
    demo=result['order_demonstrations'][-1]
    assert demo['status']=='running'
    urgent=next(j for j in result['jobs'] if j['order_id']==demo['order_id'])
    assert urgent['estimated_finish']=='2026-11-15T04:00:00+00:00'
    assert {j['id'] for j in result['jobs']}>=old_ids and len(result['jobs'])==16
    assert [j for j in result['jobs'] if j['status']=='running']==active



@pytest.mark.parametrize('grams',[50,1])
def test_new_automatic_order_cannot_displace_approved_parts_when_total_filament_is_short(order,grams):
    from print_assist.order_demo import simulate_automatic_order
    state=scenario_state('seeded')
    state['orders']=state['orders'][:1]
    state['orders'][0]['quantity']=6
    state=apply_proposal(state,propose(state,'automatic')['id'],'automatic')
    for printer in state['printers']:printer['material']['grams']=grams
    before=deepcopy(state['jobs'])
    result=simulate_automatic_order(state,{**order,'quantity':1,'priority':10,'production_due':'2026-11-15T05:00:00Z','mode':'end_to_end'})
    assert result['order_demonstrations'][-1]['status']=='needs_attention'
    assert result['jobs']==before
    assert result['orders'][-1]['requires_schedule_review']

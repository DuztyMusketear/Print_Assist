from copy import deepcopy

import pytest

from print_assist.scenarios import initial_state, scenario_state


@pytest.mark.parametrize('count', [1, 3, 4])
def test_fault_demo_preserves_fleet_and_starts_real_approved_queues(count):
    fleet = [deepcopy(initial_state()['printers'][0]) for _ in range(count)]
    for index, printer in enumerate(fleet):
        printer.update(id=f'custom-{index}', status='faulted', fault={'type': 'thermal'})
        printer['material'].update(color='red' if index % 2 else 'blue', grams=0)
    before = deepcopy(fleet)
    state = scenario_state('fault-demo', fleet)
    assert fleet == before
    assert [p['id'] for p in state['printers']] == [p['id'] for p in fleet]
    assert all(p['status'] == 'running' and not p.get('fault') for p in state['printers'])
    assert all(p['material']['grams'] == 1000 for p in state['printers'])
    assert len([j for j in state['jobs'] if j['status'] == 'running']) == count
    assert len(state['jobs']) == count * 4
    assert len([j for j in state['jobs'] if j['status'] == 'planned']) == count * 3
    assert state['recovery_policy'] == 'automatic'
    assert state['running'] is False
    assert state['controls'] == {'agents_enabled': False, 'automatic_triggers': False}
    assert all(task['stage'] == 'approved' for task in state['modeling_tasks'])
    assert all(order['artifact_id'] in {a['id'] for a in state['artifacts']} for order in state['orders'])
    assert all('sample' in task['title'].lower() for task in state['modeling_tasks'])


@pytest.mark.parametrize('fleet', [[], [dict(id='resin', status='offline', capabilities=['SLA'], material=dict(type='resin', color='white', grams=0))]])
def test_fault_demo_reports_no_compatible_capacity_without_invalid_jobs(fleet):
    state = scenario_state('fault-demo', fleet)
    assert state['printers'] == [dict(p, status='idle', material=dict(p['material'], grams=1000)) for p in fleet]
    assert state['jobs'] == []
    assert any(e['status'] == 'blocked' and 'FFF' in e['message'] for e in state['events'])


def test_existing_scenarios_ignore_supplied_fleet_and_remain_idle():
    for name in ['empty', 'seeded']:
        state = scenario_state(name, [])
        assert state['printers'] == initial_state()['printers']
        assert state['jobs'] == []
    with pytest.raises(ValueError, match='Unknown scenario'):
        scenario_state('unknown')


def test_default_demo_and_mixed_technology_fleet_report_incompatible_printer():
    assert len(scenario_state('fault-demo')['printers']) == 3
    fleet = initial_state()['printers']
    fleet[0]['capabilities'] = ['SLA']
    state = scenario_state('fault-demo', fleet)
    assert [p['status'] for p in state['printers']] == ['idle', 'running', 'running']
    assert len(state['jobs']) == 8
    assert any(e['type'] == 'fault_demo_warning' for e in state['events'])


@pytest.mark.parametrize('target_index', [0, 1, 2])
def test_demo_recovers_any_active_printer_without_disturbing_healthy_work(target_index):
    from print_assist.incidents import inject_fault
    from print_assist.recovery import clear_fault
    from print_assist.simulation import advance

    state = scenario_state('fault-demo')
    before = deepcopy(state)
    target = state['printers'][target_index]['id']
    healthy = [j for j in state['jobs'] if j['status'] == 'running' and j['printer_id'] != target]
    original = state
    state = inject_fault(state, dict(printer_id=target, fault_type='thermal', event_id='demo-fault'))
    assert original == before
    assert all(j in state['jobs'] for j in healthy)
    incident = state['incidents'][0]
    assert incident['applied']
    assert all(j['printer_id'] != target for j in state['jobs'] if j['status'] in {'running', 'planned'})
    state = clear_fault(state, dict(incident_id=incident['id'], confirmed=True))
    state = advance(state, 86400)
    assert sum(o['successful_quantity'] for o in state['orders']) == 12
    assert not any(j['status'] in {'running', 'planned', 'recovery_pending'} for j in state['jobs'])

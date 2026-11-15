from copy import deepcopy

import pytest

from print_assist.incidents import inject_fault
from print_assist.monitoring import project
from print_assist.recovery import clear_fault
from print_assist.scenarios import scenario_state
from print_assist.scheduling import schedule


def faulted(fault='network_disconnect', busy=True):
    state = scenario_state('seeded' if busy else 'empty')
    if busy:
        state = schedule(state)
    return inject_fault(state, dict(printer_id='printer-1', fault_type=fault, event_id='signal'))


@pytest.mark.parametrize('connected,safe', [(False, False), (False, True), (True, False), (True, True)])
def test_network_signal_only_clears_safe_current_equipment_without_releasing_work(connected, safe):
    from print_assist.recovery import update_incident_telemetry
    state = faulted(); before = deepcopy(state); iid = state['incidents'][0]['id']
    result = update_incident_telemetry(state, dict(incident_id=iid, connected=connected, safe_to_resume=safe))
    assert state == before
    assert result['jobs'] == before['jobs']
    assert result['orders'] == before['orders']
    incident = result['incidents'][0]
    assert incident['telemetry']['connected'] is connected
    assert incident['telemetry']['safe_to_resume'] is safe
    assert project(result)['telemetry'][0]['connected'] is connected
    assert result['printers'][0]['status'] == ('idle' if connected and safe else 'faulted')
    assert incident.get('equipment_cleared', False) is (connected and safe)
    assert incident['actions'][-1]['action'] == 'printer_telemetry'
    assert incident['actions'][-1]['outcome']
    if connected and safe:
        assert incident['resolution_source'] == 'printer_telemetry'
        assert incident['progress']['held'] is True


@pytest.mark.parametrize('fault', ['thermal', 'nozzle_clog', 'filament_runout', 'insufficient_material'])
def test_physical_fault_requires_operator_confirmation_and_refill(fault):
    from print_assist.recovery import update_incident_telemetry
    state = faulted(fault); before = deepcopy(state); iid = state['incidents'][0]['id']
    with pytest.raises(ValueError, match='operator'):
        update_incident_telemetry(state, dict(incident_id=iid, connected=True, safe_to_resume=True))
    assert state == before
    result = clear_fault(state, dict(incident_id=iid, confirmed=True, refill_grams=100))
    assert result['incidents'][0]['resolution_source'] == 'operator'
    assert result['orders'] == before['orders']


def test_idle_reconnection_resolves_but_rejects_unknown_or_superseded_incident():
    from print_assist.recovery import update_incident_telemetry
    state = faulted(busy=False); iid = state['incidents'][0]['id']
    payload = dict(incident_id=iid, connected=True, safe_to_resume=True)
    with pytest.raises(ValueError, match='Unknown incident'):
        update_incident_telemetry(state, {**payload, 'incident_id': 'unknown'})
    result = update_incident_telemetry(state, payload)
    assert result['incidents'][0]['status'] == 'resolved'
    result = inject_fault(result, dict(printer_id='printer-1', fault_type='thermal', event_id='second'))
    with pytest.raises(ValueError, match='current equipment'):
        update_incident_telemetry(result, payload)
    assert project(result)['telemetry'][0]['connected'] is True


def test_manual_network_clear_updates_report_and_live_connection():
    state = faulted(); iid = state['incidents'][0]['id']
    result = clear_fault(state, dict(incident_id=iid, confirmed=True))
    assert result['incidents'][0]['telemetry']['connected'] is True
    assert project(result)['telemetry'][0]['connected'] is True
    assert result['incidents'][0]['resolution_source'] == 'operator'


@pytest.mark.parametrize('fault,cleared,connected', [('network_disconnect', False, False), ('network_disconnect', True, True), ('thermal', False, True)])
@pytest.mark.parametrize('telemetry', [None, {}])
def test_legacy_reports_without_connection_telemetry_have_safe_defaults(fault, cleared, connected, telemetry):
    state = faulted(fault)
    incident = state['incidents'][0]
    incident['equipment_cleared'] = cleared
    incident.pop('telemetry')
    if telemetry is not None:
        incident['telemetry'] = telemetry
    assert project(state)['telemetry'][0]['connected'] is connected

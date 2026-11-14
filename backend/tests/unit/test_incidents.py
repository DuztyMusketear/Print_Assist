from copy import deepcopy
from uuid import uuid4

import pytest

from print_assist.scenarios import scenario_state
from print_assist.scheduling import schedule
from print_assist.simulation import advance


@pytest.mark.parametrize('kind',['thermal','filament_runout','network_disconnect','nozzle_clog','insufficient_material'])
def test_fault_isolation_preserves_healthy_work_and_waste(kind):
    from print_assist.incidents import inject_fault
    state=advance(schedule(scenario_state('seeded')),1800)
    original=deepcopy(state)
    payload={'printer_id':'printer-1','fault_type':kind,'event_id':str(uuid4())}
    result=inject_fault(state,payload)
    assert state==original
    assert result['printers'][0]['status']=='faulted'
    assert result['jobs'][0]['status']=='failed'
    assert result['incidents'][0]['waste_grams']==6.25
    evidence=result['incidents'][0]
    assert evidence['telemetry']['nozzle_c']==25
    if kind=='thermal': assert evidence['trigger_telemetry']['nozzle_c']==350
    if kind=='network_disconnect': assert not evidence['telemetry']['connected']
    if kind=='filament_runout':
        assert result['printers'][0]['material']['grams']==0
        assert evidence['inventory_adjustment_grams']==-original['printers'][0]['material']['grams']
    assert result['jobs'][1]==state['jobs'][1]
    assert result['orders'][0]['successful_quantity']==state['orders'][0]['successful_quantity']
    assert inject_fault(result,payload)==result
    with pytest.raises(ValueError):
        inject_fault(result,{**payload,'event_id':str(uuid4())})


def test_fault_holds_cannot_be_bypassed_by_normal_scheduling():
    from print_assist.incidents import inject_fault
    from print_assist.proposals import propose
    state=schedule(scenario_state('seeded'))
    result=inject_fault(state,{'printer_id':'printer-1','fault_type':'thermal','event_id':str(uuid4())})
    incident=result['incidents'][0]
    assert incident['before']['orders']
    later=advance(result,7200)
    assert later['jobs'][0]['status']=='failed'
    assert not any(j['printer_id']=='printer-1' and j['status']=='running' for j in later['jobs'])
    held=incident['order_ids']
    assert not any(a['order_id'] in held for a in propose(later,'automatic')['assignments'])


def test_invalid_events_empty_and_queued_equipment_are_deterministic():
    from print_assist.incidents import inject_fault
    state=scenario_state('seeded')
    payload={'printer_id':'printer-1','fault_type':'thermal','event_id':str(uuid4())}
    empty=inject_fault(state,payload)
    assert empty['incidents'][0]['job_ids']==[]
    for change in [{'fault_type':'other'},{'printer_id':'missing'}]:
        with pytest.raises(ValueError): inject_fault(state,{**payload,**change})
    with pytest.raises(ValueError): inject_fault(empty,{**payload,'fault_type':'network_disconnect'})
    manual=schedule(state,'manual')
    result=inject_fault(manual,payload)
    assert result['jobs'][0]['status']=='recovery_pending'
    assert result['incidents'][0]['waste_grams']==0
    # Multiple queued parts of the same order share one hold, not repeated ownership.
    manual['jobs'].append({**manual['jobs'][0],'id':'another','status':'planned','schedule_mode':'manual'})
    result=inject_fault(manual,payload)
    assert len(result['orders'][0]['recovery_holds'])==1

from copy import deepcopy
import pytest
from print_assist.scenarios import scenario_state


def payload():return dict(printer_id='printer-1',filament_type='PLA',color='black',grams=500,confirmed=True)


def test_idle_printer_can_load_the_filament_needed_by_approved_waiting_work():
    from print_assist.controls import load_filament
    state=scenario_state('seeded');state['orders']=state['orders'][:1];state['orders'][0]['quantity']=1
    state['artifacts'][0]['color']='black';state['orders'][0]['schedule_mode']='automatic'
    before=deepcopy(state)
    result=load_filament(state,payload())
    assert state==before and result['printers'][0]['material']==dict(type='PLA',color='black',grams=500)
    assert result['jobs'][0]['status']=='running'
    assert result['jobs'][0]['printer_id']=='printer-1'


@pytest.mark.parametrize('change,message',[({'confirmed':False},'Confirm'),({'printer_id':'missing'},'Unknown')])
def test_filament_replacement_rejects_invalid_or_unacknowledged_changes(change,message):
    from print_assist.controls import load_filament
    with pytest.raises(ValueError,match=message):load_filament(scenario_state('empty'),{**payload(),**change})


@pytest.mark.parametrize('status',['running','reserved','faulted'])
def test_loading_cannot_bypass_equipment_state(status):
    from print_assist.controls import load_filament
    state=scenario_state('empty');state['printers'][0]['status']=status
    with pytest.raises(ValueError,match='idle|uncommitted'):load_filament(state,payload())


def test_future_commitments_cannot_have_their_reserved_filament_replaced():
    from print_assist.controls import load_filament
    state=scenario_state('empty');state['jobs']=[dict(printer_id='printer-1',status='planned')]
    with pytest.raises(ValueError,match='uncommitted'):load_filament(state,payload())



def test_material_cannot_be_changed_to_hide_a_recorded_equipment_fault():
    from print_assist.controls import load_filament
    state=scenario_state('empty');state['printers'][0]['fault']={'type':'thermal'}
    with pytest.raises(ValueError,match='fault'):load_filament(state,payload())



def test_another_printers_queue_does_not_prevent_loading_an_uncommitted_spool():
    from print_assist.controls import load_filament
    from print_assist.scheduling import schedule
    state=scenario_state('seeded');state['orders']=state['orders'][:1];state['orders'][0]['quantity']=1
    state['printers'][0]['status']='offline'
    state=schedule(state,'manual');state['printers'][0]['status']='idle'
    result=load_filament(state,payload())
    assert result['jobs']==state['jobs']
    assert result['printers'][0]['material']['color']=='black'


@pytest.mark.parametrize('status',['idle','running','paused','offline','reserved','faulted'])
def test_matching_refill_adds_stock_in_every_state_without_replacing_material_or_clearing_fault(status):
    from print_assist.controls import load_filament
    state=scenario_state('empty');printer=state['printers'][0]
    printer['status']=status
    if status=='faulted':printer['fault']={'type':'thermal'}
    before=deepcopy(state)
    result=load_filament(state,{**payload(), 'color':'blue','mode':'refill','grams':250})
    assert state==before
    assert result['printers'][0]['material']==dict(type='PLA',color='blue',grams=1250)
    assert result['printers'][0]['status']==status
    assert result['printers'][0].get('fault')==printer.get('fault')
    assert not result['jobs']


def test_refill_does_not_change_active_part_identity_elapsed_or_reservations():
    from print_assist.controls import load_filament
    from print_assist.scheduling import schedule
    from print_assist.simulation import advance
    from print_assist.reservations import ledger
    state=scenario_state('seeded');state['orders']=state['orders'][:1];state['orders'][0]['quantity']=1
    state=advance(schedule(state),3600)
    result=load_filament(state,{**payload(),'color':'blue','mode':'refill','grams':250})
    assert result['jobs']==state['jobs']
    assert result['orders']==state['orders']
    assert result['printers'][0]['material']['grams']==state['printers'][0]['material']['grams']+250
    assert ledger(result)[0]['reserved_grams']==ledger(state)[0]['reserved_grams']


@pytest.mark.parametrize('change',[{'color':'black'},{'filament_type':'PETG'}])
def test_refill_cannot_silently_change_loaded_material(change):
    from print_assist.controls import load_filament
    state=scenario_state('empty');before=deepcopy(state)
    with pytest.raises(ValueError,match='matching|loaded'):
        load_filament(state,{**payload(),'color':'blue','mode':'refill',**change})
    assert state==before


@pytest.mark.parametrize('fault_type',['filament_runout','insufficient_material'])
def test_matching_refill_resolves_material_fault_once_without_another_repair_action(fault_type):
    from print_assist.controls import load_filament
    from print_assist.incidents import inject_fault
    state=scenario_state('fault-demo')
    state=inject_fault(state,dict(printer_id='printer-1',fault_type=fault_type,event_id='refill-demo'))
    before=deepcopy(state)
    stock=state['printers'][0]['material']['grams']
    result=load_filament(state,{**payload(),'color':'blue','mode':'refill','grams':250})
    assert state==before
    assert result['printers'][0]['material']['grams']==stock+250
    assert result['printers'][0]['status']=='running'
    assert 'fault' not in result['printers'][0]
    assert result['incidents'][0]['equipment_cleared']
    assert result['incidents'][0]['refilled_grams']==250
    assert [a['action'] for a in result['incidents'][0]['actions']].count('equipment_cleared')==1


@pytest.mark.parametrize('fault_type',['thermal','nozzle_clog','network_disconnect'])
def test_refill_does_not_resolve_unrelated_equipment_faults(fault_type):
    from print_assist.controls import load_filament
    from print_assist.incidents import inject_fault
    state=scenario_state('fault-demo')
    state=inject_fault(state,dict(printer_id='printer-1',fault_type=fault_type,event_id='other-fault'))
    result=load_filament(state,{**payload(),'color':'blue','mode':'refill','grams':250})
    assert result['printers'][0]['status']=='faulted'
    assert result['printers'][0]['fault']==state['printers'][0]['fault']
    assert not result['incidents'][0].get('equipment_cleared')


def test_recorded_refill_must_still_have_stock_before_clearance():
    from print_assist.controls import load_filament
    from print_assist.incidents import inject_fault
    from print_assist.recovery import clear_fault
    state=scenario_state('empty')
    state=inject_fault(state,dict(printer_id='printer-1',fault_type='filament_runout',event_id='refill-empty'))
    result=deepcopy(state)
    result['incidents'][0]['refilled_grams']=1
    result['printers'][0]['material']['grams']=0
    with pytest.raises(ValueError,match='refill'):
        clear_fault(result,dict(incident_id=result['incidents'][0]['id'],confirmed=True))



def test_refill_clears_material_equipment_fault_without_approving_manual_work():
    from print_assist.controls import load_filament
    from print_assist.incidents import inject_fault
    from print_assist.scheduling import schedule
    state=scenario_state('seeded');state['recovery_policy']='automatic'
    state=schedule(state,'manual')
    state=inject_fault(state,dict(printer_id='printer-1',fault_type='filament_runout',event_id='manual-refill'))
    result=load_filament(state,{**payload(),'color':'blue','mode':'refill','grams':250})
    assert result['incidents'][0]['equipment_cleared']
    assert result['printers'][0]['status']=='idle'
    assert not any(j['status']=='running' for j in result['jobs'])
    assert result['orders'][0]['recovery_holds']==state['orders'][0]['recovery_holds']

from copy import deepcopy
import pytest
from print_assist.scenarios import initial_state
from print_assist.scheduling import schedule
from print_assist.simulation import advance
from print_assist.controls import control_printer


def working(mode='automatic'):
    state=initial_state()
    state['orders']=[dict(id='00000000-0000-4000-8000-000000000001',artifact_id='figure-pla-blue',quantity=1,
                          successful_quantity=0,status='queued',priority=1,production_due='2026-11-20T12:00:00Z')]
    return schedule(state,mode)


@pytest.mark.parametrize('action',['pause','offline'])
def test_controls_restart_work_elsewhere_and_preserve_consumed_source_stock(action):
    state=advance(working(),3600)
    original=deepcopy(state)
    stopped=control_printer(state,'printer-1',action)
    assert state==original
    later=advance(stopped,3600)
    assert later['jobs'][0]['elapsed_seconds']==3600
    assert later['printers'][0]['material']['grams']==987.5
    if action=='offline':
        later=control_printer(later,'printer-1','online')
        assert later['jobs'][0]['status']=='failed'
        assert later['printers'][0]['status']=='idle'
        resumed=later
    else:
        resumed=control_printer(later,'printer-1','resume')
    finished=advance(resumed,3600)
    assert finished['orders'][0]['successful_quantity']==1
    assert finished['printers'][0]['material']['grams']==987.5
    assert finished['printers'][1]['material']['grams']==975


def test_pending_manual_work_does_not_start_on_resume_and_idle_equipment_can_return_online():
    paused=control_printer(working('manual'),'printer-1','pause')
    resumed=control_printer(paused,'printer-1','resume')
    assert resumed['jobs'][0]['status']=='pending'
    assert resumed['printers'][0]['status']=='idle'
    assert resumed['printers'][1]['status']=='reserved'
    state=control_printer(initial_state(),'printer-1','offline')
    assert control_printer(state,'printer-1','online')['printers'][0]['status']=='idle'
    state=control_printer(initial_state(),'printer-1','pause')
    assert control_printer(state,'printer-1','resume')['printers'][0]['status']=='idle'


def test_controls_reject_invalid_and_unsafe_transitions_without_mutation():
    state=working()
    with pytest.raises(ValueError,match='Unknown printer'): control_printer(state,'missing','pause')
    for status in ['faulted','unknown','offline']:
        state['printers'][0]['status']=status
        before=deepcopy(state)
        with pytest.raises(ValueError): control_printer(state,'printer-1','resume')
        assert state==before
    state=control_printer(working(),'printer-1','pause')
    state['printers'][0]['material']['grams']=1
    resumed=control_printer(state,'printer-1','resume')
    assert resumed['printers'][0]['status']=='idle'
    assert resumed['jobs'][-1]['printer_id']=='printer-2'


def test_assignment_records_why_work_is_blocked_and_does_not_repeat_same_reason():
    state=initial_state()
    state['orders']=working()['orders']
    for printer in state['printers']: printer['material']['grams']=0
    blocked=schedule(state)
    assert blocked['events'][-1]['status']=='blocked'
    assert 'filament' in blocked['events'][-1]['message']
    assert schedule(blocked)==blocked


def test_assignment_explains_capability_and_material_mismatches():
    for field,value,reason in [('capabilities',[],'capabilities'),('material',dict(type='ABS',color='red',grams=1000),'filament')]:
        state=initial_state();state['orders']=working()['orders']
        for printer in state['printers']:printer[field]=value
        assert reason in schedule(state)['events'][-1]['message']
    state=control_printer(working(),'printer-1','pause')
    state['printers'][0]['capabilities']=[]
    assert control_printer(state,'printer-1','resume')['jobs'][-1]['printer_id']=='printer-2'


def test_invalid_scenarios_and_material_shortage_are_atomic():
    from print_assist.scenarios import scenario_state
    with pytest.raises(ValueError,match='Unknown scenario'):scenario_state('missing')
    state=working();state['printers'][0]['material']['grams']=0
    before=deepcopy(state)
    result=advance(state,3600)
    assert result['printers'][0]['status']=='faulted'
    assert result['incidents'][0]['fault_type']=='filament_runout'
    assert state==before


def test_ineligible_printer_never_advances_even_if_job_status_is_stale():
    state=working();state['printers'][0]['status']='offline'
    before=deepcopy(state)
    result=advance(state,3600)
    assert result['jobs'][0]['elapsed_seconds']==0
    assert result['printers'][0]['material']==before['printers'][0]['material']


def test_manual_quantity_prepares_the_next_batch_without_starting_it():
    from print_assist.scenarios import scenario_state
    from print_assist.scheduling import schedule,start_job
    from print_assist.simulation import advance
    state=scenario_state('seeded');state['orders']=state['orders'][:1]
    state=schedule(state,'manual')
    for job in list(state['jobs']): state=start_job(state,job['id'])
    result=advance(state,7200)
    assert result['orders'][0]['successful_quantity']==3
    assert len(result['jobs'])==4
    assert result['jobs'][-1]['status']=='pending'
    assert not any(job['status']=='running' for job in result['jobs'])


@pytest.mark.parametrize('change,message', [
    ({'status':'offline'}, 'unavailable'),
    ({'capabilities':[]}, 'capabilities'),
    ({'material':dict(type='ABS',color='red',grams=1000)}, 'filament'),
    ({'material':dict(type='PLA',color='blue',grams=0)}, 'filament'),
])
def test_manual_start_revalidates_equipment_before_touching_job(change,message):
    from print_assist.scheduling import start_job
    state=working('manual')
    state['printers'][0].update(change)
    if message=='capabilities':
        state['artifacts'][0]['required_capabilities']=['enclosed']
    before=deepcopy(state)
    with pytest.raises(ValueError,match=message):
        start_job(state,state['jobs'][0]['id'])
    assert state==before

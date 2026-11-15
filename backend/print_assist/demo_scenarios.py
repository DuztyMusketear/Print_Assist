"""Composable offline events using real deterministic production operations."""
from copy import deepcopy

from .activity import record
from .contracts import ScenarioEventPayload
from .controls import control_printer
from .incidents import inject_fault
from .order_demo import simulate_automatic_order
from .recovery import automatic_recovery, clear_fault, set_recovery_policy
from .schedule_impact import capture_schedule, compare_parts, compare_schedules
from .scheduling import schedule
from .shop import simulate


def trigger_scenario(state, payload):
    """Apply one event without resetting, replaying inference, or releasing holds."""
    payload=ScenarioEventPayload.model_validate(payload).model_dump(mode='json')
    previous=next((row for row in state.get('scenario_events',[]) if row['event_id']==payload['event_id']),None)
    if previous:
        if previous['payload'] != payload:
            raise ValueError('Scenario event identity conflict')
        return deepcopy(state)
    result=deepcopy(state)
    before=capture_schedule(state)
    calls=[]

    def invoke(name, function, *args):
        calls.append(dict(name=name,status='accepted',timestamp=state['simulation_time']))
        return function(*args)

    if payload['recovery_mode'] is not None:
        result=invoke('recovery.set_recovery_policy',set_recovery_policy,result,dict(mode=payload['recovery_mode']))
    event=payload['event']; request=None; incident=None
    status='accepted'
    notification='Simulated '+event.replace('_',' ')+' applied using deterministic operations; agents OFF.'
    if event in {'marketplace_order','urgent_order'}:
        if payload['order'] is None:
            raise ValueError('An order is required for incoming order events')
        order={**payload['order'], 'product_id':payload['product_id'], 'source':'simulated_etsy',
               'event_id':payload['event_id'],'filament_type':payload['filament_type'],'color':payload['color']}
        end_to_end=order['mode']=='end_to_end'
        result=invoke('order_demo.simulate_automatic_order' if end_to_end else 'shop.simulate',
                      simulate_automatic_order if end_to_end else simulate,result,order)
        request=result['shop_requests'][-1]
        reason=request.get('attention_reason')
        if request['artifact_id'] is None:
            reason='Choose a saved model before this request can be scheduled.'
        if end_to_end and result['order_demonstrations'][-1]['status']=='needs_attention':
            reason=reason or result['order_demonstrations'][-1]['reason']
        if reason:
            status='blocked';notification=reason+' Simulated event; agents OFF.'
    else:
        printer=next((p for p in result['printers'] if p['id']==payload['printer_id']),None)
        if printer is None:
            raise ValueError('Unknown printer')
        if event in {'thermal_fault','insufficient_filament'}:
            if event=='thermal_fault' and not any(j['printer_id']==printer['id'] and j['status']=='running' for j in result['jobs']):
                raise ValueError('Thermal fault requires an active printer')
            if event=='insufficient_filament':
                printer['material']['grams']=payload['available_grams']
            result=invoke('incidents.inject_fault',inject_fault,result,
                          dict(event_id=payload['event_id'],printer_id=printer['id'],
                               fault_type='thermal' if event=='thermal_fault' else 'insufficient_material'))
            incident=result['incidents'][-1]
            if event=='insufficient_filament':
                result=invoke('scheduling.schedule',schedule,result,'automatic',True)
        elif printer['status'] in {'paused','offline'}:
            result=invoke('controls.control_printer',control_printer,result,printer['id'],
                          'resume' if printer['status']=='paused' else 'online')
        elif printer['status']=='faulted':
            incident=next(row for row in result['incidents'] if row['id']==printer['fault']['incident_id'])
            result=invoke('recovery.clear_fault',clear_fault,result,
                          dict(incident_id=incident['id'],confirmed=payload['confirmed'],
                               refill_grams=payload['refill_grams'] if incident['fault_type'] in {'filament_runout','insufficient_material'} else None))
            if not incident.get('applied') and result.get('recovery_policy','review')=='automatic' and incident['job_ids']:
                result=invoke('recovery.automatic_recovery',automatic_recovery,result,incident['id'])
            result=invoke('scheduling.schedule',schedule,result,'automatic',True)
        else:
            raise ValueError('Restore requires paused, offline or faulted equipment')
    after=capture_schedule(result)
    affected=incident or dict(id='',order_ids=[request['order_id']] if request and request['order_id'] else [])
    impacts=compare_schedules(before,after,result,affected)
    result.setdefault('scenario_events',[]).append(dict(event_id=payload['event_id'],event=event,
        timestamp=result['simulation_time'],printer_id=payload['printer_id'],
        order_id=request['order_id'] if request else None,request_id=request['id'] if request else None,
        status=status,notification=notification,before=before,after=after,impacts=impacts,
        part_impacts=compare_parts(before,after,[]),tool_calls=calls,payload=payload,
        execution_mode='deterministic/agents_off'))
    record(result,'scenario_event',notification,source='simulation',status=status,
           printer_id=payload['printer_id'],order_id=request['order_id'] if request else None)
    return result

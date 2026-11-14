"""Deterministic simulated equipment isolation; no inference or hardware control."""
from copy import deepcopy
from uuid import uuid4

from .activity import record
from .monitoring import project
from .reservations import ACTIVE

FAULTS={'thermal','filament_runout','network_disconnect','nozzle_clog','insufficient_material'}


def inject_fault(state:dict,payload:dict)->dict:
    if payload['fault_type'] not in FAULTS:
        raise ValueError('Unknown simulated fault')
    previous=next((i for i in state.get('incidents',[]) if i['event_id']==payload['event_id']),None)
    if previous:
        if previous['printer_id']!=payload['printer_id'] or previous['fault_type']!=payload['fault_type']:
            raise ValueError('Fault event identity conflict')
        return deepcopy(state)
    result=deepcopy(state)
    printer=next((p for p in result['printers'] if p['id']==payload['printer_id']),None)
    if printer is None or printer['status'] not in {'running','reserved','paused','idle'}:
        raise ValueError('Printer is unknown or already isolated')
    before=project(state)
    from .schedule_impact import capture_schedule
    incident=dict(id=str(uuid4()),event_id=payload['event_id'],timestamp=state['simulation_time'],
                  printer_id=printer['id'],fault_type=payload['fault_type'],status='awaiting_review',
                  before=capture_schedule(state),
                  telemetry=next(t for t in before['telemetry'] if t['printer_id']==printer['id']),
                  job_ids=[],order_ids=[],waste_grams=0.0,actions=[])
    for job in result['jobs']:
        if job['printer_id']!=printer['id'] or job['status'] not in ACTIVE:
            continue
        order=next(o for o in result['orders'] if o['id']==job['order_id'])
        artifact=next(a for a in result['artifacts'] if a['id']==order['artifact_id'])
        waste=artifact['filament_grams']*job.get('elapsed_seconds',0)/artifact['duration_seconds']
        job.update(status='failed' if job['status']=='running' or waste else 'recovery_pending',
                   incident_id=incident['id'],waste_grams=waste,part_key=job.get('part_key',job['id']))
        incident['waste_grams']+=waste
        incident['job_ids'].append(job['id'])
        if order['id'] not in incident['order_ids']:
            incident['order_ids'].append(order['id'])
            order.setdefault('recovery_holds',[]).append(incident['id'])
    printer.update(status='faulted',fault={'incident_id':incident['id'],'type':payload['fault_type']})
    incident['before_telemetry']=deepcopy(incident['telemetry'])
    incident['trigger_telemetry']={**incident['telemetry'],'nozzle_c':350 if payload['fault_type']=='thermal' else incident['telemetry']['nozzle_c']}
    incident['telemetry'].update(nozzle_c=25,bed_c=25,connected=payload['fault_type']!='network_disconnect',simulated=True)
    incident['inventory_adjustment_grams']=0.0
    if payload['fault_type']=='filament_runout':
        incident['inventory_adjustment_grams']=-printer['material']['grams']
        printer['material']['grams']=0
    incident['summary']=f"{payload['fault_type'].replace('_',' ')} isolated {printer['id']}; {len(incident['job_ids'])} parts held; {incident['waste_grams']:.1f} g failed-print waste. Recovery review required."
    incident['actions'].append({'timestamp':state['simulation_time'],'action':'equipment_isolated','outcome':'safe_simulated_stop'})
    result.setdefault('incidents',[]).append(incident)
    record(result,'fault_isolated',incident['summary'],source='system',printer_id=printer['id'])
    from .recovery import automatic_recovery
    return automatic_recovery(result,incident['id'])

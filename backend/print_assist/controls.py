"""Pure operator printer controls."""
from copy import deepcopy
from .activity import record
from .scheduling import schedule, start_job
from .redistribution import redistribute

def control_printer(state,printer_id,action):
    result=deepcopy(state)
    printer=next((item for item in result['printers'] if item['id']==printer_id),None)
    if printer is None:
        raise ValueError('Unknown printer')
    allowed={'pause':{'idle','reserved','running'},'resume':{'paused'},
             'offline':{'idle','reserved','running','paused'},'online':{'offline'}}
    if printer['status'] not in allowed.get(action,set()):
        raise ValueError('Invalid printer control for current state')
    job=next((job for job in result['jobs'] if job['printer_id']==printer_id and job['status'] in {'running','pending','paused'}),None)
    if action in {'pause','offline'}:
        result=redistribute(result,printer_id,action)
    elif action=='online':
        printer['status']='idle'
    elif job and job['status']=='paused' and not job.get('workload_transfer_pending'):
        # Application restart pauses active jobs for safety. An explicit resume
        # may continue that same physical printer's part with its saved progress.
        result=start_job(result,job['id'])
    else:
        printer['status']='idle'
    record(result,'printer_'+action,'Printer '+printer_id+': '+action,printer_id=printer_id,
           job_id=job['id'] if job else None,order_id=job['order_id'] if job else None)
    return schedule(result,'automatic',preserve_mode=True)


def load_filament(state,payload):
    from .reservations import ACTIVE
    if not payload.get('confirmed'):
        raise ValueError('Confirm the simulated spool replacement')
    result=deepcopy(state)
    printer=next((p for p in result['printers'] if p['id']==payload['printer_id']),None)
    if printer is None:
        raise ValueError('Unknown printer')
    if payload.get('mode')=='refill':
        if payload['filament_type']!=printer['material']['type'] or payload['color']!=printer['material']['color']:
            raise ValueError('Refill must use the matching material and color already loaded')
        printer['material']['grams']+=payload['grams']
        incident=next((i for i in result.get('incidents',[]) if i['id']==printer.get('fault',{}).get('incident_id')),None)
        if incident is not None:
            incident['refilled_grams']=incident.get('refilled_grams',0)+payload['grams']
            incident['actions'].append(dict(timestamp=result['simulation_time'],action='filament_added',outcome='Matching simulated filament added; equipment remains isolated',refill_grams=payload['grams']))
        record(result,'filament_added','Added '+str(payload['grams'])+' g of matching '+payload['color']+' '+payload['filament_type']+' filament; simulated refill',printer_id=printer['id'])
        if incident is not None and incident['fault_type'] in {'filament_runout','insufficient_material'}:
            from .recovery import clear_fault
            return clear_fault(result,dict(incident_id=incident['id'],confirmed=True))
        return schedule(result,'automatic',preserve_mode=True)
    if printer['status'] not in {'idle','offline','paused'} or printer.get('fault') or any(j['printer_id']==printer['id'] and j['status'] in ACTIVE for j in result['jobs']):
        raise ValueError('Load filament only on an idle or uncommitted printer without a fault; finish or transfer its queued work first')
    printer['material']=dict(type=payload['filament_type'],color=payload['color'],grams=payload['grams'])
    record(result,'filament_loaded','Loaded '+payload['color']+' '+payload['filament_type']+' filament: '+str(payload['grams'])+' g; simulated spool replacement',printer_id=printer['id'])
    return schedule(result,'automatic',preserve_mode=True)

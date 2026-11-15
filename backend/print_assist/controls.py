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

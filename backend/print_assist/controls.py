"""Pure operator printer controls."""
from copy import deepcopy
from .activity import record
from .scheduling import start_job, schedule

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
        if job:
            job.setdefault('suspended_status',job['status'])
            job['status']='paused'
        printer['status']='paused' if action=='pause' else 'offline'
    elif action=='online':
        printer['status']='paused' if job else 'idle'
    elif job:
        if job.get('suspended_status')=='pending':
            job.pop('suspended_status')
            job['status']='pending';printer['status']='reserved'
        else:
            result=start_job(result,job['id'])
    else:
        printer['status']='idle'
    record(result,'printer_'+action,'Printer '+printer_id+': '+action,printer_id=printer_id,
           job_id=job['id'] if job else None,order_id=job['order_id'] if job else None)
    return schedule(result,'automatic',preserve_mode=True)

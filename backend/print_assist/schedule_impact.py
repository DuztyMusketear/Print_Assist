"""Immutable schedule evidence and conservative customer-order comparisons."""
from copy import deepcopy
from datetime import datetime, timedelta
from .monitoring import project


def capture_schedule(state):
    projected = project(state)
    orders = []
    for forecast in projected['forecasts']:
        oid = forecast['order_id']
        orders.append(dict(forecast, printers=sorted({j['printer_id'] for j in state['jobs']
            if j['order_id'] == oid and j['status'] in {'running','pending','paused','planned','completed'}})))
    now=datetime.fromisoformat(state['simulation_time'].replace('Z','+00:00'))
    available={p['id']:0 if p['status']=='idle' else None for p in state['printers']}
    jobs=deepcopy(state['jobs'])
    ordered=sorted(jobs,key=lambda j:(j['status']!='running',next(o['production_due'] for o in state['orders'] if o['id']==j['order_id']),-next(o['priority'] for o in state['orders'] if o['id']==j['order_id']),j.get('estimated_start',''),j['id']))
    for job in ordered:
        pid=job['printer_id']; elapsed=job.get('elapsed_seconds',0)
        duration=job['duration_seconds']; start=finish=None
        if job['status']=='running' and next(p for p in state['printers'] if p['id']==pid)['status']=='running':
            start=-elapsed;finish=duration-elapsed;available[pid]=finish
        elif job['status']=='planned' and job.get('schedule_mode')=='automatic' and available[pid] is not None:
            start=available[pid];finish=start+duration;available[pid]=finish
        elif job['status']=='completed':
            event=next((e for e in state['events'] if e.get('job_id')==job['id'] and e['type']=='job_completed'),None)
            if event:
                finish=(datetime.fromisoformat(event['timestamp'].replace('Z','+00:00'))-now).total_seconds();start=finish-duration
        elif job['status'] in {'paused','pending','planned'}:
            available[pid]=None
        job.update(part_key=job.get('part_key',job['id']),start=(now+timedelta(seconds=start)).isoformat() if start is not None else None,
            finish=(now+timedelta(seconds=finish)).isoformat() if finish is not None else None,
            remaining_seconds=max(0,duration-elapsed))
    for order in state['orders']:
        if order['status']=='cancelled':
            continue
        outstanding={j['part_key'] for j in jobs if j['order_id']==order['id'] and j['status'] not in {'completed','cancelled'}}
        completed={j['part_key'] for j in jobs if j['order_id']==order['id'] and j['status']=='completed'}
        outstanding-=completed
        artifact=next(a for a in state['artifacts'] if a['id']==order['artifact_id'])
        for number in range(max(0,order['quantity']-order['successful_quantity']-len(outstanding))):
            key=f"{order['id']}:unassigned:{number+1}"
            jobs.append(dict(id=key,part_key=key,order_id=order['id'],printer_id=None,status='unassigned',
                start=None,finish=None,duration_seconds=artifact['duration_seconds'],remaining_seconds=artifact['duration_seconds']))
    return dict(timestamp=state['simulation_time'], orders=orders, jobs=jobs)


def compare_parts(before,after,assignments):
    original={j.get('part_key',j['id']):j for j in before['jobs']}
    current={j.get('part_key',j['id']):j for j in after['jobs']}
    actions={a['part_key']:a['action'] for a in assignments}
    parts=[]
    for key in sorted(original.keys() | current.keys()):
        old=original.get(key,{}); new=current.get(key,{})
        active=new.get('status') in {'running','pending','planned','paused','completed'}
        parts.append(dict(part_key=key,order_id=new.get('order_id',old.get('order_id')),
            original_job_id=old.get('id'),revised_job_id=new.get('id'),
            original_printer=old.get('printer_id'),revised_printer=new.get('printer_id') if active else None,
            original_start=old.get('start'),original_finish=old.get('finish'),
            revised_start=new.get('start') if active else None,revised_finish=new.get('finish') if active else None,
            duration_seconds=new.get('duration_seconds',old.get('duration_seconds')),
            remaining_seconds=new.get('remaining_seconds'),action=actions.get(key,
                'unassigned' if new.get('status')=='unassigned' else 'preserved' if active else 'blocked')))
    return parts


def compare_schedules(before, after, state, incident):
    previous = {o['order_id']: o for o in before['orders']}
    impacts = []
    for revised in after['orders']:
        oid = revised['order_id']; original = previous.get(oid, {})
        old = original.get('completion'); new = revised['completion']
        order = next(o for o in state['orders'] if o['id'] == oid)
        delta = (datetime.fromisoformat(new.replace('Z','+00:00')) - datetime.fromisoformat(old.replace('Z','+00:00'))).total_seconds() if old and new else None
        impacts.append(dict(order_id=oid, original_completion=old, revised_completion=new,
            delta_seconds=delta, production_due=order['production_due'], risk=revised['risk'],
            original_printers=original.get('printers',[]), revised_printers=revised['printers'],
            outstanding_quantity=max(0,order['quantity']-order['successful_quantity']),
            change='direct' if oid in incident['order_ids'] else 'indirect' if old != new else 'unchanged',
            waste_grams=sum(j.get('waste_grams',0) for j in state['jobs'] if j.get('incident_id')==incident['id'] and j['order_id']==oid)))
    return impacts

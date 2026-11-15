"""Read-only conservative estimates and illustrative simulated telemetry."""
from copy import deepcopy
from .reservations import ledger
from datetime import datetime, timedelta


def project(state):
    result=deepcopy(state)
    now=datetime.fromisoformat(state['simulation_time'].replace('Z','+00:00'))
    printers={p['id']:p for p in state['printers']}
    available={p['id']:0 if p['status']=='idle' else None for p in state['printers']}
    stock={p['id']:p['material']['grams'] for p in state['printers']}
    ends={o['id']:[] for o in state['orders']}
    held=set()
    for job in sorted(state['jobs'],key=lambda j:(j['status']!='running',next(o['production_due'] for o in state['orders'] if o['id']==j['order_id']),-next(o['priority'] for o in state['orders'] if o['id']==j['order_id']),j.get('estimated_start',''),j['id'])):
        if job['status'] not in {'running','pending','paused','planned'}: continue
        order=next(o for o in state['orders'] if o['id']==job['order_id'])
        artifact=next(a for a in state['artifacts'] if a['id']==order['artifact_id'])
        pid=job['printer_id']
        remaining=artifact['duration_seconds']-job.get('elapsed_seconds',0)
        grams=artifact['filament_grams']*remaining/artifact['duration_seconds']
        if ((job['status']=='running' and printers[pid]['status']=='running') or (job['status']=='planned' and job['schedule_mode']=='automatic' and available[pid] is not None)) and stock[pid]+1e-9>=grams:
            available[pid]=(available[pid] or 0)+remaining;stock[pid]-=grams;ends[order['id']].append(available[pid])
        else:
            held.add(order['id']);available[pid]=None
    forecasts=[]
    for order in sorted(state['orders'],key=lambda o:(o['production_due'],-o['priority'],o['id'])):
        if order['status']=='cancelled':continue
        artifact=next(a for a in state['artifacts'] if a['id']==order['artifact_id'])
        reason='Held or manual work requires an explicit start/resume' if order['id'] in held else ''
        if order['successful_quantity']>=order['quantity']:
            completed=[datetime.fromisoformat(event['timestamp'].replace('Z','+00:00')) for event in state['events']
                if event['type']=='job_completed' and event.get('order_id')==order['id']]
            if completed:
                ends[order['id']]=[(max(completed)-now).total_seconds()]
            else: reason='Completion time was not recorded'
        if order.get('requires_schedule_review'): reason='Awaiting reviewed schedule application'
        if order.get('recovery_holds'): reason='Incident recovery review required'
        count=order['quantity']-order['successful_quantity']-len(ends[order['id']])
        if order.get('schedule_mode')=='manual' and count>0: reason='Manual work requires an explicit start'
        if not reason:
            for _ in range(max(0,count)):
                candidates=[pid for pid,p in printers.items() if available[pid] is not None
                    and set(artifact['required_capabilities']).issubset(p['capabilities'])
                    and p['material']['type']==artifact['filament_type'] and p['material']['color']==artifact['color']
                    and stock[pid]>=artifact['filament_grams']]
                if not candidates:
                    reason='Insufficient available compatible printer capacity or filament';break
                pid=min(candidates,key=lambda pid:(available[pid],pid))
                available[pid]+=artifact['duration_seconds'];stock[pid]-=artifact['filament_grams']
                ends[order['id']].append(available[pid])
        finish=now+timedelta(seconds=max(ends[order['id']],default=0))
        due=datetime.fromisoformat(order['production_due'].replace('Z','+00:00'))
        forecasts.append(dict(order_id=order['id'],completion=None if reason else finish.isoformat(),
            risk='unavailable' if reason else 'late' if finish>due else 'on_time',reason=reason))
    result['material_reservations']=ledger(state)
    result['forecasts']=forecasts
    connections={i['printer_id']:i.get('telemetry',{}).get('connected',
        i['fault_type']!='network_disconnect' or i.get('equipment_cleared',False)) for i in state.get('incidents',[])}
    result['telemetry']=[dict(printer_id=p['id'],nozzle_c=210 if p['status']=='running' else 25,
        bed_c=60 if p['status']=='running' else 25,simulated=True,connected=connections.get(p['id'],True)) for p in state['printers']]
    return result

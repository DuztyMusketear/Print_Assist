"""Fill healthy idle capacity from approved automatic queues without preemption."""
from copy import deepcopy
from datetime import datetime
from .activity import record
from .reservations import free_grams
from .schedule_impact import capture_schedule, compare_schedules, compare_parts


def rebalance_queues(state):
    result=deepcopy(state)
    printers={p['id']:p for p in result['printers']}
    orders={o['id']:o for o in result['orders']}
    artifacts={a['id']:a for a in result['artifacts']}
    healthy={pid for pid,p in printers.items() if p['status'] in {'idle','running'} and not p.get('fault')}
    if not any(p['status']=='idle' and p['id'] in healthy for p in result['printers']):
        return result
    manual={j['printer_id'] for j in result['jobs'] if j['status'] in {'pending','paused'} or (j['status']=='planned' and j.get('schedule_mode')=='manual')}
    usable=healthy-manual
    pool=[j for j in result['jobs'] if j['status']=='planned' and j.get('schedule_mode')=='automatic' and not j.get('elapsed_seconds',0) and j['printer_id'] in usable and orders[j['order_id']]['status']!='cancelled']
    draft=deepcopy(result)
    ids={j['id'] for j in pool}
    draft['jobs']=[j for j in draft['jobs'] if j.get('id') not in ids]
    capacity={pid:0 for pid in usable}
    for job in draft['jobs']:
        if job['printer_id'] in usable and job['status'] in {'running','planned'}:
            capacity[job['printer_id']]+=job['duration_seconds']-job.get('elapsed_seconds',0)
    stock={pid:free_grams(draft,printers[pid]) for pid in usable}
    protected={pid:sum(artifacts[orders[j['order_id']]['artifact_id']]['filament_grams'] for j in pool if j['printer_id']==pid) for pid in usable}
    moved=[]
    sources=set()
    for job in sorted(pool,key=lambda j:(orders[j['order_id']]['production_due'],-orders[j['order_id']]['priority'],j.get('estimated_start',''),j['id'])):
        artifact=artifacts[orders[job['order_id']]['artifact_id']]
        protected[job['printer_id']]-=artifact['filament_grams']
        candidates=[pid for pid in usable if set(artifact['required_capabilities']).issubset(printers[pid]['capabilities']) and printers[pid]['material']['type']==artifact['filament_type'] and printers[pid]['material']['color']==artifact['color'] and stock[pid]-protected[pid]+1e-9>=artifact['filament_grams']]
        if not candidates:
            # Retain every original reservation if the complete approved pool
            # cannot be safely reassigned; never discard an existing commitment.
            return deepcopy(state)
        pid=min(candidates,key=lambda pid:(capacity[pid],pid!=job['printer_id'],pid))
        capacity[pid]+=job['duration_seconds']
        stock[pid]-=artifact['filament_grams']
        if job['printer_id']!=pid:
            sources.add(job['printer_id'])
            job['printer_id']=pid
            moved.append(dict(job_id=job['id'],order_id=job['order_id'],part_key=job.get('part_key',job['id']),action='moved'))
    if not moved:
        return result
    before=capture_schedule(state)
    # Compact remaining queues after removing their transferred parts.
    projected=capture_schedule(result)
    projected_jobs={j['id']:j for j in projected['jobs']}
    for job in result['jobs']:
        snapshot=projected_jobs[job['id']]
        if job['status']=='planned' and snapshot['finish'] is not None:
            job.update(estimated_start=snapshot['start'],estimated_finish=snapshot['finish'])
    after=capture_schedule(result)
    transfer_id=f"transfer-{len(result.get('workload_transfers',[]))+1}"
    impacts=compare_schedules(before,after,result,dict(id=transfer_id,order_ids={j['order_id'] for j in moved}))
    parts=compare_parts(before,after,moved)
    for part in parts:
        finish=part['revised_finish']
        part['risk']='unavailable' if finish is None else 'late' if datetime.fromisoformat(finish)>datetime.fromisoformat(orders[part['order_id']]['production_due'].replace('Z','+00:00')) else 'on_time'
    summary=f"{len(moved)} queued parts rebalanced onto healthy idle printers, soonest deadline first; {sum(i['risk']=='late' for i in impacts)} late orders. Active prints preserved."
    result.setdefault('workload_transfers',[]).append(dict(id=transfer_id,timestamp=result['simulation_time'],action='rebalance',source_printer=sorted(sources)[0],source_printers=sorted(sources),before=before,after=after,impacts=impacts,part_impacts=parts,blocked=[],waste_grams=0,summary=summary))
    record(result,'workload_rebalanced',summary,source='system')
    return result

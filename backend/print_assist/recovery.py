"""Deterministic incident-owned recovery planning and guarded decisions."""
from copy import deepcopy
from datetime import datetime, timedelta
from hashlib import sha256
import json
from .activity import record
from .reservations import ACTIVE, free_grams
from .scheduling import schedule
from .schedule_impact import capture_schedule, compare_schedules, compare_parts


def _incident(state, incident_id):
    incident = next((i for i in state.get('incidents',[]) if i['id']==incident_id),None)
    if incident is None:
        raise ValueError('Unknown incident')
    return incident


def _require_confirmation(payload):
    if not payload.get('confirmed'):
        raise ValueError('Explicit confirmation is required')


def _materialize(state, proposal):
    result=deepcopy(state)
    incident=_incident(result,proposal['incident_id'])
    moving={a['job_id'] for a in proposal['assignments'] if a['action']=='moved'}
    for printer in result['printers']:
        if printer['status']=='reserved' and any(j['id'] in moving and j['printer_id']==printer['id'] for j in result['jobs']):
            printer['status']='idle'
    for item in proposal['assignments']:
        if item['action']=='moved':
            job=next(j for j in result['jobs'] if j['id']==item['job_id'])
            if job.get('incident_id')==incident['id']:
                job['recovery_incident_id']=incident['id']
        else:
            order=next(o for o in result['orders'] if o['id']==item['order_id'])
            attempt=1+sum(j['order_id']==order['id'] for j in result['jobs'])
            job=dict(id=f"{order['id']}-{attempt}",order_id=order['id'],elapsed_seconds=0,
                part_key=item['part_key'],replaces_job_id=item['job_id'],recovery_incident_id=incident['id'])
            result['jobs'].append(job)
        order=next(o for o in result['orders'] if o['id']==item['order_id'])
        job.update(printer_id=item['printer_id'],status='planned',duration_seconds=item['duration_seconds'],
            estimated_start=item['start'],estimated_finish=item['finish'],schedule_mode=order.get('schedule_mode') or 'automatic')
    assigned={a['job_id'] for a in proposal['assignments']} | {j.get('replaces_job_id') for j in result['jobs']}
    assigned.update(j['id'] for j in result['jobs'] if j.get('incident_id')==incident['id'] and j['status'] in ACTIVE | {'completed'})
    for order in result['orders']:
        owned=[j for j in state['jobs'] if j.get('incident_id')==incident['id'] and j['order_id']==order['id']]
        if owned and all(j['id'] in assigned for j in owned):
            order['recovery_holds']=[i for i in order.get('recovery_holds',[]) if i!=incident['id']]
    return result


def propose_recovery(state, incident_id, include_movable=True):
    incident=_incident(state,incident_id)
    addressed={j.get('replaces_job_id') for j in state['jobs']}
    owned=[j for j in state['jobs'] if j.get('incident_id')==incident_id and j['status'] in {'failed','recovery_pending'} and j['id'] not in addressed]
    if incident.get('applied') and not owned:
        raise ValueError('Incident recovery has already been applied')
    draft=deepcopy(state)
    movable=[j for j in draft['jobs'] if include_movable and j['status'] in {'pending','planned'} and not j.get('elapsed_seconds',0)]
    moving={j['id'] for j in movable}
    draft['jobs']=[j for j in draft['jobs'] if j['id'] not in moving]
    for printer in draft['printers']:
        if printer['status']=='reserved' and any(j['printer_id']==printer['id'] for j in movable):
            printer['status']='idle'
    capacity={p['id']:0 if p['status']=='idle' else None for p in draft['printers']}
    for job in draft['jobs']:
        printer=next(p for p in draft['printers'] if p['id']==job['printer_id'])
        if job['status']=='running' and printer['status']=='running':
            capacity[printer['id']]=job['duration_seconds']-job.get('elapsed_seconds',0)
    for job in draft['jobs']:
        if job['status']=='planned' and capacity[job['printer_id']] is not None:
            capacity[job['printer_id']]+=job['duration_seconds']
    stock={p['id']:free_grams(draft,p) for p in draft['printers']}
    orders={o['id']:o for o in state['orders']}
    now=datetime.fromisoformat(state['simulation_time'].replace('Z','+00:00'))
    assignments=[]; blocked=[]
    for job in sorted(owned+movable,key=lambda j:(orders[j['order_id']]['production_due'],-orders[j['order_id']]['priority'],j['order_id'],j['id'])):
        order=orders[job['order_id']]
        artifact=next(a for a in state['artifacts'] if a['id']==order['artifact_id'])
        candidates=[p for p in draft['printers'] if capacity[p['id']] is not None
            and set(artifact['required_capabilities']).issubset(p['capabilities'])
            and p['material']['type']==artifact['filament_type'] and p['material']['color']==artifact['color']
            and stock[p['id']]+1e-9>=artifact['filament_grams']]
        if not candidates:
            blocked.append(dict(order_id=order['id'],quantity=1,reason='No compatible healthy capacity with unreserved material; refill, repair or add compatible capacity.'))
            continue
        printer=min(candidates,key=lambda p:(capacity[p['id']],p['id'])); pid=printer['id']
        start=capacity[pid]; capacity[pid]+=artifact['duration_seconds']; stock[pid]-=artifact['filament_grams']
        assignments.append(dict(order_id=order['id'],job_id=job['id'],part_key=job.get('part_key',job['id']),
            action='moved' if job['id'] in moving or job['status']=='recovery_pending' else 'restarted',printer_id=pid,
            start=(now+timedelta(seconds=start)).isoformat(),finish=(now+timedelta(seconds=capacity[pid])).isoformat(),
            duration_seconds=artifact['duration_seconds'],filament_grams=artifact['filament_grams']))
    # A movable queue that cannot move must retain its original commitment.
    blocked_movable={j['id'] for j in movable}-{a['job_id'] for a in assignments}
    if blocked_movable:
        # Preserve stock and capacity by replanning without moving healthy queues.
        return propose_recovery(state,incident_id,include_movable=False)
    proposal=dict(incident_id=incident_id,session_id=state['session_id'],revision=state['revision'],assignments=assignments,blocked=blocked)
    revised=capture_schedule(_materialize(state,proposal))
    proposal['impacts']=compare_schedules(incident['before'],revised,state,incident)
    proposal['part_impacts']=compare_parts(incident['before'],revised,assignments)
    proposal['summary']=f"{len(assignments)} assignments; {len(blocked)} blocked parts. Review completion risks and preserve manual starts."
    proposal['mitigations']=['Inspect or refill isolated equipment; add compatible capacity.',
        'Review a later production deadline or reduced remaining quantity through the order workflow.',
        'Supply an explicitly approved faster prepared profile if available.']
    proposal['revised']=revised
    proposal['id']=sha256(json.dumps(dict(state=state,proposal=proposal),sort_keys=True).encode()).hexdigest()
    return proposal


def apply_recovery(state,payload):
    _require_confirmation(payload)
    proposal=propose_recovery(state,payload['incident_id'])
    if proposal['id']!=payload['proposal_id']:
        raise ValueError('Recovery proposal is stale; preview again')
    if not proposal['assignments']:
        raise ValueError('No feasible assignments to apply')
    result=_materialize(state,proposal)
    incident=_incident(result,payload['incident_id'])
    incident.setdefault('proposal_versions',[]).append(dict(proposal=deepcopy(proposal),decision='applied'))
    incident.setdefault('applied',deepcopy(proposal['revised']))
    incident['impacts']=deepcopy(proposal['impacts'])
    incident['part_impacts']=deepcopy(proposal['part_impacts'])
    incident['status']='recovering'
    incident['actions'].append(dict(timestamp=state['simulation_time'],action='recovery_applied',outcome=proposal['summary']))
    record(result,'recovery_applied',proposal['summary'],source='system')
    return refresh_incidents(schedule(result,'automatic',preserve_mode=True))


def reject_recovery(state,payload):
    _require_confirmation(payload)
    proposal=propose_recovery(state,payload['incident_id'])
    result=deepcopy(state); incident=_incident(result,payload['incident_id'])
    incident.setdefault('proposal_versions',[]).append(dict(proposal=proposal,decision='rejected'))
    incident['status']='rejected'
    incident['actions'].append(dict(timestamp=state['simulation_time'],action='recovery_rejected',outcome='Equipment isolated and parts held'))
    return refresh_incidents(result)


def clear_fault(state,payload):
    _require_confirmation(payload)
    result=deepcopy(state); incident=_incident(result,payload['incident_id'])
    printer=next(p for p in result['printers'] if p['id']==incident['printer_id'])
    if printer.get('fault',{}).get('incident_id')!=incident['id']:
        raise ValueError('Incident is not the current equipment fault')
    refill=payload.get('refill_grams')
    if incident['fault_type'] in {'filament_runout','insufficient_material'} and (refill is None or refill<=0):
        raise ValueError('Positive known refill stock is required')
    if refill is not None:
        if refill<=0:
            raise ValueError('Refill must be positive')
        printer['material']['grams']+=refill
    printer['status']='idle'; printer.pop('fault',None)
    incident['equipment_cleared']=True
    incident['resolution_source']='operator'
    if incident['fault_type']=='network_disconnect':
        incident.setdefault('telemetry',{}).update(connected=True,safe_to_resume=True,simulated=True)
    incident['actions'].append(dict(timestamp=state['simulation_time'],action='equipment_cleared',outcome='Simulated inspection acknowledged',refill_grams=refill))
    return refresh_incidents(result)


def update_incident_telemetry(state, payload):
    """Apply an explicit simulated signal; never dispatch work or release holds."""
    result=deepcopy(state); incident=_incident(result,payload['incident_id'])
    printer=next(p for p in result['printers'] if p['id']==incident['printer_id'])
    if printer.get('fault',{}).get('incident_id')!=incident['id']:
        raise ValueError('Incident is not the current equipment fault')
    if incident['fault_type']!='network_disconnect':
        raise ValueError('Physical faults require confirmed operator inspection or refill')
    incident['telemetry'].update(connected=payload['connected'],safe_to_resume=payload['safe_to_resume'],simulated=True)
    if payload['connected'] and payload['safe_to_resume']:
        printer['status']='idle'; printer.pop('fault',None)
        incident['equipment_cleared']=True
        incident['resolution_source']='printer_telemetry'
        outcome='Simulated printer connection restored and safe signal received; held work still requires recovery'
    else:
        outcome='Simulated printer signal does not confirm a safe connection; equipment remains isolated and work held'
    incident['actions'].append(dict(timestamp=state['simulation_time'],action='printer_telemetry',outcome=outcome))
    record(result,'printer_telemetry',outcome,source='simulation',printer_id=printer['id'])
    return refresh_incidents(result)


def set_recovery_policy(state,payload):
    if payload['mode'] not in {'review','automatic'}:
        raise ValueError('Unknown recovery policy')
    result=deepcopy(state); result['recovery_policy']=payload['mode']
    return result


def automatic_recovery(state,incident_id):
    if state.get('recovery_policy','review')!='automatic':
        return state
    proposal=propose_recovery(state,incident_id)
    orders={o['id']:o for o in state['orders']}
    eligible=proposal['assignments'] and not proposal['blocked'] and all(
        orders[a['order_id']].get('schedule_mode')=='automatic' for a in proposal['assignments']) and all(i['risk']=='on_time' for i in proposal['impacts'])
    if eligible:
        return apply_recovery(state,dict(incident_id=incident_id,proposal_id=proposal['id'],confirmed=True))
    return state


def refresh_incidents(state):
    result=deepcopy(state)
    for incident in result.get('incidents',[]):
        keys={j.get('part_key',j['id']) for j in result['jobs'] if j['id'] in incident['job_ids']}
        completed=len({j.get('part_key',j['id']) for j in result['jobs'] if j['status']=='completed'} & keys)
        complete=completed==len(keys) and (bool(keys) or incident.get('equipment_cleared',False))
        held=any(incident['id'] in o.get('recovery_holds',[]) for o in result['orders'])
        incident['progress']=dict(completed=completed,total=len(incident['job_ids']),remaining=len(incident['job_ids'])-completed,held=held)
        if complete and not held:
            incident['status']='resolved' if incident.get('equipment_cleared') else 'production_restored'
        impacts=incident.get('impacts',[])
        late=sum(i['risk']=='late' for i in impacts)
        unavailable=sum(i['risk']=='unavailable' for i in impacts)
        delay=max((i['delta_seconds'] for i in impacts if i['delta_seconds'] is not None),default=0)
        incident['summary']=f"{incident['status']}: {completed}/{len(keys)} parts completed; {late} late orders, {unavailable} unavailable estimates; maximum completion change {delay:+.0f} seconds; {incident['waste_grams']:.1f} g failed-print waste."
    return result

"""Deterministic, read-only future slots and validated application."""
from copy import deepcopy
from datetime import datetime,timedelta
from hashlib import sha256
import json
from .reservations import ACTIVE,free_grams
from .scheduling import schedule
from .activity import record

def propose(state,mode,order_ids=None,exclude_manual_queues=False,reschedule_queued=False,_queued=None):
 if reschedule_queued:
  draft=deepcopy(state)
  healthy={p['id'] for p in state['printers'] if p['status'] in {'idle','running'} and not p.get('fault')}
  manual={j['printer_id'] for j in state['jobs'] if j['status']=='planned' and j.get('schedule_mode')=='manual'}
  movable=[j for j in state['jobs'] if j['status']=='planned' and j.get('schedule_mode')=='automatic' and not j.get('elapsed_seconds',0) and j['printer_id'] in healthy-manual]
  moving={j['id'] for j in movable}
  draft['jobs']=[j for j in draft['jobs'] if j.get('id') not in moving]
  targets=set(order_ids) if order_ids is not None else {o['id'] for o in state['orders']}
  for order in draft['orders']:
   if order['id'] not in targets:
    order['quantity']=order['successful_quantity']+sum(j['order_id']==order['id'] and j['status'] in ACTIVE for j in state['jobs'])
   # Existing approved parts can move despite a separate held sibling part.
   if any(j['order_id']==order['id'] for j in movable): order['recovery_holds']=[]
  result=propose(draft,mode,order_ids=targets|{j['order_id'] for j in movable},exclude_manual_queues=exclude_manual_queues,_queued=sorted(movable,key=lambda j:j['id']))
  remaining=sorted(movable,key=lambda j:j['id'])
  for item in result['assignments']:
   job=next((j for j in remaining if j['order_id']==item['order_id']),None)
   if job is not None:
    item['existing_job_id']=job['id'];remaining.remove(job)
  result['replanned_job_ids']=sorted(moving)
  result['id']=sha256(json.dumps(dict(state=state,proposal={k:v for k,v in result.items() if k!='id'}),sort_keys=True).encode()).hexdigest()
  return result
 now=datetime.fromisoformat(state['simulation_time'].replace('Z','+00:00'))
 capacity={p['id']:0 if p['status']=='idle' else None for p in state['printers']}
 stock={p['id']:free_grams(state,p) for p in state['printers']}
 for job in state['jobs']:
  if job['status']=='running':
   printer=next(p for p in state['printers'] if p['id']==job['printer_id'])
   if printer['status']=='running': capacity[printer['id']]=job['duration_seconds']-job.get('elapsed_seconds',0)
 for job in state['jobs']:
  if job['status']=='planned' and capacity[job['printer_id']] is not None:
   if exclude_manual_queues and job.get('schedule_mode')=='manual':
    capacity[job['printer_id']]=None
   else:
    capacity[job['printer_id']]+=job['duration_seconds']
 protected={p['id']:sum(next(a['filament_grams'] for a in state['artifacts'] if a['id']==next(o['artifact_id'] for o in state['orders'] if o['id']==j['order_id'])) for j in (_queued or []) if j['printer_id']==p['id']) for p in state['printers']}
 assignments=[];blocked=[]
 for order in sorted(state['orders'],key=lambda o:(o['production_due'],-o['priority'],o['id'])):
  if order_ids is not None and order['id'] not in order_ids:continue
  if order.get('recovery_holds') or order['status']=='cancelled':continue
  artifact=next(a for a in state['artifacts'] if a['id']==order['artifact_id'])
  existing=sum(j['order_id']==order['id'] and j['status'] in ACTIVE for j in state['jobs'])
  remaining=order['quantity']-order['successful_quantity']-existing
  originals=[j for j in (_queued or []) if j['order_id']==order['id']]
  for number in range(max(0,remaining)):
   if number<len(originals): protected[originals[number]['printer_id']]-=artifact['filament_grams']
   candidates=[p for p in state['printers'] if capacity[p['id']] is not None and set(artifact['required_capabilities']).issubset(p['capabilities']) and p['material']['type']==artifact['filament_type'] and p['material']['color']==artifact['color'] and stock[p['id']]-protected[p['id']]+1e-9>=artifact['filament_grams']]
   if not candidates:
    blocked.append(dict(order_id=order['id'],quantity=remaining-number,reason='No available compatible capacity or unreserved filament; held printers require user action.'));break
   printer=min(candidates,key=lambda p:(capacity[p['id']],p['id']));pid=printer['id']
   start=capacity[pid];capacity[pid]+=artifact['duration_seconds'];stock[pid]-=artifact['filament_grams']
   assignments.append(dict(order_id=order['id'],printer_id=pid,start=(now+timedelta(seconds=start)).isoformat(),finish=(now+timedelta(seconds=capacity[pid])).isoformat(),filament_grams=artifact['filament_grams'],duration_seconds=artifact['duration_seconds']))
 result=dict(session_id=state['session_id'],revision=state['revision'],mode=mode,assignments=assignments,blocked=blocked,assumptions='Estimates use model profiles, immediate manual starts and no future faults. Existing held work is preserved. Apply automatic starts the clock; manual work waits for your start.')
 result['id']=sha256(json.dumps(dict(state=state,proposal=result),sort_keys=True).encode()).hexdigest()
 return result

def apply_proposal(state,proposal_id,mode,clock_speed=60,require_on_time=False,order_ids=None,exclude_manual_queues=False,reschedule_queued=False):
 proposal=propose(state,mode,order_ids=order_ids,exclude_manual_queues=exclude_manual_queues,reschedule_queued=reschedule_queued)
 if proposal['id']!=proposal_id:
  raise ValueError('Schedule proposal is stale; preview again before applying')
 if not set(proposal.get('replanned_job_ids',[])).issubset({a.get('existing_job_id') for a in proposal['assignments']}):
  raise ValueError('Cannot preserve every approved queued part with this plan')
 if not proposal['assignments']:
  raise ValueError('No feasible assignments to apply')
 if require_on_time:
  deadlines={order['id']:datetime.fromisoformat(order['production_due']) for order in state['orders']}
  if proposal['blocked'] or any(datetime.fromisoformat(item['finish'])>deadlines[item['order_id']] for item in proposal['assignments'] if order_ids is None or item['order_id'] in order_ids):
   raise ValueError('Cannot meet every production deadline with this plan; adjust dates, quantity or available material')
 result=deepcopy(state)
 for item in proposal['assignments']:
  order=next(o for o in result['orders'] if o['id']==item['order_id'])
  if 'existing_job_id' in item:
   job=next(j for j in result['jobs'] if j['id']==item['existing_job_id'])
   job.update(printer_id=item['printer_id'],estimated_start=item['start'],estimated_finish=item['finish'])
   continue
  order['schedule_mode']=mode
  attempt=sum(j['order_id']==order['id'] for j in result['jobs'])+1
  result['jobs'].append(dict(id=f"{order['id']}-{attempt}",order_id=order['id'],printer_id=item['printer_id'],status='planned',elapsed_seconds=0,duration_seconds=item['duration_seconds'],schedule_mode=mode,estimated_start=item['start'],estimated_finish=item['finish']))
 reviewed={item['order_id'] for item in proposal['assignments']+proposal['blocked']}
 for order in result['orders']:
  if order['id'] in reviewed and (order_ids is None or order['id'] in order_ids):
   committed=sum(j['order_id']==order['id'] and j['status'] in ACTIVE for j in result['jobs'])
   order['requires_schedule_review']=order['successful_quantity']+committed<order['quantity']
 record(result,'schedule_applied','Applied reviewed schedule and material reservations')
 result=schedule(result,'automatic',preserve_mode=True)
 if mode=='automatic':
  result['running']=True;result['clock_speed']=clock_speed
 return result

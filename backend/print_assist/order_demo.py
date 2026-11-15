"""Explicitly consented, offline request-to-print demonstrations."""
from copy import deepcopy
from .shop import simulate
from .proposals import propose, apply_proposal
from .activity import record


def _step(demo, name, status, timestamp):
    step = next(item for item in demo['steps'] if item['id'] == name)
    if step['status'] != status:
        step.update(status=status, timestamp=timestamp)


def simulate_automatic_order(state, payload):
    """Accept and confirm only this incoming request when its whole plan is safe."""
    result = simulate(state, {**payload, 'mode':'automatic'})
    request = result['shop_requests'][-1]
    now = result['simulation_time']
    matched = request['order_id'] is not None
    demo = dict(id='DEMO-' + request['id'], request_id=request['id'],
                order_id=request['order_id'], status='needs_attention', steps=[
        dict(id=name, label=label, status='completed' if name == 'intake' else 'pending',
             timestamp=now if name == 'intake' else None)
        for name, label in [('intake','Incoming request received'), ('match','Saved model matched'),
                            ('schedule','Complete schedule confirmed'), ('printing','Printing'),
                            ('completion','Order complete')]])
    result.setdefault('order_demonstrations', []).append(demo)
    if not matched:
        demo['reason'] = 'Choose a saved model before this request can be scheduled.'
        _step(demo,'match','needs_attention',now)
    else:
        _step(demo,'match','completed',now)
        plan = propose(result,'automatic',order_ids=[request['order_id']],exclude_manual_queues=True,reschedule_queued=True)
        try:
            result = apply_proposal(result,plan['id'],'automatic',payload.get('clock_speed',3600),
                                    require_on_time=True,order_ids=[request['order_id']],exclude_manual_queues=True,reschedule_queued=True)
        except ValueError as error:
            demo['reason'] = plan['blocked'][0]['reason'] if plan['blocked'] else str(error)
            _step(demo,'schedule','needs_attention',now)
        else:
            demo = result['order_demonstrations'][-1]
            _step(demo,'schedule','completed',now)
            demo['status'] = 'running'
    record(result,'automatic_order_demo',demo.get('reason','Confirmed local automatic order demonstration'),
           source='simulation',status='blocked' if demo['status']=='needs_attention' else 'accepted',order_id=demo['order_id'])
    return refresh_order_demonstrations(result)


def refresh_order_demonstrations(state):
    """Derive progress without re-confirming held work or changing production."""
    result = deepcopy(state)
    now = result['simulation_time']
    for demo in result.get('order_demonstrations',[]):
        if demo['order_id'] is None:
            continue
        order = next((row for row in result['orders'] if row['id'] == demo['order_id']),None)
        if order is None or order['status'] == 'cancelled':
            demo.update(status='needs_attention',reason='Order is missing or cancelled; operator action is required.')
            continue
        if order['successful_quantity'] >= order['quantity']:
            demo['status'] = 'completed'
            demo.pop('reason',None)
            _step(demo,'printing','completed',now)
            _step(demo,'completion','completed',now)
            continue
        if next(step for step in demo['steps'] if step['id'] == 'schedule')['status'] != 'completed':
            continue
        jobs = [job for job in result['jobs'] if job['order_id'] == order['id'] and job['status'] in ('running','planned','pending','paused')]
        unavailable = {printer['id'] for printer in result['printers'] if printer['status'] not in ('idle','running')}
        if order.get('recovery_holds') or not jobs or any(job['printer_id'] in unavailable for job in jobs):
            demo.update(status='needs_attention',reason='Printing is unavailable or held; operator action is required.')
            _step(demo,'printing','needs_attention',now)
        else:
            demo['status'] = 'running'
            demo.pop('reason',None)
            _step(demo,'printing','running' if any(job['status'] == 'running' for job in jobs) else 'pending',now)
    return result

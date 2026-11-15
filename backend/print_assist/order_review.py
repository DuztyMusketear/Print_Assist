"""Corrections to uncommitted orders awaiting human schedule confirmation."""
from copy import deepcopy
from .activity import record
from .reservations import ACTIVE


def mutable_order(state,payload):
    order=next((item for item in state['orders'] if item['id']==payload['order_id']),None)
    if order is None or order['status'] in {'cancelled','completed'} or order['successful_quantity'] or any(job['order_id']==order['id'] and (job['status'] not in {'pending','planned','cancelled'} or job.get('elapsed_seconds',0)>0) for job in state['jobs']):
        raise ValueError('Only uncommitted orders that have not started can be changed')
    if not payload.get('confirmed'):
        raise ValueError('Confirm the change before updating scheduled work')
    return order


def release(state,order):
    for job in state['jobs']:
        if job['order_id']==order['id'] and job['status'] in ACTIVE:
            job['status']='cancelled'
    for printer in state['printers']:
        if printer['status']=='reserved' and not any(job['printer_id']==printer['id'] and job['status'] in ACTIVE for job in state['jobs']):
            printer['status']='idle'


def revise(state,payload):
    result=deepcopy(state);order=mutable_order(result,payload)
    if not any(artifact['id']==payload['order']['artifact_id'] for artifact in result['artifacts']):
        raise ValueError('Choose a saved model')
    order.update(payload['order'])
    release(result,order)
    order['requires_schedule_review']=True
    record(result,'order_revised','Updated held order; review a fresh schedule before starting',order_id=order['id'])
    return result


def delete(state,payload):
    result=deepcopy(state)
    if payload.get('order_ids') is not None:
        ids=payload['order_ids']
        orders=[mutable_order(result,dict(order_id=oid,confirmed=payload.get('confirmed'))) for oid in ids]
        if any(not order.get('requires_schedule_review') or any(j['order_id']==order['id'] and j['status'] in ACTIVE for j in result['jobs']) for order in orders):
            raise ValueError('Only uncommitted orders awaiting review can be bulk deleted')
        for order in orders:
            result=delete(result,dict(order_id=order['id'],confirmed=True))
        return result
    order=mutable_order(result,payload)
    release(result,order)
    order.update(status='cancelled',requires_schedule_review=False)
    for request in result.get('shop_requests',[]):
        if request.get('order_id')==order['id']:
            request['status']='cancelled'
    record(result,'order_deleted','Deleted unstarted scheduled order; commitments released',order_id=order['id'])
    return result

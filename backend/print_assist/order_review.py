"""Corrections to uncommitted orders awaiting human schedule confirmation."""
from copy import deepcopy
from .activity import record
from .reservations import ACTIVE


def revise(state,payload):
    result=deepcopy(state)
    order=next((item for item in result['orders'] if item['id']==payload['order_id']),None)
    if order is None or not order.get('requires_schedule_review') or order['successful_quantity'] or any(job['order_id']==order['id'] and job['status'] in ACTIVE for job in result['jobs']):
        raise ValueError('Only uncommitted orders awaiting review can be edited')
    if not any(artifact['id']==payload['order']['artifact_id'] for artifact in result['artifacts']):
        raise ValueError('Choose a saved model')
    order.update(payload['order'])
    record(result,'order_revised','Updated held order; review a fresh schedule before starting',order_id=order['id'])
    return result

def delete(state,payload):
    result=deepcopy(state)
    selected=set(payload['order_ids'])
    orders=[item for item in result['orders'] if item['id'] in selected]
    if len(orders)!=len(selected) or any(not order.get('requires_schedule_review') or order['successful_quantity'] or any(job['order_id']==order['id'] and job['status'] in ACTIVE for job in result['jobs']) for order in orders):
        raise ValueError('Only uncommitted orders awaiting review can be deleted')
    result['orders']=[item for item in result['orders'] if item['id'] not in selected]
    for order in orders:
        record(result,'order_deleted','Deleted an order awaiting confirmation',order_id=order['id'])
    return result

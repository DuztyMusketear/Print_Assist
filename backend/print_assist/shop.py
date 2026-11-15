"""Offline example shop requests; decisions never start printing."""
from copy import deepcopy
from datetime import datetime, timedelta
from uuid import uuid4
from .activity import record


def load_examples(state):
    result = deepcopy(state)
    requests = result.setdefault('shop_requests', [])
    mappings = result.setdefault('product_mappings', {'EXAMPLE-FIGURE': 'figure-pla-blue'})
    mappings.setdefault('EXAMPLE-FIGURE','figure-pla-blue')
    now = datetime.fromisoformat(state['simulation_time'])
    for number, sku, name, quantity in [(1, 'EXAMPLE-FIGURE', 'Blue PLA figure', 2),
                                      (2, 'EXAMPLE-FIGURE', 'Blue PLA figure', 1),
                                      (3, 'EXAMPLE-CUSTOM', 'Custom shop product', 3)]:
        request_id = 'EXAMPLE-' + str(number).zfill(3)
        if not any(item['id'] == request_id for item in requests):
            requests.append(dict(id=request_id, source='example', sku=sku, product_name=name,
                artifact_id=mappings.get(sku), quantity=quantity, priority=0,
                production_due=(now + timedelta(hours=12)).isoformat(), ship_by=(now + timedelta(hours=24)).isoformat(),
                status='pending', order_id=None))
    return result


def decide(state, payload):
    result = deepcopy(state)
    request = next((row for row in result.get('shop_requests', []) if row['id'] == payload['request_id']), None)
    if request is None or request['status'] != 'pending':
        raise ValueError('Request is missing or already reviewed')
    if payload['decision'] == 'reject':
        request['status'] = 'rejected'
    else:
        artifact_id = payload.get('artifact_id') or result['product_mappings'].get(request['sku']) or request.get('artifact_id')
        if not any(artifact['id'] == artifact_id for artifact in result['artifacts']):
            raise ValueError('Select a saved model before accepting this product')
        artifact = next(artifact for artifact in result['artifacts'] if artifact['id'] == artifact_id)
        if _material_mismatch(request, artifact):
            raise ValueError('Saved model does not match the requested material')
        order_id = str(uuid4())
        result['orders'].append(dict(id=order_id, artifact_id=artifact_id, quantity=request['quantity'],
            priority=request['priority'], production_due=request['production_due'], ship_by=request['ship_by'],
            status='queued', successful_quantity=0, schedule_mode='automatic', requires_schedule_review=True))
        result['product_mappings'][request['sku']] = artifact_id
        request.update(status='accepted', order_id=order_id, artifact_id=artifact_id)
        for pending in result['shop_requests']:
            if pending['status']=='pending' and pending['sku']==request['sku']:
                pending['artifact_id']=artifact_id
    record(result, 'shop_request_' + request['status'], request['id'] + ': ' + request['status'], order_id=request['order_id'])
    return result


def _material_mismatch(request, model):
    return any(request.get(field) is not None and request[field] != model[field]
               for field in ('filament_type', 'color'))


def simulate(state,payload):
    """Construct a local simulated request through the shared shop intake path."""
    return ingest_request(state,payload)


def ingest_request(state,payload):
    """Match a saved product and hold it for the existing approval workflow."""
    result=deepcopy(state)
    mappings=result.setdefault('product_mappings',{})
    if payload.get('product_id') == 'EXAMPLE-FIGURE':
        mappings.setdefault('EXAMPLE-FIGURE','figure-pla-blue')
    artifact_id=payload.get('artifact_id') or mappings.get(payload.get('product_id'))
    model=next((model for model in state['artifacts'] if model['id']==artifact_id),None)
    if payload.get('artifact_id') is not None and model is None:
        raise ValueError('Choose a saved model or an unmatched demo product')
    request_id='SIM-'+uuid4().hex[:8].upper()
    sku=payload.get('product_id') or ('MODEL-'+model['id'] if model else 'UNMATCHED-DEMO')
    request=dict(id=request_id,source=payload.get('source','simulation'),sku=sku,
        product_name=model['name'] if model else 'Unmatched demo product',artifact_id=model['id'] if model else None,
        quantity=payload['quantity'],priority=payload['priority'],production_due=payload['production_due'],ship_by=payload['ship_by'],status='pending',order_id=None)
    for field in ('event_id','filament_type','color'):
        if payload.get(field) is not None:
            request[field]=payload[field]
    mismatch=model is not None and _material_mismatch(request,model)
    if mismatch:
        request['attention_reason']='Saved model does not match the requested material.'
    result.setdefault('shop_requests',[]).append(request)
    record(result,'incoming_order_simulated',request_id+': local incoming request simulated')
    if payload['mode']=='automatic' and model is not None and not mismatch:
        result=decide(result,dict(request_id=request_id,decision='accept',artifact_id=model['id']))
    return result

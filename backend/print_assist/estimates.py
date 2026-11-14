"""Read-only draft feasibility using the authoritative queue proposal rules."""
from copy import deepcopy
from datetime import datetime
from .proposals import propose


def estimate(state,order):
    if order['quantity']>10000:
        raise ValueError('Plan up to 10,000 copies per order')
    if not any(model['id']==order['artifact_id'] for model in state['artifacts']):
        raise ValueError('Choose a saved model')
    draft=deepcopy(state)
    draft_id='draft-estimate'
    draft['orders'].append(dict(order,id=draft_id,status='queued',successful_quantity=0,requires_schedule_review=True))
    proposal=propose(draft,'automatic')
    slots=[slot for slot in proposal['assignments'] if slot['order_id']==draft_id]
    blocked=next((row for row in proposal['blocked'] if row['order_id']==draft_id),None)
    due=datetime.fromisoformat(order['production_due'])
    on_time=sum(datetime.fromisoformat(slot['finish'])<=due for slot in slots)
    finish=max((slot['finish'] for slot in slots),default=None) if blocked is None else None
    feasible=on_time==order['quantity']
    reason='Fits current compatible capacity and filament.' if feasible else blocked['reason'] if blocked else f'Only {on_time} copies fit before the selected print deadline.'
    return dict(session_id=state['session_id'],revision=state['revision'],feasible=feasible,
                on_time_quantity=on_time,estimated_finish=finish,reason=reason)

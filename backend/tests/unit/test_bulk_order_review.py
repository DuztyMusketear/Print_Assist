"""Bulk review removal preserves main's atomic confirmation and production history."""
from copy import deepcopy
import pytest
from print_assist.scenarios import scenario_state
from print_assist.order_review import delete
from print_assist.contracts import DeleteOrderPayload


def held():
    state=scenario_state('seeded')
    for order in state['orders']:order['requires_schedule_review']=True
    return state


def test_bulk_cancellation_retains_orders_and_request_history():
    state=held();ids=[o['id'] for o in state['orders']]
    state['shop_requests']=[dict(order_id=ids[0],status='accepted')]
    before=deepcopy(state)
    result=delete(state,dict(order_ids=ids,confirmed=True))
    assert state==before
    assert all(o['status']=='cancelled' for o in result['orders'])
    assert len(result['orders'])==2 and result['shop_requests'][0]['status']=='cancelled'
    assert len(result['events'])==2


@pytest.mark.parametrize('change', ['unknown','active','unreviewed','unconfirmed'])
def test_bulk_cancellation_rejects_entire_selection_before_any_change(change):
    state=held();ids=[o['id'] for o in state['orders']]
    if change=='unknown':ids.append('unknown')
    if change=='active':state['jobs']=[dict(order_id=ids[1],status='running',elapsed_seconds=1)]
    if change=='unreviewed':state['orders'][1]['requires_schedule_review']=False
    before=deepcopy(state)
    with pytest.raises(ValueError):delete(state,dict(order_ids=ids,confirmed=change!='unconfirmed'))
    assert state==before


@pytest.mark.parametrize('payload',[{},dict(order_id='one',order_ids=['two']),dict(order_ids=[]),dict(order_ids=['one','one'])])
def test_deletion_contract_requires_one_unique_target_form(payload):
    with pytest.raises(ValueError):DeleteOrderPayload.model_validate(payload)

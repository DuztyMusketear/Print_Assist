from copy import deepcopy

import pytest

from print_assist.scenarios import scenario_state


def trigger(state, **payload):
    from print_assist.demo_scenarios import trigger_scenario
    return trigger_scenario(state, payload)


def incoming(order, event_id='purchase', **changes):
    return dict(event='marketplace_order', event_id=event_id,
                order={**order, 'mode':'end_to_end'}, **changes)


def test_mapped_order_event_is_persistent_idempotent_and_preserves_state(order):
    state = scenario_state('empty')
    state['printers'] = [dict(state['printers'][0], id='custom-floor')]
    state['product_mappings'] = {'CUSTOM':order['artifact_id']}
    before = deepcopy(state)
    payload = incoming({**order, 'artifact_id':None}, product_id='CUSTOM')
    result = trigger(state, **payload)
    assert state == before
    assert result['orders'][-1]['quantity'] == order['quantity']
    assert {job['printer_id'] for job in result['jobs']} == {'custom-floor'}
    request = result['shop_requests'][-1]
    assert (request['sku'],request['source'],request['event_id']) == ('CUSTOM','simulated_etsy','purchase')
    event = result['scenario_events'][-1]
    assert event['status'] == 'accepted'
    assert event['execution_mode'] == 'deterministic/agents_off'
    assert event['before']['jobs'] == [] and len(event['after']['jobs']) == 2
    assert event['impacts'][0]['order_id'] == result['orders'][-1]['id']
    assert event['tool_calls'][0]['name'] == 'order_demo.simulate_automatic_order'
    assert trigger(result, **payload) == result
    with pytest.raises(ValueError, match='identity conflict'):
        trigger(result, **{**payload,'product_id':'different'})


@pytest.mark.parametrize('changes,reason', [
    ({'product_id':'UNKNOWN'}, 'saved model'),
    ({'filament_type':'PETG'}, 'material'),
    ({'color':'red'}, 'material'),
])
def test_unknown_or_material_mismatch_stays_in_inbox(order, changes, reason):
    payload = incoming({**order,'artifact_id':None}, **changes)
    result = trigger(scenario_state('empty'), **payload)
    assert not result['jobs'] and not result['orders']
    assert result['shop_requests'][-1]['status'] == 'pending'
    assert result['scenario_events'][-1]['status'] == 'blocked'
    assert reason in result['scenario_events'][-1]['notification']


def test_events_sequence_thermal_isolation_review_and_confirmed_restore(order):
    state = trigger(scenario_state('empty'), **incoming(order))
    healthy = deepcopy(state['jobs'][1])
    pid = state['jobs'][0]['printer_id']
    state = trigger(state,event='thermal_fault',event_id='heat',printer_id=pid)
    assert state.get('recovery_policy','review') == 'review'
    assert next(j for j in state['jobs'] if j['id']==healthy['id']) == healthy
    assert state['incidents'][0]['status'] == 'awaiting_review'
    with pytest.raises(ValueError,match='confirmation'):
        trigger(state,event='printer_restored',event_id='restore',printer_id=pid)
    restored = trigger(state,event='printer_restored',event_id='restore',printer_id=pid,confirmed=True)
    assert next(p for p in restored['printers'] if p['id']==pid)['status'] == 'idle'
    assert restored['orders'][0]['recovery_holds']
    assert len(restored['scenario_events']) == 3
    assert len(restored['scenario_events'][-1]['impacts']) == 1


def test_idle_low_stock_isolates_and_automatic_recovery_refills(order):
    state = scenario_state('seeded')
    state['printers'] = state['printers'][:1]
    state = trigger(state,event='insufficient_filament',event_id='low',printer_id='printer-1',available_grams=3)
    assert state['printers'][0]['material']['grams'] == 3
    assert state['printers'][0]['status'] == 'faulted'
    restored = trigger(state,event='printer_restored',event_id='refill',printer_id='printer-1',confirmed=True,refill_grams=47)
    assert restored['printers'][0]['material']['grams'] == 50
    assert len(restored['jobs']) == 1
    assert restored['jobs'][0]['status'] == 'running'


@pytest.mark.parametrize('status',['paused','offline'])
def test_restore_controls_existing_equipment_and_preserves_policy(status):
    state = scenario_state('empty')
    state['recovery_policy'] = 'automatic'
    state['printers'][0]['status'] = status
    result = trigger(state,event='printer_restored',event_id=status,printer_id='printer-1')
    assert result['printers'][0]['status'] == 'idle'
    assert result['recovery_policy'] == 'automatic'


@pytest.mark.parametrize('payload,reason',[
    (dict(event='thermal_fault',event_id='e',printer_id='printer-1'),'active'),
    (dict(event='thermal_fault',event_id='e',printer_id='unknown'),'Unknown printer'),
    (dict(event='marketplace_order',event_id='e'),'order'),
    (dict(event='printer_restored',event_id='e',printer_id='printer-1'),'paused, offline or faulted'),
])
def test_invalid_event_does_not_change_state(payload,reason):
    state = scenario_state('empty'); before = deepcopy(state)
    with pytest.raises(ValueError,match=reason):
        trigger(state,**payload)
    assert state == before


@pytest.mark.parametrize('mode',['manual','automatic'])
def test_urgent_inbox_modes_do_not_confirm_printing(order,mode):
    result = trigger(scenario_state('empty'),event='urgent_order',event_id=mode,
                     order={**order,'mode':mode,'priority':12})
    assert not result['jobs']
    request = result['shop_requests'][-1]
    assert request['status'] == ('pending' if mode=='manual' else 'accepted')
    if mode=='automatic':
        assert result['orders'][-1]['requires_schedule_review']
    assert result['scenario_events'][-1]['tool_calls'][0]['name'] == 'shop.simulate'


def test_restore_can_apply_previously_blocked_automatic_incident(order):
    state = scenario_state('empty'); state['printers'] = state['printers'][:1]
    state = trigger(state,**incoming({**order,'quantity':1}))
    state = trigger(state,event='thermal_fault',event_id='heat',printer_id='printer-1',recovery_mode='automatic')
    assert not state['incidents'][0].get('applied')
    state = trigger(state,event='printer_restored',event_id='inspect',printer_id='printer-1',confirmed=True)
    assert state['printers'][0]['status'] == 'running'
    assert state['incidents'][0]['applied']
    assert not state['orders'][0]['recovery_holds']
    assert len(state['jobs']) == 2


def test_restore_after_automatic_transfer_does_not_duplicate_attempts(order):
    state = trigger(scenario_state('empty'),**incoming({**order,'quantity':1}))
    state = trigger(state,event='thermal_fault',event_id='heat',printer_id='printer-1',recovery_mode='automatic')
    assert state['incidents'][0]['applied']
    restored = trigger(state,event='printer_restored',event_id='inspect',printer_id='printer-1',confirmed=True)
    assert len(restored['jobs']) == len(state['jobs'])
    assert not any(call['name']=='recovery.automatic_recovery' for call in restored['scenario_events'][-1]['tool_calls'])


def test_operator_cannot_accept_material_mismatch_without_compatible_saved_model(order):
    from print_assist.shop import decide
    state = trigger(scenario_state('empty'),**incoming(order,filament_type='PETG'))
    with pytest.raises(ValueError,match='requested material'):
        decide(state,dict(request_id=state['shop_requests'][-1]['id'],decision='accept'))
    state['artifacts'].append({**state['artifacts'][0],'id':'petg','filament_type':'PETG'})
    result = decide(state,dict(request_id=state['shop_requests'][-1]['id'],decision='accept',artifact_id='petg'))
    assert result['orders'][-1]['artifact_id'] == 'petg'
    assert not result['jobs']


def test_reusable_ingestion_matches_saved_product_and_retains_requirements(order):
    from print_assist.shop import ingest_request
    state = scenario_state('empty')
    state['product_mappings'] = {'SHOP-ITEM':order['artifact_id']}
    result = ingest_request(state,{**order,'artifact_id':None,'product_id':'SHOP-ITEM',
                                   'mode':'automatic','filament_type':'PLA','color':'blue',
                                   'source':'simulated_etsy','event_id':'external-001'})
    request = result['shop_requests'][-1]
    assert request['event_id'] == 'external-001'
    assert (request['filament_type'],request['color']) == ('PLA','blue')
    assert request['order_id'] == result['orders'][-1]['id']
    assert not result['jobs']

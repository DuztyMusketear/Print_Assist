"""Offline intake, production and durable progress workflow."""
from copy import deepcopy
from print_assist.order_demo import simulate_automatic_order, refresh_order_demonstrations
from print_assist.scenarios import scenario_state
from print_assist.scheduling import schedule
from print_assist.simulation import advance
from print_assist.store import Store


def test_automatic_demo_preserves_active_work_and_persists_completed_progress(tmp_path,order):
    fresh = scenario_state('seeded')
    assert all(printer['status']=='idle' for printer in fresh['printers'])
    assert not fresh.get('incidents')
    state = schedule(fresh,'automatic')
    active = deepcopy(state['jobs'])
    store = Store(tmp_path/'automatic-demo.sqlite3')
    result = simulate_automatic_order(state,{**order,'quantity':4,'mode':'end_to_end'})
    assert result['jobs'][:len(active)] == active
    assert result['controls'] == {'agents_enabled':False,'automatic_triggers':False}
    with store.transaction() as db:
        store.save(db,result)
    reopened = Store(store.path)
    with reopened.transaction() as db:
        loaded = reopened.load(db)
    assert loaded == result
    completed = refresh_order_demonstrations(advance(loaded,21600))
    assert all(row['successful_quantity']==row['quantity'] for row in completed['orders'])
    assert completed['order_demonstrations'][0]['status']=='completed'
    assert sum(printer['material']['grams'] for printer in completed['printers']) == 2775
    assert not completed.get('incidents')
    with reopened.transaction() as db:
        reopened.save(db,completed)
    with reopened.transaction() as db:
        assert reopened.load(db) == completed

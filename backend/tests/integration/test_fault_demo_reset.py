from uuid import uuid4

from print_assist.contracts import ResetCommand
from print_assist.service import FactoryService


def test_reset_demo_uses_registered_fleet_and_preserves_retry_receipt(tmp_path):
    service = FactoryService(tmp_path / 'demo.db')
    with service.store.transaction() as db:
        state = service.store.load(db)
        state['printers'] = state['printers'][:1]
        state['printers'][0]['id'] = 'registered-red'
        state['printers'][0]['material'].update(type='PETG', color='red', grams=1)
        service.store.save(db, state)
    command = ResetCommand.model_validate(dict(session_id=state['session_id'], expected_revision=state['revision'],
        idempotency_key=str(uuid4()), payload=dict(scenario='fault-demo')))
    result = service.reset(command)
    assert result['session_id'] != state['session_id']
    assert len(result['printers']) == 1
    assert result['printers'][0]['id'] == 'registered-red'
    assert result['printers'][0]['material'] == dict(type='PETG', color='red', grams=1000)
    assert len(result['jobs']) == 4
    assert result['running'] is False
    assert service.reset(command) == result

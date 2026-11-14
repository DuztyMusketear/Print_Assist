from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from fastapi.testclient import TestClient
from print_assist.api import create_app


def envelope(state,payload):
    return dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=payload)


def test_reset_replaces_state_replays_safely_and_rejects_old_work(tmp_path):
    with TestClient(create_app(tmp_path/'state.sqlite3')) as client:
        original=client.get('/api/state').json()
        request=envelope(original,{'scenario':'seeded'})
        response=client.post('/api/scenarios/reset',json=request)
        assert response.status_code==200,response.text
        seeded=response.json()
        assert len(seeded['printers'])==3 and len(seeded['orders'])==2
        assert seeded['session_id']!=original['session_id'] and seeded['revision']==0
        assert not seeded['running'] and not seeded['controls']['agents_enabled']
        assert client.post('/api/scenarios/reset',json=request).json()==seeded
        assert client.post('/api/advance',json=envelope(original,{'seconds':1})).status_code==409
        zero=client.post('/api/advance',json=envelope(seeded,{'seconds':0}))
        assert zero.json()==seeded
        scheduled=client.post('/api/schedule',json=envelope(seeded,{'mode':'automatic'})).json()
        assert any(event['type']=='job_assigned' for event in scheduled['events'])
        replay=client.post('/api/scenarios/reset',json=request).json()
        assert replay==seeded
        assert client.get('/api/state').json()==scheduled
        empty=client.post('/api/scenarios/reset',json=envelope(scheduled,{'scenario':'empty'})).json()
        assert empty['orders']==[] and empty['jobs']==[] and empty['modeling_tasks']==[]
        assert client.post('/api/scenarios/reset',json=request).status_code==409


def test_printer_commands_validate_replay_and_preserve_atomicity(tmp_path):
    with TestClient(create_app(tmp_path/'state.sqlite3')) as client:
        original=client.get('/api/state').json()
        for payload in [{'printer_id':'printer-1','action':'bad'}, {'printer_id':'printer-1','action':'pause','extra':1}]:
            assert client.post('/api/printers/control',json=envelope(original,payload)).status_code==422
        assert client.post('/api/printers/control',json=envelope(original,{'printer_id':'missing','action':'pause'})).status_code==409
        assert client.get('/api/state').json()==original
        request=envelope(original,{'printer_id':'printer-1','action':'offline'})
        stopped=client.post('/api/printers/control',json=request).json()
        assert stopped['printers'][0]['status']=='offline'
        assert client.post('/api/printers/control',json=request).json()==stopped
        assert client.post('/api/printers/control',json=envelope(original,{'printer_id':'printer-2','action':'pause'})).status_code==409
        assert stopped['events'][-1]['printer_id']=='printer-1'
        assert client.post('/api/scenarios/reset',json=envelope(stopped,{'scenario':'unknown'})).status_code==422


def test_two_simultaneous_resets_accept_only_one_mutation(tmp_path):
    from print_assist.service import FactoryService
    from print_assist.contracts import ResetCommand
    service=FactoryService(tmp_path/'state.sqlite3')
    state=service.snapshot()
    commands=[ResetCommand.model_validate(envelope(state,{'scenario':'seeded'})) for _ in range(2)]
    def reset(command):
        try: service.reset(command);return 'accepted'
        except ValueError:return 'conflict'
    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(reset,commands))==['accepted','conflict']


def test_competing_schedules_create_attempts_once_and_replay_without_reserving_twice(tmp_path):
    from print_assist.service import FactoryService
    from print_assist.contracts import ResetCommand, ScheduleCommand
    service=FactoryService(tmp_path/'state.sqlite3')
    state=service.reset(ResetCommand.model_validate(envelope(service.snapshot(),{'scenario':'seeded'})))
    commands=[ScheduleCommand.model_validate(envelope(state,{'mode':'manual'})) for _ in range(2)]
    def assign(command):
        try: return service.schedule(command)
        except ValueError: return None
    with ThreadPoolExecutor(2) as pool:
        results=list(pool.map(assign,commands))
    accepted=[result for result in results if result is not None]
    assert len(accepted)==1
    result=accepted[0]
    assert len(result['jobs'])==3
    assert len({job['printer_id'] for job in result['jobs']})==3
    assert all(printer['material']['grams']==1000 for printer in result['printers'])
    winner=commands[results.index(result)]
    assert service.schedule(winner)==result
    assert service.snapshot()==result


def test_reset_discards_mutated_inventory_custom_data_and_enabled_flags(tmp_path):
    from print_assist.service import FactoryService
    from print_assist.contracts import ResetCommand
    service=FactoryService(tmp_path/'state.sqlite3')
    with service.store.transaction() as db:
        state=service.store.load(db)
        state['running']=True
        state['controls']={'agents_enabled':True,'automatic_triggers':True}
        state['printers'][0]['material']['grams']=1
        state['artifacts'].append({'id':'custom'})
        state['modeling_tasks']=[{'id':'custom-task'}]
        state['jobs']=[{'id':'retired-attempt','status':'paused'}]
        service.store.save(db,state)
    reset=service.reset(ResetCommand.model_validate(envelope(state,{'scenario':'empty'})))
    assert reset['controls']=={'agents_enabled':False,'automatic_triggers':False}
    assert not reset['running']
    assert all(printer['material']['grams']==1000 and printer['status']=='idle' for printer in reset['printers'])
    assert reset['jobs']==reset['modeling_tasks']==reset['orders']==[]
    assert [artifact['id'] for artifact in reset['artifacts']]==['figure-pla-blue']
    assert [event['type'] for event in reset['events']]==['scenario_reset']

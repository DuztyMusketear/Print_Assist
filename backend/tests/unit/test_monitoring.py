from copy import deepcopy
from uuid import uuid4
from print_assist.scenarios import scenario_state


def test_forecasts_share_capacity_and_stock_without_mutation():
    from print_assist.monitoring import project
    state=scenario_state('seeded')
    original=deepcopy(state)
    result=project(state)
    assert state==original
    assert result['forecasts'][0]['completion']=='2026-11-15T04:00:00+00:00'
    assert result['forecasts'][0]['risk']=='on_time'
    assert result['forecasts'][1]['completion']=='2026-11-15T04:00:00+00:00'
    state['printers']=[]
    assert all(f['risk']=='unavailable' for f in project(state)['forecasts'])


def test_clock_tick_pause_replay_and_reset(tmp_path):
    from print_assist.service import FactoryService
    from print_assist.contracts import ClockCommand, ResetCommand
    service=FactoryService(tmp_path/'state.sqlite3')
    def request(cls,payload):
        state=service.snapshot()
        return cls.model_validate(dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=payload))
    initial=service.snapshot()
    service.tick()
    assert service.snapshot()==initial
    command=request(ClockCommand,dict(running=True,speed=60))
    started=service.clock(command)
    service.tick()
    assert service.snapshot()['simulation_time']!=started['simulation_time']
    service.clock(command)
    assert service.snapshot()['simulation_time']!=started['simulation_time']
    service.clock(request(ClockCommand,dict(running=False,speed=60)))
    stopped=service.snapshot()
    service.tick()
    assert service.snapshot()==stopped
    reset=service.reset(request(ResetCommand,dict(scenario='empty')))
    assert not reset['running'] and reset['clock_speed']==60


def test_forecast_deadline_material_holds_and_running_reservations():
    from print_assist.monitoring import project
    from print_assist.scheduling import schedule
    state=schedule(scenario_state('seeded'))
    state['orders'][0]['production_due']='2026-11-15T04:00:00Z'
    assert project(state)['forecasts'][0]['risk']=='on_time'
    state['orders'][0]['production_due']='2026-11-15T03:59:59Z'
    assert project(state)['forecasts'][0]['risk']=='late'
    state['jobs'][0]['status']='paused'
    assert project(state)['forecasts'][0]['completion'] is None
    state=scenario_state('seeded')
    state['orders'][0]['schedule_mode']='manual'
    assert 'Manual' in project(state)['forecasts'][0]['reason']
    for printer in state['printers']: printer['material']['grams']=0
    assert project(state)['forecasts'][1]['risk']=='unavailable'


def test_api_clock_owner_ticks_and_shutdown_pauses_on_restart(tmp_path,monkeypatch):
    import threading
    from fastapi.testclient import TestClient
    from print_assist.api import create_app
    from print_assist.service import FactoryService
    ticked=threading.Event()
    original=FactoryService.tick
    def observed(service):
        original(service);ticked.set()
    monkeypatch.setattr(FactoryService,'tick',observed)
    path=tmp_path/'state.sqlite3'
    with TestClient(create_app(path)) as client:
        state=client.get('/api/state').json()
        command=dict(session_id=state['session_id'],expected_revision=state['revision'],idempotency_key=str(uuid4()),payload=dict(running=True,speed=60))
        assert client.post('/api/clock',json=command).status_code==200
        assert ticked.wait(3)
        assert client.get('/api/state').json()['simulation_time']!=state['simulation_time']
        stale={**command,'idempotency_key':str(uuid4())}
        assert client.post('/api/clock',json=stale).status_code==409
        invalid={**command,'payload':dict(running=True,speed=0)}
        assert client.post('/api/clock',json=invalid).status_code==422
    with TestClient(create_app(path)) as client:
        assert not client.get('/api/state').json()['running']


def test_completed_forecasts_keep_recorded_finish_after_deadline():
    from print_assist.monitoring import project
    state=scenario_state('seeded')
    order=state['orders'][0]
    order['successful_quantity']=order['quantity']
    state['simulation_time']='2026-11-17T00:00:00Z'
    assert project(state)['forecasts'][0]['completion'] is None
    state['events']=[dict(type='job_completed',order_id=order['id'],timestamp='2026-11-15T04:00:00Z')]
    forecast=project(state)['forecasts'][0]
    assert forecast['completion']=='2026-11-15T04:00:00+00:00'
    assert forecast['risk']=='on_time'


def test_tick_starts_available_automatic_work_before_advancing(tmp_path):
    from print_assist.service import FactoryService
    service=FactoryService(tmp_path/'state.sqlite3')
    with service.store.transaction() as db:
        state=scenario_state('seeded');state['running']=True;state['clock_speed']=3600
        service.store.save(db,state)
    service.tick()
    assert service.snapshot()['jobs'][0]['elapsed_seconds']==3600


def test_high_speed_tick_bounds_short_job_completion_batches(tmp_path,monkeypatch):
    import print_assist.service as module
    from print_assist.service import FactoryService
    service=FactoryService(tmp_path/'state.sqlite3')
    with service.store.transaction() as db:
        state=service.store.load(db);state['running']=True;state['clock_speed']=3600
        service.store.save(db,state)
    steps=[]
    def step(state,seconds):
        assert seconds<=300
        steps.append(seconds)
        return state
    monkeypatch.setattr(module,'advance',step)
    service.tick()
    assert sum(steps)==3600


def test_failed_clock_tick_pauses_visibly_without_partial_progress(tmp_path,monkeypatch):
    import print_assist.service as module
    service=module.FactoryService(tmp_path/'state.sqlite3')
    with service.store.transaction() as db:
        state=service.store.load(db);state['running']=True
        service.store.save(db,state)
    def fail(state,seconds): raise ValueError('Test material shortage')
    monkeypatch.setattr(module,'advance',fail)
    service.tick()
    after=service.snapshot()
    assert not after['running']
    assert after['simulation_time']==state['simulation_time']
    assert after['events'][-1]['type']=='clock_stopped'
    service.tick()
    assert service.snapshot()==after

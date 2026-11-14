"""Versioned, deterministic starting state; no inference dependencies."""


def initial_state() -> dict:
    return {
        "session_id": "", "revision": 0, "printer_schema_version": 1,
        "simulation_time": "2026-11-15T00:00:00Z", "running": False, "clock_speed": 60,
        "printers": [
            {"id": f"printer-{number}", "status": "idle", "capabilities": ["FFF"],
             "material": {"type": "PLA", "color": "blue", "grams": 1000}}
            for number in range(1, 4)
        ], "orders": [], "jobs": [], "events": [],
        "controls": {"agents_enabled": False, "automatic_triggers": False},
        "artifacts": [{
            "id": "figure-pla-blue", "name": "Blue PLA figure",
            "revision": 1, "reference": "fixtures/blue-figure.gcode",
            "filament_type": "PLA", "color": "blue",
            "duration_seconds": 7200, "filament_grams": 25,
            "required_capabilities": ["FFF"],
        }],
    }


def scenario_state(name):
    state=initial_state()
    state['modeling_tasks']=[]
    if name=='seeded':
        state['artifacts'][0]['visual_asset_id']='example-tower'
        state['orders']=[dict(id=f'00000000-0000-4000-8000-{number:012d}',artifact_id='figure-pla-blue',
            quantity=quantity,priority=priority,production_due='2026-11-15T12:00:00Z',ship_by='2026-11-16T12:00:00Z',
            status='queued',successful_quantity=0) for number,quantity,priority in [(1,4,2),(2,1,1)]]
    elif name!='empty':
        raise ValueError('Unknown scenario')
    return state

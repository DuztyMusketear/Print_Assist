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


def scenario_state(name, printers=None):
    state=initial_state()
    state['modeling_tasks']=[]
    if name=='fault-demo':
        return _fault_demo(state, state['printers'] if printers is None else printers)
    if name=='seeded':
        state['artifacts'][0]['visual_asset_id']='example-tower'
        state['orders']=[dict(id=f'00000000-0000-4000-8000-{number:012d}',artifact_id='figure-pla-blue',
            quantity=quantity,priority=priority,production_due='2026-11-15T12:00:00Z',ship_by='2026-11-16T12:00:00Z',
            status='queued',successful_quantity=0) for number,quantity,priority in [(1,4,2),(2,1,1)]]
    elif name!='empty':
        raise ValueError('Unknown scenario')
    return state


def _fault_demo(state, printers):
    """Prepare explicit simulated sample work through the normal model/schedule paths."""
    from copy import deepcopy
    from uuid import uuid4
    from .activity import record
    from .modeling import create_task, move_task
    from .proposals import propose, apply_proposal

    state['printers']=deepcopy(printers)
    state['artifacts']=[]
    state['recovery_policy']='automatic'
    for printer in state['printers']:
        printer['status']='idle'
        printer.pop('fault',None)
        printer['material']['grams']=1000
    compatible=[p for p in state['printers'] if 'FFF' in p['capabilities']]
    profiles=sorted({(p['material']['type'],p['material']['color']) for p in compatible})
    for material,color in profiles:
        state=create_task(state,dict(title=f'Simulated sample {material} {color} tower',
            modelReference='fixtures/simulated-sample-tower.gcode', duration_seconds=7200,
            filament_grams=25,filament_type=material,color=color,required_capabilities=['FFF'],
            visual_asset_id='example-tower'))
        task_id=state['modeling_tasks'][-1]['id']
        for action in ['prepare-supports','submit-review','approve']:
            state=move_task(state,dict(task_id=task_id,action=action,support_assessment=dict(
                supports_required=False,support_reference=None,support_material_grams=0,
                removal_notes='Simulated sample profile; estimates are not a real slicer result.')))
        count=sum(p['material']['type']==material and p['material']['color']==color for p in compatible)
        state['orders'].append(dict(id=str(uuid4()),artifact_id='model-'+task_id,
            quantity=count*4,priority=2,production_due='2026-11-16T12:00:00Z',
            ship_by='2026-11-17T12:00:00Z',status='queued',successful_quantity=0))
    if compatible:
        proposal=propose(state,'automatic')
        state=apply_proposal(state,proposal['id'],'automatic')
    if not compatible or len(compatible)!=len(printers):
        record(state,'fault_demo_warning',
            'Fault demo requires compatible FFF printers; some or all registered printers cannot print the sample profiles.',
            source='system',status='blocked')
    state['running']=False
    record(state,'fault_demo_prepared',
        'Simulated sample estimates prepared through normal scheduling; press Run to advance production.',source='system')
    return state

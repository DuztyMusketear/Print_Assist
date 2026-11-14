import type { Snapshot } from './api';
export const state:Snapshot = {
  recovery_policy:'review',
  session_id:'00000000-0000-4000-8000-000000000001', revision:0,
  simulation_time:'2026-11-15T00:00:00Z', running:false, clock_speed:60, printers:[], jobs:[],events:[],orders:[],
  controls:{agents_enabled:false,automatic_triggers:false},
  artifacts:[{id:'figure-pla-blue',name:'Blue PLA figure',revision:1,reference:'fixture.gcode',
    filament_type:'PLA',color:'blue',duration_seconds:7200,filament_grams:25,required_capabilities:['FFF']}],
};
export const orderedState:Snapshot = {...state,revision:1,orders:[{
  id:'00000000-0000-4000-8000-000000000002',artifact_id:'figure-pla-blue',quantity:2,
  priority:1,production_due:'2026-11-15T12:00:00Z',ship_by:'2026-11-16T12:00:00Z',
  status:'queued',successful_quantity:0,
}]};

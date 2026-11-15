import { test, expect, vi } from 'vitest';
import { readState, addOrder, productionCommand } from './api';
import { state } from './test-fixtures';

test('reads real snapshot data returned by the transport', async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(state)));
  expect(await readState()).toEqual(state);
});
test('state fetch failure is actionable',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:503}));
  await expect(readState()).rejects.toThrow('Check the local server');
});
test('modeling rejection includes safe server validation detail',async()=>{
 const {modelingCommand}=await import('./api');
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({detail:'Expected revision 4, received 2'}),{status:409}));
 await expect(modelingCommand('/api/modeling/tasks',{session_id:state.session_id,expected_revision:2,idempotency_key:state.session_id,payload:{title:'Part',modelReference:'part.stl',duration_seconds:60,filament_grams:1,filament_type:'PLA',color:'blue',required_capabilities:['FFF'],visual_asset_id:null}})).rejects.toThrow('Modeling change rejected: Expected revision 4, received 2');
});
test('modeling validation rejection names the offending payload field',async()=>{
 const {modelingCommand}=await import('./api');
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({detail:[{loc:['body','payload','visual_asset_id'],msg:'Extra inputs are not permitted',type:'extra_forbidden'}]}),{status:422}));
 const command={session_id:state.session_id,expected_revision:0,idempotency_key:state.session_id,payload:{title:'Part',modelReference:'part.stl',duration_seconds:60,filament_grams:1,filament_type:'PLA',color:'blue',required_capabilities:['FFF'],visual_asset_id:null}};
 await expect(modelingCommand('/api/modeling/tasks',command)).rejects.toThrow('Modeling change rejected: payload.visual_asset_id: Extra inputs are not permitted');
});
test.each([
 ['not json','Modeling change rejected. Refresh state and check the task details.'],
 [JSON.stringify(null),'Modeling change rejected. Refresh state and check the task details.'],
 [JSON.stringify({detail:{message:'unknown response format'}}),'Modeling change rejected. Refresh state and check the task details.'],
 [JSON.stringify({detail:''}),'Modeling change rejected. Refresh state and check the task details.'],
 [JSON.stringify({detail:[{}, {loc:'payload.color',msg:'Choose an available filament color'}, {msg:'Check the prepared profile'}]}),'Modeling change rejected: Choose an available filament color; Check the prepared profile'],
 [JSON.stringify({detail:[{}]}),'Modeling change rejected. Refresh state and check the task details.'],
])('modeling errors retain available validation messages and provide a fallback for incomplete responses: %s',async(response,message)=>{
 const {modelingCommand,RejectedCommand}=await import('./api');
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(response,{status:422}));
 const command={session_id:state.session_id,expected_revision:0,idempotency_key:state.session_id,payload:{task_id:'task-1',action:'prepare-supports' as const}};
 await expect(modelingCommand('/api/modeling/actions',command)).rejects.toEqual(new RejectedCommand(message,422));
});
const body = {session_id:state.session_id,expected_revision:0,idempotency_key:state.session_id,
  payload:{artifact_id:'figure-pla-blue',quantity:1,priority:0,production_due:'2026-11-15T00:00:00Z',ship_by:'2026-11-16T00:00:00Z'}};
test('posts a typed command and returns the saved state',async()=>{
  const transport = vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(state)));
  expect(await addOrder(body)).toEqual(state);
  expect(JSON.parse(String(transport.mock.calls[0][1]!.body))).toEqual(body);
});
test.each([[409,'Refresh'],[422,'Check the product']])('explains HTTP %i without exposing server details',async(status,message)=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status}));
  await expect(addOrder(body)).rejects.toThrow(message);
});

test.each([
 [JSON.stringify({detail:'Model exceeds the virtual build volume'}),'Model exceeds the virtual build volume'],
 [JSON.stringify({detail:[{input:'private mesh data',msg:'invalid'}]}),'Check the STL file and print settings'],
 ['not json','Check the STL file and print settings'],
])('upload rejection explains how to correct the model without displaying payloads',async(response,message)=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(response,{status:422}));
 const command={session_id:state.session_id,expected_revision:0,idempotency_key:state.session_id,payload:{name:'Part',filename:'part.stl',stl_base64:'mesh',duration_seconds:60,filament_grams:1,filament_type:'PLA',color:'blue',support_assessment:{supports_required:false}}};
 await expect(productionCommand('/api/library/models',command)).rejects.toThrow(message);
});


test.each([JSON.stringify({detail:'Incident recovery has already been applied'}),JSON.stringify({detail:[]}), 'invalid'])('incident conflicts retain actionable details with fallback: %s',async(response)=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(response,{status:409}));
 await expect(productionCommand('/api/incidents/reject',{session_id:state.session_id,expected_revision:0,idempotency_key:state.session_id,payload:{incident_id:'incident-a',confirmed:true}})).rejects.toThrow(response.includes('already been applied')?'Incident recovery has already been applied':'Production command failed');
});

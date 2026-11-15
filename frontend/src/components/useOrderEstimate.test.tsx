import {act,renderHook,waitFor} from '@testing-library/react';
import {test,expect,vi,afterEach} from 'vitest';
afterEach(()=>vi.useRealTimers());
import {useOrderEstimate} from './useOrderEstimate';
import {state} from '../test-fixtures';

test('draft estimates are read-only, debounced and discard late input results',async()=>{
 const result={session_id:state.session_id,revision:0,feasible:false,on_time_quantity:3,estimated_finish:'2026-11-15T14:00:00Z',reason:'Only 3 fit'};
 let finish!:(response:Response)=>void;
 const fetch=vi.spyOn(globalThis,'fetch').mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce(new Response(JSON.stringify(result)));
 const order={artifact_id:'figure-pla-blue',quantity:20,priority:0,production_due:'2026-11-15T03:00:00Z',ship_by:'2026-11-16T00:00:00Z'};
 const hook=renderHook(({quantity})=>useOrderEstimate(state,{...order,quantity},true),{initialProps:{quantity:20}});
 await waitFor(()=>expect(fetch).toHaveBeenCalledOnce());hook.rerender({quantity:3});await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));await waitFor(()=>expect(hook.result.current.estimate?.on_time_quantity).toBe(3));
 await act(async()=>finish(new Response(JSON.stringify({...result,on_time_quantity:99}))));expect(hook.result.current.estimate?.on_time_quantity).toBe(3);
 expect(fetch.mock.calls[0][0]).toBe('/api/orders/estimate');
});

test.each(['failure','session'] as const)('estimation %s is visible or ignored without mutating a draft',async(kind)=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(kind==='failure'?'':JSON.stringify({session_id:'old-session',revision:0,feasible:true,on_time_quantity:1,estimated_finish:null,reason:''}),{status:kind==='failure'?409:200}));
 const order={artifact_id:'figure-pla-blue',quantity:1,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z'};
 const hook=renderHook(()=>useOrderEstimate(state,order,true));await waitFor(()=>expect(hook.result.current.busy).toBe(false));expect(hook.result.current.estimate).toBeUndefined();if(kind==='failure')expect(hook.result.current.error).toContain('Unable to check');
});

test('invalid/disabled drafts do not fetch and canceled loading errors stay quiet',async()=>{
 let reject!:(reason:Error)=>void;const fetch=vi.spyOn(globalThis,'fetch').mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail;}));
 const order={artifact_id:'figure-pla-blue',quantity:1,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z'};
 const hook=renderHook(({enabled,valid})=>useOrderEstimate(state,valid?order:undefined,enabled),{initialProps:{enabled:false,valid:true}});expect(fetch).not.toHaveBeenCalled();hook.rerender({enabled:true,valid:false});expect(fetch).not.toHaveBeenCalled();hook.rerender({enabled:true,valid:true});await waitFor(()=>expect(fetch).toHaveBeenCalledOnce());hook.unmount();await act(async()=>reject(new Error('Cancelled response')));
});



const order={artifact_id:'figure-pla-blue',quantity:1,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z'};
const result={session_id:state.session_id,revision:0,feasible:true,on_time_quantity:1,estimated_finish:'2026-11-15T02:00:00Z',reason:'Fits'};

test('revision-only polling does not erase or repeat an unchanged draft estimate',async()=>{
 vi.useFakeTimers();
 const request=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify(result)));
 const hook=renderHook(({revision})=>useOrderEstimate({...state,revision},order,true),{initialProps:{revision:0}});
 await act(()=>vi.advanceTimersByTimeAsync(250));expect(hook.result.current.estimate?.feasible).toBe(true);
 hook.rerender({revision:1});expect(hook.result.current.estimate?.feasible).toBe(true);
 await act(()=>vi.advanceTimersByTimeAsync(15000));expect(request).toHaveBeenCalledOnce();
});

test('capacity refresh keeps its last result during a bounded recheck, then reports the new outcome',async()=>{
 vi.useFakeTimers();let finish!:(response:Response)=>void;
 const request=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(result))).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const hook=renderHook(({grams})=>useOrderEstimate({...state,printers:[{id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams}}]},order,true),{initialProps:{grams:1000}});
 await act(()=>vi.advanceTimersByTimeAsync(250));hook.rerender({grams:0});
 expect(hook.result.current.estimate?.feasible).toBe(true);
 await act(()=>vi.advanceTimersByTimeAsync(5000));expect(request).toHaveBeenCalledTimes(2);expect(hook.result.current.busy).toBe(true);expect(hook.result.current.estimate?.feasible).toBe(true);
 await act(async()=>finish(new Response(JSON.stringify({...result,feasible:false,on_time_quantity:0,reason:'No filament'}))));
 expect(hook.result.current.estimate?.feasible).toBe(false);expect(hook.result.current.busy).toBe(false);
});

test('continuous live clock updates cannot starve estimates or turn each tick into a request',async()=>{
 vi.useFakeTimers();const request=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify(result)));
 const hook=renderHook(({seconds})=>useOrderEstimate({...state,revision:seconds,simulation_time:new Date(Date.parse(state.simulation_time)+seconds*1000).toISOString()},order,true),{initialProps:{seconds:0}});
 await act(()=>vi.advanceTimersByTimeAsync(250));
 for(let seconds=1;seconds<=12;seconds++){
  hook.rerender({seconds});await act(()=>vi.advanceTimersByTimeAsync(1000));expect(hook.result.current.estimate?.feasible).toBe(true);
 }
 expect(request).toHaveBeenCalledTimes(3);
});

test('a new draft or session discards old advice immediately, and invalid drafts stop refreshing',async()=>{
 vi.useFakeTimers();vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify(result)));
 const hook=renderHook(({quantity,session,enabled})=>useOrderEstimate({...state,session_id:session},quantity?{...order,quantity}:undefined,enabled),{initialProps:{quantity:1,session:state.session_id,enabled:true}});
 await act(()=>vi.advanceTimersByTimeAsync(250));expect(hook.result.current.estimate).toBeDefined();
 hook.rerender({quantity:2,session:state.session_id,enabled:true});expect(hook.result.current.estimate).toBeUndefined();
 await act(()=>vi.advanceTimersByTimeAsync(250));expect(hook.result.current.estimate).toBeDefined();
 hook.rerender({quantity:2,session:'replacement-session',enabled:true});expect(hook.result.current.estimate).toBeUndefined();
 hook.rerender({quantity:0,session:'replacement-session',enabled:true});expect(hook.result.current.busy).toBe(false);
});

test('a failed refresh keeps clearly marked prior advice and retries without another draft edit',async()=>{
 vi.useFakeTimers();const request=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(result))).mockResolvedValueOnce(new Response('',{status:409})).mockResolvedValueOnce(new Response(JSON.stringify(result)));
 const hook=renderHook(({time})=>useOrderEstimate({...state,simulation_time:time},order,true),{initialProps:{time:state.simulation_time}});
 await act(()=>vi.advanceTimersByTimeAsync(250));hook.rerender({time:'2026-11-15T00:01:00Z'});
 await act(()=>vi.advanceTimersByTimeAsync(5000));expect(hook.result.current.error).toContain('Unable');expect(hook.result.current.estimate).toBeDefined();
 await act(()=>vi.advanceTimersByTimeAsync(5000));expect(request).toHaveBeenCalledTimes(3);expect(hook.result.current.error).toBe('');
});

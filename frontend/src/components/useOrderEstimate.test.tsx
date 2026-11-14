import {act,renderHook,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
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

import {useRef,useState,type FormEvent} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';
import {ConfirmDialog} from './ConfirmDialog';
export function OrderSimulation({state,onSimulate,initialModel}:{state:Snapshot;initialModel?:string;onSimulate:(payload:components['schemas']['SimulateOrderPayload'])=>Promise<void>}){
 const [open,setOpen]=useState(false),[model,setModel]=useState(initialModel??state.artifacts[0]?.id??''),[quantity,setQuantity]=useState(2),[mode,setMode]=useState<'manual'|'automatic'|'end_to_end'>('manual');
 const [speed,setSpeed]=useState<1|60|300|3600>(3600);
 const [due,setDue]=useState(()=>new Date(Date.parse(state.simulation_time)+43200000).toISOString().slice(0,16)),[ship,setShip]=useState(()=>new Date(Date.parse(state.simulation_time)+86400000).toISOString().slice(0,16));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const form=useRef<HTMLFormElement>(null);
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{
  if(due>ship)throw new Error('Printing must finish before shipment.');
  await onSimulate({artifact_id:model||null,quantity,mode,clock_speed:speed,priority:0,production_due:new Date(due+'Z').toISOString(),ship_by:new Date(ship+'Z').toISOString()});setOpen(false);
 }catch(reason){setError((reason as Error).message);}finally{setBusy(false);}}
 return <><button type="button" onClick={()=>{setError('');setOpen(true);}}>Simulate incoming order</button>{open&&<ConfirmDialog title="Simulate an incoming order" confirmLabel="Simulate order" onCancel={()=>setOpen(false)} onConfirm={()=>form.current!.requestSubmit()} busy={busy}>
  <form ref={form} onSubmit={submit} className="simulation-form"><p>Local demo request. {mode==='end_to_end'?'This demo authorizes automatic scheduling and printing of this order.':'Manual leaves it in the inbox; automatic matching prepares a held order and opens its schedule. Printing still needs confirmation.'}</p>
   <label htmlFor="incoming-model">Incoming model</label><select id="incoming-model" value={model} onChange={event=>setModel(event.target.value)}><option value="">Unmatched demo product</option>{state.artifacts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
   <div className="order-plan-fields"><label>Incoming quantity<input type="number" required min="1" max="10000" step="1" value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/></label><label>Incoming print deadline (UTC)<input type="datetime-local" required value={due} onChange={event=>setDue(event.target.value)}/></label><label>Incoming ship deadline (UTC)<input type="datetime-local" required value={ship} onChange={event=>setShip(event.target.value)}/></label></div>
   <label htmlFor="incoming-process">Incoming process</label><select id="incoming-process" value={mode} onChange={event=>setMode(event.target.value as typeof mode)}><option value="manual">Manual inbox review</option><option value="automatic">Match and plan automatically</option><option value="end_to_end">Fully automated order-to-print demo</option></select>
   {mode==='end_to_end'&&<><p>Automatically matches, schedules and starts this simulated order when all copies fit the deadline. This choice authorizes the demo start; no live shop or hardware is connected.</p><label>Demo playback speed<select value={speed} onChange={event=>setSpeed(Number(event.target.value) as typeof speed)}>{[1,60,300,3600].map(value=><option key={value} value={value}>{value}x</option>)}</select></label></>}
   {error&&<p role="alert">{error}</p>}
  </form>
 </ConfirmDialog>}</>;
}

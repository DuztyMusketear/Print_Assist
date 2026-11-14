import {useState,type FormEvent} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';
export type PrintPlan=components['schemas']['PlanOrderPayload'];
export function QuickPrint({state,onQueue,onModels,initialModel}:{state:Snapshot;onQueue:(plan:PrintPlan)=>Promise<void>;onModels:()=>void;initialModel?:string}) {
 const [model,setModel]=useState(state.artifacts.find(item=>item.id===initialModel)?.id ?? state.artifacts[0]?.id ?? '');
 const [copies,setCopies]=useState(1);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [due,setDue]=useState(()=>new Date(Date.parse(state.simulation_time)+86400000).toISOString().slice(0,16));
 const [ship,setShip]=useState(()=>new Date(Date.parse(state.simulation_time)+172800000).toISOString().slice(0,16));
 const selected=state.artifacts.find(item=>item.id===model);
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy(true);setError('');
  const mode=(event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') as 'automatic'|'manual';
  try {
   if(due>ship) throw new Error('Printing must finish before the ship-by date.');
   await onQueue({mode,order:{artifact_id:model,quantity:copies,priority:0,production_due:new Date(due+'Z').toISOString(),ship_by:new Date(ship+'Z').toISOString()}});
  } catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="quick-print"><h2>Choose a model and print</h2>
 <p className="muted">The prepared model supplies its time, weight and printer settings.</p>
 <label htmlFor="quick-print-model">Model to print</label><select id="quick-print-model" value={model} onChange={event=>setModel(event.target.value)} required>{state.artifacts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
 <button type="button" className="secondary" onClick={onModels}>Add or prepare a model</button>
 {selected?<p className="profile-estimates">{Math.ceil(selected.duration_seconds/60)} min per part / {selected.filament_grams} g per part / {selected.color} {selected.filament_type}</p>:<p>No prepared model available. Add a profile in Modeling first.</p>}
 <label>Number of copies<input type="number" min="1" step="1" required value={copies} onChange={event=>setCopies(Number(event.target.value))}/></label>
 {selected && <p>Total estimated filament: {(selected.filament_grams*copies).toFixed(1)} g. Finish time depends on available printers.</p>}
 <details><summary>Delivery dates (optional changes)</summary><p>Defaults: printing due in 24 simulated hours; ship by in 48. Edit for your order.</p>
 <label>Quick print due (UTC)<input type="datetime-local" required value={due} onChange={event=>setDue(event.target.value)}/></label>
 <label>Quick ship by (UTC)<input type="datetime-local" required value={ship} onChange={event=>setShip(event.target.value)}/></label></details>
 <div className="quick-actions"><button name="mode" value="automatic" disabled={busy||!selected}>Start automatic printing</button><button name="mode" value="manual" className="secondary" disabled={busy||!selected}>Plan manual printing</button></div>
 <p className="muted">Automatic assigns available compatible printers and starts the simulation clock. Manual prepares jobs and takes you to Schedule to start them yourself.</p>
 {error && <p role="alert">{error}</p>}</form>;
}

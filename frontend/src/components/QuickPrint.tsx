import {useState,type FormEvent} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';
import {ModelPreview} from './ModelPreview';
export type PrintPlan=components['schemas']['PlanOrderPayload'];
export function QuickPrint({state,onQueue,onModels,initialModel,guided=false}:{state:Snapshot;onQueue:(plan:PrintPlan)=>Promise<void>;onModels:()=>void;initialModel?:string;guided?:boolean}) {
 const [model,setModel]=useState(state.artifacts.find(item=>item.id===initialModel)?.id ?? state.artifacts[0]?.id ?? '');
 const [speed,setSpeed]=useState<1|60|300|3600>(60);
 const [copies,setCopies]=useState(1);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [due,setDue]=useState(()=>new Date(Date.parse(state.simulation_time)+86400000).toISOString().slice(0,16));
 const [ship,setShip]=useState(()=>new Date(Date.parse(state.simulation_time)+172800000).toISOString().slice(0,16));
 const selected=state.artifacts.find(item=>item.id===model);
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy(true);setError('');
  const mode=(event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') as 'automatic'|'manual'|'review';
  try {
   if(due>ship) throw new Error('Printing must finish before the ship-by date.');
   await onQueue({mode:mode==='manual'?'manual':'automatic',review_only:mode==='review',clock_speed:speed,order:{artifact_id:model,quantity:copies,priority:0,production_due:new Date(due+'Z').toISOString(),ship_by:new Date(ship+'Z').toISOString()}});
  } catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
 }
 const dates=<><p>Choose when printing must finish, leaving time for packing before shipment. Dates below use UTC.</p>
 <label>{guided?'Finish printing by (UTC)':'Quick print due (UTC)'}<input type="datetime-local" required value={due} onChange={event=>setDue(event.target.value)}/></label>
 <label>{guided?'Ship order by (UTC)':'Quick ship by (UTC)'}<input type="datetime-local" required value={ship} onChange={event=>setShip(event.target.value)}/></label></>;
 const advanced=<><label>Automatic playback speed<select value={speed} onChange={event=>setSpeed(Number(event.target.value) as 1|60|300|3600)}>{[1,60,300,3600].map(value=><option key={value} value={value}>{value}x</option>)}</select></label><p className="muted">60x is the default so you can follow printing. Choose 1x for a slower inspection; higher speeds can finish short jobs quickly.</p>
 <div className="quick-actions"><button name="mode" value="automatic" disabled={busy||!selected}>Start automatic printing</button><button name="mode" value="manual" className="secondary" disabled={busy||!selected}>Plan manual printing</button></div></>;
 return <form onSubmit={submit} className="quick-print"><p className="eyebrow">2 / ORDERS</p><h2>Choose a model and print</h2>
 <p className="muted">The prepared model supplies its time, weight and printer settings.</p>
 <label htmlFor="quick-print-model">Model to print</label><select id="quick-print-model" value={model} onChange={event=>setModel(event.target.value)} required>{state.artifacts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
 <button type="button" className="secondary" onClick={onModels}>Add or prepare a model</button>
 {guided&&selected&&<ModelPreview name={selected.name} asset={state.visual_assets?.find(asset=>asset.id===selected.visual_asset_id)}/>}
 {selected?<p className="profile-estimates">{Math.ceil(selected.duration_seconds/60)} min per part / {selected.filament_grams} g per part / {selected.color} {selected.filament_type}</p>:<p>No prepared model available. Add a profile in Modeling first.</p>}
 <label>Number of copies<input type="number" min="1" step="1" required value={copies} onChange={event=>setCopies(Number(event.target.value))}/></label>
 {selected && <p>Total estimated filament: {(selected.filament_grams*copies).toFixed(1)} g. Finish time depends on available printers.</p>}
 {guided?dates:<details><summary>Delivery dates (optional changes)</summary>{dates}</details>}
 {guided?<><p>Next: review model, quantity, printer assignments and estimated finish. Printing starts after confirmation.</p><button name="mode" value="review" disabled={busy||!selected}>Review schedule first</button><details className="advanced-start"><summary>Advanced start options</summary>{advanced}</details></>:<>{advanced}<button name="mode" value="review" disabled={busy||!selected}>Review schedule first</button></>}
 <p className="muted">Automatic starts compatible printers as they become available. Manual jobs wait for you to start them.</p>
 {error && <p role="alert">{error}</p>}</form>;
}

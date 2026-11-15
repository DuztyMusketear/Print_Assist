import {formatScheduleTime} from './scheduleView';
import {useState,type FormEvent} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';
import {ModelPreview} from './ModelPreview';
import {useOrderEstimate} from './useOrderEstimate';
import {printDuration} from '../display';
export type PrintPlan=components['schemas']['PlanOrderPayload'];
export function QuickPrint({state,onQueue,onModels,initialModel,guided=false}:{state:Snapshot;onQueue:(plan:PrintPlan)=>Promise<void>;onModels:()=>void;initialModel?:string;guided?:boolean}) {
 const [model,setModel]=useState(state.artifacts.find(item=>item.id===initialModel)?.id??state.artifacts[0]?.id??'');
 const [search,setSearch]=useState(''),[speed,setSpeed]=useState<1|60|300|3600>(60),[copies,setCopies]=useState(1);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [due,setDue]=useState(()=>new Date(Date.parse(state.simulation_time)+86400000).toISOString().slice(0,16));
 const [ship,setShip]=useState(()=>new Date(Date.parse(state.simulation_time)+172800000).toISOString().slice(0,16));
 const selected=state.artifacts.find(item=>item.id===model);
 const valid=selected&&Number.isInteger(copies)&&copies>0&&Number.isFinite(Date.parse(due+'Z'))&&Number.isFinite(Date.parse(ship+'Z'))&&due<=ship;
 const draft=valid?{artifact_id:model,quantity:copies,priority:0,production_due:new Date(due+'Z').toISOString(),ship_by:new Date(ship+'Z').toISOString()}:undefined;
 const {estimate,busy:estimating,error:estimateError,checkedAt}=useOrderEstimate(state,draft,guided);
 const query=search.trim().toLowerCase();
 const matches=state.artifacts.filter(item=>(item.name+' '+item.filament_type+' '+item.color).toLowerCase().includes(query));
 function searchModels(value:string){setSearch(value);if(selected&&!(selected.name+' '+selected.filament_type+' '+selected.color).toLowerCase().includes(value.trim().toLowerCase()))setModel('');}
 const faster=selected?.visual_asset_id?state.artifacts.find(item=>item.visual_asset_id===selected.visual_asset_id&&item.duration_seconds<selected.duration_seconds&&item.filament_type===selected.filament_type&&item.color===selected.color):undefined;
 function moveDates(){const margin=Date.parse(ship+'Z')-Date.parse(due+'Z'),finish=Math.ceil(Date.parse(estimate!.estimated_finish!)/60000)*60000;setDue(new Date(finish).toISOString().slice(0,16));setShip(new Date(finish+Math.max(0,margin)).toISOString().slice(0,16));}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  const mode=(event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') as 'automatic'|'manual'|'review';
  try{
   if(due>ship)throw new Error('Printing must finish before the ship-by date.');
   await onQueue({mode:mode==='manual'?'manual':'automatic',review_only:mode==='review',clock_speed:speed,order:{artifact_id:model,quantity:copies,priority:0,production_due:new Date(due+'Z').toISOString(),ship_by:new Date(ship+'Z').toISOString()}});
  }catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
 }
 const quantity=<div className="quantity-field"><label htmlFor="order-copies">Number of copies</label><div className="quantity-stepper"><button type="button" className="secondary" aria-label="Decrease copies" disabled={copies<=1} onClick={()=>setCopies(Math.max(1,copies-1))}>-</button><input id="order-copies" type="number" min="1" max="10000" step="1" required value={copies} onChange={event=>setCopies(Number(event.target.value))}/><button type="button" className="secondary" aria-label="Increase copies" disabled={copies>=10000} onClick={()=>setCopies(copies+1)}>+</button></div></div>;
 const dueField=<label>{guided?'Finish printing by (UTC)':'Quick print due (UTC)'}<input type="datetime-local" required value={due} onChange={event=>setDue(event.target.value)}/></label>;
 const shipField=<label>{guided?'Ship order by (UTC)':'Quick ship by (UTC)'}<input type="datetime-local" required value={ship} onChange={event=>setShip(event.target.value)}/></label>;
 const advanced=<><label>Automatic playback speed<select value={speed} onChange={event=>setSpeed(Number(event.target.value) as 1|60|300|3600)}>{[1,60,300,3600].map(value=><option key={value} value={value}>{value}x</option>)}</select></label><p className="muted">Playback speed does not change print duration or deadline feasibility. It only fast-forwards the simulation.</p><div className="quick-actions"><button name="mode" value="automatic" disabled={busy||!selected}>Start automatic printing</button><button name="mode" value="manual" className="secondary" disabled={busy||!selected}>Plan manual printing</button></div></>;
 return <form onSubmit={submit} className="quick-print"><div className="page-intro"><div><p className="eyebrow">2 / ORDERS</p><h2>Choose a model and print</h2></div><button type="button" className="secondary" onClick={onModels}>Add or prepare a model</button></div>
 {guided&&<label>Search models for this order<input type="search" value={search} onChange={event=>searchModels(event.target.value)} placeholder="Name, material or color" onKeyDown={event=>{if(event.key==='Enter')event.preventDefault();}}/></label>}
 <label htmlFor="quick-print-model">Model to print</label><select id="quick-print-model" value={model} onChange={event=>setModel(event.target.value)} required disabled={!matches.length}><option value="" disabled>Choose a model</option>{matches.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
 {guided&&query&&<p className="muted">{matches.length?`${matches.length} matching models. Choose a model below.`:'No models match. Try a different name, material or color.'}</p>}
 <div className="order-model-summary">{guided&&selected&&<ModelPreview name={selected.name} asset={state.visual_assets?.find(asset=>asset.id===selected.visual_asset_id)}/>}
 <div>{selected?<><p className="profile-estimates">Total estimated printer time: {printDuration(selected.duration_seconds*copies)} / Estimated filament: {(selected.filament_grams*copies).toFixed(1)} g / {selected.color} {selected.filament_type}</p><p className="muted">Est. print time: {Math.ceil(selected.duration_seconds/60)} min per part / Est. filament: {selected.filament_grams} g per part</p><p className="muted">Printer time is summed across all copies. The schedule shows when they will finish. Starts after confirmation.</p></>:<p>{state.artifacts.length?'Choose a matching model to continue.':'No prepared model available. Add a profile in Modeling first.'}</p>}</div></div>
 {guided?<><div className="order-plan-fields">{quantity}{dueField}</div><details className="shipping-options"><summary>Packing and ship-by date</summary><p>Leave time for packing after printing. Dates use UTC.</p>{shipField}</details></>:<>{quantity}<details><summary>Delivery dates (optional changes)</summary>{dueField}{shipField}</details></>}
 {guided&&<div className={'draft-estimate '+(estimate&&!estimate.feasible?'conflict':'')} aria-live="polite">
  {estimating&&!estimate&&<p>Checking current printer capacity and filament...</p>}
  {estimate&&<><strong>{estimateError?'Previous estimate (refresh failed)':estimate.feasible?'Fits the selected deadline':'Selected deadline or quantity conflicts with capacity'}</strong><p>{estimate.reason}</p><p className="muted">{checkedAt&&<>Last checked: {formatScheduleTime(checkedAt)}. </>}Estimate refreshes when capacity changes, up to every 5 seconds. The schedule is checked again before printing.</p>{estimate.estimated_finish&&<p>Estimated finish: {formatScheduleTime(estimate.estimated_finish)}</p>}
  {!estimate.feasible&&<div className="estimate-actions">{estimate.on_time_quantity>0&&estimate.on_time_quantity<copies&&<button type="button" className="secondary" onClick={()=>setCopies(estimate.on_time_quantity)}>Use {estimate.on_time_quantity} copies</button>}{estimate.estimated_finish&&Date.parse(estimate.estimated_finish)>Date.parse(due+'Z')&&<button type="button" className="secondary" onClick={moveDates}>Move dates to earliest fit</button>}{faster&&<button type="button" className="secondary" onClick={()=>{setSearch('');setModel(faster.id);}}>Use faster profile: {faster.name}</button>}<p>More compatible printers or matching filament may help. Playback speed does not change manufacturing time; faster printing needs a prepared profile with its own estimates.</p></div>}</>}
  {estimateError&&<p role="alert">{estimateError}</p>}
 </div>}
 {guided?<><button name="mode" value="review" disabled={busy||!selected}>Review schedule first</button><details className="advanced-start"><summary>Advanced start options</summary>{advanced}</details></>:<>{advanced}<button name="mode" value="review" disabled={busy||!selected}>Review schedule first</button></>}
 {error&&<p role="alert">{error}</p>}</form>;
}

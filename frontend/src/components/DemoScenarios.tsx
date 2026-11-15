import {useRef,useState,type FormEvent} from 'react';
import {RejectedCommand,type Snapshot} from '../api';
import type {components} from '../types';
import {orderLabel,printerLabel} from '../display';
import {ScenarioReset,type Scenario} from './ProductionControls';

type Payload=components['schemas']['ScenarioEventPayload'];
const labels:Record<Payload['event'],string>={marketplace_order:'Incoming marketplace order',thermal_fault:'Printer thermal fault',urgent_order:'Urgent order',insufficient_filament:'Insufficient filament',printer_restored:'Printer restored'};
const text=(value:unknown,fallback='unavailable')=>typeof value==='string'&&value?value:fallback;
const records=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)):[];

export function DemoScenarios({state,onTrigger,onReset}:{state:Snapshot;onTrigger:(payload:Payload)=>Promise<void>;onReset?:(scenario:Scenario)=>Promise<void>}) {
 const [event,setEvent]=useState<Payload['event']>('marketplace_order');
 const [model,setModel]=useState(state.artifacts[0]?.id??'');
 const [product,setProduct]=useState('EXAMPLE-FIGURE'),[quantity,setQuantity]=useState(2),[priority,setPriority]=useState(0),[hours,setHours]=useState(12);
 const [filament,setFilament]=useState(state.artifacts[0]?.filament_type??'PLA'),[color,setColor]=useState(state.artifacts[0]?.color??'blue');
 const [mode,setMode]=useState<'manual'|'end_to_end'>('manual'),[speed,setSpeed]=useState<1|60|300|3600>(3600);
 const [printer,setPrinter]=useState(state.printers[0]?.id??'');
 const [available,setAvailable]=useState(0),[refill,setRefill]=useState(1000),[confirmed,setConfirmed]=useState(false);
 const [recoveryOverride,setRecoveryOverride]=useState<'review'|'automatic'|null>(null);
 const recovery=recoveryOverride??state.recovery_policy??'review';
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const pending=useRef<Payload|null>(null);
 const isOrder=event==='marketplace_order'||event==='urgent_order';
 const selectedPrinter=state.printers.find(item=>item.id===printer)?.id??state.printers[0]?.id??'';
 const selectedModel=state.artifacts.find(item=>item.id===model)?.id??'';
 const history=records(state.scenario_events).slice().reverse();
 async function submit(formEvent:FormEvent<HTMLFormElement>) {
  formEvent.preventDefault();if(busy)return;
  setError('');
  if(!pending.current){
   const due=new Date(Date.parse(state.simulation_time)+hours*3600000).toISOString();
   const ship=new Date(Date.parse(due)+86400000).toISOString();
   pending.current={event,event_id:crypto.randomUUID(),printer_id:isOrder?null:selectedPrinter,product_id:product.trim(),
    order:isOrder?{artifact_id:selectedModel||null,quantity,priority,production_due:due,ship_by:ship,mode,clock_speed:speed}:null,
    filament_type:isOrder?filament:null,color:isOrder?color:null,available_grams:available,refill_grams:refill,confirmed:event==='printer_restored'&&confirmed,recovery_mode:recoveryOverride};
  }
  setBusy(true);
  try{await onTrigger(pending.current);pending.current=null;setUncertain(false);setConfirmed(false);setRecoveryOverride(null);}
  catch(reason){setError(reason instanceof Error?reason.message:'The simulated event failed.');if(reason instanceof RejectedCommand){pending.current=null;setUncertain(false);}else setUncertain(true);}
  finally{setBusy(false);}
 }
 return <section className="scenario-controls"><header className="sidebar-panel-heading"><h2>Scenario controls</h2><span className="sidebar-badge">Demo</span></header><details className="demo-scenarios"><summary>Demo scenarios</summary>
  <div className="demo-scenarios-content">
   <p>Inject a simulated marketplace or equipment event. No live marketplace or physical printer is connected.</p>
   <p>Deterministic tools; live agent orchestration is planned.</p>
   <p className="demo-control-status">Agent controls: {state.controls.agents_enabled?'ON':'OFF'}  /  Automatic triggers {state.controls.automatic_triggers?'ON':'OFF'}  /  Current recovery policy: {state.recovery_policy}</p>
   <form onSubmit={formEvent=>void submit(formEvent)}>
    <fieldset disabled={busy||uncertain}>
     <label>Demo event<select value={event} onChange={change=>{const next=change.target.value as Payload['event'];setEvent(next);setConfirmed(false);if(next==='urgent_order'){setPriority(10);setHours(2);}}}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
     <label>Simulated printer<select value={selectedPrinter} disabled={isOrder||state.printers.length===0} onChange={change=>setPrinter(change.target.value)}>{state.printers.map(item=><option key={item.id} value={item.id}>{printerLabel(item.id)} - {item.status}</option>)}</select></label>
     {!isOrder&&state.printers.length===0&&<p>No simulated printers are available. Reset to the seeded figure shop first.</p>}
     {isOrder&&<>
      <label>Saved demo model<select value={selectedModel} onChange={change=>{setModel(change.target.value);const item=state.artifacts.find(artifact=>artifact.id===change.target.value);if(item){setFilament(item.filament_type);setColor(item.color);}}}><option value="">Unmatched product</option>{state.artifacts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {!selectedModel&&<p>No saved model selected. The request will remain visible for model matching.</p>}
      <label>Product identifier<input required maxLength={200} value={product} onChange={change=>setProduct(change.target.value)}/></label>
      <div className="demo-fields-row"><label>Demo quantity<input type="number" required min="1" max="10000" step="1" value={quantity} onChange={change=>setQuantity(Number(change.target.value))}/></label><label>Demo priority<input type="number" required min="0" max="100" step="1" value={priority} onChange={change=>setPriority(Number(change.target.value))}/></label></div>
      <label>Deadline in simulated hours<input type="number" required min="0.01" max="8760" step="any" value={hours} onChange={change=>setHours(Number(change.target.value))}/></label>
      <div className="demo-fields-row"><label>Filament type<input required value={filament} onChange={change=>setFilament(change.target.value)}/></label><label>Filament color<input required value={color} onChange={change=>setColor(change.target.value)}/></label></div>
      <label>Order processing<select value={mode} onChange={change=>setMode(change.target.value as typeof mode)}><option value="manual">Manual inbox review</option><option value="end_to_end">Fully automated simulated order-to-print</option></select></label>
      {mode==='end_to_end'&&<><p>This selection authorizes deterministic matching, feasible on-time scheduling and simulated printing for this new order only.</p><label>Demo playback speed<select value={speed} onChange={change=>setSpeed(Number(change.target.value) as typeof speed)}>{[1,60,300,3600].map(value=><option key={value} value={value}>{value}x</option>)}</select></label></>}
     </>}
     {event==='insufficient_filament'&&<label>Available filament (g)<input type="number" required min="0" step="any" value={available} onChange={change=>setAvailable(Number(change.target.value))}/></label>}
     {event==='printer_restored'&&<>
      <label>Refill filament (g)<input type="number" required min="0.01" step="any" value={refill} onChange={change=>setRefill(Number(change.target.value))}/></label>
      <label className="example-toggle"><input type="checkbox" checked={confirmed} onChange={change=>setConfirmed(change.target.checked)}/>I inspected the simulated printer and confirm it is safe to restore.</label>
      <p>Restoration clears simulated equipment faults after acknowledgement. Held work still follows the recovery policy.</p>
     </>}
     <label>Recovery mode<select value={recovery} onChange={change=>setRecoveryOverride(change.target.value as typeof recovery)}><option value="review">Review recovery plans</option><option value="automatic">Automatically apply complete safe recovery plans</option></select></label>
     <p>Automatic recovery authorizes only validated, compatible, on-time plans. Equipment clearance still requires inspection acknowledgement.</p>
    </fieldset>
    {uncertain&&<p>The outcome is unconfirmed. Retry this same event before changing its settings.</p>}
    <button type="submit" disabled={busy||(!uncertain&&((!isOrder&&!selectedPrinter)||(event==='printer_restored'&&!confirmed)))}>{busy?'Sending simulated event...':uncertain?'Retry simulated event':'Trigger simulated event'}</button>
    {error&&<p role="alert">{error}</p>}
   </form>
   <p>Inspect Production activity, Incidents &amp; Schedule Impact, and the order timeline for authoritative results. Use Reset workshop below to return to a baseline.</p>
   {history.length>0&&<>
    <p role="status" className="demo-notification">{text(history[0].notification,'Scenario event recorded.')}  /  {text(history[0].status)}</p>
    <details className="demo-history"><summary>Scenario event history ({history.length})</summary><ol>{history.map((entry,index)=><li key={text(entry.event_id,String(index))}>
     <strong>{labels[entry.event as Payload['event']]??text(entry.event,'Scenario event')}  /  {text(entry.status)}</strong>
     <p>{text(entry.notification,'No notification recorded.')} <time>{text(entry.timestamp)}</time></p>
     {records(entry.impacts).map((impact,impactIndex)=><div className="demo-impact" key={impactIndex}>
      <strong>{orderLabel(text(impact.order_id,'unknown'))}</strong>
      <p>Original completion: {text(impact.original_completion)}</p>
      <p className={impact.risk==='late'||impact.risk==='unavailable'?'deadline-risk':undefined}>Revised completion: {text(impact.revised_completion)}  /  {text(impact.risk,'unknown')}</p>
      <p>Production due: {text(impact.production_due)}</p>
     </div>)}
     <details><summary>Recorded deterministic tool calls</summary>{records(entry.tool_calls).length>0?<ul>{records(entry.tool_calls).map((call,callIndex)=><li key={callIndex}><code>{text(call.name,'Unnamed tool')}</code>  /  {text(call.status)}  /  <time>{text(call.timestamp)}</time></li>)}</ul>:<p>No tool calls recorded.</p>}</details>
    </li>)}</ol></details>
   </>}
  </div>
 </details>{onReset&&<ScenarioReset onReset={onReset} heading="Reset workshop"/>}</section>;
}

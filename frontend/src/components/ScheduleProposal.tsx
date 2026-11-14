import {useEffect,useRef,useState} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';
import {printerLabel,orderLabel,printDuration} from '../display';
import {PrintTimeline} from './PrintTimeline';
type Proposal=components['schemas']['ScheduleProposal'];
type Payload=components['schemas']['ApplySchedulePayload'];
export function ScheduleProposal({state,onApply,initialSpeed=60,guided=false,onPause,onPreview,autoPreview=false}:{state:Snapshot;onApply:(payload:Payload)=>Promise<void>;initialSpeed?:1|60|300|3600;guided?:boolean;onPause?:()=>void;onPreview?:(proposal:Proposal|undefined)=>void;autoPreview?:boolean}) {
 const [speed,setSpeed]=useState(initialSpeed);
 const [mode,setMode]=useState<'automatic'|'manual'>('automatic');const [proposal,setProposal]=useState<Proposal>();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const latest=useRef(state);latest.current=state;
 const stale=Boolean(proposal&&(proposal.session_id!==state.session_id||proposal.revision!==state.revision));
 async function preview() {
  setBusy(true);setError('');
  try {
   const response=await fetch('/api/schedule/proposal?mode='+mode);
   if(!response.ok) throw new Error('Unable to preview schedule. Try again.');
   const result:Proposal=await response.json();
   if(result.session_id!==latest.current.session_id||result.revision!==latest.current.revision) throw new Error('State changed. Preview the current schedule again.');
   setProposal(result);onPreview?.(result);
  }catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
 }
 useEffect(()=>{if(autoPreview&&!latest.current.running)void preview();},[]);
 async function apply() {
  setBusy(true);setError('');
   try{await onApply({proposal_id:proposal!.id,mode:proposal!.mode,clock_speed:speed,...(guided?{require_on_time:true}:{})});}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
 }
 const late=proposal?.assignments.some(item=>{const order=state.orders.find(order=>order.id===item.order_id);return Boolean(order&&Date.parse(item.finish)>Date.parse(order.production_due));});
 const infeasible=guided&&Boolean(late||proposal?.blocked.length);
 return <section className="schedule-proposal"><h2>Review a schedule</h2><p>Pause the clock while reviewing. Preview does not create jobs or reserve material.</p>
 <div className="schedule-review-controls"><label>Proposed start mode<select disabled={busy} value={mode} onChange={event=>{setMode(event.target.value as 'automatic'|'manual');setProposal(undefined);onPreview?.(undefined);}}><option value="automatic">Start automatically when available</option><option value="manual">Wait for manual starts</option></select></label>
 <label className="review-speed">Review playback speed<select disabled={busy} value={speed} onChange={event=>setSpeed(Number(event.target.value) as 1|60|300|3600)}>{[1,60,300,3600].map(value=><option key={value} value={value}>{value}x</option>)}</select></label>
 <button disabled={busy||state.running} onClick={()=>void preview()}>Preview schedule</button></div>
 {state.running && <p>Pause clock to preview and apply a stable schedule. {onPause&&<button className="secondary" onClick={onPause}>Pause simulation for review</button>}</p>}
 {guided&&<PrintTimeline state={state} proposal={proposal}/>}
 {proposal && <><p className="proposal-assumptions">{proposal.assumptions}</p><details className="allocation-details" open={!guided}><summary>Printer allocation details ({proposal.assignments.length})</summary><ul>{proposal.assignments.map((item,index)=><li key={index}>{orderLabel(item.order_id)} / {printerLabel(item.printer_id)} / {item.filament_grams} g / {item.start} to {item.finish}</li>)}</ul></details>
 {proposal.assignments.length===0 && <p>No new assignments available.</p>}
 <p>Proposed jobs: estimated printer time: {printDuration(proposal.assignments.reduce((total,item)=>total+item.duration_seconds,0))} / Estimated filament: {proposal.assignments.reduce((total,item)=>total+item.filament_grams,0).toFixed(1)} g. Totals cover proposed jobs only; printer time is summed across printers.</p>
 {proposal.blocked.map(item=><p key={item.order_id}>{orderLabel(item.order_id)}: {item.quantity} waiting to {item.reason}</p>)}
 {infeasible&&<p role="alert">This plan cannot meet every production deadline or fit all requested copies. Adjust dates, quantities, printer availability or filament before confirming.</p>}
 {guided&&<p>Confirm the complete proposed queue above. Automatic jobs start when a compatible printer is available; manual jobs wait for your start.</p>}
 <button disabled={busy||stale||state.running||proposal.assignments.length===0||infeasible} onClick={()=>void apply()}>{guided?(mode==='automatic'?'Confirm and start printing':'Confirm manual schedule'):'Apply reviewed schedule'}</button></>}
 {stale && <p role="status">State changed. Preview again before applying.</p>}{error && <p role="alert">{error}</p>}
 <details className="material-details"><summary>Material commitments</summary><p>Reserved is committed to unfinished jobs; available excludes those commitments. Stock decreases only as printing consumes filament.</p>
 <ul>{state.material_reservations?.map(row=><li key={row.printer_id}>{printerLabel(row.printer_id)}: {row.stock_grams.toFixed(1)} g stock / {row.reserved_grams.toFixed(1)} g reserved / {row.available_grams.toFixed(1)} g available</li>)}</ul></details></section>;
}

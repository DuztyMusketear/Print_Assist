import {formatScheduleTime} from './scheduleView';
import {useState,type FormEvent} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';
import {orderLabel,printDuration} from '../display';
import {ConfirmDialog} from './ConfirmDialog';
import {ModelPreview} from './ModelPreview';
import {timelineSlots,type Proposal} from './scheduleView';
type Revise=components['schemas']['ReviseOrderPayload'];
type Delete=components['schemas']['DeleteOrderPayload'];
type Props={state:Snapshot;proposal?:Proposal;onRevise:(payload:Revise,revision?:number)=>Promise<void>;onDelete?:(payload:Delete,revision?:number)=>Promise<void>};
type Order=Snapshot['orders'][number];
export function editableOrder(state:Snapshot,order:Order){return !order.successful_quantity&&!['cancelled','completed'].includes(order.status)&&!state.jobs.some(job=>job.order_id===order.id&&(Number(job.elapsed_seconds??0)>0||!['planned','pending','cancelled'].includes(String(job.status))));}

function Details({state,order,onRevise,onDelete,onClose}:Props&{order:Order;onClose:()=>void}){
 const [copies,setCopies]=useState(order.quantity),[due,setDue]=useState(order.production_due.slice(0,16)),[ship,setShip]=useState(order.ship_by.slice(0,16));
 const [revision]=useState(state.revision),[sourceSession]=useState(state.session_id),[confirmation,setConfirmation]=useState<'edit'|'delete'>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const editable=editableOrder(state,order),stale=revision!==state.revision||sourceSession!==state.session_id;
 const model=state.artifacts.find(model=>model.id===order.artifact_id)!;
 async function confirm(){setBusy(true);setError('');try{
  if(stale)throw new Error('State changed. Close and reopen this order before confirming.');
  if(confirmation==='delete')await onDelete!({order_id:order.id,confirmed:true},revision);
  else await onRevise({order_id:order.id,confirmed:true,order:{artifact_id:order.artifact_id,quantity:copies,priority:order.priority,production_due:new Date(due+'Z').toISOString(),ship_by:new Date(ship+'Z').toISOString()}},revision);
  setConfirmation(undefined);onClose();
 }catch(reason){setError((reason as Error).message);setConfirmation(undefined);}finally{setBusy(false);}}
 return <div className="order-details" role="region" aria-label="Selected order details"><div className="page-intro"><h3>{orderLabel(order.id)} details</h3><button type="button" className="secondary" onClick={onClose}>Close order details</button></div>
 <p>{order.quantity} copies / {order.successful_quantity} completed · Print by {formatScheduleTime(order.production_due)} · Ship by {formatScheduleTime(order.ship_by)}</p>
 <p>Total estimated printer time: {printDuration(model.duration_seconds*order.quantity)} / Estimated filament: {(model.filament_grams*order.quantity).toFixed(1)} g / {model.color} {model.filament_type}</p>
 <p>For all requested copies, including completed ones. Per copy: {printDuration(model.duration_seconds)} / {model.filament_grams} g. Printer time is summed work; the schedule shows the finish date.</p>
 {editable?<><details><summary>Edit quantity and dates</summary><form onSubmit={(event:FormEvent)=>{event.preventDefault();setConfirmation('edit');}}><div className="order-plan-fields"><label>Revised copies<input required type="number" min="1" max="10000" step="1" value={copies} onChange={e=>setCopies(Number(e.target.value))}/></label><label>Revised print deadline (UTC)<input required type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label><label>Revised ship deadline (UTC)<input required type="datetime-local" value={ship} onChange={e=>setShip(e.target.value)}/></label></div><p>Updating releases queued placements and requires a fresh schedule review. The original incoming request stays in history.</p><button disabled={busy||state.running||stale}>Save order changes</button></form></details>
 {onDelete&&<button type="button" className="danger secondary" disabled={busy||state.running||stale} onClick={()=>setConfirmation('delete')}>Delete scheduled order</button>}
 {state.running&&<p>Pause the simulation before editing or deleting scheduled work.</p>}{stale&&<p role="status">State changed. Close and reopen the order to review current details.</p>}</>:<p>Printing has started. Use printer pause/resume controls; completed work and consumed material are protected.</p>}
 {error&&<p role="alert">{error}</p>}
 {confirmation&&<ConfirmDialog title={confirmation==='edit'?'Confirm order changes?':'Delete scheduled order?'} confirmLabel={confirmation==='edit'?'Confirm changes':'Confirm deletion'} onConfirm={()=>void confirm()} onCancel={()=>setConfirmation(undefined)} busy={busy}>
  <p>{state.artifacts.find(model=>model.id===order.artifact_id)!.name} ×{order.quantity}</p>{confirmation==='edit'?<p>Change to {copies} copies. Print due {due} UTC; ship by {ship} UTC. Queued placements will be released for review.</p>:<p>Remove this unstarted order and all its queued placements. Filament commitments are released; physical stock is unchanged. History is retained.</p>}
  {confirmation==='edit'&&<p>Revised estimated printer time: {printDuration(model.duration_seconds*copies)} / Estimated filament: {(model.filament_grams*copies).toFixed(1)} g / {model.color} {model.filament_type}</p>}
 </ConfirmDialog>}
 </div>;
}

export function OrderDrafts(props:Props){
 const {state}=props,[selected,setSelected]=useState<string>();
 const proposal=props.proposal?.session_id===state.session_id&&props.proposal.revision===state.revision?props.proposal:undefined;
 const slots=timelineSlots(state,proposal),orders=state.orders.filter(order=>!['cancelled','completed'].includes(order.status)&&order.successful_quantity<order.quantity);
 const selectedOrder=orders.find(order=>order.id===selected);
 return orders.length?<section className="order-drafts"><h2>{orders.some(order=>order.requires_schedule_review)?'Orders awaiting confirmation':'Scheduled orders'}</h2><div className="order-card-grid">{orders.map(order=>{
  const model=state.artifacts.find(model=>model.id===order.artifact_id)!,forecast=state.forecasts?.find(item=>item.order_id===order.id),allocated=slots.filter(slot=>slot.order_id===order.id);
  const blocked=proposal?.blocked.some(row=>row.order_id===order.id),late=allocated.some(slot=>slot.late)||forecast?.risk==='late',overlap=allocated.some(slot=>slot.overlap);
  const unavailable=forecast?.risk==='unavailable'&&!order.requires_schedule_review;
  const conflict=blocked?'Capacity conflict':overlap?'Printer overlap':late?'Deadline conflict':unavailable?'Needs attention':'';
  const ends=allocated.map(slot=>Date.parse(slot.finish));if(forecast?.completion)ends.push(Date.parse(forecast.completion));
  const finish=blocked||unavailable?'Unavailable':ends.length?formatScheduleTime(new Date(Math.max(...ends)).toISOString()):'Preview needed';
  return <button type="button" className={'order-summary-card '+(conflict?'conflict ':'')+(selected===order.id?'selected':'')} key={order.id} aria-label={`Inspect order ${orderLabel(order.id)}`} aria-expanded={selected===order.id} onClick={()=>setSelected(order.id)}>
   <ModelPreview name={model.name} asset={state.visual_assets?.find(asset=>asset.id===model.visual_asset_id)}/><span><strong>{model.name} ×{order.quantity}</strong><small>Est. printer time: {printDuration(model.duration_seconds*order.quantity)}</small><small>Est. filament: {(model.filament_grams*order.quantity).toFixed(1)} g / {model.color} {model.filament_type}</small><small>Est. finish: {finish}</small><small>{conflict|| (order.requires_schedule_review?'Awaiting confirmation':state.jobs.some(job=>job.order_id===order.id&&job.status==='running')?'Printing':allocated.some(slot=>slot.status!=='proposed')?'Scheduled':allocated.length?'Proposed':'Awaiting schedule')}</small>{unavailable&&<small>{forecast.reason}</small>}</span>
  </button>;
 })}</div>{selectedOrder&&<Details key={selectedOrder.id} {...props} order={selectedOrder} onClose={()=>setSelected(undefined)}/>}</section>:null;
}

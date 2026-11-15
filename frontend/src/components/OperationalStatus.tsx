import type {Snapshot} from '../api';
import {orderLabel,partLabel,printerLabel} from '../display';
import {timelineSlots,formatScheduleTime} from './scheduleView';

type Demonstration={id:string;order_id:string|null;status:string;reason?:string;steps:{id:string;label:string;status:string;timestamp:string|null}[]};
type Transfer={id:string;summary:string};
export function OperationalStatus({state}:{state:Snapshot}) {
 const reports=state as unknown as {order_demonstrations?:Demonstration[];workload_transfers?:Transfer[]};
 const demo=reports.order_demonstrations?.at(-1),transfer=reports.workload_transfers?.at(-1);
 const warnings=state.forecasts?.filter(row=>['late','unavailable'].includes(String(row.risk))&&state.orders.some(order=>order.id===row.order_id&&order.status!=='cancelled'))??[];
 if(!demo&&!transfer&&!warnings.length)return null;
 const slots=timelineSlots(state);
 const active=state.jobs.filter(job=>['running','planned','paused','pending'].includes(String(job.status)));
 const heldPrinters=new Set(state.printers.filter(printer=>['paused','offline','faulted'].includes(String(printer.status))).map(printer=>printer.id));
 const unavailableJobs=new Set<unknown>();
 for(const job of [...active].sort((a,b)=>Number(b.status==='running')-Number(a.status==='running')||String(state.orders.find(order=>order.id===a.order_id)?.production_due??'').localeCompare(String(state.orders.find(order=>order.id===b.order_id)?.production_due??''))||Number(state.orders.find(order=>order.id===b.order_id)?.priority??0)-Number(state.orders.find(order=>order.id===a.order_id)?.priority??0)||String(a.estimated_start??'').localeCompare(String(b.estimated_start??''))||String(a.id).localeCompare(String(b.id)))){
  if(['paused','pending'].includes(String(job.status))||(job.status!=='running'&&job.schedule_mode==='manual'))heldPrinters.add(String(job.printer_id));
  if(heldPrinters.has(String(job.printer_id)))unavailableJobs.add(job.id);
 }
 return <section className="operational-status" aria-label="Operational status">
  {demo&&<div className="automatic-progress"><h2>Automatic order progress</h2><p>{demo.order_id?orderLabel(demo.order_id):'Model match required'} / {demo.status.replaceAll('_',' ')}</p><ol>{demo.steps.map(step=><li key={step.id}>{step.label} / {step.status}</li>)}</ol>{demo.reason&&<p className={demo.status==='needs_attention'?'deadline-risk':undefined}>{demo.reason}</p>}</div>}
  {transfer&&<div><h2>Latest workload transfer</h2><p>{transfer.summary}</p></div>}
  {warnings.length>0&&<div><h2>Deadline warnings</h2><ul aria-label="Current deadline warnings">{warnings.map(row=>{
   const order=state.orders.find(order=>order.id===row.order_id)!,model=state.artifacts.find(model=>model.id===order.artifact_id);
   const jobs=active.filter(job=>job.order_id===order.id);
   return <li key={order.id}><p className="deadline-risk"><strong>{orderLabel(order.id)} / {model?.name??order.artifact_id}</strong> / {String(row.risk)}: {String(row.reason)}. Production due: {formatScheduleTime(order.production_due)}. ETA: {row.completion?formatScheduleTime(String(row.completion)):'unavailable'}.</p>
    <ul>{jobs.map(job=>{
     const slot=slots.find(slot=>slot.job_id===String(job.id)),unavailable=unavailableJobs.has(job.id)||!slot;
     if(!unavailable&&!slot!.late)return null;
     return <li className="deadline-risk" key={String(job.id)}>{partLabel(String(job.id))} / {printerLabel(String(job.printer_id))} / {unavailable?'unavailable':String(job.status)}. Production due: {formatScheduleTime(order.production_due)}. ETA: {unavailable?'unavailable':formatScheduleTime(slot!.finish)}.</li>;
    })}{jobs.length<order.quantity-order.successful_quantity&&<li className="deadline-risk">{order.quantity-order.successful_quantity-jobs.length} unassigned parts. Production due: {formatScheduleTime(order.production_due)}. ETA: unavailable.</li>}</ul>
   </li>;
  })}</ul></div>}
 </section>;
}

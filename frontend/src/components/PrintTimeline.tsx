import type {Snapshot} from '../api';
import type {components} from '../types';
import {printerLabel,orderLabel} from '../display';
import {ModelPreview} from './ModelPreview';
type Proposal=components['schemas']['ScheduleProposal'];

export function PrintTimeline({state,proposal}:{state:Snapshot;proposal?:Proposal}) {
 const now=Date.parse(state.simulation_time);
 const capacity=new Map<string,number>();
 const active=state.jobs.filter(job=>['running','pending','paused','planned'].includes(String(job.status)));
 const queue=[...active.filter(job=>job.status!=='planned'),...active.filter(job=>job.status==='planned')];
 const existing=queue.flatMap(job=>{
  const order=state.orders.find(order=>order.id===job.order_id),model=state.artifacts.find(model=>model.id===order?.artifact_id);
  const duration=Number(job.duration_seconds??model?.duration_seconds),elapsed=Number(job.elapsed_seconds??0);
  if(!Number.isFinite(duration)||!Number.isFinite(elapsed))return [];
  const printer=String(job.printer_id),start=job.status==='planned'?(capacity.get(printer)??now):now-elapsed*1000;
  const finish=(job.status==='planned'?start:now)+Math.max(0,duration-elapsed)*1000;capacity.set(printer,finish);
  return [{order_id:String(job.order_id),printer_id:printer,start:new Date(start).toISOString(),finish:new Date(finish).toISOString(),status:String(job.status)}];
 });
 const slots=[...existing,...(proposal?.assignments??[]).map(slot=>({...slot,status:'proposed'}))].filter(slot=>Number.isFinite(Date.parse(slot.start))&&Number.isFinite(Date.parse(slot.finish)));
 const start=Math.min(now,...slots.map(slot=>Date.parse(slot.start))),finish=Math.max(now+3600000,...slots.map(slot=>Date.parse(slot.finish))),span=finish-start;
 return <section className="print-timeline"><div className="page-intro"><div><h2>Print timeline</h2><p>{proposal?'Review proposed work alongside existing jobs.':'Scheduled and active print jobs.'} Times are estimates from saved model profiles.</p></div><span>Simulated schedule</span></div>
  {slots.length===0&&<p>No scheduled jobs yet. Choose a model and quantity in Orders to plan a print.</p>}
  {slots.length>0&&<><div className="timeline-range"><time>{new Date(start).toLocaleString()}</time><time>{new Date(finish).toLocaleString()}</time></div>
   <div className="timeline-scroll">{state.printers.map(printer=><div className="timeline-lane" key={printer.id} aria-label={`Timeline for ${printerLabel(printer.id)}`}>
    <strong>{printerLabel(printer.id)}</strong><div className="timeline-track">{slots.filter(slot=>slot.printer_id===printer.id).map((slot,index)=>{
     const order=state.orders.find(item=>item.id===slot.order_id),model=state.artifacts.find(item=>item.id===order?.artifact_id);
     const late=Boolean(order&&Date.parse(slot.finish)>Date.parse(order.production_due));
     return <details className={'timeline-job '+(late?'late ':'')+slot.status} key={slot.order_id+index} style={{left:`${100*(Date.parse(slot.start)-start)/span}%`,width:`${100*(Date.parse(slot.finish)-Date.parse(slot.start))/span}%`}}>
      <summary><ModelPreview name={model?.name??'Model'} asset={state.visual_assets?.find(asset=>asset.id===model?.visual_asset_id)}/><span>{model?.name??orderLabel(slot.order_id)}<small>{slot.status}{late?' · Past production deadline':''}</small></span></summary>
      <div className="timeline-detail">
       <p>{orderLabel(slot.order_id)} · {model?.color} {model?.filament_type}</p><p>{new Date(slot.start).toLocaleString()} → {new Date(slot.finish).toLocaleString()}</p>
       {order&&<p>Print due: {new Date(order.production_due).toLocaleString()}</p>}
       {['paused','pending'].includes(slot.status)&&<p>Waiting for an explicit manual start or resume; timing is provisional.</p>}
      </div>
     </details>;
    })}</div>
   </div>)}</div></>}
 </section>;
}

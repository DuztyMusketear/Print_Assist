import type {Snapshot} from '../api';
import type {components} from '../types';
export type Proposal=components['schemas']['ScheduleProposal'];
export type Scale='day'|'week'|'month';
export function formatScheduleTime(value:string){return new Date(value).toLocaleString('en-US',{timeZone:'UTC'})+' UTC';}
export type Slot={order_id:string;printer_id:string;start:string;finish:string;status:string;late:boolean;overlap:boolean};

/** Persisted orders are append-only, including archived ones: colors survive queue changes. */
export function timelineOrders(state:Snapshot,slots:Slot[],proposal?:Proposal){
 const knownIds=[...new Set([...state.orders.map(order=>order.id),...slots.map(slot=>slot.order_id)])];
 return [...new Set(slots.map(slot=>slot.order_id))].map(id=>{
  const order=state.orders.find(order=>order.id===id),shown=slots.filter(slot=>slot.order_id===id);
  const unavailable=state.forecasts?.some(row=>row.order_id===id&&row.risk==='unavailable')&&!order?.requires_schedule_review;
  const complete=order&&shown.length>=order.quantity-order.successful_quantity&&!unavailable&&!shown.some(slot=>slot.overlap)&&!proposal?.blocked.some(row=>row.order_id===id);
  const hue=(170+knownIds.indexOf(id)*137.508)%360;
  return {id,color:`hsl(${hue} 70% 70%)`,fill:`hsl(${hue} 40% 19%)`,finish:complete?new Date(Math.max(...shown.map(slot=>Date.parse(slot.finish)))).toISOString():undefined};
 });
}

export function timelineSlots(state:Snapshot,proposal?:Proposal):Slot[]{
 const now=Date.parse(state.simulation_time),capacity=new Map<string,number>();
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
 return slots.map((slot,index)=>{
  const order=state.orders.find(order=>order.id===slot.order_id);
  return {...slot,late:Boolean(order&&Date.parse(slot.finish)>Date.parse(order.production_due)),overlap:slots.some((other,j)=>j!==index&&slot.printer_id===other.printer_id&&Date.parse(slot.start)<Date.parse(other.finish)&&Date.parse(other.start)<Date.parse(slot.finish))};
 });
}

export function calendarWindow(now:number,first:number,last:number,scale:Scale){
 const day=86400000,startDate=new Date(Math.min(now,first));startDate.setUTCHours(0,0,0,0);
 if(scale==='week')startDate.setUTCDate(startDate.getUTCDate()-(startDate.getUTCDay()+6)%7);
 if(scale==='month')startDate.setUTCDate(1);
 const start=startDate.getTime(),minimum=new Date(start);
 if(scale==='month')minimum.setUTCMonth(minimum.getUTCMonth()+1);else minimum.setUTCDate(minimum.getUTCDate()+(scale==='week'?7:1));
 const finish=Math.max(minimum.getTime(),start+Math.ceil((last-start)/day)*day),span=finish-start;
 const unit=scale==='day'?day/6:scale==='week'?day:7*day,step=unit*Math.max(1,Math.ceil(span/unit/14));
 const formatter=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',...(scale==='day'?{hour:'2-digit',hour12:false}:{weekday:'short'})});
 const ticks=Array.from({length:Math.floor(span/step)+1},(_,i)=>({position:100*i*step/span,label:(scale==='month'?'Week of ':'')+formatter.format(new Date(start+i*step))}));
 return {start,finish,span,ticks};
}

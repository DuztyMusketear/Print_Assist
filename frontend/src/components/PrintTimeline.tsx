import {useState,type CSSProperties} from 'react';
import {timelineSlots,timelineOrders,calendarWindow,formatScheduleTime,type Scale} from './scheduleView';
import type {Snapshot} from '../api';
import type {components} from '../types';
import {printerLabel,orderLabel} from '../display';
import {ModelPreview} from './ModelPreview';
type Proposal=components['schemas']['ScheduleProposal'];

export function PrintTimeline({state,proposal}:{state:Snapshot;proposal?:Proposal}) {
 const [scale,setScale]=useState<Scale>('day');
 const now=Date.parse(state.simulation_time),slots=timelineSlots(state,proposal);
 const groups=timelineOrders(state,slots,proposal);
 const {start,span,ticks}=calendarWindow(now,Math.min(now,...slots.map(slot=>Date.parse(slot.start))),Math.max(now,...slots.map(slot=>Date.parse(slot.finish))),scale);
 return <section className="print-timeline"><div className="page-intro"><div><h2>Print timeline</h2><p>{proposal?'Review proposed work alongside existing jobs.':'Scheduled and active print jobs.'} Times are estimates from saved model profiles.</p></div><div className="timeline-scale" aria-label="Timeline scale">{(['day','week','month'] as const).map(view=><button type="button" key={view} className="secondary" aria-pressed={scale===view} onClick={()=>setScale(view)}>{view[0].toUpperCase()+view.slice(1)}</button>)}<small>UTC</small></div></div>
  {slots.length===0&&<p>No scheduled jobs yet. Choose a model and quantity in Orders to plan a print.</p>}
  {slots.length>0&&<>
   <ul className="timeline-order-key" aria-label="Order color key">{groups.map(group=>{
    const order=state.orders.find(order=>order.id===group.id),model=state.artifacts.find(model=>model.id===order?.artifact_id);
    const shown=slots.filter(slot=>slot.order_id===group.id);
    return <li key={group.id} style={{'--order-color':group.color,'--order-fill':group.fill} as CSSProperties}><span className="order-color-swatch" aria-hidden="true"/><div><strong>{orderLabel(group.id)} · {model?.name??'Unknown model'}{order&&` ×${order.quantity}`}</strong><small>{group.finish?`Est. completion: ${formatScheduleTime(group.finish)}`:'Completion unavailable — review schedule'}</small><small>Status: {[...new Set(shown.map(slot=>slot.status))].join(', ')}{shown.some(slot=>slot.late)?' · Past production deadline':''}{shown.some(slot=>slot.overlap)?' / Printer overlap':''}</small></div></li>;
   })}</ul><p className="timeline-key-help">Colors identify orders across printers. ◆ marks the last print of a fully scheduled order. Paused/manual timings are provisional; warnings remain labeled.</p>
   <div className="timeline-scroll">{state.printers.map(printer=><div className="timeline-lane" key={printer.id} aria-label={`Timeline for ${printerLabel(printer.id)}`}>
    <strong>{printerLabel(printer.id)}</strong><div className="timeline-track">{slots.filter(slot=>slot.printer_id===printer.id).map((slot,index)=>{
     const order=state.orders.find(item=>item.id===slot.order_id),model=state.artifacts.find(item=>item.id===order?.artifact_id);
     const late=slot.late;
     const group=groups.find(group=>group.id===slot.order_id)!,last=group.finish!==undefined&&Date.parse(group.finish)===Date.parse(slot.finish);
     return <details className={'timeline-job '+(last?'order-finish ':'')+(late?'late ':'')+(slot.overlap?'conflict ':'')+slot.status} key={slot.order_id+index} style={{'--order-color':group.color,'--order-fill':group.fill,left:`${100*(Date.parse(slot.start)-start)/span}%`,width:`${100*(Date.parse(slot.finish)-Date.parse(slot.start))/span}%`} as CSSProperties}>
      <summary aria-label={`${model?.name??orderLabel(slot.order_id)} / ${orderLabel(slot.order_id)} / ${slot.status}${late?' / Past production deadline':''}${slot.overlap?' / Printer overlap':''}`}><ModelPreview name={model?.name??'Model'} asset={state.visual_assets?.find(asset=>asset.id===model?.visual_asset_id)}/><span>{model?.name??orderLabel(slot.order_id)}<small>{slot.status}{slot.overlap?' / Printer overlap':''}{late?' · Past production deadline':''}</small></span>{last&&<span className="timeline-end-marker" aria-label={`Estimated order completion for ${orderLabel(slot.order_id)}: ${formatScheduleTime(slot.finish)}`}>◆</span>}</summary>
      <div className="timeline-detail">
       <p>{orderLabel(slot.order_id)} · {model?.color} {model?.filament_type}</p><p>{formatScheduleTime(slot.start)} → {formatScheduleTime(slot.finish)}</p>
       <p>Status: {slot.status}{late?' · Past production deadline':''}{slot.overlap?' / Printer overlap':''}</p>
       {order&&<p>Print due: {formatScheduleTime(order.production_due)}</p>}
       {['paused','pending'].includes(slot.status)&&<p>Waiting for an explicit manual start or resume; timing is provisional.</p>}
      </div>
     </details>;
    })}</div>
   </div>)}<div className="timeline-axis" aria-label="Calendar axis"><span>UTC</span><div>{ticks.map((tick,index)=><time key={index} style={{left:`${tick.position}%`}}>{tick.label}</time>)}</div></div></div></>}
 </section>;
}

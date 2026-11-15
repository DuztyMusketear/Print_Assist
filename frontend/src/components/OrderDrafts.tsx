import {useState,type FormEvent} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';
import {orderLabel} from '../display';

type Revise=components['schemas']['ReviseOrderPayload'];
function Draft({order,name,onRevise}:{order:Snapshot['orders'][number];name:string;onRevise:(payload:Revise)=>Promise<void>}) {
 const [copies,setCopies]=useState(order.quantity),[due,setDue]=useState(order.production_due.slice(0,16)),[ship,setShip]=useState(order.ship_by.slice(0,16));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await onRevise({order_id:order.id,order:{artifact_id:order.artifact_id,quantity:copies,priority:order.priority,production_due:new Date(due+'Z').toISOString(),ship_by:new Date(ship+'Z').toISOString()}});}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}}
 return <article className="review-order"><h3>{name} · {orderLabel(order.id)}</h3><p>{order.quantity} copies · Print by {new Date(order.production_due).toLocaleString()} · Ship by {new Date(order.ship_by).toLocaleString()}</p>
 <details><summary>Edit quantity and dates</summary><form onSubmit={save}><p>Changes affect this production order; the original example shop request stays in the inbox history.</p><div className="fields">
 <label>Revised copies<input required type="number" min="1" step="1" value={copies} onChange={e=>setCopies(Number(e.target.value))}/></label>
 <label>Revised print deadline (UTC)<input required type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label><label>Revised ship deadline (UTC)<input required type="datetime-local" value={ship} onChange={e=>setShip(e.target.value)}/></label></div>
 <button disabled={busy}>Save order changes</button>{error&&<p role="alert">{error}</p>}</form></details></article>;
}

export function OrderDrafts({state,onRevise,onDelete=async()=>{}}:{state:Snapshot;onRevise:(payload:Revise)=>Promise<void>;onDelete?:(order_ids:string[])=>Promise<void>}) {
 const [selected,setSelected]=useState<string[]>([]),[confirm,setConfirm]=useState(false),[error,setError]=useState('');
 const orders=state.orders.filter(order=>order.requires_schedule_review&&!order.successful_quantity&&!state.jobs.some(job=>job.order_id===order.id&&['planned','pending','paused','running'].includes(String(job.status))));
 async function removeSelected(){try{await onDelete(selected);setSelected([]);setConfirm(false);setError('');}catch(reason){setError((reason as Error).message);}}
 return orders.length>0?<section className="order-drafts"><h2>Orders awaiting confirmation</h2><label className="check-label"><input type="checkbox" aria-label="Select all awaiting confirmation orders" checked={orders.length>0&&orders.every(order=>selected.includes(order.id))} onChange={event=>setSelected(event.target.checked?orders.map(order=>order.id):[])}/>Select all</label>{orders.map(order=><div className="draft-select-row" key={order.id}><label className="check-label"><input type="checkbox" aria-label={`Select ${orderLabel(order.id)}`} checked={selected.includes(order.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,order.id]:current.filter(id=>id!==order.id))}/></label><Draft order={order} name={state.artifacts.find(model=>model.id===order.artifact_id)?.name??'Model'} onRevise={onRevise}/></div>)}{selected.length>0&&<button type="button" className="danger-button" onClick={()=>setConfirm(true)}>Delete selected ({selected.length})</button>}{error&&<p role="alert">{error}</p>}{confirm&&<div role="dialog" aria-modal="true" aria-labelledby="delete-orders-title" className="remove-confirm-dialog"><h3 id="delete-orders-title">Delete selected orders?</h3><p>This permanently removes {selected.length} order{selected.length===1?'':'s'} awaiting confirmation.</p><button type="button" className="secondary" onClick={()=>setConfirm(false)}>Cancel</button><button type="button" className="danger-button" onClick={()=>void removeSelected()}>Confirm deletion</button></div>}</section>:null;
}

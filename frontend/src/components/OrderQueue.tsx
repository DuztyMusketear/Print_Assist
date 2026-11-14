import {partLabel,printerLabel} from '../display';
import type {Snapshot} from '../api';
export function OrderQueue({state,compact=false}:{state:Snapshot;compact?:boolean}) {
  state={...state,orders:state.orders.filter(order=>order.status!=='cancelled'),jobs:state.jobs.filter(job=>job.status!=='cancelled')};
  if(compact) return <section className="compact-queue"><h2>Production queue ({state.orders.length})</h2>
    {state.orders.length===0?<p>No orders yet. Add your first production order.</p>:<div className="queue-scroll"><table aria-label="Production queue"><thead><tr><th>Model / part</th><th>Printer</th><th>Quantity</th><th>Priority</th><th>Status / timing</th></tr></thead><tbody>{state.orders.map(order=><tr key={order.id}>
      <td><strong>{state.artifacts.find(item=>item.id===order.artifact_id)!.name}</strong>{state.jobs.filter(job=>job.order_id===order.id).map(job=><small key={String(job.id)}>{partLabel(String(job.id))} / {String(job.status)}</small>)}</td>
      <td>{state.jobs.some(job=>job.order_id===order.id)?state.jobs.filter(job=>job.order_id===order.id).map(job=><small key={String(job.id)}>{printerLabel(String(job.printer_id))}</small>):'Unassigned'}</td>
      <td>{order.quantity} items<small>{order.successful_quantity} completed</small></td><td>{order.priority}</td>
      <td>{order.status}<details className="queue-timing"><summary>Timing</summary><small>Production due: {order.production_due}</small><small>Ship by: {order.ship_by}</small>{state.forecasts?.filter(item=>item.order_id===order.id).map(item=><small key={order.id}>Estimated print completion: {item.completion ? String(item.completion) : 'Unavailable'} / {String(item.risk)} {String(item.reason)}. Shipping and packing are separate.</small>)}</details></td>
    </tr>)}</tbody></table></div>}
  </section>;
  return <section><h2>Production queue ({state.orders.length})</h2>
    {state.orders.length===0 ? <p>No orders yet. Add your first production order.</p> :
      <ul>{state.orders.map(order=><li key={order.id}>
        <strong>{state.artifacts.find(item=>item.id===order.artifact_id)!.name}</strong>
        <p>{order.quantity} items · Priority {order.priority} · {order.status}</p>
        <p>Production due: {order.production_due} · Ship by: {order.ship_by}</p>
        <small>{order.successful_quantity} completed · of {order.quantity} requested.</small>
        {state.forecasts?.filter(item=>item.order_id===order.id).map(item=><p key={order.id}>Estimated print completion: {item.completion ? String(item.completion) : 'Unavailable'} / {String(item.risk)} {String(item.reason)}. Shipping and packing are separate.</p>)}
      </li>)}</ul>}
  </section>;
}

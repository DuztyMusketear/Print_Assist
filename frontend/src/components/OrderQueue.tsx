import type {Snapshot} from '../api';
export function OrderQueue({state}:{state:Snapshot}) {
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

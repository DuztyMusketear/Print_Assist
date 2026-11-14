import {useState} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';

export function ShopInbox({state,onLoad,onDecision,onSchedule}:{state:Snapshot;onLoad:()=>Promise<void>;onDecision:(payload:components['schemas']['ShopDecision'])=>Promise<void>;onSchedule:()=>void}) {
 const [selected,setSelected]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}}
 return <section className="shop-inbox"><div className="page-intro"><div><h2>Shop order inbox</h2><p>Local example feed. No shop is connected. Review product matches before scheduling.</p></div><button className="secondary" disabled={busy} onClick={()=>void run(onLoad)}>Load example shop orders</button></div>
  {error&&<p role="alert">{error}</p>}
  {!(state.shop_requests?.length)&&<p>No incoming requests. Load the example feed to try the workflow.</p>}
  <div className="inbox-grid">{state.shop_requests?.map(request=><article className="inbox-request" key={request.id}>
   <div className="inbox-heading"><h3>{request.id}</h3><span className={'request-status '+request.status}>{request.status}</span></div>
   <p>{request.quantity} × {request.product_name}</p><p>Print by {new Date(request.production_due).toLocaleString()} · Ship by {new Date(request.ship_by).toLocaleString()}</p>
   {request.status==='pending'?<><label htmlFor={'shop-model-'+request.id}>Saved model for {request.id}</label><select id={'shop-model-'+request.id} value={selected[request.id]??request.artifact_id??''} onChange={e=>setSelected({...selected,[request.id]:e.target.value})}><option value="">Match this product to a model</option>{state.artifacts.map(model=><option value={model.id} key={model.id}>{model.name}</option>)}</select>
    <p className="muted">{request.artifact_id?'Example product match supplied. Confirm it before continuing.':'Unmatched product: select a saved model. The selection is remembered for this product.'}</p>
    <button disabled={busy||!(selected[request.id]??request.artifact_id)} onClick={()=>void run(()=>onDecision({request_id:request.id,decision:'accept',artifact_id:selected[request.id]??request.artifact_id}))}>Review schedule for {request.id}</button>
    <button className="secondary" disabled={busy} onClick={()=>void run(()=>onDecision({request_id:request.id,decision:'reject'}))}>Reject {request.id}</button>
   </>:request.status==='accepted'?<><p>Accepted for schedule review. Acceptance does not start printing.</p><button className="secondary" onClick={onSchedule}>View print schedule</button></>:<p>Rejected. No production order was created.</p>}
  </article>)}</div>
 </section>;
}

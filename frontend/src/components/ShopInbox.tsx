import {formatScheduleTime} from './scheduleView';
import {useState} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';
import {OrderSimulation} from './OrderSimulation';

export function ShopInbox({state,onLoad,onDecision,onSchedule,onSimulate,initialModel}:{state:Snapshot;onLoad:()=>Promise<void>;onDecision:(payload:components['schemas']['ShopDecision'])=>Promise<void>;onSchedule:()=>void;initialModel?:string;onSimulate?:(payload:components['schemas']['SimulateOrderPayload'])=>Promise<void>}) {
 const [selected,setSelected]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}}
 return <section className="shop-inbox"><div className="page-intro"><div><h2>Shop order inbox</h2><p>Local demo feed. No shop is connected.</p></div>{onSimulate&&<OrderSimulation key={state.session_id} initialModel={initialModel} state={state} onSimulate={onSimulate}/>}<button className="secondary example-batch" disabled={busy} onClick={()=>void run(onLoad)}>Load example shop orders</button></div>
  {error&&<p role="alert">{error}</p>}
  {onSimulate&&<details className="incoming-demo-guide"><summary>How the order demo works</summary><ol>
   <li>Click Simulate incoming order, choose a saved model, copies and deadlines, then select a process.</li>
   <li>Manual: open Request details in the inbox, check the model and choose Review schedule.</li>
   <li>Automatic: match the saved model and open its proposed schedule automatically.</li><li>Fully automated demo: match, confirm a feasible schedule and start printing without another approval. Watch the accelerated order progress in Overview.</li>
   <li>Check the colored timeline and estimates in Schedule. Choose Confirm and start printing, or confirm a manual schedule and start its jobs in Printers.</li>
   <li>Overview shows the assigned printers printing; use the clock to watch progress and completion. Pause/resume controls are in Printers.</li>
  </ol><p>This is a local example order feed. No live shop or physical printer is connected.</p></details>}
  {!(state.shop_requests?.length)&&<p>No incoming requests. Load the example feed to try the workflow.</p>}
  <div className="inbox-grid">{state.shop_requests?.map(request=><article className="inbox-request" key={request.id}>
   <div className="inbox-heading"><h3>{request.id}</h3><span className={'request-status '+request.status}>{request.status}</span></div>
   <strong>{request.product_name} ×{request.quantity}</strong><p>Print by {formatScheduleTime(request.production_due)}</p><details><summary>Request details</summary><p>Ship by {formatScheduleTime(request.ship_by)}</p>
   {request.status==='pending'?<><label htmlFor={'shop-model-'+request.id}>Saved model for {request.id}</label><select id={'shop-model-'+request.id} value={selected[request.id]??request.artifact_id??''} onChange={e=>setSelected({...selected,[request.id]:e.target.value})}><option value="">Match this product to a model</option>{state.artifacts.map(model=><option value={model.id} key={model.id}>{model.name}</option>)}</select>
    <p className="muted">{request.artifact_id?'Example product match supplied. Confirm it before continuing.':'Unmatched product: select a saved model. The selection is remembered for this product.'}</p>
    <button disabled={busy||!(selected[request.id]??request.artifact_id)} onClick={()=>void run(()=>onDecision({request_id:request.id,decision:'accept',artifact_id:selected[request.id]??request.artifact_id}))}>Review schedule for {request.id}</button>
    <button className="secondary" disabled={busy} onClick={()=>void run(()=>onDecision({request_id:request.id,decision:'reject'}))}>Reject {request.id}</button>
   </>:request.status==='accepted'?<><p>Accepted for schedule review. Acceptance does not start printing.</p><button className="secondary" onClick={onSchedule}>View print schedule</button></>:request.status==='cancelled'?<p>Removed from production. The incoming request remains in history.</p>:<p>Rejected. No production order was created.</p>}</details>
  </article>)}</div>
 </section>;
}

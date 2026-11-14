import {printerLabel,partLabel} from './display';
import {useMonitoring} from './monitoring';
import {useEffect,useRef,useState} from 'react';
import {readState,addOrder,scheduleOrders,productionCommand,modelingCommand,RejectedCommand,type Snapshot,type OrderInput} from './api';
import type {components} from './types';
import type {WorkflowAction} from './dashboard/workflow';
import {OrderForm} from './components/OrderForm';
import {OrderQueue} from './components/OrderQueue';
import {ModelingBoard} from './dashboard/ModelingBoard';
import {PrinterFloor} from './printers/PrinterFloor';
import {ActivityFeed,ScenarioReset} from './components/ProductionControls';
import type {ProductionPath,ProductionBody,ProductionPayload} from './api';

export default function App() {
  const [state,setState]=useState<Snapshot>();
  const [error,setError]=useState('');
  const [tab,setTab]=useState<'Overview'|'Orders'|'Printers'|'Schedule'|'Modeling'>('Overview');
  const sequence=useRef(0);
  const pending=useRef<{signature:string;key:string}|undefined>(undefined);
  const pendingCommand=useRef<{signature:string;body:Parameters<typeof productionCommand>[1]}|undefined>(undefined);
  const pendingModel=useRef<{signature:string;body:Parameters<typeof modelingCommand>[1]}|undefined>(undefined);
  async function modelChange(path:Parameters<typeof modelingCommand>[0],payload:components['schemas']['ModelTaskCreate']|{task_id:string;action:WorkflowAction}) {
    ++sequence.current;
    const signature=JSON.stringify([path,payload,state!.session_id]);
    if(pendingModel.current && pendingModel.current.signature!==signature) throw new Error('Retry the previous modeling change first.');
    if(!pendingModel.current) pendingModel.current={signature,body:{session_id:state!.session_id,expected_revision:state!.revision,idempotency_key:crypto.randomUUID(),payload} as Parameters<typeof modelingCommand>[1]};
    const body=pendingModel.current.body;
    try {
      const updated=await modelingCommand(path,body);
      if(pendingModel.current?.body.idempotency_key===body.idempotency_key) pendingModel.current=undefined;
      setState(previous=>updated.session_id===previous!.session_id && updated.revision>=previous!.revision ? updated : previous);
    } catch(reason) {if(reason instanceof RejectedCommand && pendingModel.current?.body.idempotency_key===body.idempotency_key) pendingModel.current=undefined; throw reason;}
  }
  async function load() {
    const current=++sequence.current;
    try {
      const loaded=await readState();
      if(current===sequence.current) {
        if(pendingModel.current && pendingModel.current.body.session_id!==loaded.session_id) pendingModel.current=undefined;
        if(pendingCommand.current && pendingCommand.current.body.session_id!==loaded.session_id && JSON.parse(pendingCommand.current.signature)[0]!=='/api/scenarios/reset') pendingCommand.current=undefined;
        setState(previous=>previous?.session_id===loaded.session_id && previous.revision>loaded.revision ? previous : loaded);
        setError('');
      }
    } catch(reason) {
      if(current===sequence.current) setError((reason as Error).message);
    }
  }
  useEffect(()=>{void load();},[]);
  useMonitoring(load);
  async function submit(payload:OrderInput) {
    ++sequence.current;
    const signature=JSON.stringify([state!.session_id,payload]);
    if(pending.current?.signature!==signature) pending.current={signature,key:crypto.randomUUID()};
    const key=pending.current.key;
    const updated=await addOrder({session_id:state!.session_id,expected_revision:state!.revision,
      idempotency_key:key,payload});
    if(pending.current?.key===key) pending.current=undefined;
    setState(previous=>updated.session_id===previous!.session_id && updated.revision>=previous!.revision ? updated : previous);
  }
  async function schedule(mode:'automatic'|'manual') {
    const current=++sequence.current;
    try {
      const updated=await scheduleOrders({session_id:state!.session_id,expected_revision:state!.revision,idempotency_key:crypto.randomUUID(),payload:{mode}});
      setState(previous=>updated.session_id===previous!.session_id && updated.revision>=previous!.revision ? updated : previous);
      if(current===sequence.current) setError('');
    } catch(reason) {if(current===sequence.current) setError((reason as Error).message);}
  }
  async function command(path:ProductionPath,payload:ProductionPayload,retry=false) {
    ++sequence.current;
    let body:ProductionBody|undefined;
    try {
      const signature=JSON.stringify([path,payload,state!.session_id]);
      if(path==='/api/scenarios/reset' && pendingCommand.current && JSON.parse(pendingCommand.current.signature)[0]!=='/api/scenarios/reset') pendingCommand.current=undefined;
      if(pendingCommand.current && pendingCommand.current.signature!==signature && !retry) throw new Error('Retry the previous production command before issuing another.');
      if(!pendingCommand.current) pendingCommand.current={signature,body:{session_id:state!.session_id,expected_revision:state!.revision,idempotency_key:crypto.randomUUID(),payload} as Parameters<typeof productionCommand>[1]};
      body=pendingCommand.current.body;
      const updated=await productionCommand(path,body);
      const ownsRequest=pendingCommand.current?.body.idempotency_key===body.idempotency_key;
      if(ownsRequest) pendingCommand.current=undefined;
      if(path==='/api/scenarios/reset' && ownsRequest) {
        ++sequence.current;
        if(pendingModel.current?.body.session_id===body.session_id) pendingModel.current=undefined;
        if(pending.current && JSON.parse(pending.current.signature)[0]===body.session_id) pending.current=undefined;
      }
      const sourceSession=body.session_id;
      setState(previous=>path==='/api/scenarios/reset' && previous!.session_id===sourceSession ? updated : updated.session_id===previous!.session_id && updated.revision>=previous!.revision ? updated : previous);
      if(ownsRequest) setError('');
    } catch(reason) {
      if(body && pendingCommand.current?.body.idempotency_key!==body.idempotency_key) return;
      if(reason instanceof RejectedCommand) pendingCommand.current=undefined;
      setError((reason as Error).message);
    }
  }
  return <main className={tab==='Overview'?'overview':''}>
    <header><div><p className="eyebrow">YOUR PRODUCTION WORKSPACE</p><h1>Print Assist</h1><p>Keep customer orders moving.</p></div>
      <span className="badge">Agents OFF · Offline prototype</span></header>
    <p className="notice">Simulated manufacturing · Print-ready files · No physical printer control</p>
    {error && <p role="alert">{error}</p>}
    {pendingCommand.current && <button type="button" onClick={()=>{const [path,payload]=JSON.parse(pendingCommand.current!.signature);void command(path,payload,true);}}>Retry production command</button>}
    <nav role="tablist" aria-label="Dashboard sections">{(['Overview','Orders','Printers','Schedule','Modeling'] as const).map(name=><button key={name} role="tab" aria-selected={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</nav>
    <button className="secondary" onClick={()=>void load()}>Refresh queue</button>
    {state && <div hidden={tab!=='Modeling'}><ModelingBoard key={state.session_id} visualAssets={state.visual_assets ?? []} items={state.modeling_tasks ?? []} onCreate={payload=>modelChange('/api/modeling/tasks',payload)} onMove={(id,action)=>modelChange('/api/modeling/actions',{task_id:id,action})} onRetry={async()=>{if(pendingModel.current){const [path,payload]=JSON.parse(pendingModel.current.signature);await modelChange(path,payload);}else await load();}}/></div>}
    {state ? <>
      <section aria-label="Simulation clock"><h2>Simulation clock</h2><p>{state.simulation_time} / {state.running?'Running':'Paused'} / Live refresh every second</p>
        <label>Clock speed <select aria-label="Clock speed" value={state.clock_speed ?? 60} onChange={event=>void command('/api/clock',{running:state.running,speed:Number(event.target.value) as 1|60|300|3600})}>{[1,60,300,3600].map(speed=><option key={speed} value={speed}>{speed}x</option>)}</select></label>
        <button onClick={()=>void command('/api/clock',{running:!state.running,speed:(state.clock_speed ?? 60) as 1|60|300|3600})}>{state.running?'Pause clock':'Run clock'}</button>
      </section>
      {tab==='Overview' && <div className="summary-grid" aria-label="Production summary">
        <section><span>Active printers</span><strong>{state.printers.filter(p=>p.status==='running').length} / {state.printers.length}</strong></section>
        <section><span>Items remaining</span><strong>{state.orders.reduce((sum,o)=>sum+o.quantity-o.successful_quantity,0)}</strong></section>
        <section><span>Items completed</span><strong>{state.orders.reduce((sum,o)=>sum+o.successful_quantity,0)}</strong></section>
        <section><span>Orders at risk</span><strong>{state.forecasts?.filter(f=>f.risk!=='on_time').length ?? 0}</strong></section>
      </div>}
      <div className={tab==='Overview'?'overview-workspace':''}>
      {(tab==='Overview'||tab==='Printers') && <PrinterFloor state={state} detailed={tab==='Printers'} onControl={(printer_id,action)=>command('/api/printers/control',{printer_id,action})}/> }
      {tab==='Printers' && <ScenarioReset onReset={scenario=>command('/api/scenarios/reset',{scenario})}/>}
      {(tab==='Overview'||tab==='Schedule') && <ActivityFeed events={state.events}/>}
      </div>
      {tab==='Schedule' && <section><h2>Schedule</h2><button onClick={()=>void schedule('automatic')}>Schedule automatically</button> <button onClick={()=>void schedule('manual')}>Schedule for manual start</button> <button onClick={()=>void command('/api/advance',{seconds:3600})}>Advance 1 hour</button><ul>{state.jobs.map((job,index)=><li key={String(job.id ?? index)}>{partLabel(String(job.id))} · {String(job.status)} · {printerLabel(String(job.printer_id))} {(job.status==='pending'||job.status==='paused') && <button onClick={()=>void command('/api/start',{job_id:String(job.id)})}>{job.status==='paused'?'Resume':'Start'} {partLabel(String(job.id))}</button>}</li>)}</ul><OrderQueue state={state}/></section>}
      {tab==='Overview' && <OrderQueue state={state}/>}
      {tab==='Orders' && <div className="workspace"><OrderForm artifacts={state.artifacts} onSubmit={submit}/><OrderQueue state={state}/></div>}
    </> : <p>Waiting for production state…</p>}
  </main>;
}

import {PrintingGuidance} from './components/PrintingGuidance';
import {ScheduleProposal} from './components/ScheduleProposal';
import {ModelLibrary} from './components/ModelLibrary';
import {ShopInbox} from './components/ShopInbox';
import {PrintTimeline} from './components/PrintTimeline';
import {OrderDrafts} from './components/OrderDrafts';
import {QuickPrint,type PrintPlan} from './components/QuickPrint';
import {printerLabel,partLabel} from './display';
import {useMonitoring} from './monitoring';
import {useEffect,useRef,useState} from 'react';
import {readState,addOrder,scheduleOrders,productionCommand,modelingCommand,RejectedCommand,type Snapshot,type OrderInput} from './api';
import type {components} from './types';
import {OrderForm} from './components/OrderForm';
import {OrderQueue} from './components/OrderQueue';
import {ModelingBoard} from './dashboard/ModelingBoard';
import {PrinterFloor} from './printers/PrinterFloor';
import {ActivityFeed,ScenarioReset} from './components/ProductionControls';
import type {ProductionPath,ProductionBody,ProductionPayload} from './api';

export default function App() {
  const [state,setState]=useState<Snapshot>();
  const currentSession=useRef(state?.session_id);currentSession.current=state?.session_id;
  const [schedulePreview,setSchedulePreview]=useState<components['schemas']['ScheduleProposal']>();
  const [autoPreview,setAutoPreview]=useState(0);
  const [reviewSpeed,setReviewSpeed]=useState<1|60|300|3600>(60);
  const [selectedPrinter,setSelectedPrinter]=useState('');
  const [selectedModel,setSelectedModel]=useState<string>();
  const [error,setError]=useState('');
  const [tab,setTab]=useState<'Overview'|'Orders'|'Printers'|'Schedule'|'Models'>('Overview');
  const sequence=useRef(0);
  const pending=useRef<{signature:string;key:string}|undefined>(undefined);
  const pendingCommand=useRef<{signature:string;body:Parameters<typeof productionCommand>[1]}|undefined>(undefined);
  const pendingModel=useRef<{signature:string;body:Parameters<typeof modelingCommand>[1]}|undefined>(undefined);
  async function modelChange(path:Parameters<typeof modelingCommand>[0],payload:components['schemas']['ModelTaskCreate']|components['schemas']['ModelAction']) {
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
  async function command(path:ProductionPath,payload:ProductionPayload,retry=false,throwOnFailure=false,expectedRevision?:number) {
    ++sequence.current;
    let body:ProductionBody|undefined;
    try {
      const signature=JSON.stringify([path,payload,state!.session_id]);
      if(path==='/api/scenarios/reset' && pendingCommand.current && JSON.parse(pendingCommand.current.signature)[0]!=='/api/scenarios/reset') pendingCommand.current=undefined;
      if(pendingCommand.current && pendingCommand.current.signature!==signature && !retry) throw new Error('Retry the previous production command before issuing another.');
      if(!pendingCommand.current) pendingCommand.current={signature,body:{session_id:state!.session_id,expected_revision:expectedRevision??state!.revision,idempotency_key:crypto.randomUUID(),payload} as Parameters<typeof productionCommand>[1]};
      body=pendingCommand.current.body;
      let updated:Snapshot;
      try {updated=await productionCommand(path,body);}
      catch(conflict) {
        if(!(conflict instanceof RejectedCommand && conflict.status===409 && path==='/api/clock' && 'running' in body.payload && !body.payload.running)) throw conflict;
        const current=await readState();
        if(pendingCommand.current?.body.idempotency_key!==body.idempotency_key) return;
        if(current.session_id!==body.session_id) throw conflict;
        body={...body,expected_revision:current.revision,idempotency_key:crypto.randomUUID()};
        pendingCommand.current={...pendingCommand.current,body};
        updated=await productionCommand(path,body);
      }
      const ownsRequest=pendingCommand.current?.body.idempotency_key===body.idempotency_key;
      if(ownsRequest) pendingCommand.current=undefined;
      if(path==='/api/scenarios/reset' && ownsRequest) {
        setAutoPreview(0);setSchedulePreview(undefined);
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
      if(throwOnFailure) throw reason;
    }
  }
  async function queuePrint(plan:PrintPlan) {
    const sourceSession=state!.session_id;
    await command('/api/orders/plan',plan,false,true);
    if(currentSession.current===sourceSession) {setReviewSpeed(plan.clock_speed);setTab(plan.mode==='automatic'&&!plan.review_only?'Overview':'Schedule');}
  }
  async function applyReviewedSchedule(payload:components['schemas']['ApplySchedulePayload']) {
    const sourceSession=state!.session_id;
    await command('/api/schedule/apply',payload,false,true);
    if(currentSession.current===sourceSession) setTab('Overview');
  }
  const clock=state && (<section aria-label="Simulation clock"><h2>Simulation clock</h2><p>{state.simulation_time} / {state.running?'Running':'Paused'} / Live refresh every second</p>
        <label>Clock speed <select aria-label="Clock speed" value={state.clock_speed ?? 60} onChange={event=>void command('/api/clock',{running:state.running,speed:Number(event.target.value) as 1|60|300|3600})}>{[1,60,300,3600].map(speed=><option key={speed} value={speed}>{speed}x</option>)}</select></label>
        <button onClick={()=>void command('/api/clock',{running:!state.running,speed:(state.clock_speed ?? 60) as 1|60|300|3600})}>{state.running?'Pause clock':'Run clock'}</button>
      </section>);
  const workflowGuide=(<div className="workflow-guide" aria-label="Manual printing guide"><span>Manual workflow:</span>{(['Models','Orders','Schedule','Overview'] as const).map((step,index)=><button className="secondary" key={step} onClick={()=>setTab(step)}>{index+1}. {step==='Models'?'Browse models':step==='Orders'?'Choose model and quantity':step==='Schedule'?'Start scheduled jobs':'Monitor printers'}</button>)}</div>);
  return <main className={tab==='Overview'?'overview':''}>
    <header><div className="header-brand"><p className="eyebrow">YOUR PRODUCTION WORKSPACE</p><h1>Print Assist</h1><p>Keep customer orders moving.</p></div>
      <div className="header-controls"><span className="badge">Agents OFF · Offline prototype</span>{clock}</div></header>
    <p className="notice">Simulated manufacturing · Print-ready files · No physical printer control</p>
    {error && <p role="alert">{error}</p>}
    {pendingCommand.current && <button type="button" onClick={()=>{const [path,payload]=JSON.parse(pendingCommand.current!.signature);void command(path,payload,true);}}>Retry production command</button>}
    <div className="dashboard-toolbar"><nav role="tablist" aria-label="Dashboard sections">{(['Models','Orders','Schedule','Overview','Printers'] as const).map(name=><button key={name} role="tab" aria-selected={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</nav>
    <button className="secondary" onClick={()=>void load()}>Refresh queue</button></div>
    {tab!=='Overview' && workflowGuide}
    {state && <div hidden={tab!=='Models'}><ModelLibrary key={state.session_id} state={state} onChoose={id=>{setSelectedModel(id);setTab('Orders');}} onUpload={payload=>command('/api/library/models',payload,false,true)}/><details className="preparation-tools"><summary>Model preparation &amp; support review</summary><ModelingBoard key={state.session_id} visualAssets={state.visual_assets ?? []} items={state.modeling_tasks ?? []} onCreate={payload=>modelChange('/api/modeling/tasks',payload)} onProduction={modelId=>{setSelectedModel(modelId);setTab('Orders');}} onMove={(id,action,assessment)=>modelChange('/api/modeling/actions',{task_id:id,action,...(assessment?{support_assessment:assessment}:{})})} onRemove={id=>modelChange('/api/modeling/actions',{task_id:id,action:'remove'})} isArtifactInUse={id=>state.orders.some(order=>order.artifact_id===`model-${id}`)} onRetry={async()=>{if(pendingModel.current){const [path,payload]=JSON.parse(pendingModel.current.signature);await modelChange(path,payload);}else await load();}}/></details></div>}
    {state ? <>

      {tab==='Overview' && <PrintingGuidance state={state} onNewPrint={()=>setTab('Orders')} onSchedule={()=>setTab('Schedule')}/>}
      {tab==='Overview' && <div className="summary-grid" aria-label="Production summary">
        <section><span>Active printers</span><strong>{state.printers.filter(p=>p.status==='running').length} / {state.printers.length}</strong></section>
        <section><span>Items remaining</span><strong>{state.orders.filter(order=>order.status!=='cancelled').reduce((sum,o)=>sum+o.quantity-o.successful_quantity,0)}</strong></section>
        <section><span>Items completed</span><strong>{state.orders.reduce((sum,o)=>sum+o.successful_quantity,0)}</strong></section>
        <section><span>Orders at risk</span><strong>{state.forecasts?.filter(f=>f.risk!=='on_time').length ?? 0}</strong></section>
      </div>}
      {tab==='Overview' && <div className="overview-workspace"><div className="overview-main">
        <PrinterFloor onNewPrint={()=>setTab('Orders')} selectedId={selectedPrinter} onSelect={setSelectedPrinter} state={state} detailed={false} onStart={job_id=>command('/api/start',{job_id})} onControl={(printer_id,action)=>command('/api/printers/control',{printer_id,action})}/>
        <PrintTimeline state={state}/><div className="overview-bottom"><OrderQueue compact state={state}/><ActivityFeed events={state.events}/></div>
      </div><aside className="overview-sidebar" aria-label="Production controls">
        <ScenarioReset onReset={scenario=>command('/api/scenarios/reset',{scenario})}/>
        <section className="workflow-panel"><h2>Manual workflow</h2>{workflowGuide}</section>
        <section className="orchestration-placeholder"><h2>Orchestration</h2><p>Chat, fault recovery and agent activity controls are planned. Manual production works with agents off.</p></section>
      </aside></div>}
      {tab==='Printers' && <><PrinterFloor onNewPrint={()=>setTab('Orders')} selectedId={selectedPrinter} onSelect={setSelectedPrinter} state={state} detailed onStart={job_id=>command('/api/start',{job_id})} onControl={(printer_id,action)=>command('/api/printers/control',{printer_id,action})}/><ScenarioReset onReset={scenario=>command('/api/scenarios/reset',{scenario})}/></>}
      {tab==='Schedule' && <OrderDrafts key={state.session_id} state={state} proposal={schedulePreview} onRevise={(payload,revision)=>command('/api/orders/revise',payload,false,true,revision)} onDelete={(payload,revision)=>command('/api/orders/delete',payload,false,true,revision)}/>}
      {tab==='Schedule' && <ScheduleProposal guided autoPreview={autoPreview>0} onPreview={setSchedulePreview} onPause={()=>void command('/api/clock',{running:false,speed:(state.clock_speed ?? 60) as 1|60|300|3600})} initialSpeed={reviewSpeed} key={state.session_id+autoPreview} state={state} onApply={applyReviewedSchedule}/>}

      {tab==='Schedule' && <details className="advanced-schedule"><summary>Manual scheduling tools</summary><ActivityFeed events={state.events}/><section><h2>Schedule</h2><p>Start each pending print below. Further manual copies are prepared as printers become free and wait for your start. Then open Overview to inspect the printer and run the clock.</p><button className="secondary" onClick={()=>setTab('Overview')}>Next: monitor printers</button><button onClick={()=>void schedule('automatic')}>Schedule automatically</button> <button onClick={()=>void schedule('manual')}>Schedule for manual start</button> <button onClick={()=>void command('/api/advance',{seconds:3600})}>Advance 1 hour</button><ul>{state.jobs.map((job,index)=><li key={String(job.id ?? index)}>{partLabel(String(job.id))} · {String(job.status)} · {printerLabel(String(job.printer_id))} {(job.status==='pending'||job.status==='paused') && <button onClick={()=>void command('/api/start',{job_id:String(job.id)})}>{job.status==='paused'?'Resume':'Start'} {partLabel(String(job.id))}</button>}</li>)}</ul><OrderQueue state={state}/></section></details>}
      {tab==='Orders' && <div className="order-intake-grid"><QuickPrint guided key={state.session_id+selectedModel} initialModel={selectedModel} state={state} onQueue={queuePrint} onModels={()=>setTab('Models')}/><ShopInbox initialModel={selectedModel} onSimulate={async payload=>{const sourceSession=state.session_id;await command('/api/shop/simulate',payload,false,true);if(currentSession.current===sourceSession&&payload.mode==='automatic'&&payload.artifact_id){setAutoPreview(value=>value+1);setTab('Schedule');}}} state={state} onLoad={()=>command('/api/shop/example',{},false,true)} onDecision={async payload=>{const sourceSession=state.session_id;await command('/api/shop/decisions',payload,false,true);if(payload.decision==='accept'&&currentSession.current===sourceSession)setTab('Schedule');}} onSchedule={()=>setTab('Schedule')}/><details className="advanced-order"><summary>Custom order details</summary><div className="workspace"><OrderForm artifacts={state.artifacts} onSubmit={submit}/><OrderQueue state={state}/></div></details></div>}
    </> : <p>Waiting for production state…</p>}
  </main>;
}

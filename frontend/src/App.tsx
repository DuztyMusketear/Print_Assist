import {useEffect,useRef,useState} from 'react';
import {readState,addOrder,scheduleOrders,productionCommand,modelingCommand,RejectedCommand,type Snapshot,type OrderInput} from './api';
import type {components} from './types';
import {OrderForm} from './components/OrderForm';
import {OrderQueue} from './components/OrderQueue';
import {ModelingBoard} from './dashboard/ModelingBoard';

export default function App() {
  const [state,setState]=useState<Snapshot>();
  const [error,setError]=useState('');
  const [tab,setTab]=useState<'Overview'|'Orders'|'Printers'|'Schedule'|'Modeling'>('Overview');
  const sequence=useRef(0);
  const pending=useRef<{signature:string;key:string}|undefined>(undefined);
  const pendingCommand=useRef<{signature:string;body:Parameters<typeof productionCommand>[1]}|undefined>(undefined);
  const pendingModel=useRef<{signature:string;body:Parameters<typeof modelingCommand>[1]}|undefined>(undefined);
  async function modelChange(path:Parameters<typeof modelingCommand>[0],payload:components['schemas']['ModelTaskCreate']|components['schemas']['ModelAction']) {
    ++sequence.current;
    const signature=JSON.stringify([path,payload,state!.session_id]);
    if(pendingModel.current && pendingModel.current.signature!==signature) throw new Error('Retry the previous modeling change first.');
    if(!pendingModel.current) pendingModel.current={signature,body:{session_id:state!.session_id,expected_revision:state!.revision,idempotency_key:crypto.randomUUID(),payload} as Parameters<typeof modelingCommand>[1]};
    try {
      const updated=await modelingCommand(path,pendingModel.current.body);
      pendingModel.current=undefined;
      setState(previous=>updated.session_id===previous!.session_id && updated.revision>=previous!.revision ? updated : previous);
    } catch(reason) {if(reason instanceof RejectedCommand) pendingModel.current=undefined; throw reason;}
  }
  async function load() {
    const current=++sequence.current;
    try {
      const loaded=await readState();
      if(current===sequence.current) {
        if(pendingModel.current && pendingModel.current.body.session_id!==loaded.session_id) pendingModel.current=undefined;
        setState(previous=>previous?.session_id===loaded.session_id && previous.revision>loaded.revision ? previous : loaded);
        setError('');
      }
    } catch(reason) {
      if(current===sequence.current) setError((reason as Error).message);
    }
  }
  useEffect(()=>{void load();},[]);
  async function submit(payload:OrderInput) {
    ++sequence.current;
    const signature=JSON.stringify([state!.session_id,payload]);
    if(pending.current?.signature!==signature) pending.current={signature,key:crypto.randomUUID()};
    const updated=await addOrder({session_id:state!.session_id,expected_revision:state!.revision,
      idempotency_key:pending.current.key,payload});
    pending.current=undefined;
    setState(previous=>updated.session_id===previous!.session_id && updated.revision>=previous!.revision ? updated : previous);
  }
  async function schedule(mode:'automatic'|'manual') {
    ++sequence.current;
    try {
      const updated=await scheduleOrders({session_id:state!.session_id,expected_revision:state!.revision,idempotency_key:crypto.randomUUID(),payload:{mode}});
      setState(previous=>updated.session_id===previous!.session_id && updated.revision>=previous!.revision ? updated : previous);
      setError('');
    } catch(reason) {setError((reason as Error).message);}
  }
  async function command(path:'/api/start'|'/api/advance',payload:{job_id:string}|{seconds:number}) {
    ++sequence.current;
    try {
      const signature=JSON.stringify([path,payload,state!.session_id]);
      if(pendingCommand.current && pendingCommand.current.signature!==signature) throw new Error('Retry the previous production command before issuing another.');
      if(!pendingCommand.current) pendingCommand.current={signature,body:{session_id:state!.session_id,expected_revision:state!.revision,idempotency_key:crypto.randomUUID(),payload} as Parameters<typeof productionCommand>[1]};
      const updated=await productionCommand(path,pendingCommand.current.body);
      pendingCommand.current=undefined;
      setState(previous=>updated.session_id===previous!.session_id && updated.revision>=previous!.revision ? updated : previous);
      setError('');
    } catch(reason) {if(reason instanceof RejectedCommand) pendingCommand.current=undefined; setError((reason as Error).message);}
  }
  return <main>
    <header><div><p className="eyebrow">YOUR PRODUCTION WORKSPACE</p><h1>Print Assist</h1><p>Keep customer orders moving.</p></div>
      <span className="badge">Agents OFF · Offline prototype</span></header>
    <p className="notice">Simulated manufacturing · Print-ready files · No physical printer control</p>
    {error && <p role="alert">{error}</p>}
    <nav role="tablist" aria-label="Dashboard sections">{(['Overview','Orders','Printers','Schedule','Modeling'] as const).map(name=><button key={name} role="tab" aria-selected={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</nav>
    <button className="secondary" onClick={()=>void load()}>Refresh queue</button>
    {state && <div hidden={tab!=='Modeling'}><ModelingBoard items={state.modeling_tasks ?? []} onCreate={payload=>modelChange('/api/modeling/tasks',payload)} onMove={(id,action,assessment)=>modelChange('/api/modeling/actions',{task_id:id,action,...(assessment?{support_assessment:assessment}:{})})} onRemove={id=>modelChange('/api/modeling/actions',{task_id:id,action:'remove'})} isArtifactInUse={id=>state.orders.some(order=>order.artifact_id===`model-${id}`)} onRetry={async()=>{if(pendingModel.current){const [path,payload]=JSON.parse(pendingModel.current.signature);await modelChange(path,payload);}else await load();}}/></div>}
    {state ? <>
      {(tab==='Overview'||tab==='Printers') && <section><h2>Virtual printers</h2><div className="printer-grid">{state.printers.map(printer=>{const job=state.jobs.find(item=>item.printer_id===printer.id && ['running','pending','paused'].includes(String(item.status))); return <article key={printer.id}><h3>{printer.id}</h3><p>{printer.status}</p><p>{printer.material.color} {printer.material.type} · {printer.material.grams} g</p>{job && <p>Job {String(job.id)} · {Math.round(Number(job.elapsed_seconds ?? 0) / Number(job.duration_seconds ?? 1) * 100)}%</p>}</article>})}</div></section>}
      {tab==='Schedule' && <section><h2>Schedule</h2><button onClick={()=>void schedule('automatic')}>Schedule automatically</button> <button onClick={()=>void schedule('manual')}>Schedule for manual start</button> <button onClick={()=>void command('/api/advance',{seconds:3600})}>Advance 1 hour</button><ul>{state.jobs.map((job,index)=><li key={String(job.id ?? index)}>{String(job.id)} · {String(job.status)} · {String(job.printer_id)} {(job.status==='pending'||job.status==='paused') && <button onClick={()=>void command('/api/start',{job_id:String(job.id)})}>{job.status==='paused'?'Resume':'Start'} {String(job.id)}</button>}</li>)}</ul><OrderQueue state={state}/></section>}
      {tab==='Overview' && <><section><h2>Example production activity</h2><p>Example only: a blue PLA figure is printing on Printer 1 (45% complete); another order is waiting for an available printer.</p></section><OrderQueue state={state}/></>}
      {tab==='Orders' && <div className="workspace"><OrderForm artifacts={state.artifacts} onSubmit={submit}/><OrderQueue state={state}/></div>}
    </> : <p>Waiting for production state…</p>}
  </main>;
}

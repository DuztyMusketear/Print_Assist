import {useEffect,useRef,useState} from 'react';
import {readState,addOrder,type Snapshot,type OrderInput} from './api';
import {OrderForm} from './components/OrderForm';
import {OrderQueue} from './components/OrderQueue';

export default function App() {
  const [state,setState]=useState<Snapshot>();
  const [error,setError]=useState('');
  const sequence=useRef(0);
  const pending=useRef<{signature:string;key:string}|undefined>(undefined);
  async function load() {
    const current=++sequence.current;
    try {
      const loaded=await readState();
      if(current===sequence.current) {setState(loaded);setError('');}
    } catch(reason) {
      if(current===sequence.current) setError((reason as Error).message);
    }
  }
  useEffect(()=>{void load();},[]);
  async function submit(payload:OrderInput) {
    const current=++sequence.current;
    const signature=JSON.stringify([state!.session_id,payload]);
    if(pending.current?.signature!==signature) pending.current={signature,key:crypto.randomUUID()};
    const updated=await addOrder({session_id:state!.session_id,expected_revision:state!.revision,
      idempotency_key:pending.current.key,payload});
    pending.current=undefined;
    if(current===sequence.current && updated.revision>=state!.revision) setState(updated);
  }
  return <main>
    <header><div><p className="eyebrow">YOUR PRODUCTION WORKSPACE</p><h1>Print Assist</h1><p>Keep customer orders moving.</p></div>
      <span className="badge">Agents OFF · Offline prototype</span></header>
    <p className="notice">Simulated manufacturing · Print-ready files · No physical printer control</p>
    {error && <p role="alert">{error}</p>}
    <button className="secondary" onClick={()=>void load()}>Refresh queue</button>
    {state ? <div className="workspace"><OrderForm artifacts={state.artifacts} onSubmit={submit}/><OrderQueue state={state}/></div> : <p>Waiting for production state…</p>}
  </main>;
}

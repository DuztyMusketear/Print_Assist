import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {Snapshot} from '../api';
export type OrchestratorConnection={configured:boolean;connected:boolean;account_label:string|null;message:string;models:{id:string;name:string}[]};
type ChatRequest={message:string;session_id:string;expected_revision:number;idempotency_key:string;model:string|null};
class RequestFailure extends Error {constructor(message:string,public status:number){super(message);}}
async function request<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch('/api/orchestrator/'+path,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();
 if(!response.ok)throw new RequestFailure(typeof result.detail==='string'?result.detail:'The orchestrator request failed. Try again.',response.status);
 return result as T;
}
export function OrchestratorPanel({state,onConnectionChange}:{state:Snapshot;onConnectionChange?:(connection:OrchestratorConnection)=>void}){
 const [connection,setConnection]=useState<OrchestratorConnection|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[model,setModel]=useState('');
 const [messages,setMessages]=useState<{role:string;text:string}[]>([]),[retry,setRetry]=useState(false);
 const pending=useRef<ChatRequest|null>(null),active=useRef(true),callback=useRef(onConnectionChange);callback.current=onConnectionChange;
 function update(value:OrchestratorConnection){if(active.current){setConnection(value);callback.current?.(value);}}
 async function refresh(){setBusy(true);setError('');try{update(await request<OrchestratorConnection>('connection'));}catch(reason){if(active.current)setError((reason as Error).message);}finally{if(active.current)setBusy(false);}}
 useEffect(()=>{active.current=true;void refresh();return()=>{active.current=false;};},[]);
 async function authenticate(){setBusy(true);setError('');try{const result=await request<{authorization_url:string}>('auth/start',{});if(active.current)window.open(result.authorization_url,'_self');}catch(reason){if(active.current)setError((reason as Error).message);}finally{if(active.current)setBusy(false);}}
 async function logout(){setBusy(true);setError('');try{update(await request<OrchestratorConnection>('logout',{}));if(active.current){setMessages([]);pending.current=null;setRetry(false);}}catch(reason){if(active.current)setError((reason as Error).message);}finally{if(active.current)setBusy(false);}}
 async function send(event:FormEvent){event.preventDefault();if(busy||!connection?.connected||(!message.trim()&&!pending.current))return;
 const body=pending.current??{message:message.trim(),session_id:state.session_id,expected_revision:state.revision,idempotency_key:crypto.randomUUID(),model:model||null};pending.current=body;setBusy(true);setError('');
 try{const result=await request<{reply:string;model:string;read_only:true}>('chat',body);if(active.current){setMessages(previous=>[...previous,{role:'You',text:body.message},{role:'Orchestrator',text:result.reply}].slice(-20));setMessage('');setRetry(false);pending.current=null;}}
 catch(reason){if(active.current){setError((reason as Error).message);const rejected=reason instanceof RequestFailure&&reason.status>=400&&reason.status<500;if(rejected)pending.current=null;setRetry(!rejected);}}finally{if(active.current)setBusy(false);}
 }
 return <section className="orchestrator-panel" aria-label="Orchestrator chat">
  <header className="sidebar-panel-heading"><h2>Orchestrator</h2><span className="sidebar-badge">{connection?.connected?'Connected':'ChatGPT'}</span></header>
  <p className="orchestrator-description">Your manufacturing planning assistant</p>
  <div className="orchestrator-connection">{connection?<><p>{connection.connected?connection.account_label:connection.message}</p>{connection.connected?<button className="secondary" disabled={busy} onClick={()=>void logout()}>Sign out</button>:<button data-oai-siwc-button="true" disabled={busy||!connection.configured} onClick={()=>void authenticate()}>Continue with ChatGPT</button>}</>:<p>Checking ChatGPT connection...</p>}<button className="secondary" disabled={busy} onClick={()=>void refresh()}>Refresh connection</button></div>
  <div className="orchestrator-messages" role="log" aria-label="Orchestrator conversation"><p className="orchestrator-local-status">Local workshop status: {state.printers.length} printers, {state.orders.length} orders.</p>{messages.map((entry,index)=><div className={'orchestrator-message '+entry.role.toLowerCase()} key={index}><strong>{entry.role}</strong><p>{entry.text}</p></div>)}</div>
  <div className="orchestrator-suggestions">{['Factory status','Optimize schedule','Prioritize urgent orders'].map(suggestion=><button className="secondary" key={suggestion} disabled={busy||retry} onClick={()=>setMessage(suggestion)}>{suggestion}</button>)}</div>
  <form onSubmit={event=>void send(event)}><label>Model<select value={model} disabled={busy||retry||!connection?.connected} onChange={event=>setModel(event.target.value)}><option value="">Account default</option>{connection?.models.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="orchestrator-compose"><textarea aria-label="Message orchestrator" placeholder="Ask about your workshop..." value={message} disabled={busy||retry} onChange={event=>setMessage(event.target.value)}/><button type="submit" aria-label={retry?'Retry message':'Send message'} disabled={busy||!connection?.connected||!message.trim()}>{busy?'...':retry?'Retry':'Send'}</button></div></form>
  {retry&&<button type="button" className="secondary" disabled={busy} onClick={()=>{pending.current=null;setRetry(false);setError('');}}>Discard pending message</button>}
  {error&&<p role="alert">{error}</p>}<p className="orchestrator-disclaimer">Recommendations only; production changes still require confirmation.</p>
 </section>;
}

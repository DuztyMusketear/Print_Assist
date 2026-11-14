import {useState} from 'react';
import type {components} from '../types';
import {EntryField} from './EntryField';
export type PrinterAction=components['schemas']['PrinterControlPayload']['action'];
export type Scenario=components['schemas']['ResetPayload']['scenario'];
export type ControlHandler=(id:string,action:PrinterAction)=>Promise<void>;
const actions:Record<string,PrinterAction[]>={idle:['pause','offline'],reserved:['pause','offline'],running:['pause','offline'],paused:['resume','offline'],offline:['online']};
const labels:Record<PrinterAction,(id:string)=>string>={pause:id=>'Pause '+id,resume:id=>'Resume '+id,offline:id=>'Take '+id+' offline',online:id=>'Bring '+id+' online'};

export function PrinterControls({id,status,onControl}:{id:string;status:string;onControl:ControlHandler}) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const available=actions[status] ?? [];
  async function apply(action:PrinterAction) {
    setBusy(true);setError('');
    try {await onControl(id,action);}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
  }
  return <div className="printer-operation-controls">
    {available.length===0 && <p>No manual controls available for this printer state.</p>}
    {available.map(action=><button type="button" className="secondary" key={action} disabled={busy} onClick={()=>void apply(action)}>{labels[action](id)}</button>)}
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function ScenarioReset({onReset}:{onReset:(scenario:Scenario)=>Promise<void>}) {
  const [scenario,setScenario]=useState<Scenario>('empty');const [ack,setAck]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function reset() {
    setBusy(true);setError('');
    try {await onReset(scenario);setAck(false);}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
  }
  return <section className="scenario-reset"><h2>Reset simulation scenario</h2>
    <EntryField id="scenario-choice" label="Scenario" help="Empty clears manufacturing work. Seeded creates two sample figure orders and three idle printers. Both reset the session and keep agents off."><select value={scenario} onChange={event=>setScenario(event.target.value as Scenario)}><option value="empty">Empty workshop</option><option value="seeded">Seeded figure shop</option></select></EntryField>
    <p>Reset replaces orders, attempts, inventory, modeling tasks, custom artifacts and activity history. The clock stops and agent controls turn off. Repository model files are kept.</p>
    <label className="example-toggle"><input type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)}/>I understand that reset replaces the current simulation data.</label>
    <button type="button" disabled={!ack||busy} onClick={()=>void reset()}>Reset scenario</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}

type Event=Partial<components['schemas']['ActivityEvent']> & Pick<components['schemas']['ActivityEvent'],'type'|'timestamp'>;
export function ActivityFeed({events}:{events:Event[]}) {
  return <section className="activity-feed"><h2>Production activity</h2>
    {events.length===0?<p>No activity yet</p>:<ul>{events.slice().reverse().map((event,index)=><li key={index}>
      <strong>{event.message || event.type.replaceAll('_',' ')}</strong>
      <p>{event.source ?? 'user'} / {event.status ?? 'accepted'} / <time dateTime={event.timestamp}>{event.timestamp}</time></p>
      <small>{[event.printer_id,event.job_id,event.order_id].filter(Boolean).join(' / ')}</small>
    </li>)}</ul>}
  </section>;
}

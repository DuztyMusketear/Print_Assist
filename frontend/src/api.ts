import type { components } from './types';
export type Snapshot = components['schemas']['FactorySnapshot'];
export type OrderInput = components['schemas']['OrderCreate'];
export type IncidentCommand=components['schemas']['IncidentTelemetryCommand']|components['schemas']['FaultCommand']|components['schemas']['RecoverCommand']|components['schemas']['RejectRecoveryCommand']|components['schemas']['ClearFaultCommand']|components['schemas']['RecoveryPolicyCommand'];
export type ProductionPath='/api/incidents/telemetry'|'/api/incidents/inject'|'/api/incidents/recover'|'/api/incidents/reject'|'/api/incidents/clear'|'/api/incidents/policy'|'/api/orders/delete'|'/api/shop/simulate'|'/api/orders/revise'|'/api/library/models'|'/api/shop/example'|'/api/shop/decisions'|'/api/schedule/apply'|'/api/orders/plan'|'/api/clock'|'/api/start'|'/api/advance'|'/api/printers/control'|'/api/scenarios/reset';
export type ProductionBody=IncidentCommand|components['schemas']['DeleteOrderCommand']|components['schemas']['SimulateOrderCommand']|components['schemas']['ReviseOrderCommand']|components['schemas']['LibraryUploadCommand']|components['schemas']['ExampleFeedCommand']|components['schemas']['ShopDecisionCommand']|components['schemas']['ApplyScheduleCommand']|components['schemas']['PlanOrderCommand']|components['schemas']['ClockCommand']|components['schemas']['StartCommand']|components['schemas']['AdvanceCommand']|components['schemas']['PrinterControlCommand']|components['schemas']['ResetCommand'];
export type ProductionPayload=ProductionBody['payload'];
export class RejectedCommand extends Error {constructor(message:string,public status=409){super(message);}}
export async function modelingCommand(path:'/api/modeling/tasks'|'/api/modeling/actions',body:components['schemas']['ModelTaskCommand']|components['schemas']['ModelActionCommand']):Promise<Snapshot> {
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok) {
    const result=await response.json().catch(()=>null);
    const detail=typeof result?.detail==='string'?result.detail:Array.isArray(result?.detail)?result.detail.map((item:{loc?:unknown[];msg?:string})=>`${Array.isArray(item.loc)?item.loc.slice(1).join('.')+': ':''}${item.msg??''}`).filter(Boolean).join('; '):'';
    throw new RejectedCommand(detail?`Modeling change rejected: ${detail}`:'Modeling change rejected. Refresh state and check the task details.',response.status);
  }
  return response.json();
}
export async function productionCommand(path:ProductionPath,body:ProductionBody):Promise<Snapshot> {
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (!response.ok) {
    if(path==='/api/library/models'&&response.status===422) {
      const result=await response.json().catch(()=>null);
      const message=typeof result?.detail==='string'?result.detail:'Check the STL file and print settings. Uploads require a valid model and positive print estimates.';
      throw new RejectedCommand(message,response.status);
    }
    if(response.status===409&&path.startsWith('/api/incidents/')) {
      const result=await response.json().catch(()=>null);
      throw new RejectedCommand(typeof result?.detail==='string'?result.detail:'Production command failed. Refresh the queue and try again.',response.status);
    }
    if(response.status<500) throw new RejectedCommand('Production command failed. Refresh the queue and try again.',response.status);
    throw new Error('Production outcome could not be confirmed. Retry the previous command.');
  }
  return response.json();
}
export async function scheduleOrders(body:components['schemas']['ScheduleCommand']):Promise<Snapshot> {
  const response=await fetch('/api/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (!response.ok) throw new Error('Scheduling failed. Refresh the queue and try again.');
  return response.json();
}
export async function readState(): Promise<Snapshot> {
  const response=await fetch('/api/state');
  if (!response.ok) throw new Error('Unable to load production state. Check the local server.');
  return response.json();
}
export async function addOrder(body:components['schemas']['CommandEnvelope']):Promise<Snapshot> {
  const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (!response.ok) {
    if (response.status===409) throw new Error('Production state changed. Refresh before submitting again.');
    throw new Error('Order could not be saved. Check the product, quantity and deadlines.');
  }
  return response.json();
}

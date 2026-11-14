import type { components } from './types';
export type Snapshot = components['schemas']['FactorySnapshot'];
export type OrderInput = components['schemas']['OrderCreate'];
export type ProductionPath='/api/start'|'/api/advance'|'/api/printers/control'|'/api/scenarios/reset';
export type ProductionBody=components['schemas']['StartCommand']|components['schemas']['AdvanceCommand']|components['schemas']['PrinterControlCommand']|components['schemas']['ResetCommand'];
export type ProductionPayload=ProductionBody['payload'];
export class RejectedCommand extends Error {}
export async function modelingCommand(path:'/api/modeling/tasks'|'/api/modeling/actions',body:components['schemas']['ModelTaskCommand']|components['schemas']['ModelActionCommand']):Promise<Snapshot> {
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok) throw new RejectedCommand('Modeling change rejected. Refresh state and check the task details.');
  return response.json();
}
export async function productionCommand(path:ProductionPath,body:ProductionBody):Promise<Snapshot> {
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (!response.ok) {
    if(response.status<500) throw new RejectedCommand('Production command failed. Refresh the queue and try again.');
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

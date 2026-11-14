import type { components } from './types';
export type Snapshot = components['schemas']['FactorySnapshot'];
export type OrderInput = components['schemas']['OrderCreate'];
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

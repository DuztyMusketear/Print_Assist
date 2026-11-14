import { useState, type FormEvent } from 'react';
import type { components } from '../types';
import {EntryField} from './EntryField';
type OrderInput = components['schemas']['OrderCreate'];
type Props = { artifacts: {id:string; name:string}[]; onSubmit: (order:OrderInput) => Promise<void> };

export function OrderForm({artifacts, onSubmit}: Props) {
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const production_due = new Date(String(values.get('production_due'))+'Z').toISOString();
    const ship_by = new Date(String(values.get('ship_by'))+'Z').toISOString();
    if (production_due > ship_by) { setError('Production must be due by the ship-by time'); return; }
    setError(''); setBusy(true);
    try {
      await onSubmit({artifact_id:String(values.get('artifact_id')), quantity:Number(values.get('quantity')),
        priority:Number(values.get('priority')), production_due, ship_by});
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    <h2>New production order</h2>
    <EntryField id="order-product" label="Print-ready product" help="Print-ready product: choose an approved artifact. Example: Blue PLA figure."><select name="artifact_id" required>{artifacts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></EntryField>
    <div className="fields">
      <EntryField id="order-quantity" label="Quantity" help="Quantity: successful items required. Example: 3 means three finished prints."><input name="quantity" type="number" min="1" step="1" defaultValue="1" required/></EntryField>
      <EntryField id="order-priority" label="Priority" help="Priority: Higher numbers are scheduled first. Example: 0 is standard; 2 goes ahead of 1."><input name="priority" type="number" min="0" step="1" defaultValue="0" required/></EntryField>
    </div>
    <EntryField id="order-due" label="Production due (UTC)" help="Production due: when printing must finish, in UTC. Example: 2026-11-20 12:00."><input name="production_due" type="datetime-local" required/></EntryField>
    <EntryField id="order-shipping" label="Ship by (UTC)" help="Ship by: when the order must leave for shipping, in UTC. Example: 2026-11-21 12:00. Leave time for packing."><input name="ship_by" type="datetime-local" required/></EntryField>
    <p className="muted">Allow time for finishing and packing before shipping.</p>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{busy ? 'Saving…' : 'Add order'}</button>
  </form>;
}

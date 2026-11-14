import { useState, type FormEvent } from 'react';
import type { components } from '../types';
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
    <label>Print-ready product<select name="artifact_id" required>{artifacts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="fields">
      <label>Quantity<input name="quantity" type="number" min="1" step="1" defaultValue="1" required/></label>
      <label>Priority<input name="priority" type="number" min="0" step="1" defaultValue="0" required/></label>
    </div>
    <label>Production due (UTC)<input name="production_due" type="datetime-local" required/></label>
    <label>Ship by (UTC)<input name="ship_by" type="datetime-local" required/></label>
    <p className="muted">Allow time for finishing and packing before shipping.</p>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{busy ? 'Saving…' : 'Add order'}</button>
  </form>;
}

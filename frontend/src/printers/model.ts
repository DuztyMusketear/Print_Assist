import type {Snapshot} from '../api';
export function printerView(state:Snapshot,id:string) {
  const printer=state.printers.find(p=>p.id===id);
  if(!printer) throw new Error('Unknown printer');
  const jobs=state.jobs.filter(job=>job.printer_id===id);
  const job=jobs.find(job=>['running','pending','paused'].includes(String(job.status))) ?? jobs.slice().reverse().find(job=>job.status==='completed');
  const order=state.orders.find(order=>order.id===job?.order_id);
  const artifact=state.artifacts.find(artifact=>artifact.id===order?.artifact_id);
  const elapsed=Number(job?.elapsed_seconds ?? 0);
  const duration=Number(job?.duration_seconds ?? artifact?.duration_seconds ?? 0);
  const fraction=Number.isFinite(elapsed) && duration>0 ? Math.min(1,Math.max(0,elapsed/duration)) : 0;
  return {printer,job,artifact,progress:job?.status==='completed'?1:fraction};
}

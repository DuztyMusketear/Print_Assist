import type {Snapshot} from '../api';
export function PrintingGuidance({state,onNewPrint,onSchedule}:{state:Snapshot;onNewPrint:()=>void;onSchedule:()=>void}) {
 const orders=state.orders.filter(order=>order.status!=='cancelled');
 const unfinished=orders.some(order=>order.successful_quantity<order.quantity);
 const active=state.printers.some(printer=>printer.status==='running');
 return <section className="printing-guidance" aria-label="Printing guidance"><div><h2>{active?'Printing in progress':unfinished?'Work is waiting':'Ready for a new print'}</h2>
 <p>{active?(state.running?'The simulation is running. Select a printer below to inspect, pause or resume it.':'Printers have work, but the clock is paused. Select Run clock to see printing move.'):unfinished?'Pending jobs need Start; paused printers need Resume. Review the schedule for unavailable printers or material.':orders.length?'All requested prints are complete. Idle printers need a new model and quantity; running the clock alone will not create work.':'No print jobs are assigned. Choose a prepared model and quantity to start printing.'}</p></div>
 <button onClick={onNewPrint}>Start a new print</button>{unfinished && <button className="secondary" onClick={onSchedule}>Review waiting work</button>}</section>;
}

import type {Snapshot} from '../api';
import {printerLabel} from '../display';
export function MaterialCompatibility({state,artifactId}:{state:Snapshot;artifactId:string}){
 const model=state.artifacts.find(item=>item.id===artifactId);if(!model)return null;
 const ready=state.printers.some(printer=>printer.material.type===model.filament_type&&printer.material.color===model.color);
 return <div className="material-compatibility"><p>Required filament: <strong>{model.color} {model.filament_type}</strong>, {model.filament_grams} g per copy.</p><p>Loaded spools: {state.printers.length?state.printers.map(printer=>`${printerLabel(printer.id)}: ${printer.material.color} ${printer.material.type} (${Math.round(printer.material.grams)} g, ${printer.status})`).join('; '):'No printers registered'}.</p>{!ready&&<p role="note" className="deadline-risk">No printer has {model.color} {model.filament_type} loaded. A blue spool cannot print a black part. Open Printers and load matching filament on an idle, uncommitted printer, or choose a model profile that matches an available spool.</p>}<p className="muted">Queued work also reserves filament. Compatibility and remaining stock are checked again before starting.</p></div>;
}

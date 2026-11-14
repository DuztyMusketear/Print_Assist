import {printerLabel,partLabel} from '../display';
import {useState} from 'react';
import type {Snapshot} from '../api';
import {printerView} from './model';
import {PrinterScene} from './PrinterScene';
import {PrinterControls,type ControlHandler} from '../components/ProductionControls';

export function PrinterFloor({state,detailed,onControl}:{state:Snapshot;detailed:boolean;onControl?:ControlHandler}) {
  const [selection,setSelection]=useState('');
  const [example,setExample]=useState(false);
  const [exampleProgress,setExampleProgress]=useState(50);
  const selected=state.printers.find(printer=>printer.id===selection) ?? state.printers[0];
  if(!selected) return <p>No virtual printers available</p>;
  const exampleAsset=state.visual_assets?.find(asset=>asset.id==='example-tower');
  const visible=detailed?[selected]:state.printers;
  return <section className={detailed?'printer-floor detailed':'printer-floor'}>
    <div className="printer-floor-heading"><h2>Virtual printers</h2><span className="volume-label">Simulated beds · 220 × 220 × 250 mm</span></div>
    {detailed && <><div className="printer-selector">{state.printers.map(printer=><button className="secondary" key={printer.id} aria-pressed={selected.id===printer.id} onClick={()=>{setSelection(printer.id);setExample(false);}}>Inspect {printerLabel(printer.id)}</button>)}</div>
      <label className="example-toggle"><input type="checkbox" checked={example} disabled={!exampleAsset} onChange={event=>setExample(event.target.checked)}/>Preview example part</label>
      {example && <div className="example-controls"><p>Example geometry · demonstration only; production state is unchanged.</p><label>Example progress<input type="range" min="0" max="100" value={exampleProgress} onChange={event=>setExampleProgress(Number(event.target.value))}/></label><output>{exampleProgress}%</output></div>}
    </>}
    <div className="printer-grid">{visible.map(printer=>{
      const view=printerView(state,printer.id);
      const asset=state.visual_assets?.find(asset=>asset.id===view.artifact?.visual_asset_id);
      const demo=detailed && example;
      return <article key={printer.id} className="printer-card">
        <div className="printer-card-heading"><h3>{printerLabel(printer.id)}</h3><span className={'printer-status '+printer.status}>{printer.status}</span></div>
        <PrinterScene label={`3D view of ${printerLabel(printer.id)}`} asset={demo?exampleAsset:asset} progress={demo?exampleProgress/100:view.progress} color={printer.material.color} hasJob={demo||Boolean(view.job)}/>
        <p>{printer.material.color} {printer.material.type} · {Math.round(printer.material.grams)} g</p>
        <p className="printer-job">{view.job ? <>{partLabel(String(view.job.id))} · {Math.round(view.progress*100)}%</> : <>No active job</>}</p>
        <p className="muted printer-part-name">{view.artifact?.name ?? 'Ready for an assignment'}</p>
        <progress aria-label={`Print progress for ${printerLabel(printer.id)}`} max="1" value={view.progress}/>
        <div className="printer-telemetry">{state.telemetry?.filter(item=>item.printer_id===printer.id).map(item=><span key={item.printer_id}>Nozzle {item.nozzle_c} C / Bed {item.bed_c} C (simulated)</span>)}</div>
        {detailed && onControl && <PrinterControls id={printer.id} status={printer.status} onControl={onControl}/>}
      </article>;
    })}</div>
    <p className="scene-caption">Progress reveal is simulated geometry, not a sliced toolpath or print certification. Drag to orbit; use the buttons for keyboard controls.</p>
  </section>;
}

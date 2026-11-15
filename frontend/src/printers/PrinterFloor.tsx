import {FilamentSetup,type FilamentPayload} from '../components/FilamentSetup';
import {printerLabel,partLabel} from '../display';
import {useState} from 'react';
import type {Snapshot} from '../api';
import {printerView} from './model';
import {PrinterScene} from './PrinterScene';
import {PrinterControls,type ControlHandler} from '../components/ProductionControls';

export function PrinterFloor({state,detailed,onControl,onStart,selectedId,onSelect,onNewPrint,onMaterial}:{state:Snapshot;detailed:boolean;onControl?:ControlHandler;onStart?:(id:string)=>Promise<void>;selectedId?:string;onSelect?:(id:string)=>void;onNewPrint?:()=>void;onMaterial?:(payload:FilamentPayload)=>Promise<void>}) {
  const [selection,setSelection]=useState('');
  const [example,setExample]=useState(false);
  const [exampleProgress,setExampleProgress]=useState(50);
  const selected=state.printers.find(printer=>printer.id===(selectedId ?? selection)) ?? state.printers[0];
  function select(id:string) {setSelection(id);if(id!==selected!.id)setExample(false);onSelect?.(id);}
  if(!selected) return <p>No virtual printers available</p>;
  const selectedView=printerView(state,selected.id);
  const selectedTelemetry=state.telemetry?.find(item=>item.printer_id===selected.id);
  const exampleAsset=state.visual_assets?.find(asset=>asset.id==='example-tower');
  const visible=detailed?[selected]:state.printers;
  return <section className={detailed?'printer-floor detailed':'printer-floor'}>
    <div className="printer-floor-heading"><h2>Virtual printers</h2><span className="volume-label">Simulated beds · 220 × 220 × 250 mm</span></div>
    {detailed && <><div className="printer-selector">{state.printers.map(printer=><button className="secondary" key={printer.id} aria-pressed={selected.id===printer.id} onClick={()=>select(printer.id)}>Inspect {printerLabel(printer.id)}</button>)}</div>
      <label className="example-toggle"><input type="checkbox" checked={example} disabled={!exampleAsset} onChange={event=>setExample(event.target.checked)}/>Preview example part</label>
      {example && <div className="example-controls"><p>Example geometry · demonstration only; production state is unchanged.</p><label>Example progress<input type="range" min="0" max="100" value={exampleProgress} onChange={event=>setExampleProgress(Number(event.target.value))}/></label><output>{exampleProgress}%</output></div>}
    </>}
    <div className="printer-grid">{visible.map(printer=>{
      const view=printerView(state,printer.id);
      const asset=state.visual_assets?.find(asset=>asset.id===view.artifact?.visual_asset_id);
      const demo=detailed && example;
      return <article key={printer.id} onClick={()=>select(printer.id)} className={'printer-card'+(selected.id===printer.id?' selected':'')}>
        <div className="printer-card-heading"><h3>{detailed?printerLabel(printer.id):<button className="inspect-printer" aria-label={`Inspect ${printerLabel(printer.id)}`} aria-pressed={selected.id===printer.id} onClick={()=>select(printer.id)}>{printerLabel(printer.id)}</button>}</h3><span className={'printer-status '+printer.status}>{printer.status}</span></div>
        <PrinterScene compact={!detailed} label={`3D view of ${printerLabel(printer.id)}`} asset={demo?exampleAsset:asset} progress={demo?exampleProgress/100:view.progress} color={printer.material.color} hasJob={demo||Boolean(view.job)} printing={!demo&&state.running&&printer.status==='running'&&view.job?.status==='running'}/>
        <p className="printer-job">{view.job ? <>{partLabel(String(view.job.id))} · {Math.round(view.progress*100)}%</> : <>No active job</>}</p>
        <p className="muted printer-part-name">{view.artifact?.name ?? 'Ready for an assignment'}</p>
        {printer.fault && <p className="fault-warning">Isolated: {String(printer.fault.type).replaceAll('_',' ')}. {printer.fault.type==='network_disconnect'?'Awaiting printer confirmation.':'Physical intervention required.'}</p>}
        <progress aria-label={`Print progress for ${printerLabel(printer.id)}`} max="1" value={view.progress}/>


      </article>;
    })}</div>
    <section className="printer-inspector" aria-label="Selected printer details">
      <h3>{printerLabel(selected.id)} details</h3>
      <dl className="inspection-metrics"><div><dt>Status</dt><dd>{selected.status}</dd></div>
      <div><dt>Nozzle / bed (simulated)</dt><dd>{selectedTelemetry?`${selectedTelemetry.nozzle_c} C / ${selectedTelemetry.bed_c} C`:'Unavailable'}</dd></div>
      <div><dt>Filament remaining</dt><dd>{Math.round(selected.material.grams)} g / {selected.material.color} {selected.material.type}</dd></div>
      <div><dt>Print progress</dt><dd>{Math.round(selectedView.progress*100)}%</dd></div>
      <div><dt>Model</dt><dd>{selectedView.artifact?.name ?? 'No model assigned'}</dd></div>
      <div><dt>Print time remaining</dt><dd>{selectedView.job?`${Math.ceil(Math.max(0,Number(selectedView.job.duration_seconds ?? 0)-Number(selectedView.job.elapsed_seconds ?? 0))/60)} min`:'No active print'}</dd></div></dl>
      {selectedView.job?.status==='pending' && onStart && <button onClick={()=>void onStart(String(selectedView.job!.id))}>Start print on {printerLabel(selected.id)}</button>}
      {onControl && <PrinterControls key={'controls-'+selected.id} id={selected.id} status={selected.status} onControl={onControl}/>}
      {selected.status==='idle' && onNewPrint && <button className="new-printer-print" onClick={onNewPrint}>Choose a model for {printerLabel(selected.id)}</button>}
      {onMaterial&&<FilamentSetup key={'filament-'+selected.id} state={state} printer={selected} onLoad={onMaterial}/>}
      <details className="inspection-help"><summary>Control help</summary><p className="muted">Pause stops this printer and holds the part for resuming. Run the simulation clock to see printing advance.</p></details>
    </section>
    <p className="scene-caption">Progress reveal is simulated geometry, not a sliced toolpath or print certification. Drag to orbit; use the buttons for keyboard controls.</p>
  </section>;
}

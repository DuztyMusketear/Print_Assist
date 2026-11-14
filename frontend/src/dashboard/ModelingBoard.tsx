import {readProfile,type ModelProfile} from './profile';
import {useState,type FormEvent} from 'react';
import {advanceWorkItem,createWorkItem,type WorkItem,type WorkflowAction} from './workflow';
import type {components} from '../types';
import {EntryField} from '../components/EntryField';

const stages=['modeling','supports','review','approved'] as const;
const labels:Record<WorkItem['stage'],string>={modeling:'Modeling',supports:'Supports',review:'Review',approved:'Approved'};

type Props={visualAssets?:components['schemas']['VisualAsset'][];items?:WorkItem[];onCreate?:(payload:components['schemas']['ModelTaskCreate'])=>Promise<void>;onMove?:(id:string,action:WorkflowAction)=>Promise<void>;onProduction?:(modelId:string)=>void;onRetry?:()=>Promise<void>};
export function ModelingBoard(props:Props) {
  const [localItems,setItems]=useState<WorkItem[]>([]);
  const items=props.items ?? localItems;
  const [visual,setVisual]=useState('');
  const [duration,setDuration]=useState('');
  const [grams,setGrams]=useState('');
  const [material,setMaterial]=useState('');
  const [color,setColor]=useState('');
  const [profile,setProfile]=useState<ModelProfile>();
  const [manual,setManual]=useState(false);
  const [busy,setBusy]=useState(false);
  const [title,setTitle]=useState('');
  const [reference,setReference]=useState('');
  const [error,setError]=useState('');
  async function importProfile(file:File) {
    try {
      if(file.size>1000000) throw new Error('Profile JSON is too large (maximum 1 MB).');
      const next=readProfile(await file.text());
      setProfile(next);setTitle(next.title);setReference(next.modelReference);
      setDuration(String(next.duration_seconds/60));setGrams(String(next.filament_grams));
      setMaterial(next.filament_type);setColor(next.color);setVisual(next.visual_asset_id ?? '');setError('');
    } catch(reason){setError((reason as Error).message);}
  }
  async function add(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const item=createWorkItem(crypto.randomUUID(),title,reference);
      if(props.onCreate) await props.onCreate({title:item.title,modelReference:item.modelReference,duration_seconds:Math.round(Number(duration)*60),filament_grams:Number(grams),filament_type:material,color,required_capabilities:profile?.required_capabilities ?? ['FFF'],visual_asset_id:visual||null});
      else setItems(current=>[...current,item]);
      setTitle('');setReference('');setError('');
    } catch(reason) {setError((reason as Error).message);} finally {setBusy(false);}
  }
  async function move(item:WorkItem,action:WorkflowAction) {
    setBusy(true);
    try {
      if(props.onMove) await props.onMove(item.id,action);
      else setItems(current=>current.map(candidate=>candidate.id===item.id?advanceWorkItem(candidate,action):candidate));
      setError('');
    } catch(reason) {setError((reason as Error).message);} finally {setBusy(false);}
  }
  return <div className="dashboard">
    <div className="dashboard-intro"><div><p className="eyebrow">MODEL PREPARATION</p><h2>Modeling dashboard</h2><p className="muted">Track each design through modeling, support preparation, and human review.</p></div><span className="local-tag">LOCAL WORKFLOW · NO MODEL CALLS</span></div>
    <form className="work-form" onSubmit={add}>
      {props.onCreate && <div className="prepared-profile"><h3>Add a prepared model</h3><p>Choose the profile JSON supplied with your model. It includes print time, filament weight and printer settings. This imports metadata only; preview geometry must be registered by your team.</p><a href="/models/example-tower.profile.json" download>Download example profile (demo estimates)</a><label>Prepared model profile<input type="file" accept=".json,application/json" onChange={event=>{const file=event.target.files?.[0];if(file) void importProfile(file);}}/></label>{profile && <p role="status">Profile ready: {profile.title} / {Math.ceil(profile.duration_seconds/60)} min / {profile.filament_grams} g per part</p>}</div>}
      <div><h3>Add a model task</h3><p className="muted">Start from an operator-supplied model file reference.</p></div>
      <div><EntryField id="model-name" label="Model name" help="A recognizable name for this design. Example: Dragon figurine."><input value={title} onChange={event=>setTitle(event.target.value)} placeholder="Dragon figurine" /></EntryField></div>
      <div><EntryField id="model-reference" label="Model file reference" help="A filename or team reference; this does not upload a file. Example: dragon-v2.stl."><input value={reference} onChange={event=>setReference(event.target.value)} placeholder="dragon-v2.stl" /></EntryField></div>
      {props.onCreate && <>
        <div><EntryField id="model-visual" label="3D preview model" help="Optional local geometry for the printer-bed preview. This does not upload or certify a file; your partner's assets can be added to the catalog."><select value={visual} onChange={event=>setVisual(event.target.value)}><option value="">No visual model (placeholder)</option>{props.visualAssets?.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></EntryField></div>
        <details className="model-preparation" onToggle={event=>setManual(event.currentTarget.open)}><summary>Model preparation (team only)</summary><p>Partner/slicer estimates belong to the model profile. Everyday printing uses these saved values automatically.</p>
        <div><EntryField id="model-duration" label="Estimated print minutes" help="Print time for one item, from your slicer or experience. Example: 120 means two hours."><input required type="number" min="0.01" step="any" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="120"/></EntryField></div>
        <div><EntryField id="model-grams" label="Estimated filament grams" help="Material for one item, including supports. Example: 25 grams."><input required type="number" min="0" step="any" value={grams} onChange={e=>setGrams(e.target.value)} placeholder="25"/></EntryField></div>
        <div><EntryField id="model-material" label="Filament type" help="Choose a common material or type your own. Example: PLA. Must match printer inventory."><input required list="filament-types" value={material} onChange={e=>setMaterial(e.target.value)} placeholder="PLA"/></EntryField><datalist id="filament-types">{['PLA','PETG','ABS','ASA','TPU','Nylon','PC','PVA'].map(value=><option key={value} value={value}/>)}</datalist></div>
        <div><EntryField id="model-color" label="Filament color" help="Choose a common color or type your own. Example: blue. Match the printer inventory spelling."><input required list="filament-colors" value={color} onChange={e=>setColor(e.target.value)} placeholder="blue"/></EntryField><datalist id="filament-colors">{['blue','black','white','gray','red','green','yellow','orange','purple','pink','natural','transparent'].map(value=><option key={value} value={value}/>)}</datalist></div>
        <p className="muted">Compatibility is supplied by the profile; virtual filament printers are the default.</p></details>
      </>}
      <button type="submit" disabled={busy||Boolean(props.onCreate&&!profile&&!manual)}>Add to modeling</button>
    </form>
    {error && <><p role="alert">{error}</p>{props.onRetry && <button disabled={busy} onClick={async()=>{setBusy(true);try {await props.onRetry!();setError('');}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}}}>Retry modeling change</button>}</>}
    <div className="workflow-board" aria-label="Model preparation stages">
      {stages.map(stage=>{
        const laneItems=items.filter(item=>item.stage===stage);
        return <section className="workflow-lane" key={stage} aria-label={`${labels[stage]} stage`}>
          <div className="lane-heading"><h3>{labels[stage]}</h3><span>{laneItems.length}</span></div>
          {laneItems.length===0?<p className="muted lane-empty">Nothing here yet</p>:laneItems.map(item=><article className="work-card" key={item.id}>
            <h4>{item.title}</h4><p className="file-reference">{item.modelReference}</p>
            {item.reviewOutcome && <p className="review-note">Review requested changes · returned to modeling</p>}
            {stage==='modeling' && <button className="secondary" onClick={()=>move(item,'prepare-supports')}>Prepare supports</button>}
            {stage==='supports' && <button className="secondary" onClick={()=>move(item,'submit-review')}>Send to review</button>}
            {stage==='review' && <div className="review-actions"><button onClick={()=>move(item,'approve')}>Approve</button><button className="secondary" onClick={()=>move(item,'request-changes')}>Request changes</button></div>}
            {stage==='approved' && <><span className="approved-label">Ready for production queue</span>{props.onProduction && <button className="secondary" onClick={()=>props.onProduction!('model-'+item.id)}>Next: choose quantity</button>}</>}
          </article>)}
        </section>;
      })}
    </div>
    <p className="workflow-footnote">Stage changes are deterministic and operator-controlled. Model generation and slicing integrations are not enabled.</p>
  </div>;
}

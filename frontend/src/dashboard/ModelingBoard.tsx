import {readProfile,type ModelProfile} from './profile';
import {useEffect,useState,type FormEvent} from 'react';
import {advanceWorkItem,createWorkItem,FILAMENT_COLOR_CHOICES,type FilamentColor,type WorkItem,type WorkflowAction,type SupportAssessment} from './workflow';
import type {components} from '../types';
import {EntryField} from '../components/EntryField';
import {NistModelPreview} from './NistModelPreview';

const stages=['modeling','supports','review','approved'] as const;
const labels:Record<WorkItem['stage'],string>={modeling:'Modeling',supports:'Supports',review:'Review',approved:'Approved'};

function SupportAssessmentForm({item,busy,onSubmit}:{item:WorkItem;busy:boolean;onSubmit:(assessment:SupportAssessment)=>void}) {
  const [required,setRequired]=useState('');
  const [reference,setReference]=useState('');
  const [grams,setGrams]=useState('');
  const [notes,setNotes]=useState('');
  const requiredSupports=required==='required';
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!required) return;
    onSubmit({supports_required:requiredSupports,
      support_reference:requiredSupports?(reference.trim()||null):null,
      support_material_grams:requiredSupports&&grams!==''?Number(grams):null,
      removal_notes:requiredSupports?(notes.trim()||null):null});
  }
  return <form className="support-task" aria-label={`Support task for ${item.title}`} onSubmit={submit}>
    <h5>Support task</h5>
    <p className="muted">Check the model for overhangs that need temporary print supports. Supports are removed after printing.</p>
    <label>Support requirement<select required value={required} onChange={event=>setRequired(event.target.value)}>
      <option value="">Select an assessment</option><option value="required">Supports are required</option><option value="not-required">No supports required</option>
    </select></label>
    {requiredSupports&&<>
      <label>Support file or slicer project (optional)<input value={reference} onChange={event=>setReference(event.target.value)} placeholder="model-supports.3mf"/></label>
      <label>Estimated support material grams (optional)<input type="number" min="0" step="0.01" value={grams} onChange={event=>setGrams(event.target.value)} placeholder="5"/></label>
      <label>Support removal notes (optional)<textarea value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Where to remove supports after printing"/></label>
    </>}
    <button type="submit" disabled={busy||!required}>Send model and support assessment to review</button>
  </form>;
}

type Props={visualAssets?:components['schemas']['VisualAsset'][];items?:WorkItem[];initialDraft?:components['schemas']['ModelTaskCreate'];showTaskIntake?:boolean;onCreate?:(payload:components['schemas']['ModelTaskCreate'])=>Promise<void>;onMove?:(id:string,action:WorkflowAction,assessment?:SupportAssessment,color?:FilamentColor)=>Promise<void>;onRemove?:(id:string)=>Promise<void>;isArtifactInUse?:(id:string)=>boolean;onProduction?:(modelId:string)=>void;onRetry?:()=>Promise<void>};
function ModelPrintDetails({item,onColorChange,busy=false}:{item:WorkItem;onColorChange?:(color:FilamentColor)=>void;busy?:boolean}) {
  return <dl className="task-print-details" aria-label={`Print details for ${item.title}`}>
    <div><dt>Estimated print time</dt><dd>{Math.ceil((item.duration_seconds??0)/60)} min</dd></div>
    <div><dt>Estimated material</dt><dd>{item.filament_grams??0} g {item.filament_type??'unspecified'}</dd></div>
    <div><dt>Color</dt><dd>{onColorChange?<select aria-label={`Color for ${item.title}`} className="secondary task-color-select" disabled={busy} value={item.color??''} onChange={event=>onColorChange(event.target.value as FilamentColor)}>{FILAMENT_COLOR_CHOICES.map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select>:item.color??'unspecified'}</dd></div>
    <div><dt>Printer capabilities</dt><dd>{item.required_capabilities?.join(', ')||'unspecified'}</dd></div>
  </dl>;
}
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
  useEffect(()=>{const draft=props.initialDraft;if(!draft)return;setTitle(draft.title);setReference(draft.modelReference);setDuration(String(draft.duration_seconds/60));setGrams(String(draft.filament_grams));setMaterial(draft.filament_type);setColor(draft.color);setVisual(draft.visual_asset_id??'');setProfile(draft);setManual(false);},[props.initialDraft]);
  async function importProfile(file:File) {
    try {
      if(file.size>1000000) throw new Error('Profile JSON is too large (maximum 1 MB).');
      const next=readProfile(await file.text());
      if(!FILAMENT_COLOR_CHOICES.includes(next.color as typeof FILAMENT_COLOR_CHOICES[number])) throw new Error(`Choose one of these filament colors: ${FILAMENT_COLOR_CHOICES.join(', ')}.`);
      setProfile(next);setTitle(next.title);setReference(next.modelReference);
      setDuration(String(next.duration_seconds/60));setGrams(String(next.filament_grams));
      setMaterial(next.filament_type);setColor(next.color);setVisual(next.visual_asset_id ?? '');setError('');
    } catch(reason){setError((reason as Error).message);}

  }
  const [removeTarget,setRemoveTarget]=useState<WorkItem>();
  async function add(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const taskProfile={duration_seconds:Math.round(Number(duration)*60),filament_grams:Number(grams),filament_type:material,color,required_capabilities:profile?.required_capabilities ?? ['FFF']};
      const item=createWorkItem(crypto.randomUUID(),title,reference,taskProfile);
      if(props.onCreate) await props.onCreate({title:item.title,modelReference:item.modelReference,duration_seconds:Math.round(Number(duration)*60),filament_grams:Number(grams),filament_type:material,color,required_capabilities:profile?.required_capabilities ?? ['FFF'],...(visual?{visual_asset_id:visual}:{})});
      else setItems(current=>[...current,item]);
      setTitle('');setReference('');setError('');
    } catch(reason) {setError((reason as Error).message);} finally {setBusy(false);}
  }
  async function move(item:WorkItem,action:WorkflowAction,assessment?:SupportAssessment,color?:FilamentColor) {
    setBusy(true);
    try {
      if(props.onMove) await props.onMove(item.id,action,assessment,color);
      else setItems(current=>current.map(candidate=>candidate.id===item.id?advanceWorkItem(candidate,action,assessment,color):candidate));
      setError('');
    } catch(reason) {setError((reason as Error).message);} finally {setBusy(false);}
  }
  async function remove(item:WorkItem) {
    setBusy(true);
    try {
      if(props.onRemove) await props.onRemove(item.id);
      else setItems(current=>current.filter(candidate=>candidate.id!==item.id));
      setError('');
    } catch(reason) {setError((reason as Error).message);} finally {setBusy(false);}
  }
  function requestRemove(item:WorkItem) {
    if(item.stage==='approved'&&props.isArtifactInUse?.(item.id)) {
      setError(`Cannot remove ${item.title}; this approved artifact is already used by an order.`);
      return;
    }
    setError('');
    setRemoveTarget(item);
  }
  function confirmRemoval() {
    const item=removeTarget!;
    setRemoveTarget(undefined);
    void remove(item);
  }
  return <div className="dashboard">
    <div className="dashboard-intro"><div><p className="eyebrow">MODEL PREPARATION</p><h2>Modeling dashboard</h2><p className="muted">Track separate model and support tasks, then review them together before approval.</p></div><span className="local-tag">LOCAL WORKFLOW · NO MODEL CALLS</span></div>
    {props.showTaskIntake !== false && <form className="work-form" onSubmit={add}>
      <div><h3>Add a model task</h3><p className="muted">Start from a preset, a prepared profile, or an operator-supplied model reference.</p>{props.onCreate&&<><label className="inline-profile-import">Import prepared profile <input aria-label="Prepared model profile" type="file" accept=".json,application/json" onChange={event=>{const file=event.target.files?.[0];if(file)void importProfile(file);}}/></label><a href="/models/example-tower.profile.json" download>Download example profile (demo estimates)</a>{profile&&<p role="status">Profile ready: {profile.title} / {Math.ceil(profile.duration_seconds/60)} min / {profile.filament_grams} g per item</p>}</>}</div>
      <div><EntryField id="model-name" label="Model name" help="A recognizable name for this design. Example: Dragon figurine."><input value={title} onChange={event=>setTitle(event.target.value)} placeholder="Dragon figurine" /></EntryField></div>
      <div><EntryField id="model-reference" label="Model file reference" help="A filename or team reference; this does not upload a file. Example: dragon-v2.stl."><input value={reference} onChange={event=>setReference(event.target.value)} placeholder="dragon-v2.stl" /></EntryField></div>
      {props.onCreate && <>
        <div><EntryField id="model-visual" label="3D preview model" help="Optional local geometry for the printer-bed preview. This does not upload or certify a file; your partner's assets can be added to the catalog."><select value={visual} onChange={event=>setVisual(event.target.value)}><option value="">No visual model (placeholder)</option>{props.visualAssets?.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></EntryField></div>
        <details open={manual} className="model-preparation" onToggle={event=>setManual(event.currentTarget.open)}><summary>Model preparation (team only)</summary><p>Partner/slicer estimates belong to the model profile. Everyday printing uses these saved values automatically.</p>
        <div><EntryField id="model-duration" label="Estimated print minutes" help="Print time for one item, from your slicer or experience. Example: 120 means two hours."><input required type="number" min="0.01" step="any" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="120"/></EntryField></div>
        <div><EntryField id="model-grams" label="Estimated filament grams" help="Material for one item, including supports. Example: 25 grams."><input required type="number" min="0" step="any" value={grams} onChange={e=>setGrams(e.target.value)} placeholder="25"/></EntryField></div>
        <div><EntryField id="model-material" label="Filament type" help="Choose a common material or type your own. Example: PLA. Must match printer inventory."><input required list="filament-types" value={material} onChange={e=>setMaterial(e.target.value)} placeholder="PLA"/></EntryField><datalist id="filament-types">{['PLA','PETG','ABS','ASA','TPU','Nylon','PC','PVA'].map(value=><option key={value} value={value}/>)}</datalist></div>
        <div><EntryField id="model-color" label="Filament color" help="Choose a color that matches your printer's filament inventory."><select required className="theme-color-select" style={{borderLeftColor:color}} value={color} onChange={e=>setColor(e.target.value)}><option value="">Choose a color</option>{FILAMENT_COLOR_CHOICES.map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></EntryField></div>
        <p className="muted">Compatibility is supplied by the profile; virtual filament printers are the default.</p></details>
      </>}
      <button type="submit" disabled={busy||Boolean(props.onCreate&&!profile&&!manual)}>Add to modeling</button>
    </form>}
    {error && <><p role="alert">{error}</p>{props.onRetry && <button disabled={busy} onClick={async()=>{setBusy(true);try {await props.onRetry!();setError('');}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}}}>Retry modeling change</button>}</>}
    {removeTarget&&<div className="remove-confirm-backdrop"><section className="remove-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-confirm-heading">
      <h3 id="remove-confirm-heading">Confirm task removal</h3>
      <p>Remove {removeTarget.title} from the modeling workflow?</p>
      {removeTarget.stage==='approved'&&<p>The unused orderable artifact will also be removed.</p>}
      <div><button type="button" className="secondary" disabled={busy} aria-label="Cancel removal" onClick={()=>setRemoveTarget(undefined)}>Cancel</button><button type="button" disabled={busy} onClick={confirmRemoval}>Confirm removal</button></div>
    </section></div>}
    <div className="workflow-board" aria-label="Model preparation stages">
      {stages.map(stage=>{
        const laneItems=items.filter(item=>item.stage===stage);
        return <section className="workflow-lane" key={stage} aria-label={`${labels[stage]} stage`}>
          <div className="lane-heading"><h3>{labels[stage]}</h3><span>{laneItems.length}</span></div>
          {laneItems.length===0?<p className="muted lane-empty">Nothing here yet</p>:laneItems.map(item=><article className="work-card" key={item.id}>
            <h4>{item.title}</h4><ModelPrintDetails item={item} busy={busy} onColorChange={stage==='modeling'?color=>move(item,'set-color',undefined,color):undefined}/>
            {item.modelReference==='/demo-models/nist-test-artifact.stl'&&<NistModelPreview/>}
            {item.reviewOutcome && <p className="review-note">Review requested changes · returned to modeling</p>}
            {stage==='modeling' && <button className="secondary" onClick={()=>move(item,'prepare-supports')}>Prepare supports</button>}
            {stage==='supports' && <SupportAssessmentForm item={item} busy={busy} onSubmit={assessment=>move(item,'submit-review',assessment)}/>}
            {stage==='review' && <><section className="review-package" aria-label={`Review package for ${item.title}`}>
              <h5>Combined model and supports review</h5><ModelPrintDetails item={item}/>
              <p>{item.support_task?(item.support_task.supports_required?'Supports required':'No supports required'):'Support assessment not recorded'}</p>
              {item.support_task?.support_reference&&<p>Support file or slicer project: {item.support_task.support_reference}</p>}
              {item.support_task?.support_material_grams!=null&&<p>Estimated support material: {item.support_task.support_material_grams} g</p>}
              {item.support_task?.removal_notes&&<p>Support removal notes: {item.support_task.removal_notes}</p>}
            </section><div className="review-actions"><button onClick={()=>move(item,'approve')}>Approve model and supports</button><button className="secondary" onClick={()=>move(item,'request-changes')}>Request changes</button></div></>}
            {stage==='approved' && <><span className="approved-label">Ready for production queue</span><p className="support-stored">Model and support data stored together · {item.support_task?(item.support_task.supports_required?'supports required':'no supports required'):'legacy approval; support assessment not recorded'}</p>{props.onProduction && <button className="secondary" onClick={()=>props.onProduction!('model-'+item.id)}>Next: choose quantity</button>}</>}
            <button type="button" className="remove-model" disabled={busy} aria-label={`Remove ${item.title}`} onClick={()=>requestRemove(item)}>Remove</button>
          </article>)}
        </section>;
      })}
    </div>
    <p className="workflow-footnote">Support requirements and removal notes are operator assessments. The dashboard does not generate support geometry or slice files.</p>
  </div>;
}

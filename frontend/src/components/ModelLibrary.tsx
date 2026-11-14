import {useRef,useState,type FormEvent} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';
import {EntryField} from './EntryField';
import {ModelPreview} from './ModelPreview';
import {readProfile} from '../dashboard/profile';
import {MAX_BYTES} from '../printers/assets';

type Upload=components['schemas']['LibraryUpload'];
export function ModelLibrary({state,onChoose,onUpload}:{state:Snapshot;onChoose:(id:string)=>void;onUpload:(payload:Upload)=>Promise<void>}) {
 const [search,setSearch]=useState(''),[open,setOpen]=useState(false),[file,setFile]=useState<File>();
 const [name,setName]=useState(''),[minutes,setMinutes]=useState(''),[grams,setGrams]=useState('');
 const [material,setMaterial]=useState('PLA'),[color,setColor]=useState('blue'),[assessment,setAssessment]=useState('');
 const [notes,setNotes]=useState(''),[reference,setReference]=useState(''),[supportGrams,setSupportGrams]=useState('');
 const [reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const form=useRef<HTMLFormElement>(null);
 async function importProfile(file:File) {
  try {
   if(file.size>1000000) throw new Error('Profile exceeds 1 MB');
   const profile=readProfile(await file.text());
   setName(profile.title);setMinutes(String(profile.duration_seconds/60));setGrams(String(profile.filament_grams));setMaterial(profile.filament_type);setColor(profile.color);setReviewed(false);setError('');
  }catch(reason){setError((reason as Error).message);}
 }
 async function save(event:FormEvent) {
  event.preventDefault();setBusy(true);setError('');setSaved(false);
  try {
   if(!file) throw new Error('Choose an STL model file');
   if(file.size>MAX_BYTES) throw new Error('STL exceeds 10 MiB');
   const encoded=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Unable to read model file'));reader.readAsDataURL(file);
   });
   await onUpload({name,filename:file.name,stl_base64:encoded,duration_seconds:Math.round(Number(minutes)*60),filament_grams:Number(grams),filament_type:material,color,
    support_assessment:{supports_required:assessment==='required',support_reference:assessment==='required'?reference||null:null,support_material_grams:assessment==='required'&&supportGrams!==''?Number(supportGrams):null,removal_notes:assessment==='required'?notes||null:null}});
   setSaved(true);setOpen(false);setFile(undefined);setReviewed(false);form.current?.reset();
   setName('');setMinutes('');setGrams('');setAssessment('');setReference('');setNotes('');setSupportGrams('');setMaterial('PLA');setColor('blue');
  }catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
 }
 const models=state.artifacts.filter(item=>(item.name+' '+item.filament_type+' '+item.color).toLowerCase().includes(search.toLowerCase()));
 return <div className="model-library">
  <div className="page-intro"><div><p className="eyebrow">1 / MODELS</p><h2>Your model library</h2><p>Save print settings once. Choose a model whenever you need more copies.</p></div><button onClick={()=>{setOpen(!open);setSaved(false);}}>Upload a model</button></div>
  <label className="library-search">Search saved models<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, material or color"/></label>
  {saved&&<p role="status">Model saved. Find it below and choose Print to set quantity and deadline.</p>}
  {error&&<p role="alert">{error}</p>}
  {open&&<form ref={form} onSubmit={save} className="library-upload" onChange={()=>setReviewed(false)}><h3>Upload a print-ready model</h3><p>STL in millimeters, up to 10 MiB / 100,000 triangles. Use your slicer or preparer's estimates; geometry alone does not provide print time or material use.</p>
   <EntryField id="library-file" label="STL model file" help="Upload the actual part geometry. Example: bracket.stl. It is saved locally with your model."><input aria-required="true" type="file" accept=".stl" onChange={e=>setFile(e.target.files?.[0])}/></EntryField>
   <label>Prepared estimate profile (optional)<input type="file" accept=".json" onChange={e=>{const selected=e.target.files?.[0];if(selected)void importProfile(selected);}}/></label>
   <EntryField id="library-name" label="Saved model name" help="A recognizable product name. Example: Small mounting bracket."><input required value={name} onChange={e=>setName(e.target.value)}/></EntryField>
   <div className="fields"><EntryField id="library-minutes" label="Print time per item (minutes)" help="From your slicer or prepared profile. Example: 90 minutes per copy, including supports."><input required type="number" min="0.01" step="any" value={minutes} onChange={e=>setMinutes(e.target.value)}/></EntryField>
   <EntryField id="library-grams" label="Filament per item (grams)" help="Total per copy, including supports. Example: 12.5 g. This checks available filament when planning orders."><input required type="number" min="0.001" step="any" value={grams} onChange={e=>setGrams(e.target.value)}/></EntryField></div>
   <div className="fields"><EntryField id="library-material" label="Model filament type" help="Use the material your print profile was prepared for. Example: PLA."><input required list="library-materials" value={material} onChange={e=>setMaterial(e.target.value)}/></EntryField><datalist id="library-materials">{['PLA','PETG','ABS','ASA','TPU','Nylon','PC','PVA'].map(value=><option key={value} value={value}/>)}</datalist>
   <EntryField id="library-color" label="Model filament color" help="Choose the intended color. The planner checks matching stock. Example: blue."><input required list="library-colors" value={color} onChange={e=>setColor(e.target.value)}/></EntryField><datalist id="library-colors">{['blue','black','white','gray','red','green','yellow','orange','purple','natural'].map(value=><option key={value} value={value}/>)}</datalist></div>
   <label htmlFor="library-assessment">Support assessment</label><select id="library-assessment" required value={assessment} onChange={e=>setAssessment(e.target.value)}><option value="">Choose an assessment</option><option value="not-required">No supports required</option><option value="required">Supports required and prepared</option></select>
   {assessment==='required'&&<div className="fields"><label>Prepared support reference (optional)<input value={reference} onChange={e=>setReference(e.target.value)}/></label><label>Support grams included in total (optional)<input type="number" min="0" step="any" value={supportGrams} onChange={e=>setSupportGrams(e.target.value)}/></label><label>Removal notes (optional)<textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label></div>}
   <label className="check-label"><input type="checkbox" checked={reviewed} onChange={e=>{e.stopPropagation();setReviewed(e.target.checked);}}/>I have reviewed the model and its print settings</label>
   <button disabled={busy||!reviewed}>Save print-ready model</button>
  </form>}
  <div className="model-grid">{models.map(model=><article className="saved-model" key={model.id}>
   <ModelPreview name={model.name} asset={state.visual_assets?.find(asset=>asset.id===model.visual_asset_id)}/><h3>{model.name}</h3>
   <p>Est. print time: {Math.ceil(model.duration_seconds/60)} min per item</p><p>Est. filament: {model.filament_grams} g per item</p><p>{model.color} {model.filament_type}</p><button onClick={()=>onChoose(model.id)}>Print {model.name}</button>
  </article>)}</div>{models.length===0&&<p>No saved models match. Upload a model or change your search.</p>}
 </div>;
}

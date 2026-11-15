import {useRef,useState,type FormEvent} from 'react';
import type {Snapshot} from '../api';
import type {components} from '../types';
import {EntryField} from './EntryField';
import {ModelPreview} from './ModelPreview';
import {readProfile} from '../dashboard/profile';
import {FILAMENT_COLOR_CHOICES} from '../dashboard/workflow';
import {MAX_BYTES} from '../printers/assets';

type Upload=components['schemas']['LibraryUpload'];
type ModelTask=components['schemas']['ModelTaskCreate'];
const presets=[
 {title:'3DBenchy',url:'https://www.printables.com/model/3161-3d-benchy',license:'CC0 / public domain',material:'PLA',minutes:148,grams:29,printer:'Prusa MK3/S/S+',note:'Popular print-quality benchmark; sample values are profile-specific.'},
 {title:'Calibration Cube',url:'https://www.printables.com/model/110677-calibration-cube-wall-thickness-new-filament-extru',license:'CC BY-NC',material:'PLA / PETG',minutes:'12',grams:'1.22',printer:'Prusa i3 MK3S+',note:'20 × 20 × 10 mm; no supports.'},
 {title:'Honeycomb Phone Stand',url:'https://www.printables.com/model/525164-honeycomb-phone-stand',license:'CC BY',material:'PLA',minutes:'373',grams:'33',printer:'Prusa MK3/S/S+',note:'70 × 80 mm; 0.15 mm sample layer height.'},
 {title:'Curved Phone Stand',url:'https://www.printables.com/model/486805-phone-stand/files',license:'CC BY-NC-ND',material:'PLA',minutes:'614',grams:'75',printer:'Prusa MK3/S/S+',note:'STL/3MF and a sample G-code profile.'},
 {title:'Organic Phone Stand',url:'https://www.printables.com/model/489751-orgone-organic-phone-stand',license:'CC BY-NC',material:'PLA',minutes:'169',grams:'28',printer:'Prusa MK3/S/S+',note:'Source includes an organic-support slicer project.'},
 {title:'Foldable Phone Stand Keychain',url:'https://www.printables.com/model/531862-pip-phone-stand-keychain-adjustable-print-in-place/files',license:'CC BY-NC-ND',material:'PLA',minutes:'38',grams:'6',printer:'Prusa MK3/S/S+',note:'Print-in-place sample profile; 0.20 mm layers.'},
];
export function ModelLibrary({state,onChoose,onUpload,onSendToModeling}:{state:Snapshot;onChoose:(id:string)=>void;onUpload:(payload:Upload)=>Promise<void>;onSendToModeling?:(payload:ModelTask)=>Promise<void>}) {
 const [search,setSearch]=useState(''),[open,setOpen]=useState(false),[file,setFile]=useState<File>();
 const [name,setName]=useState(''),[minutes,setMinutes]=useState(''),[grams,setGrams]=useState('');
 const [material,setMaterial]=useState('PLA'),[color,setColor]=useState('blue'),[assessment,setAssessment]=useState('');
 const [notes,setNotes]=useState(''),[reference,setReference]=useState(''),[supportGrams,setSupportGrams]=useState('');
 const [reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[presetLoaded,setPresetLoaded]=useState(false),[retryPreset,setRetryPreset]=useState<ModelTask>();
 const form=useRef<HTMLFormElement>(null);
 async function importProfile(file:File) {
  try {
   if(file.size>1000000) throw new Error('Profile exceeds 1 MB');
   const profile=readProfile(await file.text());
   if(!FILAMENT_COLOR_CHOICES.includes(profile.color as typeof FILAMENT_COLOR_CHOICES[number])) throw new Error(`Choose one of these filament colors: ${FILAMENT_COLOR_CHOICES.join(', ')}.`);
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
 async function sendPresetToModeling(payload:ModelTask) {
  setBusy(true);setError('');setPresetLoaded(false);setRetryPreset(payload);
  try{await onSendToModeling!(payload);setPresetLoaded(true);setRetryPreset(undefined);}
  catch(reason){setError((reason as Error).message);}
  finally{setBusy(false);}
 }
 const models=state.artifacts.filter(item=>(item.name+' '+item.filament_type+' '+item.color).toLowerCase().includes(search.toLowerCase()));
 return <div className="model-library">
  <div className="page-intro"><div><p className="eyebrow">1 / MODELS</p><h2>Your model library</h2><p>Save print settings once. Choose a model whenever you need more copies.</p></div><button onClick={()=>{setOpen(!open);setSaved(false);}}>Upload a model</button></div>
  <label className="library-search">Search saved models<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, material or color"/></label>
  {saved&&<p role="status">Model saved. Find it below and choose Print to set quantity and deadline.</p>}{presetLoaded&&<p role="status">Preset added to the modeling workflow.</p>}
  {error&&<p role="alert">{error}</p>}{error&&retryPreset&&onSendToModeling&&<button type="button" disabled={busy} onClick={()=>void sendPresetToModeling(retryPreset)}>Retry preset model send</button>}
  <section className="preset-catalog" aria-label="Preset models"><div className="page-intro"><div><p className="eyebrow">CURATED PRESETS</p><h3>Browse printable models</h3><p>Values are sample profiles, not universal estimates. Color is not specified by the source; blue is the demo inventory default. Check each license before use.</p></div></div><div className="model-grid">{presets.map(model=><article className="saved-model preset-model" key={model.title}><div className="model-thumbnail"><span>Open model page for preview</span></div><p className="eyebrow">{model.license}</p><h3>{model.title}</h3><p>{model.note}</p><dl><div><dt>Sample profile</dt><dd>{model.printer} · {model.material} · {model.minutes} min · {model.grams} g</dd></div><div><dt>Color</dt><dd>Not specified; using blue for demo</dd></div></dl><button type="button" disabled={busy||!onSendToModeling} onClick={()=>void sendPresetToModeling({title:model.title,modelReference:model.url,duration_seconds:Number(model.minutes)*60,filament_grams:Number(model.grams),filament_type:model.material.split(' / ')[0],color:'blue',required_capabilities:['FFF'],visual_asset_id:null})}>Send to modeling dashboard</button><a className="button-link" href={model.url} target="_blank" rel="noreferrer">View model source and license</a></article>)}</div></section>
  {open&&<form ref={form} onSubmit={save} className="library-upload" onChange={()=>setReviewed(false)}><h3>Upload a print-ready model</h3><p>STL in millimeters, up to 10 MiB / 100,000 triangles. Use your slicer or preparer's estimates; geometry alone does not provide print time or material use.</p>
   <EntryField id="library-file" label="STL model file" help="Upload the actual part geometry. Example: bracket.stl. It is saved locally with your model."><input aria-required="true" type="file" accept=".stl" onChange={e=>setFile(e.target.files?.[0])}/></EntryField>
   <label>Prepared estimate profile (optional)<input type="file" accept=".json" onChange={e=>{const selected=e.target.files?.[0];if(selected)void importProfile(selected);}}/></label>
   <EntryField id="library-name" label="Saved model name" help="A recognizable product name. Example: Small mounting bracket."><input required value={name} onChange={e=>setName(e.target.value)}/></EntryField>
   <div className="fields"><EntryField id="library-minutes" label="Print time per item (minutes)" help="From your slicer or prepared profile. Example: 90 minutes per copy, including supports."><input required type="number" min="0.01" step="any" value={minutes} onChange={e=>setMinutes(e.target.value)}/></EntryField>
   <EntryField id="library-grams" label="Filament per item (grams)" help="Total per copy, including supports. Example: 12.5 g. This checks available filament when planning orders."><input required type="number" min="0.001" step="any" value={grams} onChange={e=>setGrams(e.target.value)}/></EntryField></div>
   <div className="fields"><EntryField id="library-material" label="Model filament type" help="Use the material your print profile was prepared for. Example: PLA."><input required list="library-materials" value={material} onChange={e=>setMaterial(e.target.value)}/></EntryField><datalist id="library-materials">{['PLA','PETG','ABS','ASA','TPU','Nylon','PC','PVA'].map(value=><option key={value} value={value}/>)}</datalist>
   <EntryField id="library-color" label="Model filament color" help="Choose a color that matches your printer's filament inventory."><select required className="theme-color-select" style={{borderLeftColor:color}} value={color} onChange={e=>setColor(e.target.value)}><option value="">Choose a color</option>{FILAMENT_COLOR_CHOICES.map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></EntryField></div>
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

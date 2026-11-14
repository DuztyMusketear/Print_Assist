import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import {ModelLibrary} from './ModelLibrary';
import {state} from '../test-fixtures';

test('browse saved estimates, search and choose a model without reentering its settings',async()=>{
 const choose=vi.fn(),user=userEvent.setup();render(<ModelLibrary state={{...state,visual_assets:[{id:'unrelated',name:'Other preview',path:'/models/other.stl',units:'mm',rotation_degrees:[0,0,0]}]}} onChoose={choose} onUpload={vi.fn()}/>);
 expect(screen.getByText(/120 min/)).toBeInTheDocument();expect(screen.getByText(/25 g/)).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Print Blue PLA figure'}));expect(choose).toHaveBeenCalledWith('figure-pla-blue');
 await user.type(screen.getByLabelText('Search saved models'),'missing');expect(screen.getByText(/No saved models match/)).toBeInTheDocument();
});

test('upload requires an explicit profile review and passes STL plus reusable estimates',async()=>{
 const save=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();render(<ModelLibrary state={state} onChoose={vi.fn()} onUpload={save}/>);
 await user.click(screen.getByRole('button',{name:'Upload a model'}));
 await user.upload(screen.getByLabelText('STL model file'),new File(['solid part\nendsolid part'],'bracket.stl'));
 await user.type(screen.getByLabelText('Saved model name'),'Bracket');
 await user.type(screen.getByLabelText('Print time per item (minutes)'),'90');
 await user.type(screen.getByLabelText('Filament per item (grams)'),'12.5');
 await user.selectOptions(screen.getByLabelText('Support assessment'),'not-required');
 expect(screen.getByRole('button',{name:'Save print-ready model'})).toBeDisabled();
 await user.click(screen.getByLabelText('I have reviewed the model and its print settings'));
 expect(Array.from(document.querySelectorAll('input,select')).filter(input=>!(input as HTMLInputElement).checkValidity()).map(input=>(input as HTMLInputElement).id)).toEqual([]);
 await user.click(screen.getByRole('button',{name:'Save print-ready model'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({name:'Bracket',filename:'bracket.stl',duration_seconds:5400,filament_grams:12.5,filament_type:'PLA',color:'blue',support_assessment:expect.objectContaining({supports_required:false})})));
 expect(screen.getByRole('status')).toHaveTextContent('Model saved');
 await user.click(screen.getByRole('button',{name:'Upload a model'}));expect(screen.getByLabelText('Saved model name')).toHaveValue('');
});

async function fill(user:ReturnType<typeof userEvent.setup>){
 await user.click(screen.getByRole('button',{name:'Upload a model'}));
 await user.type(screen.getByLabelText('Saved model name'),'Bracket');await user.type(screen.getByLabelText('Print time per item (minutes)'),'90');
 await user.type(screen.getByLabelText('Filament per item (grams)'),'12.5');await user.selectOptions(screen.getByLabelText('Support assessment'),'not-required');
}

test('missing files, oversize uploads and server rejection preserve an editable profile',async()=>{
 const save=vi.fn().mockRejectedValue(new Error('Model is too large for this bed')),user=userEvent.setup();render(<ModelLibrary state={state} onChoose={vi.fn()} onUpload={save}/>);
 await fill(user);await user.click(screen.getByLabelText('I have reviewed the model and its print settings'));await user.click(screen.getByRole('button',{name:'Save print-ready model'}));await screen.findByText('Choose an STL model file');
 const huge=new File(['mesh'],'large.stl');Object.defineProperty(huge,'size',{value:10*1024*1024+1});await user.upload(screen.getByLabelText('STL model file'),huge);
 await user.click(screen.getByLabelText('I have reviewed the model and its print settings'));await user.click(screen.getByRole('button',{name:'Save print-ready model'}));await screen.findByText('STL exceeds 10 MiB');
 await user.upload(screen.getByLabelText('STL model file'),new File(['mesh'],'part.stl'));await user.click(screen.getByLabelText('I have reviewed the model and its print settings'));await user.click(screen.getByRole('button',{name:'Save print-ready model'}));await screen.findByText('Model is too large for this bed');
 expect(screen.getByLabelText('Saved model name')).toHaveValue('Bracket');
 fireEvent.change(screen.getByLabelText('STL model file'),{target:{files:[]}});
});

test('profile import supplies estimates and prepared support details are reviewed explicitly',async()=>{
 const save=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();render(<ModelLibrary state={state} onChoose={vi.fn()} onUpload={save}/>);
 await user.click(screen.getByRole('button',{name:'Upload a model'}));
 const profile=new File(['profile'],'part.json');Object.defineProperty(profile,'text',{value:async()=>JSON.stringify({title:'Prepared part',modelReference:'part.stl',duration_seconds:600,filament_grams:15,filament_type:'PETG',color:'red'})});
 await user.upload(screen.getByLabelText('Prepared estimate profile (optional)'),profile);await waitFor(()=>expect(screen.getByLabelText('Saved model name')).toHaveValue('Prepared part'));
 await user.clear(screen.getByLabelText('Model filament type'));await user.type(screen.getByLabelText('Model filament type'),'PLA');await user.clear(screen.getByLabelText('Model filament color'));await user.type(screen.getByLabelText('Model filament color'),'blue');
 await user.upload(screen.getByLabelText('STL model file'),new File(['mesh'],'part.stl'));await user.selectOptions(screen.getByLabelText('Support assessment'),'required');
 await user.type(screen.getByLabelText('Prepared support reference (optional)'),'part.3mf');await user.type(screen.getByLabelText('Support grams included in total (optional)'),'2');await user.type(screen.getByLabelText('Removal notes (optional)'),'Remove base supports');
 await user.click(screen.getByLabelText('I have reviewed the model and its print settings'));await user.click(screen.getByRole('button',{name:'Save print-ready model'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({support_assessment:{supports_required:true,support_reference:'part.3mf',support_material_grams:2,removal_notes:'Remove base supports'}})));
});

test('bad estimate files and file-reading failure show useful feedback',async()=>{
 const user=userEvent.setup();render(<ModelLibrary state={state} onChoose={vi.fn()} onUpload={vi.fn()}/>);await fill(user);
 const large=new File(['bad'],'large.json');Object.defineProperty(large,'size',{value:1000001});await user.upload(screen.getByLabelText('Prepared estimate profile (optional)'),large);await screen.findByText('Profile exceeds 1 MB');
 const bad=new File(['bad'],'bad.json');Object.defineProperty(bad,'text',{value:async()=>'{'});await user.upload(screen.getByLabelText('Prepared estimate profile (optional)'),bad);await screen.findByRole('alert');
 fireEvent.change(screen.getByLabelText('Prepared estimate profile (optional)'),{target:{files:[]}});
 vi.spyOn(FileReader.prototype,'readAsDataURL').mockImplementation(function(this:FileReader){this.dispatchEvent(new ProgressEvent('error'));});
 await user.upload(screen.getByLabelText('STL model file'),new File(['mesh'],'part.stl'));await user.click(screen.getByLabelText('I have reviewed the model and its print settings'));await user.click(screen.getByRole('button',{name:'Save print-ready model'}));await screen.findByText('Unable to read model file');
});

test('closing the upload form during a save does not misreport a successful upload',async()=>{
 let finish!:()=>void;const save=vi.fn().mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;})),user=userEvent.setup();render(<ModelLibrary state={state} onChoose={vi.fn()} onUpload={save}/>);await fill(user);
 await user.upload(screen.getByLabelText('STL model file'),new File(['mesh'],'part.stl'));await user.click(screen.getByLabelText('I have reviewed the model and its print settings'));await user.click(screen.getByRole('button',{name:'Save print-ready model'}));await waitFor(()=>expect(save).toHaveBeenCalled());
 await user.click(screen.getByRole('button',{name:'Upload a model'}));finish();await screen.findByText(/Model saved/);expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('required supports without optional metadata do not invent removal or weight values',async()=>{
 const save=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();render(<ModelLibrary state={state} onChoose={vi.fn()} onUpload={save}/>);await fill(user);
 await user.selectOptions(screen.getByLabelText('Support assessment'),'required');await user.upload(screen.getByLabelText('STL model file'),new File(['mesh'],'part.stl'));await user.click(screen.getByLabelText('I have reviewed the model and its print settings'));await user.click(screen.getByRole('button',{name:'Save print-ready model'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({support_assessment:{supports_required:true,support_reference:null,support_material_grams:null,removal_notes:null}})));
});

import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test,vi} from 'vitest';
import {ModelingBoard} from './ModelingBoard';
import {NistModelPreview,parseBinaryStl} from './NistModelPreview';

function binaryStl(triangles:number[][]=[[0,0,0,1,0,0,0,1,0],[0,0,0,0,0,0,0,0,0]]) {
  const buffer=new ArrayBuffer(84+triangles.length*50);
  const view=new DataView(buffer);
  view.setUint32(80,triangles.length,true);
  triangles.forEach((points,index)=>{
    const values=[0,0,1,...points];
    values.forEach((value,offset)=>view.setFloat32(84+index*50+offset*4,value,true));
  });
  return buffer;
}

test('selected catalog visual is passed to persisted modeling tasks',async()=>{
  const onCreate=vi.fn().mockResolvedValue(undefined);
  render(<ModelingBoard onCreate={onCreate} visualAssets={[{id:'example-tower',name:'Example tower',path:'/models/example-tower.stl',units:'mm',rotation_degrees:[0,0,0]}]}/>);
  await userEvent.setup().click(screen.getByText('Model preparation (team only)'));
  fireEvent.change(screen.getByLabelText('Model name'),{target:{value:'Part'}});
  fireEvent.change(screen.getByLabelText('Model file reference'),{target:{value:'part.stl'}});
  const user=userEvent.setup();
  await user.selectOptions(screen.getByLabelText('3D preview model'),'example-tower');
  fireEvent.submit(screen.getByRole('button',{name:'Add to modeling'}).closest('form')!);
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({visual_asset_id:'example-tower'}));
});
test('omits an unset visual asset instead of sending a null field',async()=>{
 const onCreate=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();
 render(<ModelingBoard items={[]} onCreate={onCreate}/>);
 await user.type(screen.getByLabelText('Model name'),'Part');
 await user.type(screen.getByLabelText('Model file reference'),'part.stl');
 await user.click(screen.getByText('Model preparation (team only)'));
 await user.type(screen.getByLabelText('Estimated print minutes'),'10');
 await user.type(screen.getByLabelText('Estimated filament grams'),'2');
 await user.type(screen.getByLabelText('Filament type'),'PLA');
  await user.selectOptions(screen.getByLabelText('Filament color'),'blue');
 await user.click(screen.getByRole('button',{name:'Add to modeling'}));
 expect(onCreate).toHaveBeenCalledOnce();
 expect(onCreate.mock.calls[0][0]).not.toHaveProperty('visual_asset_id');
});

test('explains model inputs with examples and offers common filament choices',async()=>{
  render(<ModelingBoard items={[]} onCreate={vi.fn()}/>);
  await userEvent.setup().click(screen.getByText('Model preparation (team only)'));
  expect(screen.getByLabelText('Model name')).toHaveAccessibleDescription(/Dragon figurine/);
  expect(screen.getByLabelText('Model file reference')).toHaveAccessibleDescription(/does not upload/);
  expect(screen.getByLabelText('Estimated print minutes')).toHaveAccessibleDescription(/one item/);
  expect(screen.getByRole('combobox',{name:'Filament type'})).toHaveAttribute('list','filament-types');
  expect(document.querySelector('#filament-types option[value="PETG"]')).not.toBeNull();
  expect(Array.from(screen.getByLabelText('Filament color').querySelectorAll('option')).map(option=>option.value).filter(Boolean)).toEqual(['blue','black','white','gray','red']);
  expect(screen.getByLabelText('Filament color')).toHaveClass('theme-color-select');
  const user=userEvent.setup();
  await user.type(screen.getByRole('combobox',{name:'Filament type'}),'Custom blend');
  expect(screen.getByRole('combobox',{name:'Filament type'})).toHaveValue('Custom blend');
});

test('copies a preset draft into the model name and source reference fields',async()=>{
  render(<ModelingBoard onCreate={vi.fn()} initialDraft={{title:'Honeycomb Phone Stand',modelReference:'https://www.printables.com/model/525164-honeycomb-phone-stand',duration_seconds:22380,filament_grams:33,filament_type:'PLA',color:'blue',required_capabilities:['FFF'],visual_asset_id:null}}/>);
  expect(await screen.findByLabelText('Model name')).toHaveValue('Honeycomb Phone Stand');
  expect(screen.getByLabelText('Model file reference')).toHaveValue('https://www.printables.com/model/525164-honeycomb-phone-stand');
  expect(screen.getByLabelText('Estimated print minutes')).toHaveValue(373);
  expect(screen.getByLabelText('Estimated filament grams')).toHaveValue(33);
});
test('shows print profile details on workflow cards without exposing the source reference',async()=>{
 const user=userEvent.setup();
 render(<ModelingBoard initialDraft={{title:'Honeycomb Phone Stand',modelReference:'https://example.test/private-source',duration_seconds:22380,filament_grams:33,filament_type:'PLA',color:'blue',required_capabilities:['FFF'],visual_asset_id:null}}/>);
 await user.click(screen.getByRole('button',{name:'Add to modeling'}));
 const card=screen.getByRole('region',{name:'Modeling stage'});
 expect(card).toHaveTextContent('Honeycomb Phone Stand');
 expect(card).toHaveTextContent('373 min');
 expect(card).toHaveTextContent('33 g PLA');
 expect(screen.getByRole('combobox',{name:'Color for Honeycomb Phone Stand'})).toHaveValue('blue');
 expect(card).not.toHaveTextContent('private-source');
});

test('modeling task color selector dispatches a color update',async()=>{
 const task={id:'color-task',title:'Color sample',modelReference:'color.stl',stage:'modeling' as const,duration_seconds:600,filament_grams:2,filament_type:'PLA',color:'blue',required_capabilities:['FFF']};
 const onMove=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();
 render(<ModelingBoard items={[task]} onMove={onMove}/>);
 await user.selectOptions(screen.getByRole('combobox',{name:'Color for Color sample'}),'red');
 await waitFor(()=>expect(onMove).toHaveBeenCalledWith('color-task','set-color',undefined,'red'));
});

test('shows the STL shape and the NIST features when the demo is added',async()=>{
  const fill=vi.fn();
  const context={clearRect:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),closePath:vi.fn(),fill} as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,arrayBuffer:async()=>binaryStl()} as Response);
  const user=userEvent.setup();
  render(<ModelingBoard initialDraft={{title:'NIST AM Test Artifact',modelReference:'/demo-models/nist-test-artifact.stl',duration_seconds:7200,filament_grams:35,filament_type:'PLA',color:'blue',required_capabilities:['FFF'],visual_asset_id:'nist-test-artifact'}}/>);
  await screen.findByDisplayValue('NIST AM Test Artifact');
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  const preview=await screen.findByRole('img',{name:'NIST artifact 3D model preview'});
  expect(preview).toHaveAttribute('data-loaded','true');
  expect(context.fill).toHaveBeenCalled();
  expect(screen.getByText(/center hole and concentric cylinders/i)).toBeInTheDocument();
  expect(screen.getByText(/4 mm pins and holes/i)).toBeInTheDocument();
  expect(screen.getByText(/stepped walls/i)).toBeInTheDocument();
  expect(screen.getByText(/ramp and lateral features/i)).toBeInTheDocument();
  const image=screen.getByRole('button',{name:'Enlarge NIST artifact preview'});
  expect(screen.queryByText(/drag the model to rotate/i)).not.toBeInTheDocument();
  expect(image).not.toHaveAttribute('aria-description',expect.stringMatching(/drag the model to rotate/i));
  const thumbnailYaw=image.getAttribute('data-yaw');
  fireEvent.mouseDown(image,{button:2,clientX:100,clientY:100});
  fireEvent.mouseMove(window,{button:2,clientX:150,clientY:130});
  fireEvent.mouseUp(window,{button:2,clientX:150,clientY:130});
  fireEvent.mouseDown(image,{button:0,clientX:100,clientY:100});
  fireEvent.mouseMove(window,{button:0,clientX:101,clientY:100});
  fireEvent.mouseMove(window,{button:0,clientX:150,clientY:130});
  fireEvent.mouseUp(window,{button:0,clientX:150,clientY:130});
  expect(image).toHaveAttribute('data-yaw',thumbnailYaw);
  fireEvent.touchStart(image,{touches:[{clientX:0,clientY:0},{clientX:100,clientY:0}]});
  fireEvent.touchMove(image,{touches:[{clientX:0,clientY:0},{clientX:150,clientY:0}]});
  expect(image).toHaveAttribute('data-zoom','1.00');
  fireEvent.click(image);
  const dialog=screen.getByRole('dialog',{name:'Enlarged NIST model preview'});
  const enlargedImage=screen.getByRole('button',{name:'Enlarge NIST artifact preview'});
  const enlargedYaw=enlargedImage.getAttribute('data-yaw');
  const drawsBeforeDrag=fill.mock.calls.length;
  fireEvent.mouseDown(enlargedImage,{button:0,clientX:100,clientY:100});
  fireEvent.mouseMove(window,{button:0,clientX:101,clientY:100});
  fireEvent.mouseMove(window,{button:0,clientX:150,clientY:130});
  fireEvent.mouseMove(window,{button:0,clientX:160,clientY:140});
  fireEvent.mouseUp(window,{button:0,clientX:150,clientY:130});
  expect(enlargedImage).not.toHaveAttribute('data-yaw',enlargedYaw);
  expect(enlargedImage).toHaveAttribute('data-zoom','1.00');
  expect(fill.mock.calls.length).toBeGreaterThan(drawsBeforeDrag);
  expect(dialog).toBeInTheDocument();
  fireEvent.click(enlargedImage);
  expect(dialog).toBeInTheDocument();
  const dragYaw=enlargedImage.getAttribute('data-yaw');
  fireEvent.touchStart(enlargedImage,{touches:[{clientX:0,clientY:0}]});
  fireEvent.touchMove(enlargedImage,{touches:[{clientX:0,clientY:0},{clientX:100,clientY:0}]});
  fireEvent.touchEnd(enlargedImage,{touches:[{clientX:0,clientY:0},{clientX:100,clientY:0}]});
  fireEvent.touchStart(enlargedImage,{touches:[{clientX:0,clientY:0},{clientX:100,clientY:0}]});
  fireEvent.touchMove(enlargedImage,{touches:[{clientX:-200,clientY:0},{clientX:300,clientY:0}]});
  expect(enlargedImage).toHaveAttribute('data-zoom','3.00');
  fireEvent.touchMove(enlargedImage,{touches:[{clientX:49,clientY:0},{clientX:50,clientY:0}]});
  expect(enlargedImage).toHaveAttribute('data-zoom','0.50');
  fireEvent.touchEnd(enlargedImage,{touches:[{clientX:0,clientY:0},{clientX:100,clientY:0}]});
  fireEvent.touchEnd(enlargedImage,{touches:[]});
  expect(enlargedImage).toHaveAttribute('data-zoom','0.50');
  expect(enlargedImage).toHaveAttribute('data-yaw',dragYaw);
  await user.click(screen.getByRole('button',{name:'Rotate model left'}));
  await user.click(screen.getByRole('button',{name:'Rotate model right'}));
  await user.click(screen.getByRole('button',{name:'Reset view'}));
  expect(fill.mock.calls.length).toBeGreaterThan(2);
  await user.click(screen.getByRole('button',{name:'Enlarge NIST artifact preview'}));
  const reopenedDialog=screen.getByRole('dialog',{name:'Enlarged NIST model preview'});
  await user.click(screen.getByRole('button',{name:'Rotate model left'}));
  expect(reopenedDialog).toBeInTheDocument();
  await user.keyboard('x');
  expect(dialog).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog',{name:'Enlarged NIST model preview'})).not.toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Enlarge NIST artifact preview'}));
  await user.click(screen.getByRole('button',{name:'Close enlarged preview'}));
  expect(screen.queryByRole('dialog',{name:'Enlarged NIST model preview'})).not.toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Enlarge NIST artifact preview'}));
  fireEvent.click(screen.getByRole('dialog',{name:'Enlarged NIST model preview'}));
  expect(screen.queryByRole('dialog',{name:'Enlarged NIST model preview'})).not.toBeInTheDocument();
});

test('validates incomplete and non-finite STL data',()=>{
  expect(()=>parseBinaryStl(new ArrayBuffer(20))).toThrow('incomplete');
  expect(()=>parseBinaryStl(new ArrayBuffer(84))).toThrow('complete triangle mesh');
  const truncated=new ArrayBuffer(134);new DataView(truncated).setUint32(80,2,true);
  expect(()=>parseBinaryStl(truncated)).toThrow('complete triangle mesh');
  const invalid=binaryStl([[Number.NaN,0,0,1,0,0,0,1,0]]);
  expect(()=>parseBinaryStl(invalid)).toThrow('invalid coordinates');
});

test('shows a download link when the bundled STL cannot be loaded',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:false,arrayBuffer:vi.fn()} as unknown as Response);
  render(<NistModelPreview/>);
  expect(screen.getByRole('status')).toHaveTextContent('Loading STL mesh');
  expect(await screen.findByRole('alert')).toHaveTextContent('bundled NIST STL could not be loaded');
  expect(screen.getByRole('link',{name:'Download the STL'})).toHaveAttribute('href','/demo-models/nist-test-artifact.stl');
});

test('keeps a loaded mesh available when canvas drawing is not supported',async()=>{
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,arrayBuffer:async()=>binaryStl()} as Response);
  render(<NistModelPreview/>);
  expect(await screen.findByRole('img',{name:'NIST artifact 3D model preview'})).toHaveAttribute('data-loaded','true');
});

test('ignores a successful mesh response after the preview unmounts',async()=>{
  let resolveResponse!:(response:Response)=>void;
  vi.spyOn(globalThis,'fetch').mockReturnValue(new Promise(resolve=>{resolveResponse=resolve;}));
  const {unmount}=render(<NistModelPreview/>);
  unmount();
  resolveResponse({ok:true,arrayBuffer:async()=>binaryStl()} as Response);
  await new Promise(resolve=>setTimeout(resolve,0));
});

test('ignores a failed mesh response after the preview unmounts',async()=>{
  let resolveResponse!:(response:Response)=>void;
  vi.spyOn(globalThis,'fetch').mockReturnValue(new Promise(resolve=>{resolveResponse=resolve;}));
  const {unmount}=render(<NistModelPreview/>);
  unmount();
  resolveResponse({ok:false,arrayBuffer:vi.fn()} as unknown as Response);
  await new Promise(resolve=>setTimeout(resolve,0));
});

test('moves a model task through supports and review to approval',async()=>{
  const user=userEvent.setup();render(<ModelingBoard/>);
  await user.type(screen.getByLabelText('Model name'),'Dragon figurine');
  await user.type(screen.getByLabelText('Model file reference'),'dragon-v2.stl');
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  await user.type(screen.getByLabelText('Model name'),'Desk planter');
  await user.type(screen.getByLabelText('Model file reference'),'planter.stl');
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  expect(screen.getByRole('region',{name:'Modeling stage'})).toHaveTextContent('Desk planter');
  expect(screen.getByRole('region',{name:'Modeling stage'})).toHaveTextContent('Dragon figurine');
  await user.click(screen.getAllByRole('button',{name:'Prepare supports'})[0]);
  expect(screen.getByRole('region',{name:'Supports stage'})).not.toHaveTextContent('dragon-v2.stl');
  expect(screen.getByRole('combobox',{name:'Support requirement'})).toHaveValue('');
  expect(screen.getByRole('button',{name:'Send model and support assessment to review'})).toBeDisabled();
  fireEvent.submit(screen.getByRole('form',{name:'Support task for Dragon figurine'}));
  expect(screen.getByRole('region',{name:'Supports stage'})).not.toHaveTextContent('dragon-v2.stl');
  await user.selectOptions(screen.getByRole('combobox',{name:'Support requirement'}),'required');
  await user.type(screen.getByLabelText('Support file or slicer project (optional)'),'dragon-supports.3mf');
  await user.type(screen.getByLabelText('Estimated support material grams (optional)'),'5');
  await user.type(screen.getByLabelText('Support removal notes (optional)'),'Remove supports below the wings.');
  expect(screen.getByRole('form',{name:'Support task for Dragon figurine'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Send model and support assessment to review'}));
  const review=screen.getByRole('region',{name:'Review stage'});
  expect(review).toHaveTextContent('Dragon figurine');
  expect(review).not.toHaveTextContent('dragon-v2.stl');
  expect(review).toHaveTextContent('Supports required');
  expect(review).toHaveTextContent('dragon-supports.3mf');
  expect(review).toHaveTextContent('5 g');
  expect(review).toHaveTextContent('Remove supports below the wings.');
  await user.click(screen.getByRole('button',{name:'Approve model and supports'}));
  expect(screen.getByText('Ready for production queue')).toBeInTheDocument();
  expect(screen.getByRole('region',{name:'Approved stage'})).toHaveTextContent('Model and support data stored together');
});

test('sends an explicit no-support assessment directly to review before approval',async()=>{
  const user=userEvent.setup();render(<ModelingBoard/>);
  await user.type(screen.getByLabelText('Model name'),'Flat bracket');
  await user.type(screen.getByLabelText('Model file reference'),'bracket.stl');
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await user.selectOptions(screen.getByRole('combobox',{name:'Support requirement'}),'not-required');
  await user.click(screen.getByRole('button',{name:'Send model and support assessment to review'}));
  expect(screen.getByRole('region',{name:'Review stage'})).toHaveTextContent('No supports required');
  expect(screen.getByRole('region',{name:'Review stage'})).not.toHaveTextContent('bracket.stl');
  await user.click(screen.getByRole('button',{name:'Approve model and supports'}));
  expect(screen.getByRole('region',{name:'Approved stage'})).toHaveTextContent(/no supports required/i);
});

test.each(['modeling','supports','review'] as const)('confirms before removing a task in %s',async(stage)=>{
  const user=userEvent.setup();render(<ModelingBoard/>);
  await user.type(screen.getByLabelText('Model name'),'Desk planter');
  await user.type(screen.getByLabelText('Model file reference'),'planter.stl');
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  if(stage==='supports'||stage==='review') await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  if(stage==='review') {
    await user.selectOptions(screen.getByRole('combobox',{name:'Support requirement'}),'not-required');
    await user.click(screen.getByRole('button',{name:'Send model and support assessment to review'}));
  }
  await user.click(screen.getByRole('button',{name:'Remove Desk planter'}));
  expect(screen.getByRole('dialog',{name:'Confirm task removal'})).toHaveTextContent('Remove Desk planter from the modeling workflow?');
  await user.click(screen.getByRole('button',{name:'Cancel removal'}));
  expect(screen.getByRole('heading',{name:'Desk planter'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Remove Desk planter'}));
  await user.click(screen.getByRole('button',{name:'Confirm removal'}));
  expect(screen.queryByRole('heading',{name:'Desk planter'})).not.toBeInTheDocument();
  expect(screen.getByRole('region',{name:`${stage==='modeling'?'Modeling':stage==='supports'?'Supports':'Review'} stage`})).toHaveTextContent('Nothing here yet');
});

test('sends persisted item removal through the supplied action callback',async()=>{
  const task={id:'task-1',title:'Planter',modelReference:'planter.stl',stage:'modeling' as const};
  const onRemove=vi.fn().mockResolvedValue(undefined);
  const user=userEvent.setup();render(<ModelingBoard items={[task]} onRemove={onRemove}/>);
  await user.click(screen.getByRole('button',{name:'Remove Planter'}));
  await user.click(screen.getByRole('button',{name:'Confirm removal'}));
  expect(onRemove).toHaveBeenCalledWith('task-1');
});

test('keeps a task visible and reports an error if removal fails',async()=>{
  const task={id:'task-1',title:'Planter',modelReference:'planter.stl',stage:'modeling' as const};
  const onRemove=vi.fn().mockRejectedValue(new Error('Removal rejected'));
  const user=userEvent.setup();render(<ModelingBoard items={[task]} onRemove={onRemove}/>);
  await user.click(screen.getByRole('button',{name:'Remove Planter'}));
  await user.click(screen.getByRole('button',{name:'Confirm removal'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Removal rejected');
  expect(screen.getByRole('heading',{name:'Planter'})).toBeInTheDocument();
});

test('checks whether an approved model is used by an order before asking to remove it',async()=>{
  const task={id:'task-1',title:'Planter',modelReference:'planter.stl',stage:'approved' as const};
  const onRemove=vi.fn().mockResolvedValue(undefined);
  const user=userEvent.setup();render(<ModelingBoard items={[task]} onRemove={onRemove} isArtifactInUse={()=>true}/>);
  await user.click(screen.getByRole('button',{name:'Remove Planter'}));
  expect(screen.getByRole('alert')).toHaveTextContent('approved artifact is already used by an order');
  expect(screen.queryByRole('dialog',{name:'Confirm task removal'})).not.toBeInTheDocument();
  expect(onRemove).not.toHaveBeenCalled();
  expect(screen.getByRole('heading',{name:'Planter'})).toBeInTheDocument();
});

test('asks for confirmation before removing an approved model whose artifact is unused',async()=>{
  const task={id:'task-1',title:'Planter',modelReference:'planter.stl',stage:'approved' as const};
  const onRemove=vi.fn().mockResolvedValue(undefined);
  const user=userEvent.setup();render(<ModelingBoard items={[task]} onRemove={onRemove} isArtifactInUse={()=>false}/>);
  await user.click(screen.getByRole('button',{name:'Remove Planter'}));
  expect(screen.getByRole('dialog',{name:'Confirm task removal'})).toHaveTextContent('unused orderable artifact will also be removed');
  expect(onRemove).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'Confirm removal'}));
  expect(onRemove).toHaveBeenCalledWith('task-1');
});

test('returns a revision request to modeling and labels its review outcome',async()=>{
  const user=userEvent.setup();render(<ModelingBoard/>);
  await user.type(screen.getByLabelText('Model name'),'Planter');
  await user.type(screen.getByLabelText('Model file reference'),'planter.stl');
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await user.selectOptions(screen.getByRole('combobox',{name:'Support requirement'}),'required');
  await user.click(screen.getByRole('button',{name:'Send model and support assessment to review'}));
  await user.click(screen.getByRole('button',{name:'Request changes'}));
  expect(screen.getByRole('region',{name:'Modeling stage'})).toHaveTextContent('Review requested changes');
});

test('explains when required task details are missing',()=>{
  render(<ModelingBoard/>);
  fireEvent.submit(screen.getByRole('button',{name:'Add to modeling'}).closest('form')!);
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a model name and file reference');
});


test('prepared profile import supplies estimates and removes compatibility jargon',async()=>{
 const onCreate=vi.fn().mockResolvedValue(undefined);const user=userEvent.setup();
 render(<ModelingBoard onCreate={onCreate}/>);
 expect(screen.queryByRole('heading',{name:'Add a prepared model'})).not.toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'Add a model task'})).toBeInTheDocument();
 const profile={title:'Tray',modelReference:'tray.stl',duration_seconds:600,filament_grams:25.125,filament_type:'PLA',color:'blue'};
 const file=new File([JSON.stringify(profile)],'tray.json',{type:'application/json'});
 Object.defineProperty(file,'text',{value:async()=>JSON.stringify(profile)});
 await user.upload(screen.getByLabelText('Prepared model profile'),file);
 await screen.findByText(/Profile ready: Tray/);
 expect(screen.queryByLabelText(/Required printer capabilities/)).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Add to modeling'}));
 expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({...profile,required_capabilities:['FFF']}));
});


test('invalid or oversized profile imports report preparation guidance',async()=>{
 const user=userEvent.setup();render(<ModelingBoard onCreate={vi.fn()}/>);
 const invalid=new File(['{}'],'bad.json',{type:'application/json'});Object.defineProperty(invalid,'text',{value:async()=>'{}'});
 await user.upload(screen.getByLabelText('Prepared model profile'),invalid);
 expect(await screen.findByRole('alert')).toHaveTextContent('Ask the model preparer');
 const oversized=new File(['large'],'large.json',{type:'application/json'});Object.defineProperty(oversized,'size',{value:1000001});
 await user.upload(screen.getByLabelText('Prepared model profile'),oversized);
 expect(await screen.findByRole('alert')).toHaveTextContent('too large');
 await user.upload(screen.getByLabelText('Prepared model profile'),[]);
});

test('rejects an unavailable imported filament color while preserving the prepared task',async()=>{
 const onCreate=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();
 const draft={title:'Prepared tray',modelReference:'tray.stl',duration_seconds:600,filament_grams:12,filament_type:'PLA',color:'blue',required_capabilities:['FFF'],visual_asset_id:null};
 render(<ModelingBoard onCreate={onCreate} initialDraft={draft}/>);
 const file=new File(['profile'],'unavailable-color.json',{type:'application/json'});
 Object.defineProperty(file,'text',{value:async()=>JSON.stringify({...draft,title:'Unavailable tray',color:'green'})});
 await user.upload(screen.getByLabelText('Prepared model profile'),file);
 expect(await screen.findByRole('alert')).toHaveTextContent('Choose one of these filament colors: blue, black, white, gray, red.');
 expect(screen.getByLabelText('Model name')).toHaveValue('Prepared tray');
 expect(screen.getByLabelText('Filament color')).toHaveValue('blue');
 await user.click(screen.getByRole('button',{name:'Add to modeling'}));
 expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({title:'Prepared tray',color:'blue',duration_seconds:600}));
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});


test('legacy approved models do not invent a no-support assessment',()=>{
 render(<ModelingBoard items={[{id:'legacy',title:'Legacy part',modelReference:'old.stl',stage:'approved'}]}/>);
 expect(screen.getByText(/support assessment not recorded/i)).toBeInTheDocument();
});


test('preset modeling cards show local source previews when no registered mesh matches',()=>{
 render(<ModelingBoard items={[{id:'preset',title:'3DBenchy',modelReference:'benchy.stl',stage:'modeling',visual_asset_id:'missing'}]} visualAssets={[{id:'other',name:'Other',path:'/models/example-tower.stl',units:'mm',rotation_degrees:[0,0,0]}]}/>);
 expect(screen.getByRole('img',{name:'3DBenchy model preview'})).toHaveAttribute('src','/demo-models/benchy.png');
});

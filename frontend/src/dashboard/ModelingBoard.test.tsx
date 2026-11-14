import {fireEvent,render,screen} from '@testing-library/react';
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
  fireEvent.change(screen.getByLabelText('Model name'),{target:{value:'Part'}});
  fireEvent.change(screen.getByLabelText('Model file reference'),{target:{value:'part.stl'}});
  const user=userEvent.setup();
  await user.selectOptions(screen.getByLabelText('3D preview model'),'example-tower');
  fireEvent.submit(screen.getByRole('button',{name:'Add to modeling'}).closest('form')!);
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({visual_asset_id:'example-tower'}));
});

test('explains model inputs with examples and offers common filament choices',async()=>{
  render(<ModelingBoard items={[]} onCreate={vi.fn()}/>);
  expect(screen.getByLabelText('Model name')).toHaveAccessibleDescription(/Dragon figurine/);
  expect(screen.getByLabelText('Model file reference')).toHaveAccessibleDescription(/does not upload/);
  expect(screen.getByLabelText('Estimated print minutes')).toHaveAccessibleDescription(/one item/);
  expect(screen.getByRole('combobox',{name:'Filament type'})).toHaveAttribute('list','filament-types');
  expect(document.querySelector('#filament-types option[value="PETG"]')).not.toBeNull();
  expect(document.querySelector('#filament-colors option[value="blue"]')).not.toBeNull();
  const user=userEvent.setup();
  await user.type(screen.getByRole('combobox',{name:'Filament type'}),'Custom blend');
  expect(screen.getByRole('combobox',{name:'Filament type'})).toHaveValue('Custom blend');
});

test('loads the bundled NIST model and creates a clearly labeled demo task',async()=>{
  const user=userEvent.setup();
  const onCreate=vi.fn().mockResolvedValue(undefined);
  render(<ModelingBoard items={[]} onCreate={onCreate}/>);
  expect(screen.getByRole('link',{name:'Download NIST STL'})).toHaveAttribute('href','/demo-models/nist-test-artifact.stl');
  await user.click(screen.getByRole('button',{name:'Use NIST demo model'}));
  expect(screen.getByLabelText('Model file reference')).toHaveValue('/demo-models/nist-test-artifact.stl');
  expect(screen.getByText(/presentation estimates, not NIST settings or slicer results/)).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
    title:'NIST AM Test Artifact',modelReference:'/demo-models/nist-test-artifact.stl',
    duration_seconds:7200,filament_grams:35,filament_type:'PLA',color:'gray',required_capabilities:['FFF'],
  }));
});

test('offers the support-requiring Snack Sticks model page as a modeling demo',async()=>{
  const user=userEvent.setup();
  render(<ModelingBoard items={[]}/>);
  const source='https://pinshape.com/items/106174-3d-printed-snack-sticks';
  expect(screen.getByRole('link',{name:'Open Snack Sticks model page'})).toHaveAttribute('href',source);
  await user.click(screen.getByRole('button',{name:'Use Snack Sticks demo'}));
  expect(screen.getByLabelText('Model name')).toHaveValue('Snack Sticks');
  expect(screen.getByLabelText('Model file reference')).toHaveValue(source);
});

test('shows the STL shape and the NIST features when the demo is added',async()=>{
  const fill=vi.fn();
  const context={clearRect:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),closePath:vi.fn(),fill} as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,arrayBuffer:async()=>binaryStl()} as Response);
  const user=userEvent.setup();
  render(<ModelingBoard/>);
  await user.click(screen.getByRole('button',{name:'Use NIST demo model'}));
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
  expect(screen.getByRole('region',{name:'Supports stage'})).toHaveTextContent('dragon-v2.stl');
  expect(screen.getByRole('combobox',{name:'Support requirement'})).toHaveValue('');
  expect(screen.getByRole('button',{name:'Send model and support assessment to review'})).toBeDisabled();
  fireEvent.submit(screen.getByRole('form',{name:'Support task for Dragon figurine'}));
  expect(screen.getByRole('region',{name:'Supports stage'})).toHaveTextContent('dragon-v2.stl');
  await user.selectOptions(screen.getByRole('combobox',{name:'Support requirement'}),'required');
  await user.type(screen.getByLabelText('Support file or slicer project (optional)'),'dragon-supports.3mf');
  await user.type(screen.getByLabelText('Estimated support material grams (optional)'),'5');
  await user.type(screen.getByLabelText('Support removal notes (optional)'),'Remove supports below the wings.');
  expect(screen.getByRole('form',{name:'Support task for Dragon figurine'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Send model and support assessment to review'}));
  const review=screen.getByRole('region',{name:'Review stage'});
  expect(review).toHaveTextContent('Model: dragon-v2.stl');
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
  expect(screen.getByRole('region',{name:'Review stage'})).toHaveTextContent('bracket.stl');
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

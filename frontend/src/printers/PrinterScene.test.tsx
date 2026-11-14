import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test,vi} from 'vitest';
import {BoxGeometry} from 'three';
import {PrinterScene} from './PrinterScene';
import {loadPart} from './assets';
import {mountScene} from './scene';

vi.mock('./assets',()=>({loadPart:vi.fn()}));
vi.mock('./scene',()=>({mountScene:vi.fn()}));
const asset={id:'example-tower',name:'Example',path:'/models/example-tower.stl',units:'mm' as const,rotation_degrees:[0,0,0] as [number,number,number]};
const props={asset:undefined,progress:0,color:'blue',hasJob:false,label:'Printer 1'};
test('empty view mounts camera controls and disposes on unmount',async()=>{
  const handle={command:vi.fn(),update:vi.fn(),dispose:vi.fn()};vi.mocked(mountScene).mockReturnValue(handle);
  const user=userEvent.setup();const view=render(<PrinterScene {...props}/>);
  for(const name of ['Rotate left','Rotate right','Zoom in','Zoom out','Pan left','Pan right','Reset camera']) await user.click(screen.getByRole('button',{name}));
  expect(handle.command).toHaveBeenCalledTimes(7);
  expect(screen.getByText('Empty build plate')).toBeInTheDocument();
  view.unmount();expect(handle.dispose).toHaveBeenCalledOnce();
});
test('loads model, warns about fit, and releases its geometry',async()=>{
  const geometry=new BoxGeometry();const dispose=vi.spyOn(geometry,'dispose');
  vi.mocked(loadPart).mockResolvedValue({geometry,size:[240,40,40],fits:false});
  vi.mocked(mountScene).mockReturnValue({command:vi.fn(),update:vi.fn(),dispose:vi.fn()});
  const view=render(<PrinterScene {...props} asset={asset} hasJob/>);
  await screen.findByText(/exceeds the simulated build volume/);
  expect(mountScene).toHaveBeenCalled();view.unmount();expect(dispose).toHaveBeenCalledOnce();
});
test('stale model loads dispose without replacing a new view',async()=>{
  let finish!:(value:Awaited<ReturnType<typeof loadPart>>)=>void;
  vi.mocked(loadPart).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  vi.mocked(mountScene).mockReturnValue({command:vi.fn(),update:vi.fn(),dispose:vi.fn()});
  const view=render(<PrinterScene {...props} asset={asset}/>);
  view.rerender(<PrinterScene {...props} hasJob/>);
  const geometry=new BoxGeometry();const dispose=vi.spyOn(geometry,'dispose');
  await act(async()=>finish({geometry,size:[1,1,1],fits:true}));
  expect(dispose).toHaveBeenCalledOnce();
  expect(screen.getByText(/Placeholder geometry/)).toBeInTheDocument();
});
test('loading and renderer failures keep a readable fallback; unmounted errors are ignored',async()=>{
  vi.mocked(loadPart).mockRejectedValueOnce(new Error('Invalid part'));
  const view=render(<PrinterScene {...props} asset={asset}/>);
  await screen.findByText(/Invalid part/);
  vi.mocked(mountScene).mockImplementationOnce(()=>{throw new Error('WebGL unavailable');});
  view.rerender(<PrinterScene {...props}/>);
  await screen.findByText(/WebGL unavailable/);
  let reject!:(error:Error)=>void;
  vi.mocked(loadPart).mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail;}));
  view.rerender(<PrinterScene {...props} asset={asset}/>);view.unmount();
  await act(async()=>reject(new Error('Aborted')));
});
test('context loss shows the scene fallback',async()=>{
  vi.mocked(mountScene).mockImplementationOnce((_host,options)=>{queueMicrotask(()=>options.onError('3D context lost'));return {command:vi.fn(),update:vi.fn(),dispose:vi.fn()};});
  render(<PrinterScene {...props}/>);
  await waitFor(()=>expect(screen.getByText(/3D context lost/)).toBeInTheDocument());
});


test('poll snapshots and progress preserve the renderer and loaded model',async()=>{
  const handle={command:vi.fn(),update:vi.fn(),dispose:vi.fn()};
  vi.mocked(mountScene).mockReturnValue(handle);
  vi.mocked(loadPart).mockResolvedValue({geometry:new BoxGeometry(),size:[40,40,40],fits:true});
  const view=render(<PrinterScene {...props} asset={asset} hasJob/>);
  await waitFor(()=>expect(mountScene).toHaveBeenCalledOnce());
  view.rerender(<PrinterScene {...props} asset={{...asset,rotation_degrees:[0,0,0]}} hasJob progress={0.6} color="red"/>);
  await waitFor(()=>expect(handle.update).toHaveBeenLastCalledWith(0.6,'red',false));
  expect(mountScene).toHaveBeenCalledOnce();
  expect(loadPart).toHaveBeenCalledOnce();
  expect(handle.dispose).not.toHaveBeenCalled();
});


test('compact camera disclosure stays open across progress refreshes',async()=>{
 const handle={command:vi.fn(),update:vi.fn(),dispose:vi.fn()};vi.mocked(mountScene).mockReturnValue(handle);
 const user=userEvent.setup();const view=render(<PrinterScene {...props} compact/>);
 expect(screen.getByRole('button',{name:'Rotate left'})).not.toBeVisible();
 await user.click(screen.getByText('Camera controls'));
 await user.click(screen.getByRole('button',{name:'Rotate left'}));
 expect(handle.command).toHaveBeenCalledWith('left');
 view.rerender(<PrinterScene {...props} progress={0.5} compact/>);
 expect(screen.getByRole('button',{name:'Rotate left'})).toBeVisible();
});

import {act,render,screen,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {BoxGeometry} from 'three';
import {ModelPreview} from './ModelPreview';
import {loadPart,type Part,type VisualAsset} from '../printers/assets';
vi.mock('../printers/assets');
const asset:VisualAsset={id:'part',name:'Part',path:'/models/part.stl',units:'mm',rotation_degrees:[0,0,0]};
function part(){return {geometry:new BoxGeometry(10,20,10),size:[10,20,10],fits:true};}
function context(){return {clearRect:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),closePath:vi.fn(),fill:vi.fn(),stroke:vi.fn()} as unknown as CanvasRenderingContext2D;}

test('actual geometry draws once, equal polling metadata retains it, and disposal releases geometry',async()=>{
 const mesh=part(),dispose=vi.spyOn(mesh.geometry,'dispose'),draw=context();
 vi.mocked(loadPart).mockResolvedValue(mesh);vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(draw);
 const view=render(<ModelPreview asset={asset} name="Bracket"/>);
 await waitFor(()=>expect(draw.fill).toHaveBeenCalled());expect(dispose).toHaveBeenCalledOnce();
 view.rerender(<ModelPreview asset={{...asset}} name="Bracket"/>);expect(loadPart).toHaveBeenCalledOnce();
 view.unmount();expect(vi.mocked(loadPart).mock.calls[0][1].aborted).toBe(true);
});

test('missing geometry, failed loading and unavailable canvas remain readable',async()=>{
 const view=render(<ModelPreview name="No geometry"/>);expect(screen.getByText('Preview not supplied')).toBeVisible();
 vi.mocked(loadPart).mockRejectedValueOnce(new Error('Invalid STL'));view.rerender(<ModelPreview asset={asset} name="Bad geometry"/>);await screen.findByText('Invalid STL');
 vi.mocked(loadPart).mockResolvedValueOnce(part());vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 view.rerender(<ModelPreview asset={{...asset,id:'different'}} name="No canvas"/>);await screen.findByText('Preview unavailable');
});

test.each([false,true])('late loading after navigation is ignored and mesh memory is released (%s)',async(fails)=>{
 let resolve!:(part:Part)=>void,reject!:(reason:Error)=>void;
 vi.mocked(loadPart).mockImplementationOnce(()=>new Promise((yes,no)=>{resolve=yes;reject=no;}));
 const mesh=part(),dispose=vi.spyOn(mesh.geometry,'dispose');
 const view=render(<ModelPreview asset={asset} name="Late model"/>);view.unmount();
 await act(async()=>{if(fails)reject(new Error('Late error'));else resolve(mesh);});
 expect(dispose).toHaveBeenCalledTimes(fails?0:1);
});


test('known preset models use local preview images when no mesh is supplied',()=>{
 render(<ModelPreview name="  3DBenchy  "/>);
 expect(screen.getByRole('img')).toHaveAttribute('src','/demo-models/benchy.png');
 expect(loadPart).not.toHaveBeenCalled();
});

import {expect,test,vi} from 'vitest';
import {BoxGeometry,Scene,PerspectiveCamera,Mesh} from 'three';
import {normalizePart} from './assets';
import {mountScene} from './scene';

const mocks=vi.hoisted(()=>({render:vi.fn(),dispose:vi.fn(),size:vi.fn(),loseContext:vi.fn()}));
vi.mock('three',async()=>({...await vi.importActual('three'),WebGLRenderer:class {
  domElement=document.createElement('canvas');localClippingEnabled=false;
  setPixelRatio=vi.fn();setSize=mocks.size;render=mocks.render;dispose=mocks.dispose;forceContextLoss=mocks.loseContext;
}}));

test('builds printer/bed geometry, clips at progress and releases camera/geometry resources',()=>{
  let resize!:()=>void;
  const disconnect=vi.fn();
  vi.stubGlobal('ResizeObserver',class {constructor(callback:()=>void){resize=callback;}observe(){}disconnect=disconnect;});
  const host=document.createElement('div');document.body.append(host);
  const part=normalizePart(new BoxGeometry(40,40,100),[0,0,0]);
  const handle=mountScene(host,{part,progress:0.5,color:'blue',placeholder:false,onError:vi.fn()});
  expect(host.querySelector('canvas')).not.toBeNull();
  const [scene,camera]=mocks.render.mock.calls.at(-1)! as [Scene,PerspectiveCamera];
  expect(scene.getObjectByName('build-bed')).toBeDefined();
  const mesh=scene.getObjectByName('printed-part') as Mesh;
  expect(mesh.material).toHaveProperty('clippingPlanes.0.constant',50.01);
  const original=camera.position.clone();
  for(const command of ['left','right','zoom-in','zoom-out','pan-left','pan-right','reset'] as const) handle.command(command);
  expect(camera.position.distanceTo(original)).toBeLessThan(0.0001);
  handle.update(0.75,'red');
  expect(mesh.material).toHaveProperty('clippingPlanes.0.constant',75.01);
  expect(camera.position.distanceTo(original)).toBeLessThan(0.0001);
  expect(host.querySelectorAll('canvas')).toHaveLength(1);
  resize();
  const disposal=vi.spyOn(mesh.geometry,'dispose');
  handle.dispose();handle.dispose();
  const rendered=mocks.render.mock.calls.length;
  const resized=mocks.size.mock.calls.length;
  resize();
  expect(mocks.render).toHaveBeenCalledTimes(rendered);
  expect(mocks.size).toHaveBeenCalledTimes(resized);
  handle.command('left');handle.update(1,'blue');
  expect(disposal).toHaveBeenCalledOnce();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(mocks.loseContext).toHaveBeenCalled();
  expect(host.children).toHaveLength(0);
  part.geometry.dispose();host.remove();vi.unstubAllGlobals();
});
test('empty beds stay empty; missing models use a placeholder and context loss reports failure',()=>{
  vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
  const host=document.createElement('div');
  const onError=vi.fn();
  const empty=mountScene(host,{part:null,progress:0,color:'custom',placeholder:false,onError});
  expect((mocks.render.mock.calls.at(-1)![0] as Scene).getObjectByName('printed-part')).toBeUndefined();
  empty.update(0.5,'blue');
  empty.dispose();
  const placeholder=mountScene(host,{part:null,progress:1,color:'custom',placeholder:true,onError});
  expect((mocks.render.mock.calls.at(-1)![0] as Scene).getObjectByName('printed-part')).toBeDefined();
  placeholder.update(0.5,'custom');
  host.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('3D context'));
  vi.unstubAllGlobals();
});


test('active printing moves the head and cancels animation on pause and dispose',()=>{
 vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
 let frame!:FrameRequestCallback;
 const request=vi.fn((callback:FrameRequestCallback)=>{frame=callback;return 1;});
 const cancel=vi.fn();vi.stubGlobal('requestAnimationFrame',request);vi.stubGlobal('cancelAnimationFrame',cancel);
 const host=document.createElement('div');
 const handle=mountScene(host,{part:null,progress:0.4,color:'blue',placeholder:true,onError:vi.fn()});
 handle.update(0.4,'blue',true);handle.update(0.5,'blue',true);
 expect(request).toHaveBeenCalledOnce();
 frame(200);
 const scene=mocks.render.mock.calls.at(-1)![0] as Scene;
 expect(scene.getObjectByName('print-head')!.position.x).not.toBe(0);
 handle.update(0.4,'blue',false);
 expect(cancel).toHaveBeenCalled();
 expect(scene.getObjectByName('print-head')!.position.x).toBe(0);
 handle.update(0.5,'blue',true);handle.dispose();
 expect(cancel).toHaveBeenCalledTimes(2);
 vi.unstubAllGlobals();
});


test('hidden documents suspend head motion and late frames cannot render disposed scenes',()=>{
 vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
 let frame!:FrameRequestCallback;
 vi.stubGlobal('requestAnimationFrame',vi.fn((callback:FrameRequestCallback)=>{frame=callback;return 2;}));
 const cancel=vi.fn();vi.stubGlobal('cancelAnimationFrame',cancel);
 const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(false);
 const handle=mountScene(document.createElement('div'),{part:null,progress:0.5,color:'blue',placeholder:true,onError:vi.fn()});
 handle.update(0.5,'blue',true);
 hidden.mockReturnValue(true);document.dispatchEvent(new Event('visibilitychange'));frame(100);
 expect(cancel).toHaveBeenCalledOnce();
 hidden.mockReturnValue(false);document.dispatchEvent(new Event('visibilitychange'));
 handle.update(1,'blue',true);handle.update(0.5,'blue',true);handle.dispose();
 const renders=mocks.render.mock.calls.length;frame(200);
 expect(mocks.render).toHaveBeenCalledTimes(renders);
 hidden.mockRestore();vi.unstubAllGlobals();
});

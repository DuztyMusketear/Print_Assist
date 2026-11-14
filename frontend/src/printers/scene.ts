import {AmbientLight,BoxGeometry,Color,CylinderGeometry,DirectionalLight,EdgesGeometry,GridHelper,LineBasicMaterial,LineSegments,Mesh,MeshStandardMaterial,PerspectiveCamera,Plane,Scene,Spherical,Vector3,WebGLRenderer,type BufferGeometry,type Material} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {Part} from './assets';
export type CameraCommand='left'|'right'|'zoom-in'|'zoom-out'|'pan-left'|'pan-right'|'reset';
export type SceneOptions={part:Part|null;progress:number;color:string;placeholder:boolean;onError:(message:string)=>void};
const colors:Record<string,number>={blue:0x269be8,red:0xe66358,green:0x49b993,black:0x3b424b,white:0xf0eee8,gray:0x94a5b2,yellow:0xf0c74f,orange:0xf28a37,purple:0x9764d2,pink:0xf08cb5,natural:0xdccbb0,transparent:0x9dd4d0};

export function mountScene(host:HTMLElement,options:SceneOptions) {
  const renderer=new WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.localClippingEnabled=true;
  const scene=new Scene();scene.background=new Color(0x111f2c);
  const camera=new PerspectiveCamera(40,1,1,3000);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.minDistance=180;controls.maxDistance=1200;controls.maxPolarAngle=Math.PI*0.49;
  controls.listenToKeyEvents(renderer.domElement);
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','Interactive simulated printer. Drag to rotate, scroll to zoom.');
  function reset() {camera.position.set(370,290,400);controls.target.set(0,90,0);controls.update();}
  reset();
  scene.add(new AmbientLight(0xc7e5ff,1.8));
  const light=new DirectionalLight(0xffffff,3);light.position.set(150,400,250);scene.add(light);
  function box(name:string,size:number[],position:number[],color:number) {
    const mesh=new Mesh(new BoxGeometry(...size as [number,number,number]),new MeshStandardMaterial({color,roughness:0.65,metalness:0.25}));
    mesh.name=name;mesh.position.set(...position as [number,number,number]);scene.add(mesh);return mesh;
  }
  box('base',[310,22,310],[0,-25,0],0x252f3b);
  box('build-bed',[220,6,220],[0,-3,0],0x3f505c);
  const grid=new GridHelper(220,11,0x45b5c5,0x344a58);grid.position.y=0.2;scene.add(grid);
  for(const x of [-136,136]) {
    box('upright',[18,295,22],[x,122,-70],0x263b4c);
    box('orange-foot',[38,18,55],[x,-8,-70],0xf1823f);
  }
  box('top-beam',[290,20,24],[0,270,-70],0x263b4c);
  const volume=new LineSegments(new EdgesGeometry(new BoxGeometry(220,250,220)),new LineBasicMaterial({color:0x428797,transparent:true,opacity:0.22}));
  volume.position.y=125;scene.add(volume);
  const height=options.part?options.part.size[1]:40;
  const nozzleHeight=options.placeholder||options.part?height*options.progress+10:80;
  const gantry=box('gantry',[268,9,12],[0,nozzleHeight+20,-12],0x9aa6b1);
  const head=box('print-head',[28,30,28],[0,nozzleHeight+14,0],0xf1823f);
  const nozzle=new Mesh(new CylinderGeometry(2,0,8,12),new MeshStandardMaterial({color:0xe6bf65}));
  nozzle.position.set(0,nozzleHeight-4,0);scene.add(nozzle);
  let partMaterial:MeshStandardMaterial|undefined;let ghostMaterial:MeshStandardMaterial|undefined;
  if(options.part || options.placeholder) {
    const geometry=options.part?options.part.geometry.clone():new BoxGeometry(40,40,40).translate(0,20,0);
    const color=colors[options.color.toLowerCase()] ?? 0x51c5bd;
    const mesh=new Mesh(geometry,new MeshStandardMaterial({color,roughness:0.65,clippingPlanes:[new Plane(new Vector3(0,-1,0),height*options.progress+0.01)]}));
    partMaterial=mesh.material;
    mesh.name='printed-part';scene.add(mesh);
    const ghost=new Mesh(geometry,new MeshStandardMaterial({color,transparent:true,opacity:0.12,depthWrite:false,wireframe:true}));ghostMaterial=ghost.material;scene.add(ghost);
  }
  let disposed=false;
  function draw() {renderer.render(scene,camera);}
  function resize() {
    if(disposed) return;
    const width=Math.max(1,host.clientWidth);const height=Math.max(1,host.clientHeight);
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw();
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  controls.addEventListener('change',draw);
  host.append(renderer.domElement);resize();
  let printing=false;let animation:number|undefined;
  function animate(time:number) {
    animation=undefined;
    if(disposed||!printing||document.hidden) return;
    head.position.x=nozzle.position.x=Math.sin(time/450)*15;
    head.position.z=nozzle.position.z=Math.cos(time/600)*10;
    draw();animation=requestAnimationFrame(animate);
  }
  function syncMotion() {
    if(!printing||document.hidden) {
      if(animation!==undefined) {cancelAnimationFrame(animation);animation=undefined;}
      head.position.x=nozzle.position.x=0;head.position.z=nozzle.position.z=0;
    } else if(animation===undefined) animation=requestAnimationFrame(animate);
  }
  document.addEventListener('visibilitychange',syncMotion);
  const handle={
    update(progress:number,color:string,active=false) {
      if(disposed) return;
      const nozzleHeight=options.placeholder||options.part?height*progress+10:80;
      gantry.position.y=nozzleHeight+20;head.position.y=nozzleHeight+14;nozzle.position.y=nozzleHeight-4;
      if(partMaterial && ghostMaterial) {
        partMaterial.clippingPlanes![0].constant=height*progress+0.01;
        partMaterial.color.setHex(colors[color.toLowerCase()] ?? 0x51c5bd);
        ghostMaterial.color.copy(partMaterial.color);
      }
      printing=active&&progress<1;syncMotion();draw();
    },
    command(action:CameraCommand) {
      if(disposed) return;
      const offset=camera.position.clone().sub(controls.target);
      const spherical=new Spherical().setFromVector3(offset);
      switch(action) {
        case 'left':spherical.theta-=0.2;camera.position.copy(controls.target).add(new Vector3().setFromSpherical(spherical));break;
        case 'right':spherical.theta+=0.2;camera.position.copy(controls.target).add(new Vector3().setFromSpherical(spherical));break;
        case 'zoom-in':camera.position.copy(controls.target).add(offset.multiplyScalar(0.85));break;
        case 'zoom-out':camera.position.copy(controls.target).add(offset.multiplyScalar(1.15));break;
        case 'pan-left':camera.position.x-=15;controls.target.x-=15;break;
        case 'pan-right':camera.position.x+=15;controls.target.x+=15;break;
        case 'reset':reset();break;
      }
      controls.update();draw();
    },
    dispose() {
      if(disposed) return;disposed=true;
      if(animation!==undefined) cancelAnimationFrame(animation);
      document.removeEventListener('visibilitychange',syncMotion);
      observer.disconnect();controls.removeEventListener('change',draw);controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost',lost);
      const geometries=new Set<BufferGeometry>();const materials=new Set<Material>();
      scene.traverse(node=>{if(node instanceof Mesh || node instanceof LineSegments) {
        geometries.add(node.geometry);for(const material of [node.material].flat()) materials.add(material);
      }});
      for(const geometry of geometries) geometry.dispose();
      for(const material of materials) material.dispose();
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    }
  };
  function lost(event:Event) {event.preventDefault();handle.dispose();options.onError('3D context lost. Reload this view to retry.');}
  renderer.domElement.addEventListener('webglcontextlost',lost);
  return handle;
}

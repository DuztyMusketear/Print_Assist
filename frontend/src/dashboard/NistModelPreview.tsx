import {useEffect,useRef,useState,type MouseEvent as ReactMouseEvent,type TouchEvent as ReactTouchEvent} from 'react';

type Point=readonly [number,number,number];
type Triangle=readonly [Point,Point,Point];
type Mesh={triangles:Triangle[];min:Point;max:Point};
type DragPosition={x:number;y:number;moved:boolean};

const SOURCE='/demo-models/nist-test-artifact.stl';
const WIDTH=720;
const HEIGHT=400;
const ENLARGED_WIDTH=1200;
const ENLARGED_HEIGHT=667;

export function parseBinaryStl(buffer:ArrayBuffer):Mesh {
  if(buffer.byteLength<84) throw new Error('The STL file is incomplete.');
  const view=new DataView(buffer);
  const count=view.getUint32(80,true);
  if(count===0||buffer.byteLength<84+count*50) throw new Error('The STL file does not contain a complete triangle mesh.');
  const triangles:Triangle[]=[];
  const min:[number,number,number]=[Infinity,Infinity,Infinity];
  const max:[number,number,number]=[-Infinity,-Infinity,-Infinity];
  for(let triangle=0;triangle<count;triangle++) {
    const points:Point[]=[];
    const offset=84+triangle*50+12;
    for(let vertex=0;vertex<3;vertex++) {
      const point:Point=[0,1,2].map(axis=>view.getFloat32(offset+vertex*12+axis*4,true)) as unknown as Point;
      if(point.some(value=>!Number.isFinite(value))) throw new Error('The STL mesh contains invalid coordinates.');
      point.forEach((value,axis)=>{min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);});
      points.push(point);
    }
    triangles.push(points as unknown as Triangle);
  }
  return {triangles,min,max};
}

function drawMesh(canvas:HTMLCanvasElement,mesh:Mesh,yaw:number,pitch:number,zoom:number) {
  const context=canvas.getContext('2d');
  if(!context) return;
  const width=canvas.width,height=canvas.height;
  const center=mesh.min.map((value,axis)=>(value+mesh.max[axis])/2) as unknown as Point;
  const sinYaw=Math.sin(yaw),cosYaw=Math.cos(yaw),sinPitch=Math.sin(pitch),cosPitch=Math.cos(pitch);
  const rotate=(point:Point):Point=>{
    const x=point[0]-center[0],y=point[1]-center[1],z=point[2]-center[2];
    const yawX=x*cosYaw-y*sinYaw;
    const yawY=x*sinYaw+y*cosYaw;
    return [yawX,yawY*cosPitch-z*sinPitch,yawY*sinPitch+z*cosPitch];
  };
  const projected=mesh.triangles.map(triangle=>{
    const points=triangle.map(rotate) as unknown as Triangle;
    const [a,b,c]=points;
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
    const ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    const length=Math.hypot(...normal)||1;
    const brightness=Math.max(0.18,(normal[0]*-0.35+normal[1]*-0.5+normal[2]*0.8)/length);
    return {points,depth:points.reduce((sum,point)=>sum+point[2],0)/3,brightness};
  });
  const allPoints=projected.flatMap(face=>face.points);
  const minX=Math.min(...allPoints.map(point=>point[0])),maxX=Math.max(...allPoints.map(point=>point[0]));
  const minY=Math.min(...allPoints.map(point=>point[1])),maxY=Math.max(...allPoints.map(point=>point[1]));
  const scale=Math.min((width-70)/Math.max(1,maxX-minX),(height-70)/Math.max(1,maxY-minY))*zoom;
  const offsetX=(width-(maxX-minX)*scale)/2-minX*scale;
  const offsetY=(height-(maxY-minY)*scale)/2+maxY*scale;
  context.clearRect(0,0,width,height);
  projected.sort((left,right)=>left.depth-right.depth);
  for(const face of projected) {
    context.beginPath();
    face.points.forEach((point,index)=>{
      const x=offsetX+point[0]*scale,y=offsetY-point[1]*scale;
      if(index===0) context.moveTo(x,y); else context.lineTo(x,y);
    });
    context.closePath();
    const light=Math.round(face.brightness*100);
    context.fillStyle=`hsl(197 42% ${light}%)`;
    context.fill();
  }
}

export function NistModelPreview() {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [mesh,setMesh]=useState<Mesh|null>(null);
  const [error,setError]=useState('');
  const [yaw,setYaw]=useState(0.65);
  const [pitch,setPitch]=useState(0.72);
  const [zoom,setZoom]=useState(1);
  const [enlarged,setEnlarged]=useState(false);
  const [dragging,setDragging]=useState(false);
  const enlargedRef=useRef(enlarged);
  enlargedRef.current=enlarged;
  const dragPosition=useRef<DragPosition|null>(null);
  const pinchStart=useRef<{distance:number;zoom:number}|null>(null);
  const suppressClick=useRef(false);

  useEffect(()=>{
    let active=true;
    void fetch(SOURCE).then(response=>{
      if(!response.ok) throw new Error('The bundled NIST STL could not be loaded.');
      return response.arrayBuffer();
    }).then(buffer=>parseBinaryStl(buffer)).then(value=>{if(active) setMesh(value);}).catch(reason=>{
      if(active) setError((reason as Error).message);
    });
    return ()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(mesh&&canvasRef.current) {
      canvasRef.current.width=enlarged?ENLARGED_WIDTH:WIDTH;
      canvasRef.current.height=enlarged?ENLARGED_HEIGHT:HEIGHT;
      drawMesh(canvasRef.current,mesh,yaw,pitch,zoom);
    }
  },[mesh,yaw,pitch,zoom,enlarged]);

  useEffect(()=>{
    if(!enlarged) return;
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape') setEnlarged(false);};
    window.addEventListener('keydown',closeOnEscape);
    return ()=>window.removeEventListener('keydown',closeOnEscape);
  },[enlarged]);

  useEffect(()=>{
    const rotateFromMouse=(event:MouseEvent)=>{
      const drag=dragPosition.current;
      if(!drag) return;
      const deltaX=event.clientX-drag.x,deltaY=event.clientY-drag.y;
      drag.x=event.clientX;drag.y=event.clientY;
      if(!drag.moved&&Math.hypot(deltaX,deltaY)<2) return;
      drag.moved=true;
      setYaw(value=>value+deltaX*0.012);
      setPitch(value=>Math.max(-1.35,Math.min(1.35,value+deltaY*0.012)));
      event.preventDefault();
    };
    const finishMouse=()=>{
      const drag=dragPosition.current;
      if(!drag) return;
      suppressClick.current=drag.moved;
      dragPosition.current=null;
      setDragging(false);
    };
    window.addEventListener('mousemove',rotateFromMouse);
    window.addEventListener('mouseup',finishMouse);
    return ()=>{
      window.removeEventListener('mousemove',rotateFromMouse);
      window.removeEventListener('mouseup',finishMouse);
    };
  },[]);

  function startDrag(event:ReactMouseEvent<HTMLButtonElement>) {
    if(!enlargedRef.current||event.button!==0) return;
    suppressClick.current=false;
    dragPosition.current={x:event.clientX,y:event.clientY,moved:false};
    setDragging(true);
  }

  function touchDistance(touches:ReactTouchEvent<HTMLButtonElement>['touches']) {
    const [first,second]=[touches[0],touches[1]];
    return Math.hypot(first.clientX-second.clientX,first.clientY-second.clientY);
  }

  function startPinch(event:ReactTouchEvent<HTMLButtonElement>) {
    if(!enlargedRef.current||event.touches.length<2) return;
    dragPosition.current=null;
    setDragging(false);
    pinchStart.current={distance:touchDistance(event.touches),zoom};
    event.preventDefault();
  }

  function movePinch(event:ReactTouchEvent<HTMLButtonElement>) {
    const start=pinchStart.current;
    if(!start||event.touches.length<2) return;
    const ratio=touchDistance(event.touches)/Math.max(1,start.distance);
    setZoom(Math.max(0.5,Math.min(3,start.zoom*ratio)));
    event.preventDefault();
  }

  function endPinch(event:ReactTouchEvent<HTMLButtonElement>) {
    if(event.touches.length<2) pinchStart.current=null;
  }

  function openEnlarged() {
    if(suppressClick.current) {
      suppressClick.current=false;
      return;
    }
    setEnlarged(true);
  }

  return <section className={`nist-preview${enlarged?' enlarged':''}`} aria-label={enlarged?'Enlarged NIST model preview':'NIST model preview and features'} role={enlarged?'dialog':undefined} aria-modal={enlarged?true:undefined} onClick={event=>{if(enlarged&&event.target===event.currentTarget) setEnlarged(false);}}>
    <div className="nist-preview-panel">
      {enlarged&&<button type="button" className="nist-preview-close" aria-label="Close enlarged preview" onClick={()=>setEnlarged(false)}>Close preview</button>}
      <div className="nist-preview-canvas">
      <button type="button" className={`nist-preview-open${dragging?' dragging':''}`} aria-label="Enlarge NIST artifact preview" aria-description="Click to enlarge. In the enlarged view, drag to rotate or pinch to zoom." data-yaw={yaw.toFixed(3)} data-zoom={zoom.toFixed(2)} disabled={!mesh} onMouseDown={startDrag} onTouchStart={startPinch} onTouchMove={movePinch} onTouchEnd={endPinch} onClick={openEnlarged}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} role="img" aria-label="NIST artifact 3D model preview" data-loaded={String(Boolean(mesh))}/>
      </button>
      {!mesh&&!error&&<p role="status">Loading STL mesh…</p>}
      {error&&<p role="alert">{error} <a href={SOURCE} download="nist-test-artifact.stl">Download the STL</a></p>}
      </div>
      <div className="nist-preview-details">
      <h5>Visible model features</h5>
      <ul>
        <li>Center hole and concentric cylinders</li>
        <li>4 mm pins and holes</li>
        <li>Fine holes, pins, and stepped walls</li>
        <li>Sloped ramp and lateral features</li>
      </ul>
      <div className="nist-preview-actions">
        <button type="button" className="secondary" onClick={()=>setYaw(value=>value-Math.PI/4)} aria-label="Rotate model left">Rotate left</button>
        <button type="button" className="secondary" onClick={()=>setYaw(value=>value+Math.PI/4)} aria-label="Rotate model right">Rotate right</button>
        <button type="button" className="secondary" onClick={()=>{setYaw(0.65);setPitch(0.72);setZoom(1);}}>Reset view</button>
      </div>
      <a href="https://www.nist.gov/el/intelligent-systems-division-73500/production-systems-group/nist-additive-manufacturing-test" target="_blank" rel="noreferrer">Feature source: NIST artifact page</a>
      </div>
    </div>
  </section>;
}

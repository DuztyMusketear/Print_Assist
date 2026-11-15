import {useEffect,useRef,useState} from 'react';
import {loadPart,type VisualAsset} from '../printers/assets';

const modelImages:Record<string,string>={
 '3dbenchy':'/demo-models/benchy.png',
 'calibration cube':'/demo-models/calibration-cube.png',
 'honeycomb phone stand':'/demo-models/honeycomb-phone-stand.png',
 'curved phone stand':'/demo-models/curved-phone-stand.png',
 'organic phone stand':'/demo-models/organic-phone-stand.png',
 'foldable phone stand keychain':'/demo-models/foldable-phone-stand.png',
};

export function ModelPreview({asset,name}:{asset?:VisualAsset;name:string}) {
 const canvas=useRef<HTMLCanvasElement>(null),[error,setError]=useState('');
 const key=JSON.stringify(asset);
 useEffect(()=>{
  setError('');
  if(!asset) return;
  const controller=new AbortController();let live=true;
  void loadPart(asset,controller.signal).then(part=>{
   try {
    if(!live) return;
    const context=canvas.current!.getContext('2d');
    if(!context) throw new Error('Preview unavailable');
    const positions=part.geometry.getAttribute('position');
    const points=Array.from({length:positions.count},(_,i)=>{
     const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
     return [(x-z)*0.7,(x+z)*0.35-y];
    });
    const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
    for(const p of points) for(let i=0;i<2;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
    const scale=Math.min(200/Math.max(1,max[0]-min[0]),120/Math.max(1,max[1]-min[1]));
    context.clearRect(0,0,240,150);context.fillStyle='#52cfc5';context.strokeStyle='#285b68';context.lineWidth=0.3;
    for(let i=0;i<points.length;i+=3) {
     context.beginPath();
     for(let j=0;j<3;j++) {
      const p=points[i+j],x=120+(p[0]-(min[0]+max[0])/2)*scale,y=75+(p[1]-(min[1]+max[1])/2)*scale;
      if(j===0) context.moveTo(x,y);else context.lineTo(x,y);
     }
     context.closePath();context.fill();context.stroke();
    }
   } catch(reason){setError((reason as Error).message);}finally{part.geometry.dispose();}
  }).catch(reason=>{if(live)setError((reason as Error).message);});
  return ()=>{live=false;controller.abort();};
 },[key]);
 const image=modelImages[name.trim().toLowerCase()];
 return <div className="model-thumbnail">{asset&&!error?<canvas ref={canvas} width={240} height={150} role="img" aria-label={`3D preview of ${name}`}/>:image?<img className="preset-model-image" src={image} alt={`${name} model preview`}/>:<span>{error||'Preview not supplied'}</span>}</div>;
}

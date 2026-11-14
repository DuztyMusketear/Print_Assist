import {useEffect,useRef,useState} from 'react';
import {loadPart,type Part,type VisualAsset} from './assets';
import {mountScene,type CameraCommand} from './scene';
export type PrinterSceneProps={asset?:VisualAsset;progress:number;color:string;hasJob:boolean;label:string};
const cameras:[CameraCommand,string][]=[['left','Rotate left'],['right','Rotate right'],['zoom-in','Zoom in'],['zoom-out','Zoom out'],['pan-left','Pan left'],['pan-right','Pan right'],['reset','Reset camera']];
export function PrinterScene({asset,progress,color,hasJob,label}:PrinterSceneProps) {
  const host=useRef<HTMLDivElement>(null);
  const handle=useRef<ReturnType<typeof mountScene>|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [fits,setFits]=useState(true);
  useEffect(()=>{
    let live=true;let part:Part|null=null;
    const controller=new AbortController();
    setError('');setFits(true);setLoading(Boolean(asset));
    async function start() {
      try {
        if(asset) {
          const loaded=await loadPart(asset,controller.signal);
          if(!live){loaded.geometry.dispose();return;}
          part=loaded;setFits(loaded.fits);
        }
        handle.current=mountScene(host.current!,{part,progress,color,placeholder:hasJob&&!asset,onError:setError});
      } catch(reason) {if(live)setError((reason as Error).message);}
      finally {if(live)setLoading(false);}
    }
    void start();
    return ()=>{live=false;controller.abort();handle.current?.dispose();handle.current=null;part?.geometry.dispose();};
  },[asset,progress,color,hasJob]);
  return <div className="printer-scene" role="group" aria-label={label}>
    <div ref={host} className="printer-canvas" hidden={Boolean(error)} />
    {error && <p role="status">3D preview unavailable: {error}. Printer status and progress remain available.</p>}
    {loading && <p role="status">Loading part model...</p>}
    {!asset && <p className="scene-caption">{hasJob?'Placeholder geometry - no visual asset assigned':'Empty build plate'}</p>}
    {!fits && <p className="fit-warning">Part exceeds the simulated build volume. Original scale preserved.</p>}
    <div className="camera-controls" aria-label={`Camera controls for ${label}`}>{cameras.map(([action,name])=><button type="button" className="secondary" key={action} disabled={Boolean(error)||loading} onClick={()=>handle.current?.command(action)}>{name}</button>)}</div>
  </div>;
}

import {Euler,Matrix4,Vector3,type BufferGeometry} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import type {components} from '../types';
export type VisualAsset=components['schemas']['VisualAsset'];
export const MAX_BYTES=10*1024*1024;
export const MAX_TRIANGLES=100000;
export type Part={geometry:BufferGeometry;size:number[];fits:boolean};

export function normalizePart(geometry:BufferGeometry,rotation:number[]):Part {
  geometry.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...rotation.map(value=>value*Math.PI/180) as [number,number,number])));
  geometry.rotateX(-Math.PI/2);
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox!;
  const size=bounds.getSize(new Vector3());
  if(![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)) {
    geometry.dispose();throw new Error('Invalid STL geometry');
  }
  const center=bounds.getCenter(new Vector3());
  geometry.translate(-center.x,-bounds.min.y,-center.z);
  geometry.computeBoundingBox();
  return {geometry,size:size.toArray(),fits:size.x<=220 && size.y<=250 && size.z<=220};
}

export function parsePart(data:ArrayBuffer,rotation:number[]):Part {
  if(data.byteLength>MAX_BYTES) throw new Error('Part exceeds 10 MiB limit');
  const text=new TextDecoder().decode(new Uint8Array(data,0,Math.min(5,data.byteLength)));
  if(data.byteLength>=84) {
    const count=new DataView(data).getUint32(80,true);
    if(text!=='solid' || 84+count*50===data.byteLength) {
      if(count>MAX_TRIANGLES) throw new Error('Part exceeds 100,000 triangles');
      if(84+count*50!==data.byteLength) throw new Error('Invalid STL length');
    }
  } else if(text!=='solid') throw new Error('Invalid STL file');
  let geometry:BufferGeometry;
  try {geometry=new STLLoader().parse(data);} catch {throw new Error('Invalid STL file');}
  const count=geometry.getAttribute('position').count;
  if(count===0 || count/3>MAX_TRIANGLES) {
    geometry.dispose();throw new Error('Invalid STL or more than 100,000 triangles');
  }
  return normalizePart(geometry,rotation);
}

export async function loadPart(asset:VisualAsset,signal:AbortSignal):Promise<Part> {
  if(!(asset.path==='/demo-models/nist-test-artifact.stl'||/^\/models\/[a-zA-Z0-9_/-]+\.stl$/.test(asset.path)) || asset.path.includes('..')) throw new Error('Only local catalog models are allowed');
  const response=await fetch(asset.path,{signal,redirect:'error'});
  if(!response.ok || !response.body) throw new Error('Unable to load part model');
  const reader=response.body.getReader();
  const chunks:Uint8Array[]=[];
  let length=0;
  try {
    while(true) {
      const {value,done}=await reader.read();
      if(done) break;
      length+=value.byteLength;
      if(length>MAX_BYTES) {await reader.cancel();throw new Error('Part exceeds 10 MiB limit');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const data=new Uint8Array(length);let offset=0;
  for(const chunk of chunks) {data.set(chunk,offset);offset+=chunk.byteLength;}
  return parsePart(data.buffer,asset.rotation_degrees);
}

import {expect,test,vi} from 'vitest';
import {BoxGeometry} from 'three';
import {normalizePart,parsePart,loadPart,MAX_BYTES,MAX_TRIANGLES} from './assets';

export const triangle='solid part\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 20 0 0\nvertex 0 20 40\nendloop\nendfacet\nendsolid part';
export const asset={id:'test',name:'test',path:'/models/test.stl',units:'mm' as const,rotation_degrees:[0,0,0] as [number,number,number]};
test('normalizes Z-up geometry onto bed without rescaling and reports oversized parts',()=>{
  const part=normalizePart(new BoxGeometry(240,30,40),[0,0,0]);
  expect(part.size).toEqual([240,40,30]);
  expect(part.fits).toBe(false);
  expect(part.geometry.boundingBox!.min.y).toBe(0);
  expect(part.geometry.boundingBox!.getCenter(part.geometry.boundingBox!.min.clone()).x).toBe(0);
  const rotated=normalizePart(new BoxGeometry(10,20,30),[90,0,0]);
  expect(rotated.size[1]).toBeCloseTo(20);
  expect(rotated.fits).toBe(true);
});
test('parses ASCII and binary STL and rejects invalid or oversized data',()=>{
  expect(parsePart(new TextEncoder().encode(triangle).buffer,[0,0,0]).fits).toBe(true);
  const binary=new ArrayBuffer(134);const data=new DataView(binary);data.setUint32(80,1,true);
  data.setFloat32(108,20,true);data.setFloat32(124,20,true);
  expect(parsePart(binary,[0,0,0]).geometry.getAttribute('position').count).toBe(3);
  expect(()=>parsePart(new ArrayBuffer(MAX_BYTES+1),[0,0,0])).toThrow('10 MiB');
  const tooMany=new ArrayBuffer(84);new DataView(tooMany).setUint32(80,MAX_TRIANGLES+1,true);
  expect(()=>parsePart(tooMany,[0,0,0])).toThrow('100,000');
  expect(()=>parsePart(new TextEncoder().encode('solid invalid').buffer,[0,0,0])).toThrow('Invalid');
  expect(()=>parsePart(new ArrayBuffer(4),[0,0,0])).toThrow('Invalid');
});
test('only fetches same-origin catalog paths and enforces streamed byte limits',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(triangle));
  expect((await loadPart(asset,new AbortController().signal)).fits).toBe(true);
  expect(fetcher.mock.calls[0][0]).toBe('/models/test.stl');
  await expect(loadPart({...asset,path:'https://remote.invalid/test.stl'},new AbortController().signal)).rejects.toThrow('local');
  fetcher.mockResolvedValueOnce(new Response('',{status:404}));
  await expect(loadPart(asset,new AbortController().signal)).rejects.toThrow('Unable');
  fetcher.mockResolvedValueOnce(new Response(new Uint8Array(MAX_BYTES+1)));
  await expect(loadPart(asset,new AbortController().signal)).rejects.toThrow('10 MiB');
});

test('rejects nonfinite geometry, excessive ASCII triangles and invalid binary lengths',()=>{
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const invalid=new BoxGeometry();invalid.getAttribute('position').setX(0,NaN);
  expect(()=>normalizePart(invalid,[0,0,0])).toThrow('Invalid');
  expect(()=>parsePart(new ArrayBuffer(100),[0,0,0])).toThrow('length');
  const empty='solid empty\n'+' '.repeat(100)+'\nendsolid empty';
  expect(()=>parsePart(new TextEncoder().encode(empty).buffer,[0,0,0])).toThrow('Invalid');
  const tooMany='solid huge\n'+'facet normal 0 0 0 outer loop vertex 0 0 0 vertex 1 0 0 vertex 0 1 0 endloop endfacet\n'.repeat(MAX_TRIANGLES+1)+'endsolid huge';
  expect(()=>parsePart(new TextEncoder().encode(tooMany).buffer,[0,0,0])).toThrow('100,000');
  const tall=normalizePart(new BoxGeometry(10,10,300),[0,0,0]);
  expect(tall.fits).toBe(false);
  expect(normalizePart(new BoxGeometry(10,300,10),[0,0,0]).fits).toBe(false);
});


test('bundled NIST preview uses the same bounded printer-bed loader',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(triangle));
 const part=await loadPart({...asset,path:'/demo-models/nist-test-artifact.stl'},new AbortController().signal);
 expect(part.fits).toBe(true);part.geometry.dispose();
});

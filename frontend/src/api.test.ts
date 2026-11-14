import { test, expect, vi } from 'vitest';
import { readState, addOrder } from './api';
import { state } from './test-fixtures';

test('reads real snapshot data returned by the transport', async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(state)));
  expect(await readState()).toEqual(state);
});
test('state fetch failure is actionable',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:503}));
  await expect(readState()).rejects.toThrow('Check the local server');
});
const body = {session_id:state.session_id,expected_revision:0,idempotency_key:state.session_id,
  payload:{artifact_id:'figure-pla-blue',quantity:1,priority:0,production_due:'2026-11-15T00:00:00Z',ship_by:'2026-11-16T00:00:00Z'}};
test('posts a typed command and returns the saved state',async()=>{
  const transport = vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(state)));
  expect(await addOrder(body)).toEqual(state);
  expect(JSON.parse(String(transport.mock.calls[0][1]!.body))).toEqual(body);
});
test.each([[409,'Refresh'],[422,'Check the product']])('explains HTTP %i without exposing server details',async(status,message)=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status}));
  await expect(addOrder(body)).rejects.toThrow(message);
});

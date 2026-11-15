import {expect,test} from '@playwright/test';

test('same-origin MCP endpoint initializes and exposes only read-only workshop tools',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const headers={'accept':'application/json, text/event-stream','content-type':'application/json','mcp-protocol-version':'2025-06-18'};
  async function post(id:number|undefined,method:string,params?:unknown){
   const response=await fetch('/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',...(id===undefined?{}:{id}),method,...(params===undefined?{}:{params})})});
   return {status:response.status,body:id===undefined?null:await response.json()};
  }
  const initialized=await post(1,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'browser-test',version:'1.0'}});
  await post(undefined,'notifications/initialized');
  const listed=await post(2,'tools/list');
  return {initialized,listed};
 });
 expect(result.initialized.status).toBe(200);
 expect(result.listed.status).toBe(200);
 expect(result.listed.body.result.tools.map((tool:{name:string})=>tool.name).sort()).toEqual(['get_workshop_overview','list_incidents','list_orders','list_printers','list_supplies','list_tasks']);
 expect(result.listed.body.result.tools.every((tool:{description:string})=>tool.description.toLowerCase().includes('read-only'))).toBe(true);
});

import {test,expect,type Page} from '@playwright/test';
async function command(page:Page,path:string,payload:object){const state=await(await page.request.get('/api/state')).json();const response=await page.request.post(path,{data:{session_id:state.session_id,expected_revision:state.revision,idempotency_key:crypto.randomUUID(),payload}});expect(response.ok()).toBe(true);return response.json();}

test('partner preset search and local images coexist with guarded bulk cancellation and assistant sidebar',async({page})=>{
 const external:string[]=[];await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}return route.continue();});
 await page.goto('/');await command(page,'/api/scenarios/reset',{scenario:'empty'});await page.reload();
 await expect(page.getByRole('heading',{name:'Orchestrator',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Models',exact:true}).click();
 await page.getByRole('combobox',{name:'Search models',exact:true}).fill('3DBenchy');
 await page.getByRole('listbox',{name:'Model suggestions'}).getByRole('button',{name:'3DBenchy',exact:true}).click();
 const preview=page.getByRole('region',{name:'Modeling stage'}).getByRole('img',{name:'3DBenchy model preview'});await expect(preview).toBeVisible();expect(await preview.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 const order={artifact_id:'figure-pla-blue',quantity:1,priority:0,production_due:'2026-11-15T12:00:00Z',ship_by:'2026-11-16T00:00:00Z',mode:'automatic',clock_speed:60};
 await command(page,'/api/shop/simulate',order);await command(page,'/api/shop/simulate',order);await page.reload();
 await page.getByRole('tab',{name:'Schedule',exact:true}).click();await page.getByRole('checkbox',{name:'Select all awaiting confirmation orders'}).check();await page.getByRole('button',{name:'Delete selected (2)'}).click();
 let state=await(await page.request.get('/api/state')).json();expect(state.orders.every((o:{status:string})=>o.status==='queued')).toBe(true);
 await page.getByRole('button',{name:'Confirm bulk deletion'}).click();await expect(page.getByRole('button',{name:/Inspect order/})).toHaveCount(0);
 state=await(await page.request.get('/api/state')).json();expect(state.orders).toHaveLength(2);expect(state.orders.every((o:{status:string})=>o.status==='cancelled')).toBe(true);expect(state.shop_requests.every((r:{status:string})=>r.status==='cancelled')).toBe(true);expect(state.jobs).toHaveLength(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(external).toEqual([]);
});

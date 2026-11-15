import {test,expect,type Page} from '@playwright/test';

async function command(page:Page,path:string,payload:object) {
 const state=await (await page.request.get('/api/state')).json();
 const response=await page.request.post(path,{data:{session_id:state.session_id,expected_revision:state.revision,idempotency_key:crypto.randomUUID(),payload}});
 expect(response.ok()).toBe(true);return response.json();
}
async function settings(page:Page) {if(await page.locator('.incident-settings').getAttribute('open')===null)await page.getByText('Incident settings',{exact:true}).click();}
async function injection(page:Page) {await settings(page);if(await page.locator('.fault-injection').getAttribute('open')===null)await page.locator('.fault-injection summary').click();}
async function seeded(page:Page) {
 await page.goto('/');await command(page,'/api/scenarios/reset',{scenario:'seeded'});
 await command(page,'/api/schedule',{mode:'automatic'});await command(page,'/api/advance',{seconds:600});
 await page.getByRole('button',{name:'Refresh queue'}).click();
 await expect(page.locator('.printer-status.running').first()).toBeVisible();
}
test('fault review isolates locally, explains impacts, recovers exact quantities and resets for a repeat',async({page})=>{
 const external:string[]=[];await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}return route.continue();});
 for(const index of [0,1]) {
  await seeded(page);const before=await (await page.request.get('/api/state')).json();
  const active=before.printers.filter((printer:{status:string})=>printer.status==='running');const printer=active[index];
  await page.locator('.inspect-printer').nth(before.printers.findIndex((item:{id:string})=>item.id===printer.id)).click();
  await injection(page);await page.getByRole('combobox',{name:'Simulated fault',exact:true}).selectOption(index?'network_disconnect':'thermal');
  await page.getByRole('button',{name:'Inject simulated fault',exact:true}).click();
  await expect(page.locator('.incident-flags')).toContainText(index?'Awaiting printer signal':'Physical action needed');await page.getByRole('button',{name:'Inspect incident',exact:true}).click();await expect(page.getByText(/Equipment isolated/)).toBeVisible();
  const isolated=await (await page.request.get('/api/state')).json();expect(isolated.printers.find((item:{id:string})=>item.id===printer.id).status).toBe('faulted');
  expect(isolated.incidents[0].waste_grams).toBeGreaterThan(0);expect(isolated.jobs.filter((job:{status:string})=>job.status==='failed')).toHaveLength(1);
  await page.getByRole('button',{name:'Preview recovery',exact:true}).click();await expect(page.getByRole('table',{name:'Order schedule impact'})).toBeVisible();
  await page.getByRole('checkbox',{name:/I reviewed/}).check();await page.getByRole('button',{name:'Apply recovery',exact:true}).click();
  await expect.poll(async()=>(await (await page.request.get('/api/state')).json()).incidents[0].status).toBe('recovering');
  await command(page,'/api/advance',{seconds:43200});const completed=await (await page.request.get('/api/state')).json();
  expect(completed.orders.every((order:{quantity:number;successful_quantity:number})=>order.quantity===order.successful_quantity)).toBe(true);
  expect(completed.printers.find((item:{id:string})=>item.id===printer.id).status).toBe('faulted');
  expect(completed.jobs.filter((job:{status:string})=>job.status==='failed')).toHaveLength(1);expect(completed.controls).toEqual({agents_enabled:false,automatic_triggers:false});
  await page.getByRole('button',{name:'Refresh queue'}).click();await expect(page.locator('.incident-panel strong').filter({hasText:'production restored'})).toBeVisible();
 }
 await command(page,'/api/scenarios/reset',{scenario:'empty'});await page.getByRole('button',{name:'Refresh queue'}).click();await expect(page.getByText(/No incidents/)).toBeVisible();
 const reset=await (await page.request.get('/api/state')).json();expect(reset.incidents).toEqual([]);expect(reset.recovery_policy).toBe('review');expect(external).toEqual([]);
});

test('stale reviews and rejection preserve isolation; automatic recovery is separate and resettable',async({page})=>{
 await seeded(page);await injection(page);await page.getByRole('button',{name:'Inject simulated fault',exact:true}).click();
 await page.getByRole('button',{name:'Inspect incident',exact:true}).click();await page.getByRole('button',{name:'Preview recovery',exact:true}).click();await page.getByRole('checkbox',{name:/I reviewed/}).check();
 await command(page,'/api/advance',{seconds:1});await page.getByRole('button',{name:'Refresh queue'}).click();await expect(page.getByRole('button',{name:'Apply recovery'})).toBeDisabled();
 await page.getByRole('button',{name:'Preview recovery'}).click();await page.getByRole('checkbox',{name:/I reviewed/}).check();await page.getByRole('button',{name:'Reject recovery'}).click();
 await expect.poll(async()=>(await (await page.request.get('/api/state')).json()).incidents[0].status).toBe('rejected');
 expect((await (await page.request.get('/api/state')).json()).printers.some((printer:{status:string})=>printer.status==='faulted')).toBe(true);
 await seeded(page);await settings(page);await page.getByLabel('Simulation recovery policy').selectOption('automatic');
 await injection(page);await page.getByRole('button',{name:'Inject simulated fault',exact:true}).click();
 await expect.poll(async()=>(await (await page.request.get('/api/state')).json()).incidents[0].status).toBe('recovering');
 const recovered=await (await page.request.get('/api/state')).json();expect(recovered.controls).toEqual({agents_enabled:false,automatic_triggers:false});
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('heading',{name:'Incidents & Schedule Impact'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});


test('compact flags expose applied recovery and printer-confirmed network resolution',async({page})=>{
 for(const fault_type of ['thermal','network_disconnect']) {
  await seeded(page);const state=await (await page.request.get('/api/state')).json();
  const printer=state.printers.find((item:{status:string})=>item.status==='running');
  await command(page,'/api/incidents/inject',{printer_id:printer.id,fault_type,event_id:crypto.randomUUID()});
  await page.getByRole('button',{name:'Refresh queue'}).click();
  if(await page.getByRole('button',{name:'Close incident details'}).count())await page.getByRole('button',{name:'Close incident details'}).click();
  await expect(page.getByRole('button',{name:'Preview recovery'})).toHaveCount(0);
  const height=await page.locator('.incident-panel').evaluate(element=>element.getBoundingClientRect().height);expect(height).toBeLessThan(200);
  await page.getByRole('button',{name:'Inspect incident',exact:true}).click();
  if(fault_type==='network_disconnect') {
   await page.getByRole('button',{name:'Simulate connection restored'}).click();
   await expect(page.locator('.incident-flags')).toContainText('Resolved');
   const resolved=await (await page.request.get('/api/state')).json();expect(resolved.incidents[0].progress.held).toBe(true);
   expect(resolved.incidents[0].resolution_source).toBe('printer_telemetry');
  } else {
   await page.getByRole('button',{name:'Preview recovery'}).click();await page.getByRole('checkbox',{name:/I reviewed/}).check();await page.getByRole('button',{name:'Apply recovery'}).click();
   await expect(page.getByText('Recovery already applied',{exact:true})).toBeVisible();
   await expect(page.getByRole('button',{name:'Preview recovery'})).toHaveCount(0);
   await page.getByText('Resolve physical issue',{exact:true}).click();await expect(page.getByRole('button',{name:'Mark resolved'})).toBeDisabled();
   await page.getByRole('checkbox',{name:/I acknowledge/}).check();await page.getByRole('button',{name:'Mark resolved'}).click();await expect(page.locator('.incident-flags')).toContainText('Resolved');
  }
 }
});

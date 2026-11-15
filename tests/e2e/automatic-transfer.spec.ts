import {test,expect,type Page} from '@playwright/test';

async function command(page:Page,path:string,payload:object){
 const state=await (await page.request.get('/api/state')).json();
 const response=await page.request.post(path,{data:{session_id:state.session_id,expected_revision:state.revision,idempotency_key:crypto.randomUUID(),payload}});
 expect(response.ok()).toBe(true);return response.json();
}

test('fully automated local order reaches completion without schedule confirmation or manual printer starts',async({page})=>{
 await page.goto('/');await command(page,'/api/scenarios/reset',{scenario:'empty'});await page.reload();
 const baseline=await (await page.request.get('/api/state')).json();expect(baseline.incidents).toHaveLength(0);expect(baseline.printers.every((p:{status:string})=>p.status==='idle')).toBe(true);
 await page.getByRole('tab',{name:'Orders',exact:true}).click();await page.getByRole('button',{name:'Simulate incoming order',exact:true}).click();
 await page.getByLabel('Incoming process',{exact:true}).selectOption('end_to_end');await page.getByLabel('Incoming quantity',{exact:true}).fill('5');await page.getByRole('button',{name:'Simulate order',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByRole('heading',{name:'Automatic order progress'})).toBeVisible();
 await expect.poll(async()=>(await (await page.request.get('/api/state')).json()).orders[0].successful_quantity,{timeout:12000}).toBe(5);
 await expect(page.getByRole('region',{name:'Operational status'})).toContainText('Order complete / completed');
 const done=await (await page.request.get('/api/state')).json();expect(done.order_demonstrations[0].status).toBe('completed');expect(done.shop_requests[0].status).toBe('accepted');expect(done.incidents).toHaveLength(0);expect(done.controls.agents_enabled).toBe(false);
 // Production has completed automatically; pause only to isolate the next test.
 await page.getByRole('button',{name:'Pause clock',exact:true}).click();await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();
});

test('pause and offline transfer to healthy busy capacity and show exact deadline risks in red',async({page})=>{
 for(const sourceAction of ['pause','offline']){
  await page.goto('/');await command(page,'/api/scenarios/reset',{scenario:'empty'});
  if(sourceAction==='pause')await command(page,'/api/printers/control',{printer_id:'printer-3',action:'offline'});
  else await command(page,'/api/incidents/inject',{printer_id:'printer-3',fault_type:'thermal',event_id:crypto.randomUUID()});
  await command(page,'/api/orders',{artifact_id:'figure-pla-blue',quantity:2,priority:0,production_due:'2026-11-15T02:00:00Z',ship_by:'2026-11-16T00:00:00Z'});
  await command(page,'/api/schedule',{mode:'automatic'});await command(page,'/api/advance',{seconds:1800});await page.reload();
  const before=await (await page.request.get('/api/state')).json(),healthy=before.jobs.find((j:{printer_id:string})=>j.printer_id==='printer-2');
  await page.getByRole('button',{name:sourceAction==='pause'?'Pause Printer 1':'Take Printer 1 offline',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Latest workload transfer'})).toBeVisible();
  const after=await (await page.request.get('/api/state')).json();expect(after.jobs.find((j:{id:string})=>j.id===healthy.id)).toEqual(healthy);
  const retry=after.jobs.find((j:{replaces_job_id?:string})=>j.replaces_job_id);expect(retry.printer_id).toBe('printer-2');expect(retry.status).toBe('planned');expect(after.jobs[0].status).toBe('failed');expect(after.jobs[0].waste_grams).toBe(6.25);
  expect(after.forecasts[0].risk).toBe('late');expect(after.workload_transfers.at(-1).impacts[0].delta_seconds).toBeGreaterThan(0);
  const warnings=page.getByRole('list',{name:'Current deadline warnings'});await expect(warnings).toContainText('Part 3');await expect(warnings).toContainText('Printer 2');
  expect(await warnings.locator('.deadline-risk').first().evaluate(el=>getComputedStyle(el).color)).toBe('rgb(255, 118, 118)');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1280,height:720});
 }
});


test('healthy printers rejoin from pause or offline, take queued work and improve deadline forecasts',async({page})=>{
 for(const [away,back] of [['pause','resume'],['offline','online']]){
  await page.goto('/');await command(page,'/api/scenarios/reset',{scenario:'empty'});
  await command(page,'/api/orders',{artifact_id:'figure-pla-blue',quantity:3,priority:0,production_due:'2026-11-15T03:00:00Z',ship_by:'2026-11-16T00:00:00Z'});
  await command(page,'/api/schedule',{mode:'automatic'});await command(page,'/api/advance',{seconds:1800});
  const paused=await command(page,'/api/printers/control',{printer_id:'printer-1',action:away});
  expect(paused.forecasts[0].risk).toBe('late');
  const healthy=paused.jobs.filter((job:{status:string})=>job.status==='running');
  const queued=paused.jobs.filter((job:{status:string})=>job.status==='planned');
  await page.reload();
  await page.getByRole('button',{name:back==='resume'?'Resume Printer 1':'Bring Printer 1 online',exact:true}).click();
  await expect(page.locator('.printer-inspector').getByText('running',{exact:true})).toBeVisible();
  const restored=await (await page.request.get('/api/state')).json();
  expect(restored.jobs.filter((job:{id:string})=>healthy.some((row:{id:string})=>row.id===job.id))).toEqual(healthy);
  expect(restored.jobs.find((job:{id:string})=>job.id===queued[0].id)).toMatchObject({printer_id:'printer-1',status:'running',elapsed_seconds:0});
  expect(restored.jobs.length).toBe(paused.jobs.length);expect(restored.forecasts[0].risk).toBe('on_time');
  expect(restored.workload_transfers.at(-1).action).toBe('rebalance');
  await expect(page.getByRole('heading',{name:'Latest workload transfer'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Operational status'}).getByText(/queued parts rebalanced onto healthy idle printers/)).toBeVisible();
  await expect(page.getByRole('list',{name:'Current deadline warnings'})).toHaveCount(0);
 }
});

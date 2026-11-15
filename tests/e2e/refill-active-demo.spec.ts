import {test,expect,type Page} from '@playwright/test';
async function state(page:Page){return(await page.request.get('/api/state')).json();}
async function command(page:Page,path:string,payload:object){const current=await state(page);const response=await page.request.post(path,{data:{session_id:current.session_id,expected_revision:current.revision,idempotency_key:crypto.randomUUID(),payload}});expect(response.ok()).toBe(true);return response.json();}

test('active fault demo starts every printer with queues and faulted printer accepts additive refill',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Scenario controls',exact:true})).toBeVisible();
 await page.getByLabel('Scenario',{exact:true}).selectOption('fault-demo');await page.getByRole('checkbox',{name:/I understand that reset/}).check();await page.getByRole('button',{name:'Reset scenario',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:/I understand that reset/})).not.toBeChecked();
 const prepared=await state(page);expect(prepared.printers.every((p:{status:string})=>p.status==='running')).toBe(true);expect(prepared.running).toBe(false);expect(prepared.recovery_policy).toBe('automatic');expect(prepared.incidents).toHaveLength(0);
 expect(prepared.jobs.filter((j:{status:string})=>j.status==='planned').length).toBe(prepared.printers.length*3);
 // Every station is genuinely active before the explicit fault is injected.
 const pid=prepared.printers[0].id;
 await command(page,'/api/incidents/inject',{printer_id:pid,fault_type:'filament_runout',event_id:crypto.randomUUID()});await page.reload();
 await expect(page.getByRole('button',{name:'Inspect incident',exact:true})).toBeVisible();
 await page.getByText('Load filament',{exact:true}).click();
 await expect(page.getByRole('button',{name:'Add filament',exact:true})).toBeDisabled();
 await page.getByLabel('Filament to add (grams)',{exact:true}).fill('250');await page.getByRole('checkbox',{name:/I confirm this is the filament/}).check();await page.getByRole('button',{name:'Add filament',exact:true}).click();
 await expect.poll(async()=>(await state(page)).printers[0].material.grams).toBe(250);
 let current=await state(page);expect(current.printers[0].status).toBe('running');expect(current.incidents[0].refilled_grams).toBe(250);
 const attempts=current.jobs.length;
 await page.getByRole('button',{name:'Inspect incident',exact:true}).click();
 await expect(page.getByRole('button',{name:'Mark resolved',exact:true})).toHaveCount(0);
 await expect.poll(async()=>(await state(page)).incidents[0].equipment_cleared).toBe(true);
 current=await state(page);expect(current.printers[0].material.grams).toBe(250);expect(current.jobs).toHaveLength(attempts);expect(current.printers[0].status).toBe('running');
 // Adding to a running printer is additive and does not change its part or material.
 const running=current.jobs.find((j:{printer_id:string;status:string})=>j.printer_id===pid&&j.status==='running');
 await page.getByLabel('Filament to add (grams)',{exact:true}).fill('50');await page.getByRole('checkbox',{name:/I confirm this is the filament/}).check();await page.getByRole('button',{name:'Add filament',exact:true}).click();await expect.poll(async()=>(await state(page)).printers[0].material.grams).toBe(300);
 current=await state(page);expect(current.jobs.find((j:{id:string})=>j.id===running.id)).toEqual(running);expect(current.printers[0].material.color).toBe(prepared.printers[0].material.color);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const complete=await command(page,'/api/advance',{seconds:86400});expect(complete.orders.every((o:{quantity:number;successful_quantity:number})=>o.successful_quantity===o.quantity)).toBe(true);expect(complete.incidents[0].status).toBe('resolved');
});

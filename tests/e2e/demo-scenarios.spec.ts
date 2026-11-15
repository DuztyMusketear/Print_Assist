import {test,expect,type Page} from '@playwright/test';
async function snapshot(page:Page){return (await page.request.get('/api/state')).json();}
async function command(page:Page,path:string,payload:object){const state=await snapshot(page);const response=await page.request.post(path,{data:{session_id:state.session_id,expected_revision:state.revision,idempotency_key:crypto.randomUUID(),payload}});expect(response.ok()).toBe(true);return response.json();}

test('sequential demo events use real intake, urgent scheduling, fault recovery and restored backlogs',async({page})=>{
 await page.goto('/');await command(page,'/api/scenarios/reset',{scenario:'empty'});await page.reload();
 const panel=page.locator('details.demo-scenarios');await panel.getByText('Demo scenarios',{exact:true}).click();
 await expect(panel.getByText('Deterministic tools; live agent orchestration is planned.')).toBeVisible();
 expect(await panel.locator('fieldset').evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(700);
 async function trigger(){const count=(await snapshot(page)).scenario_events.length;await panel.getByRole('button',{name:'Trigger simulated event'}).click();await expect.poll(async()=>(await snapshot(page)).scenario_events.length).toBe(count+1);return snapshot(page);}
 let state=await trigger();expect(state.shop_requests[0].status).toBe('pending');expect(state.jobs).toHaveLength(0);
 await panel.getByRole('combobox',{name:'Order processing',exact:true}).selectOption('end_to_end');await panel.getByRole('combobox',{name:'Demo playback speed',exact:true}).selectOption('1');await panel.getByLabel('Demo quantity',{exact:true}).fill('15');await panel.getByLabel('Deadline in simulated hours',{exact:true}).fill('24');
 state=await trigger();await page.getByRole('button',{name:'Pause clock',exact:true}).click();await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();
 expect(state.jobs.filter((j:{status:string})=>j.status==='running')).toHaveLength(3);expect(state.jobs.filter((j:{status:string})=>j.status==='planned')).toHaveLength(12);
 const active=state.jobs.filter((j:{status:string})=>j.status==='running');
 await panel.getByRole('combobox',{name:'Demo event',exact:true}).selectOption('urgent_order');await panel.getByLabel('Demo quantity',{exact:true}).fill('1');await panel.getByLabel('Deadline in simulated hours',{exact:true}).fill('5');
 state=await trigger();await page.getByRole('button',{name:'Pause clock',exact:true}).click();await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();
 const urgent=state.orders.at(-1);expect(state.jobs.find((j:{order_id:string})=>j.order_id===urgent.id).estimated_finish).toContain('T04:');expect(active.every((job:{id:string})=>state.jobs.find((j:{id:string})=>j.id===job.id).status==='running')).toBe(true);
 await panel.getByRole('combobox',{name:'Demo event',exact:true}).selectOption('thermal_fault');await panel.getByRole('combobox',{name:'Recovery mode',exact:true}).selectOption('automatic');state=await trigger();
 expect(state.printers[0].status).toBe('faulted');expect(state.incidents.at(-1).fault_type).toBe('thermal');expect(state.incidents.at(-1).applied).toBeTruthy();
 await panel.getByRole('combobox',{name:'Demo event',exact:true}).selectOption('printer_restored');await panel.getByRole('checkbox',{name:/I inspected/}).check();state=await trigger();
 expect(state.printers[0].status).toBe('running');expect(state.jobs.filter((j:{printer_id:string;status:string})=>j.printer_id===state.printers[0].id&&j.status==='planned').length).toBeGreaterThanOrEqual(2);
 await panel.getByRole('combobox',{name:'Demo event',exact:true}).selectOption('insufficient_filament');await panel.getByLabel('Available filament (g)',{exact:true}).fill('0');state=await trigger();expect(state.printers[0].status).toBe('faulted');expect(state.printers[0].material.grams).toBe(0);expect(state.incidents.at(-1).fault_type).toBe('insufficient_material');
 await panel.getByRole('combobox',{name:'Demo event',exact:true}).selectOption('printer_restored');await panel.getByRole('checkbox',{name:/I inspected/}).check();state=await trigger();expect(state.printers[0].material.grams).toBe(1000);
 await panel.getByText(/Scenario event history/).click();await expect(panel.getByText(/Original completion:/).first()).toBeVisible();await expect(panel.getByText(/Revised completion:/).first()).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 state=await command(page,'/api/advance',{seconds:86400});expect(state.orders.every((o:{quantity:number;successful_quantity:number})=>o.successful_quantity===o.quantity)).toBe(true);expect(state.controls.agents_enabled).toBe(false);
 const reset=await command(page,'/api/scenarios/reset',{scenario:'empty'});expect(reset.scenario_events).toHaveLength(0);expect(reset.incidents).toHaveLength(0);expect(reset.jobs).toHaveLength(0);
});

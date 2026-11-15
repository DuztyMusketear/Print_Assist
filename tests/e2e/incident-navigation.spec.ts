import {test,expect,type Page} from '@playwright/test';
async function state(page:Page){return (await page.request.get('/api/state')).json();}
async function command(page:Page,path:string,payload:object){const current=await state(page);const response=await page.request.post(path,{data:{session_id:current.session_id,expected_revision:current.revision,idempotency_key:crypto.randomUUID(),payload}});expect(response.ok()).toBe(true);return response.json();}

test('Overview leads navigation and keyboard brand navigation preserves production',async({page})=>{
 await page.goto('/');await command(page,'/api/scenarios/reset',{scenario:'seeded'});await page.reload();
 expect(await page.getByRole('tab').allTextContents()).toEqual(['Overview','Models','Orders','Schedule','Printers']);
 const before=await state(page);await page.getByRole('tab',{name:'Orders',exact:true}).click();
 await page.getByRole('button',{name:'Print Assist - Overview',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
 const after=await state(page);expect(after.orders).toEqual(before.orders);expect(after.jobs).toEqual(before.jobs);expect(after.session_id).toBe(before.session_id);
});

test('compact inspection exposes refill and clog clearance without opening a second disclosure',async({page})=>{
 await page.goto('/');await command(page,'/api/scenarios/reset',{scenario:'empty'});
 await command(page,'/api/incidents/inject',{printer_id:'printer-1',fault_type:'filament_runout',event_id:crypto.randomUUID()});await page.reload();
 const panel=page.getByRole('region',{name:'Incidents and schedule impact'});
 expect(await panel.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(220);
 await panel.getByRole('button',{name:'Inspect incident',exact:true}).click();
 const refill=panel.getByLabel('Refill stock (grams)',{exact:true});await expect(refill).toBeVisible();
 await expect(panel.getByRole('button',{name:'Mark resolved',exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Mark resolved',exact:true})).toBeDisabled();
 expect(await panel.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(850);
 await refill.fill('1000');await panel.getByRole('checkbox',{name:/I acknowledge/}).check();
 await command(page,'/api/advance',{seconds:1});await expect(page.locator('header').first()).toContainText('00:00:01');await expect(panel.getByRole('button',{name:'Mark resolved',exact:true})).toBeEnabled();
 await panel.getByRole('button',{name:'Mark resolved',exact:true}).click();await expect(panel.getByText('Equipment clearance recorded')).toBeVisible();
 await command(page,'/api/scenarios/reset',{scenario:'seeded'});await command(page,'/api/schedule',{mode:'automatic'});
 const fault=await command(page,'/api/incidents/inject',{printer_id:'printer-1',fault_type:'nozzle_clog',event_id:crypto.randomUUID()});
 const incident=fault.incidents.at(-1),proposal=await(await page.request.get('/api/incidents/'+incident.id+'/proposal')).json();
 await command(page,'/api/incidents/recover',{incident_id:incident.id,proposal_id:proposal.id,confirmed:true});await page.reload();
 await panel.getByRole('button',{name:'Inspect incident',exact:true}).click();
 await expect(panel.getByText(/Clear the nozzle clog, inspect the hotend/)).toBeVisible();await expect(panel.getByRole('button',{name:'Mark resolved',exact:true})).toBeVisible();
 await expect(panel.getByRole('table',{name:'Order schedule impact',exact:true})).toBeHidden();
 expect(await panel.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(850);
 await page.setViewportSize({width:390,height:844});await expect(panel.getByRole('button',{name:'Mark resolved',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await panel.getByRole('checkbox',{name:/I acknowledge/}).check();await panel.getByRole('button',{name:'Mark resolved',exact:true}).click();await expect(panel.getByText('Equipment clearance recorded')).toBeVisible();
});

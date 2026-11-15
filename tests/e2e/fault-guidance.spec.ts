import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
async function state(page:Page){return(await page.request.get('/api/state')).json();}
async function command(page:Page,path:string,payload:object){const current=await state(page);const response=await page.request.post(path,{data:{session_id:current.session_id,expected_revision:current.revision,idempotency_key:crypto.randomUUID(),payload}});expect(response.ok()).toBe(true);return response.json();}

test('material mismatch is explicit and an idle printer can load the required black spool',async({page})=>{
 await page.goto('/');await command(page,'/api/scenarios/reset',{scenario:'empty'});
 const uploaded=await command(page,'/api/library/models',{name:'Black fixture',filename:'black.stl',stl_base64:readFileSync('frontend/public/models/example-tower.stl').toString('base64'),duration_seconds:3600,filament_grams:10,filament_type:'PLA',color:'black',support_assessment:{supports_required:false}});
 const model=uploaded.artifacts.find((item:{name:string})=>item.name==='Black fixture');await page.reload();
 await expect(page.getByRole('button',{name:'Refresh queue',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'Orders',exact:true}).click();await page.getByLabel('Model to print',{exact:true}).selectOption(model.id);
 await expect(page.getByRole('note')).toContainText('No printer has black PLA loaded');await expect(page.getByText(/Loaded spools:/)).toContainText('blue PLA');
 await expect(page.getByLabel('Ship order by (UTC)',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Printers',exact:true}).click();await page.getByText('Load filament',{exact:true}).click();await page.getByRole('combobox',{name:'Filament action',exact:true}).selectOption('replace');
 await page.getByRole('combobox',{name:'Loaded filament color',exact:true}).selectOption('black');await page.getByRole('checkbox',{name:/I confirm this is the filament/}).check();await page.getByRole('button',{name:'Save loaded filament',exact:true}).click();
 await expect.poll(async()=>(await state(page)).printers[0].material.color).toBe('black');
 await page.getByRole('tab',{name:'Orders',exact:true}).click();await page.getByLabel('Model to print',{exact:true}).selectOption(model.id);await expect(page.getByRole('note')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('fault redistributes every feasible queued part despite shipping risk and inspection survives updates',async({page})=>{
 await page.goto('/');await command(page,'/api/scenarios/reset',{scenario:'empty'});
 await command(page,'/api/orders',{artifact_id:'figure-pla-blue',quantity:8,priority:0,production_due:'2026-11-15T01:00:00Z',ship_by:'2026-11-15T03:00:00Z'});
 const proposal=await(await page.request.get('/api/schedule/proposal')).json();await command(page,'/api/schedule/apply',{proposal_id:proposal.id,mode:'automatic',clock_speed:1});await command(page,'/api/clock',{running:false,speed:1});
 await command(page,'/api/incidents/policy',{mode:'automatic'});const before=await state(page),healthy=before.jobs.filter((job:{status:string;printer_id:string})=>job.status==='running'&&job.printer_id!=='printer-1');
 const failed=await command(page,'/api/incidents/inject',{printer_id:'printer-1',fault_type:'thermal',event_id:crypto.randomUUID()});
 expect(failed.incidents[0].applied).toBeTruthy();expect(failed.orders[0].recovery_holds).toHaveLength(0);expect(failed.forecasts[0].shipping_risk).toBe('late');
 expect(failed.jobs.filter((job:{status:string;printer_id:string})=>['running','planned'].includes(job.status)&&job.printer_id==='printer-1')).toHaveLength(0);expect(healthy.every((job:{id:string})=>failed.jobs.find((item:{id:string})=>item.id===job.id).status==='running')).toBe(true);
 await page.reload();await expect(page.getByText(/Ship-by deadline at risk:/)).toBeVisible();await page.getByRole('button',{name:'Inspect incident',exact:true}).click();await page.getByRole('checkbox',{name:/I acknowledge the simulated inspection/}).check();
 await command(page,'/api/advance',{seconds:1});await page.waitForResponse(response=>response.url().endsWith('/api/state'));
 await expect(page.getByRole('checkbox',{name:/I acknowledge the simulated inspection/})).toBeChecked();await expect(page.getByRole('button',{name:'Mark resolved',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Mark resolved',exact:true}).click();
 await expect.poll(async()=>(await state(page)).incidents[0].equipment_cleared).toBe(true);
 const done=await command(page,'/api/advance',{seconds:86400});expect(done.orders[0].successful_quantity).toBe(8);expect(done.incidents[0].status).toBe('resolved');
});

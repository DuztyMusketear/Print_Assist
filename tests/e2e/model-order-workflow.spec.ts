import {test,expect} from '@playwright/test';

test('upload and browse a saved model, review a visual deadline plan, confirm and monitor printing',async({page})=>{
 const external:string[]=[];
 await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}return route.continue();});
 await page.goto('/');
 await page.getByLabel('Scenario',{exact:true}).selectOption('empty');await page.getByRole('checkbox',{name:/I understand/}).check();await page.getByRole('button',{name:'Reset scenario',exact:true}).click();await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
 expect(await page.getByRole('tab').allTextContents()).toEqual(['Models','Orders','Schedule','Overview','Printers']);
 await page.getByRole('tab',{name:'Models',exact:true}).click();await page.getByRole('button',{name:'Upload a model',exact:true}).click();
 await page.getByLabel('STL model file',{exact:true}).setInputFiles('frontend/public/models/example-tower.stl');
 await page.getByLabel('Saved model name',{exact:true}).fill('Shop display tower');await page.getByLabel('Print time per item (minutes)',{exact:true}).fill('120');await page.getByLabel('Filament per item (grams)',{exact:true}).fill('25');
 await page.getByLabel('Support assessment',{exact:true}).selectOption('not-required');await page.getByRole('checkbox',{name:'I have reviewed the model and its print settings'}).check();
 await page.getByRole('button',{name:'Save print-ready model',exact:true}).click();await expect(page.getByRole('status')).toContainText('Model saved');
 await page.reload();await page.getByRole('tab',{name:'Models',exact:true}).click();await page.getByRole('combobox',{name:'Search models',exact:true}).fill('display');
 await expect(page.getByRole('img',{name:'3D preview of Shop display tower',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Print Shop display tower',exact:true}).click();await expect(page.getByRole('tab',{name:'Orders',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByLabel('Number of copies',{exact:true}).fill('4');
 // An impossible deadline stays editable and never starts printing.
 await page.getByLabel('Finish printing by (UTC)',{exact:true}).fill('2026-11-15T00:30');
 await page.getByRole('button',{name:'Review schedule first',exact:true}).click();await expect(page.getByRole('tab',{name:'Schedule',exact:true})).toHaveAttribute('aria-selected','true');
 expect((await (await page.request.get('/api/state')).json()).jobs).toHaveLength(0);
 await page.getByRole('button',{name:'Preview schedule',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm and start printing',exact:true})).toBeDisabled();await expect(page.getByText(/This plan cannot meet/)).toBeVisible();
 await page.getByRole('button',{name:/Inspect order/}).click();await page.getByText('Edit quantity and dates',{exact:true}).click();await page.getByLabel('Revised print deadline (UTC)',{exact:true}).fill('2026-11-16T00:00');await page.getByRole('button',{name:'Save order changes',exact:true}).click();await page.getByRole('button',{name:'Confirm changes',exact:true}).click();await expect(page.getByText('State changed. Preview again before applying.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Preview schedule',exact:true}).click();await expect(page.locator('.timeline-job.proposed')).toHaveCount(4);await expect(page.locator('.timeline-job').first().getByRole('img')).toBeVisible();
 await page.getByRole('button',{name:'Confirm and start printing',exact:true}).click();await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByRole('button',{name:'Pause clock',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Pause clock',exact:true}).click();await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();
 let state=await (await page.request.get('/api/state')).json();expect(state.jobs.filter((job:{status:string})=>job.status==='running')).toHaveLength(3);expect(state.jobs.filter((job:{status:string})=>job.status==='planned')).toHaveLength(1);
 const response=await page.request.post('/api/advance',{data:{session_id:state.session_id,expected_revision:state.revision,idempotency_key:crypto.randomUUID(),payload:{seconds:3600}}});expect(response.ok()).toBe(true);
 await page.getByRole('button',{name:'Refresh queue',exact:true}).click();await expect(page.locator('.printer-card').first().getByText(/50%|51%/)).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(external).toEqual([]);
});

test('example shop requests match saved models, remain held, and import or acceptance retries never duplicate orders',async({page})=>{
 await page.goto('/');await page.getByLabel('Scenario',{exact:true}).selectOption('empty');await page.getByRole('checkbox',{name:/I understand/}).check();await page.getByRole('button',{name:'Reset scenario',exact:true}).click();await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
 await page.getByRole('tab',{name:'Orders',exact:true}).click();await page.getByRole('button',{name:'Load example shop orders',exact:true}).click();await expect(page.locator('.inbox-request')).toHaveCount(3);
 await page.getByRole('button',{name:'Load example shop orders',exact:true}).click();await expect(page.locator('.inbox-request')).toHaveCount(3);
 await page.locator('.inbox-request').filter({hasText:'EXAMPLE-003'}).getByText('Request details',{exact:true}).click();await expect(page.getByRole('button',{name:'Review schedule for EXAMPLE-003',exact:true})).toBeDisabled();
 await page.getByLabel('Saved model for EXAMPLE-003',{exact:true}).selectOption('figure-pla-blue');await page.getByRole('button',{name:'Review schedule for EXAMPLE-003',exact:true}).click();await expect(page.getByRole('tab',{name:'Schedule',exact:true})).toHaveAttribute('aria-selected','true');
 const state=await (await page.request.get('/api/state')).json();expect(state.orders).toHaveLength(1);expect(state.orders[0].quantity).toBe(3);expect(state.jobs).toHaveLength(0);
 await page.getByRole('tab',{name:'Orders',exact:true}).click();await page.locator('.inbox-request').filter({hasText:'EXAMPLE-002'}).getByText('Request details',{exact:true}).click();await page.getByRole('button',{name:'Reject EXAMPLE-002',exact:true}).click();await expect(page.getByText('Rejected. No production order was created.',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('tab',{name:'Orders',exact:true}).click();await expect(page.locator('.request-status.accepted')).toHaveCount(1);await expect(page.locator('.request-status.rejected')).toHaveCount(1);
});

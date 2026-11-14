import {test,expect} from '@playwright/test';

test('compact planning warns early, labels calendar dates, and confirms queued edits and deletion',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 await page.getByLabel('Scenario',{exact:true}).selectOption('empty');await page.getByRole('checkbox',{name:/I understand/}).check();await page.getByRole('button',{name:'Reset scenario',exact:true}).click();await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
 await page.getByRole('tab',{name:'Models',exact:true}).click();await page.getByRole('button',{name:'Print Blue PLA figure',exact:true}).click();
 await expect(page.getByLabel('Model to print',{exact:true})).toHaveValue('figure-pla-blue');await page.getByLabel('Search models for this order',{exact:true}).fill('PLA');
 await page.getByLabel('Number of copies',{exact:true}).fill('20');await page.getByLabel('Finish printing by (UTC)',{exact:true}).fill('2026-11-15T03:00');await expect(page.getByText('Selected deadline or quantity conflicts with capacity',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Use 3 copies',exact:true})).toBeVisible();
 await expect(page.getByText(/Total estimated printer time: 40 h/)).toContainText('Estimated filament: 500.0 g / blue PLA');
 const review=await page.getByRole('button',{name:'Review schedule first',exact:true}).boundingBox();expect(review!.y+review!.height).toBeLessThan(1000);
 await page.getByRole('button',{name:'Review schedule first',exact:true}).click();await page.getByRole('button',{name:'Preview schedule',exact:true}).click();await expect(page.locator('.order-summary-card.conflict')).toHaveCount(1);
 await expect(page.locator('.order-summary-card')).toContainText('Est. printer time: 40 h');await expect(page.locator('.order-summary-card')).toContainText('Est. filament: 500.0 g / blue PLA');
 await page.getByRole('button',{name:'Week',exact:true}).click();await expect(page.getByLabel('Calendar axis')).toContainText('Nov');await page.getByRole('button',{name:'Month',exact:true}).click();await expect(page.getByLabel('Calendar axis')).toContainText('Week of');
 const warning=page.getByRole('list',{name:'Order color key'}).getByText(/Status: proposed.*Past production deadline/);await expect(warning).toBeVisible();expect(await warning.evaluate(el=>el.clientWidth>0&&getComputedStyle(el).overflow!=='hidden')).toBe(true);
 await page.getByRole('button',{name:/Inspect order/}).click();await page.getByText('Edit quantity and dates',{exact:true}).click();await page.getByLabel('Revised copies',{exact:true}).fill('3');await page.getByRole('button',{name:'Save order changes',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Confirm order changes?'})).toBeVisible();expect((await (await page.request.get('/api/state')).json()).orders[0].quantity).toBe(20);await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await (await page.request.get('/api/state')).json()).orders[0].quantity).toBe(20);
 await page.getByRole('button',{name:'Save order changes',exact:true}).click();await page.getByRole('button',{name:'Confirm changes',exact:true}).click();await expect.poll(async()=>(await (await page.request.get('/api/state')).json()).orders[0].quantity).toBe(3);
 await page.getByRole('button',{name:'Preview schedule',exact:true}).click();await page.getByRole('combobox',{name:'Proposed start mode',exact:true}).selectOption('manual');await page.getByRole('button',{name:'Preview schedule',exact:true}).click();await page.getByRole('button',{name:'Confirm manual schedule',exact:true}).click();
 await page.getByRole('tab',{name:'Schedule',exact:true}).click();await page.getByRole('button',{name:/Inspect order/}).click();await page.getByRole('button',{name:'Delete scheduled order',exact:true}).click();await expect(page.getByRole('dialog',{name:'Delete scheduled order?'})).toBeVisible();await page.getByRole('button',{name:'Confirm deletion',exact:true}).click();await expect(page.locator('.order-summary-card')).toHaveCount(0);
 const state=await (await page.request.get('/api/state')).json();expect(state.material_reservations.every((row:{reserved_grams:number})=>row.reserved_grams===0)).toBe(true);expect(state.printers.every((printer:{material:{grams:number}})=>printer.material.grams===1000)).toBe(true);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('separate orders retain distinct bar colors and readable keys on a compressed monthly timeline',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByLabel('Scenario',{exact:true}).selectOption('empty');await page.getByRole('checkbox',{name:/I understand/}).check();await page.getByRole('button',{name:'Reset scenario',exact:true}).click();await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
 for(let order=0;order<2;order++){
  await page.getByRole('tab',{name:'Orders',exact:true}).click();await page.getByRole('button',{name:'Review schedule first',exact:true}).click();await expect(page.getByRole('tab',{name:'Schedule',exact:true})).toHaveAttribute('aria-selected','true');
 }
 await page.getByRole('button',{name:'Preview schedule',exact:true}).click();await page.getByRole('button',{name:'Month',exact:true}).click();
 const key=page.getByRole('list',{name:'Order color key'});await expect(key.getByRole('listitem')).toHaveCount(2);await expect(key.getByText('Status: proposed',{exact:true})).toHaveCount(2);
 const colors=await key.getByRole('listitem').evaluateAll(rows=>rows.map(row=>(row as HTMLElement).style.getPropertyValue('--order-color')));
 expect(new Set(colors).size).toBe(2);
 const barColors=await page.locator('.timeline-job').evaluateAll(rows=>rows.map(row=>(row as HTMLElement).style.getPropertyValue('--order-color')));expect([...new Set(barColors)].sort()).toEqual([...colors].sort());
 expect(await key.getByText('Status: proposed',{exact:true}).evaluateAll(rows=>rows.every(row=>row.clientWidth>0&&getComputedStyle(row).overflow!=='hidden'))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('single incoming requests demonstrate manual inbox review and automatic matching with final confirmation',async({page})=>{
 await page.goto('/');await page.getByLabel('Scenario',{exact:true}).selectOption('empty');await page.getByRole('checkbox',{name:/I understand/}).check();await page.getByRole('button',{name:'Reset scenario',exact:true}).click();await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();await page.getByRole('tab',{name:'Orders',exact:true}).click();
 await page.getByRole('button',{name:'Simulate incoming order',exact:true}).click();await page.getByRole('button',{name:'Simulate order',exact:true}).click();await expect(page.locator('.request-status.pending')).toHaveCount(1);expect((await (await page.request.get('/api/state')).json()).orders).toHaveLength(0);
 await page.getByRole('button',{name:'Simulate incoming order',exact:true}).click();await page.getByLabel('Incoming process',{exact:true}).selectOption('automatic');await page.getByRole('button',{name:'Simulate order',exact:true}).click();await expect(page.getByRole('tab',{name:'Schedule',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByRole('button',{name:'Confirm and start printing',exact:true})).toBeEnabled();
 let state=await (await page.request.get('/api/state')).json();expect(state.orders).toHaveLength(1);expect(state.jobs).toHaveLength(0);await page.getByRole('button',{name:'Confirm and start printing',exact:true}).click();await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'Pause clock',exact:true}).click();await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();state=await (await page.request.get('/api/state')).json();expect(state.jobs.some((job:{status:string})=>job.status==='running')).toBe(true);
});

test('a manually reviewed incoming order reaches a printer only after scheduling and a manual start',async({page})=>{
 await page.goto('/');await page.getByLabel('Scenario',{exact:true}).selectOption('empty');await page.getByRole('checkbox',{name:/I understand/}).check();await page.getByRole('button',{name:'Reset scenario',exact:true}).click();await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
 await page.getByRole('tab',{name:'Orders',exact:true}).click();await page.getByText('How the order demo works',{exact:true}).click();await expect(page.getByText(/Manual: open Request details/)).toBeVisible();
 await page.getByRole('button',{name:'Simulate incoming order',exact:true}).click();await page.getByRole('button',{name:'Simulate order',exact:true}).click();
 const request=(await (await page.request.get('/api/state')).json()).shop_requests[0];expect(request.status).toBe('pending');
 await page.getByText('Request details',{exact:true}).click();await page.getByRole('button',{name:`Review schedule for ${request.id}`,exact:true}).click();
 await expect(page.getByRole('tab',{name:'Schedule',exact:true})).toHaveAttribute('aria-selected','true');expect((await (await page.request.get('/api/state')).json()).jobs).toHaveLength(0);
 await page.getByRole('combobox',{name:'Proposed start mode',exact:true}).selectOption('manual');await page.getByRole('button',{name:'Preview schedule',exact:true}).click();
 await expect(page.getByRole('list',{name:'Order color key'})).toContainText('Est. completion:');await expect(page.getByLabel(/Estimated order completion/)).toHaveCount(2);
 await page.getByRole('button',{name:'Confirm manual schedule',exact:true}).click();await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
 const planned=(await (await page.request.get('/api/state')).json());expect(planned.shop_requests[0].status).toBe('accepted');expect(planned.jobs.every((job:{status:string})=>job.status==='pending')).toBe(true);expect(planned.running).toBe(false);
 await page.getByRole('tab',{name:'Printers',exact:true}).click();await page.getByRole('button',{name:'Inspect Printer 1',exact:true}).click();await page.getByRole('button',{name:'Start print on Printer 1',exact:true}).click();await expect(page.locator('.printer-status')).toHaveText('running');
 await page.getByRole('button',{name:'Run clock',exact:true}).click();await expect.poll(async()=>(await (await page.request.get('/api/state')).json()).jobs[0].elapsed_seconds).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Pause clock',exact:true}).click();await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();
 const active=(await (await page.request.get('/api/state')).json());expect(active.jobs[0].status).toBe('running');expect(active.controls.agents_enabled).toBe(false);
});

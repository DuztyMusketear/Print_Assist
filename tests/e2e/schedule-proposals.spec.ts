import {test,expect} from '@playwright/test';

test('idle start guidance makes printing visible and reviewed schedules reserve future material once',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Scenario',{exact:true}).selectOption('empty');await page.getByRole('checkbox',{name:/I understand/}).check();
 await page.getByRole('button',{name:'Reset scenario',exact:true}).click();await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
 await expect(page.getByText(/No print jobs are assigned/)).toBeVisible();
 await page.getByRole('button',{name:'Start a new print',exact:true}).click();
 await page.getByLabel('Number of copies',{exact:true}).fill('2');await page.getByRole('button',{name:'Start automatic printing',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.getByText(/The simulation is running/)).toBeVisible();
 const canvas=page.locator('.printer-card canvas').first();const before=await canvas.screenshot();await page.waitForTimeout(180);const after=await canvas.screenshot();expect(before.equals(after)).toBe(false);
 await page.getByRole('button',{name:'Pause clock',exact:true}).click();await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Pause Printer 1',exact:true}).click();await expect(page.getByRole('button',{name:'Resume Printer 1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Resume Printer 1',exact:true}).click();await expect(page.locator('.printer-inspector').getByText('running',{exact:true})).toBeVisible();
 await page.getByLabel('Scenario',{exact:true}).selectOption('seeded');await page.getByRole('checkbox',{name:/I understand/}).check();await page.getByRole('button',{name:'Reset scenario',exact:true}).click();await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
 await page.getByRole('tab',{name:'Schedule',exact:true}).click();await page.getByRole('button',{name:'Preview schedule',exact:true}).click();
 await expect(page.locator('.schedule-proposal li').filter({hasText:'25 g'})).toHaveCount(5);
 let state=await (await page.request.get('/api/state')).json();expect(state.jobs).toHaveLength(0);
 await page.getByRole('button',{name:'Apply reviewed schedule',exact:true}).click();await expect(page.getByRole('button',{name:'Pause clock',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Pause clock',exact:true}).click();await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();
 state=await (await page.request.get('/api/state')).json();expect(state.jobs).toHaveLength(5);
 expect(state.material_reservations.reduce((sum:number,row:{stock_grams:number;reserved_grams:number})=>sum+row.stock_grams-row.reserved_grams,0)).toBeCloseTo(2875);
 const advance=await page.request.post('/api/advance',{data:{session_id:state.session_id,expected_revision:state.revision,idempotency_key:crypto.randomUUID(),payload:{seconds:14400}}});expect(advance.ok()).toBe(true);
 state=await advance.json();expect(state.orders.every((o:{quantity:number;successful_quantity:number})=>o.quantity===o.successful_quantity)).toBe(true);
 expect(state.material_reservations.reduce((sum:number,row:{reserved_grams:number})=>sum+row.reserved_grams,0)).toBe(0);
});


test('review-first model intake stays unassigned until a manual proposal is accepted',async({page})=>{
 await page.goto('/');await page.getByLabel('Scenario',{exact:true}).selectOption('empty');await page.getByRole('checkbox',{name:/I understand/}).check();await page.getByRole('button',{name:'Reset scenario',exact:true}).click();await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
 await page.getByRole('button',{name:'Start a new print',exact:true}).click();await page.getByLabel('Number of copies',{exact:true}).fill('4');await page.getByRole('button',{name:'Review schedule first',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Schedule',exact:true})).toHaveAttribute('aria-selected','true');
 expect((await (await page.request.get('/api/state')).json()).jobs).toHaveLength(0);
 await page.getByRole('combobox',{name:'Proposed start mode',exact:true}).selectOption('manual');await page.getByRole('button',{name:'Preview schedule',exact:true}).click();await expect(page.locator('.schedule-proposal li').filter({hasText:'25 g'})).toHaveCount(4);
 await page.getByRole('button',{name:'Apply reviewed schedule',exact:true}).click();await expect.poll(async()=>(await (await page.request.get('/api/state')).json()).jobs.length).toBe(4);
 const state=await (await page.request.get('/api/state')).json();expect(state.running).toBe(false);expect(state.jobs.filter((job:{status:string})=>job.status==='pending')).toHaveLength(3);expect(state.jobs.filter((job:{status:string})=>job.status==='planned')).toHaveLength(1);
});

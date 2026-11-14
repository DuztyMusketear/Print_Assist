import {test,expect} from '@playwright/test';

test('seeded production can pause, go offline, resume and complete before reset',async({page})=>{
  const external:string[]=[];
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.goto('/');
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reset scenario',exact:true})).toBeDisabled();
  await page.getByLabel('Scenario',{exact:true}).selectOption('seeded');
  await page.getByRole('checkbox',{name:/I understand/}).check();
  await page.getByRole('button',{name:'Reset scenario',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
  await openScheduleTools(page);
  await page.getByRole('button',{name:'Schedule automatically',exact:true}).click();
  await expect(page.locator('section li').filter({hasText:'running'}).first()).toBeVisible();
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await page.getByRole('button',{name:'Pause Printer 1',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resume Printer 1',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Take Printer 1 offline',exact:true}).click();
  await expect(page.getByRole('button',{name:'Bring Printer 1 online',exact:true})).toBeVisible();
  const before=await (await page.request.get('http://127.0.0.1:8000/api/state')).json();
  await openScheduleTools(page);
  await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/advance')),page.getByRole('button',{name:'Advance 1 hour',exact:true}).click()]);
  const stopped=await (await page.request.get('http://127.0.0.1:8000/api/state')).json();
  expect(stopped.jobs[0].elapsed_seconds).toBe(before.jobs[0].elapsed_seconds);
  expect(stopped.printers[0].material.grams).toBe(before.printers[0].material.grams);
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await page.getByRole('button',{name:'Bring Printer 1 online',exact:true}).click();
  await page.getByRole('button',{name:'Resume Printer 1',exact:true}).click();
  await expect(page.locator('.printer-status')).toHaveText('running');
  await openScheduleTools(page);
  for(let hour=0;hour<3;hour++) {
    await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/advance')),page.getByRole('button',{name:'Advance 1 hour',exact:true}).click()]);
  }
  const completed=await (await page.request.get('http://127.0.0.1:8000/api/state')).json();
  expect(completed.orders.every((order:{quantity:number;successful_quantity:number})=>order.quantity===order.successful_quantity)).toBe(true);
  await expect(page.getByRole('heading',{name:'Production activity',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await page.getByLabel('Scenario',{exact:true}).selectOption('empty');
  await page.getByRole('checkbox',{name:/I understand/}).check();
  await page.getByRole('button',{name:'Reset scenario',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
  const cleared=await (await page.request.get('http://127.0.0.1:8000/api/state')).json();
  expect(cleared.orders).toEqual([]);expect(cleared.jobs).toEqual([]);
  expect(cleared.controls).toEqual({agents_enabled:false,automatic_triggers:false});
  expect(external).toEqual([]);
});


test('automatic clock advances the live floor and updates forecasts without refresh',async({page})=>{
  await page.goto('/');
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await page.getByLabel('Scenario',{exact:true}).selectOption('seeded');
  await page.getByRole('checkbox',{name:/I understand/}).check();
  await page.getByRole('button',{name:'Reset scenario',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
  await openScheduleTools(page);
  await page.getByRole('button',{name:'Schedule automatically',exact:true}).click();
  await expect(page.locator('section li').filter({hasText:'running'}).first()).toBeVisible();
  await expect(page.getByText(/Estimated print completion:/).first()).toBeVisible();
  await page.getByLabel('Clock speed',{exact:true}).selectOption('3600');
  await expect.poll(async()=> (await (await page.request.get('/api/state')).json()).clock_speed).toBe(3600);
  await page.getByRole('button',{name:'Run clock',exact:true}).click();
  await expect(page.getByText(/completed.*of 4 requested/)).toContainText(/3 completed|4 completed/,{timeout:12000});
  await page.getByRole('button',{name:'Pause clock',exact:true}).click();
  await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();
});

async function openScheduleTools(page:import('@playwright/test').Page){await page.getByRole('tab',{name:'Schedule',exact:true}).click();if(await page.locator('details.advanced-schedule').getAttribute('open')===null)await page.getByText('Manual scheduling tools',{exact:true}).click();}

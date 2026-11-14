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
  await page.getByRole('tab',{name:'Schedule',exact:true}).click();
  await page.getByRole('button',{name:'Schedule automatically',exact:true}).click();
  await expect(page.locator('section li').filter({hasText:'running'}).first()).toBeVisible();
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await page.getByRole('button',{name:'Pause printer-1',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resume printer-1',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Take printer-1 offline',exact:true}).click();
  await expect(page.getByRole('button',{name:'Bring printer-1 online',exact:true})).toBeVisible();
  const before=await (await page.request.get('http://127.0.0.1:8000/api/state')).json();
  await page.getByRole('tab',{name:'Schedule',exact:true}).click();
  await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/advance')),page.getByRole('button',{name:'Advance 1 hour',exact:true}).click()]);
  const stopped=await (await page.request.get('http://127.0.0.1:8000/api/state')).json();
  expect(stopped.jobs[0].elapsed_seconds).toBe(before.jobs[0].elapsed_seconds);
  expect(stopped.printers[0].material.grams).toBe(before.printers[0].material.grams);
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await page.getByRole('button',{name:'Bring printer-1 online',exact:true}).click();
  await page.getByRole('button',{name:'Resume printer-1',exact:true}).click();
  await expect(page.locator('.printer-status')).toHaveText('running');
  await page.getByRole('tab',{name:'Schedule',exact:true}).click();
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

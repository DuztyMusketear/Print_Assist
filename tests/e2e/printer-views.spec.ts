import {test,expect} from '@playwright/test';

test('real 3D beds render; camera controls and example STL work offline',async({page})=>{
  const external:string[]=[];
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.goto('/');
  await expect(page.locator('.printer-canvas canvas')).toHaveCount(3);
  const beforeBox=await page.locator('.printer-floor').boundingBox();
  await page.evaluate(()=>{(window as unknown as {savedCanvas:Element|null}).savedCanvas=document.querySelector('.printer-canvas canvas');});
  await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/state')),page.getByRole('button',{name:'Refresh queue',exact:true}).click()]);
  expect(await page.evaluate(()=>(window as unknown as {savedCanvas:Element}).savedCanvas===document.querySelector('.printer-canvas canvas'))).toBe(true);
  expect((await page.locator('.printer-floor').boundingBox())?.height).toBe(beforeBox?.height);

  await expect(page.locator('.printer-canvas canvas')).toHaveCount(3);
  await expect(page.getByRole('heading',{name:'Virtual printers'})).toBeVisible();
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await expect(page.locator('.printer-canvas canvas')).toHaveCount(1);
  await page.getByRole('checkbox',{name:'Preview example part'}).check();
  await expect(page.getByText(/Example geometry/)).toBeVisible();
  await expect(page.getByText('Loading part model...')).toBeHidden();
  const canvas=page.locator('.printer-canvas canvas');
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate(element=>Boolean((element as HTMLCanvasElement).getContext('webgl2')))).toBe(true);
  const before=await canvas.screenshot();
  await page.getByRole('button',{name:'Rotate left',exact:true}).click();
  const after=await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
  await page.getByRole('button',{name:'Reset camera'}).click();
  await page.getByRole('slider',{name:'Example progress'}).fill('75');
  await expect(page.getByText('75%',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Inspect Printer 2'}).click();
  await expect(page.getByRole('checkbox',{name:'Preview example part'})).not.toBeChecked();
  await expect(page.getByText('Empty build plate')).toBeVisible();
  expect(external).toEqual([]);
});

test('WebGL failure retains readable printer statuses and fallback',async({page})=>{
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
  await page.goto('/');
  await expect(page.getByText(/3D preview unavailable/)).toHaveCount(3);
  await expect(page.getByText('Printer 1',{exact:true})).toBeVisible();
});

test('approved visual model flows through ordering, scheduling and real progress',async({page})=>{
  await page.goto('/');
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await page.getByLabel('Scenario',{exact:true}).selectOption('empty');
  await page.getByRole('checkbox',{name:/I understand/}).check();
  await page.getByRole('button',{name:'Reset scenario',exact:true}).click();
  await page.getByRole('tab',{name:'Models',exact:true}).click();
  await page.getByRole('button',{name:'Upload a model',exact:true}).click();
  const profile={title:'Visual tower order',modelReference:'tower.stl',duration_seconds:7200,filament_grams:25,filament_type:'PLA',color:'blue',visual_asset_id:'example-tower'};
  await page.getByLabel('STL model file',{exact:true}).setInputFiles('frontend/public/models/example-tower.stl');
  await page.getByLabel('Prepared estimate profile (optional)',{exact:true}).setInputFiles({name:'tower.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(profile))});
  await page.getByLabel('Support assessment',{exact:true}).selectOption('not-required');
  await page.getByRole('checkbox',{name:'I have reviewed the model and its print settings'}).check();
  await page.getByRole('button',{name:'Save print-ready model',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Model saved');
  await page.getByRole('button',{name:'Print Visual tower order',exact:true}).click();
  await page.getByRole('tab',{name:'Orders',exact:true}).click();
  await page.getByText('Custom order details',{exact:true}).click();
  await page.getByLabel('Print-ready product',{exact:true}).selectOption({label:'Visual tower order'});
  await page.getByLabel('Quantity',{exact:true}).fill('1');
  await page.getByLabel('Priority',{exact:true}).fill('999');
  await page.getByLabel('Production due (UTC)',{exact:true}).fill('2026-11-20T12:00');
  await page.getByLabel('Ship by (UTC)',{exact:true}).fill('2026-11-21T12:00');
  await page.getByRole('button',{name:'Add order',exact:true}).click();
  await expect(page.getByText('Visual tower order',{exact:true}).last()).toBeVisible();
  await openScheduleTools(page);
  await page.getByRole('button',{name:'Schedule automatically',exact:true}).click();
  await expect(page.locator('section li').filter({hasText:'running'}).first()).toBeVisible();
  await page.getByRole('button',{name:'Advance 1 hour',exact:true}).click();
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await expect(page.locator('.printer-card').getByText('Visual tower order',{exact:true})).toBeVisible();
  await expect(page.locator('.printer-card').getByText(/Part.*50%/)).toBeVisible();
  await expect(page.locator('.printer-card canvas')).toBeVisible();
  await expect(page.getByText('Loading part model...')).toBeHidden();
});

async function openScheduleTools(page:import('@playwright/test').Page){await page.getByRole('tab',{name:'Schedule',exact:true}).click();if(await page.locator('details.advanced-schedule').getAttribute('open')===null)await page.getByText('Manual scheduling tools',{exact:true}).click();}

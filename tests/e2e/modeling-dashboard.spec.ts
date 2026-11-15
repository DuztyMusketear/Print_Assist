import {test,expect} from '@playwright/test';

test('preset models expose a persistent five-color selector in Modeling',async({page})=>{
  const external:string[]=[];
  await page.route('**/*',route=>{
    const host=new URL(route.request().url()).hostname;
    if(host!=='127.0.0.1') {external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.goto('/');
  await resetEmpty(page);
  await page.getByRole('tab',{name:'Models'}).click();
  await page.getByRole('button',{name:'Send to modeling dashboard'}).first().click();
  const color=page.getByRole('combobox',{name:'Color for 3DBenchy'});
  await expect(color).toBeVisible();
  await expect(color.locator('option')).toHaveCount(5);
  await color.selectOption('red');
  await expect(color).toHaveValue('red');
  await page.reload();
  await openPreparation(page);
  await expect(page.getByRole('combobox',{name:'Color for 3DBenchy'})).toHaveValue('red');
  expect(external).toEqual([]);
});

test('sends a preset through modeling, support review, approval, and order selection',async({page})=>{
  const external:string[]=[];
  await page.route('**/*',route=>{
    const host=new URL(route.request().url()).hostname;
    if(host!=='127.0.0.1') {external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.goto('/');
  await resetEmpty(page);
  await page.getByRole('tab',{name:'Models'}).click();
  await page.getByRole('button',{name:'Send to modeling dashboard'}).first().click();
  const color=page.getByRole('combobox',{name:'Color for 3DBenchy'});
  await expect(color).toBeVisible();
  await color.selectOption('red');
  await expect(color).toHaveValue('red');
  await page.getByRole('button',{name:'Prepare supports'}).click();
  await page.getByLabel('Support requirement').selectOption('required');
  await page.getByLabel('Support file or slicer project (optional)').fill('benchy-supports.3mf');
  await page.getByLabel('Estimated support material grams (optional)').fill('3.5');
  await page.getByLabel('Support removal notes (optional)').fill('Remove supports from the bow after printing.');
  await page.getByRole('button',{name:'Send model and support assessment to review'}).click();
  await expect(page.getByRole('region',{name:'Review stage'})).toContainText('Supports required');
  await expect(page.getByRole('region',{name:'Review stage'})).toContainText('benchy-supports.3mf');
  await expect(page.getByRole('region',{name:'Review stage'})).toContainText('red');
  await page.getByRole('button',{name:'Approve model and supports'}).click();
  await expect(page.getByRole('region',{name:'Approved stage'})).toContainText('3DBenchy');
  await expect(page.getByRole('region',{name:'Approved stage'})).toContainText('Model and support data stored together');
  await page.getByRole('tab',{name:'Orders'}).click();
  await expect(page.getByLabel('Print-ready product',{exact:true})).toContainText('3DBenchy');
  await openPreparation(page);
  await page.getByRole('button',{name:'Remove 3DBenchy'}).click();
  await expect(page.getByRole('dialog',{name:'Confirm task removal'})).toBeVisible();
  await page.getByRole('button',{name:'Confirm removal'}).click();
  await expect(page.getByRole('region',{name:'Approved stage'})).not.toContainText('3DBenchy');
  expect(external).toEqual([]);
});

test('tracks a model through supports and review without external traffic',async({page})=>{
  const external:string[]=[];
  await page.route('**/*',route=>{
    const host=new URL(route.request().url()).hostname;
    if(host!=='127.0.0.1') {external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.goto('/');
  await resetEmpty(page);
  await page.getByRole('tab',{name:'Models'}).click();
  const organicStand=page.locator('.preset-model').filter({has:page.getByRole('heading',{name:'Organic Phone Stand'})});
  await organicStand.getByRole('button',{name:'Send to modeling dashboard'}).click();
  const task=page.locator('.work-card').filter({has:page.getByRole('heading',{name:'Organic Phone Stand',exact:true})});
  await task.getByRole('button',{name:'Prepare supports'}).click();
  await task.getByLabel('Support requirement').selectOption('required');
  await task.getByLabel('Support removal notes (optional)').fill('Remove supports from the handle after printing.');
  await task.getByRole('button',{name:'Send model and support assessment to review'}).click();
  await expect(task).toContainText('Supports required');
  await expect(task).toContainText('Remove supports from the handle after printing.');
  await task.getByRole('button',{name:'Request changes'}).click();
  await expect(page.getByRole('region',{name:'Modeling stage'})).toContainText('Review requested changes');
  await expect(page.getByRole('region',{name:'Modeling stage'})).toContainText('Organic Phone Stand');
  await page.getByRole('tab',{name:'Orders'}).click();
  await openPreparation(page);
  await expect(page.getByRole('region',{name:'Modeling stage'})).toContainText('Organic Phone Stand');
  await page.reload();
  await openPreparation(page);
  await expect(page.getByRole('region',{name:'Modeling stage'})).toContainText('Organic Phone Stand');
  expect(external).toEqual([]);
});

async function resetEmpty(page:import('@playwright/test').Page){
  await page.getByRole('tab',{name:'Printers',exact:true}).click();
  await page.getByLabel('Scenario',{exact:true}).selectOption('empty');
  await page.getByRole('checkbox',{name:/I understand/}).check();
  await page.getByRole('button',{name:'Reset scenario',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
}

async function openPreparation(page:import('@playwright/test').Page){await page.getByRole('tab',{name:'Models',exact:true}).click();if(await page.locator('details.preparation-tools').getAttribute('open')===null)await page.getByText('Model preparation & support review',{exact:true}).click();}

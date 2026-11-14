import {test,expect} from '@playwright/test';

test('tracks a model through supports and review without external traffic',async({page})=>{
  const external:string[]=[];
  await page.route('**/*',route=>{
    const host=new URL(route.request().url()).hostname;
    if(host!=='127.0.0.1') {external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Modeling dashboard'})).toBeVisible();
  await page.getByLabel('Model name').fill('Desk planter');
  await page.getByLabel('Model file reference').fill('planter-v2.stl');
  await page.getByRole('button',{name:'Add to modeling'}).click();
  await page.getByRole('button',{name:'Prepare supports'}).click();
  await page.getByRole('button',{name:'Send to review'}).click();
  await page.getByRole('button',{name:'Request changes'}).click();
  await expect(page.getByRole('region',{name:'Modeling stage'})).toContainText('Review requested changes');
  await page.getByRole('button',{name:'Orders'}).click();
  await page.getByRole('button',{name:'Dashboard'}).click();
  await expect(page.getByRole('region',{name:'Modeling stage'})).toContainText('Desk planter');
  expect(external).toEqual([]);
});

import {test,expect} from '@playwright/test';

test('tracks a model through supports and review without external traffic',async({page})=>{
  const external:string[]=[];
  await page.route('**/*',route=>{
    const host=new URL(route.request().url()).hostname;
    if(host!=='127.0.0.1') {external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.goto('/');
  await page.getByRole('tab',{name:'Modeling'}).click();
  await page.getByText('Model preparation (team only)',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Modeling dashboard'})).toBeVisible();
  const modelHelp=page.locator('#model-name-help');
  const helpIcon=page.getByRole('button',{name:'Help for Model name',exact:true});
  await expect(modelHelp).toBeHidden();
  await helpIcon.hover();
  await expect(modelHelp).toBeVisible();
  await expect(modelHelp).toContainText('Example: Dragon figurine');
  await page.getByRole('heading',{name:'Modeling dashboard'}).hover();
  await expect(modelHelp).toBeHidden();
  await helpIcon.focus();
  await expect(modelHelp).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modelHelp).toBeHidden();
  await page.getByLabel('Model name',{exact:true}).fill('Desk planter');
  await page.getByLabel('Model file reference',{exact:true}).fill('planter-v2.stl');
  await page.getByLabel('Estimated print minutes',{exact:true}).fill('60');
  await page.getByLabel('Estimated filament grams',{exact:true}).fill('30');
  await page.getByLabel('Filament type',{exact:true}).fill('PLA');
  await page.getByLabel('Filament color',{exact:true}).fill('blue');
  await page.getByRole('button',{name:'Add to modeling'}).click();
  await page.getByRole('button',{name:'Prepare supports'}).click();
  await page.getByRole('button',{name:'Send to review'}).click();
  await page.getByRole('button',{name:'Request changes'}).click();
  await expect(page.getByRole('region',{name:'Modeling stage'})).toContainText('Review requested changes');
  await page.getByRole('tab',{name:'Orders'}).click();
  await page.getByRole('tab',{name:'Modeling'}).click();
  await expect(page.getByRole('region',{name:'Modeling stage'})).toContainText('Desk planter');
  await page.reload();
  await page.getByRole('tab',{name:'Modeling'}).click();
  await expect(page.getByRole('region',{name:'Modeling stage'})).toContainText('Desk planter');
  expect(external).toEqual([]);
});

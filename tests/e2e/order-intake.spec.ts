import {test,expect} from '@playwright/test';
test('offline order intake survives a browser reload without external traffic',async({page})=>{
  const external:string[]=[];
  await page.route('**/*',route=>{
    const host=new URL(route.request().url()).hostname;
    if(host!=='127.0.0.1') {external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByText('Agents OFF · Offline prototype')).toBeVisible();
  await page.getByRole('tab',{name:'Orders'}).click();
  const initial=await page.locator('section li').count();
  await page.getByLabel('Quantity').fill('3');
  await page.getByLabel('Production due (UTC)').fill('2026-11-15T12:00');
  await page.getByLabel('Ship by (UTC)').fill('2026-11-16T12:00');
  await page.getByRole('button',{name:'Add order'}).click();
  await expect(page.locator('section li')).toHaveCount(initial+1);
  await expect(page.locator('section li').last()).toContainText('3 items');
  await page.reload();
  await expect(page.locator('section li')).toHaveCount(initial+1);
  expect(external).toEqual([]);
});

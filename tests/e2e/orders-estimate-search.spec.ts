import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
async function command(page:Page,path:string,payload:object){
 const state=await(await page.request.get('/api/state')).json();
 const response=await page.request.post(path,{data:{session_id:state.session_id,expected_revision:state.revision,idempotency_key:crypto.randomUUID(),payload}});
 expect(response.ok()).toBe(true);return response.json();
}

test('Orders keep checked capacity visible during live refreshes and search real saved models',async({page})=>{
 await command(page,'/api/scenarios/reset',{scenario:'empty'});
 const uploaded=await command(page,'/api/library/models',{name:'Red PETG boat',filename:'boat.stl',stl_base64:readFileSync('frontend/public/models/example-tower.stl').toString('base64'),duration_seconds:3600,filament_grams:12,filament_type:'PETG',color:'red',support_assessment:{supports_required:false}});
 const boat=uploaded.artifacts.find((model:{name:string})=>model.name==='Red PETG boat');
 let requests=0,holdNext=false,release:(()=>Promise<void>)|undefined;
 await page.route('**/api/orders/estimate',async route=>{
  requests++;const response=await route.fetch();
  if(holdNext){holdNext=false;release=()=>route.fulfill({response});}else await route.fulfill({response});
 });
 await page.clock.install();await page.goto('/');await page.getByRole('tab',{name:'Orders',exact:true}).click();await page.clock.runFor(300);
 const estimate=page.locator('.draft-estimate');await expect(estimate.getByText('Fits the selected deadline',{exact:true})).toBeVisible();await expect(estimate).toContainText('Last checked:');
 for(let poll=0;poll<6;poll++){
  await page.clock.runFor(1000);
  await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/state')),page.clock.runFor(1000)]);
  await expect(estimate.getByText('Fits the selected deadline',{exact:true})).toBeVisible();
 }
 expect(requests).toBe(1);
 await command(page,'/api/orders',{artifact_id:'figure-pla-blue',quantity:1,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z'});
 await command(page,'/api/schedule',{mode:'automatic'});
 await command(page,'/api/advance',{seconds:600});holdNext=true;
 await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/state')),page.clock.runFor(1000)]);
 await expect(estimate.getByText('Fits the selected deadline',{exact:true})).toBeVisible();
 await page.clock.runFor(5000);await expect.poll(()=>requests).toBe(2);await expect.poll(()=>Boolean(release)).toBe(true);
 await expect(estimate.getByText('Fits the selected deadline',{exact:true})).toBeVisible();await expect(estimate.getByText(/Checking current printer/)).toHaveCount(0);
 await release!();await expect(estimate.getByText('Fits the selected deadline',{exact:true})).toBeVisible();
 const search=page.getByLabel('Search models for this order',{exact:true});await search.fill('  boat  ');
 await expect(page.getByLabel('Model to print',{exact:true}).getByRole('option',{name:'Blue PLA figure',exact:true})).toHaveCount(0);await expect(page.getByLabel('Model to print',{exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'Review schedule first',exact:true})).toBeDisabled();
 await page.getByLabel('Model to print',{exact:true}).selectOption(boat.id);await expect(page.locator('.profile-estimates')).toContainText('red PETG');
 await search.fill('PETG');await expect(page.getByLabel('Model to print',{exact:true}).getByRole('option',{name:'Red PETG boat',exact:true})).toHaveCount(1);
 await search.fill('no such model');await expect(page.getByText('No models match. Try a different name, material or color.')).toBeVisible();await expect(page.getByLabel('Model to print',{exact:true})).toBeDisabled();await search.press('Enter');expect((await(await page.request.get('/api/state')).json()).orders).toHaveLength(1);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

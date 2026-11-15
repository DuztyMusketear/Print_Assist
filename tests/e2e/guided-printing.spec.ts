import {test,expect} from '@playwright/test';

test('prepared upload profile guides manual inspection and automatic quantity printing',async({page})=>{
 const external:string[]=[];
 await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}return route.continue();});
 await page.goto('/');
 await page.getByRole('tab',{name:'Printers',exact:true}).click();
 await page.getByLabel('Scenario',{exact:true}).selectOption('empty');
 await page.getByRole('checkbox',{name:/I understand/}).check();
 await page.getByRole('button',{name:'Reset scenario',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
 await page.getByRole('tab',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:'Upload a model',exact:true}).click();
 const profile={title:'Guided tower',modelReference:'tower.stl',duration_seconds:7200,filament_grams:25.125,filament_type:'PLA',color:'blue',visual_asset_id:'example-tower'};
 await page.getByLabel('STL model file',{exact:true}).setInputFiles('frontend/public/models/example-tower.stl');
 await page.getByLabel('Prepared estimate profile (optional)',{exact:true}).setInputFiles({name:'tower.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(profile))});
 await expect(page.getByLabel('Saved model name',{exact:true})).toHaveValue('Guided tower');
 await page.getByLabel('Support assessment',{exact:true}).selectOption('not-required');
 await page.getByRole('checkbox',{name:'I have reviewed the model and its print settings'}).check();
 await page.getByRole('button',{name:'Save print-ready model',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Model saved');
 await page.getByRole('button',{name:'Print Guided tower',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Model to print',exact:true})).toHaveValue(/^model-/);
 await page.getByLabel('Number of copies',{exact:true}).fill('4');
 await page.getByText('Advanced start options',{exact:true}).click();await page.getByRole('button',{name:'Plan manual printing',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Schedule',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByText('Manual scheduling tools',{exact:true}).click();await page.getByRole('button',{name:'Next: monitor printers',exact:true}).click();
 await page.getByRole('button',{name:'Inspect Printer 2',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Printer 2 details',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Start print on Printer 2',exact:true}).click();
 await expect(page.locator('.printer-inspector').getByText('running',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Run clock',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause clock',exact:true})).toBeVisible();
 // Keep this control workflow deterministic while the live-clock tests cover ticks.
 await page.getByRole('button',{name:'Pause clock',exact:true}).click();
 await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Pause Printer 2',exact:true}).click();
 await expect(page.locator('.printer-inspector').getByText('paused',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Resume Printer 2',exact:true}).click();
 await expect(page.locator('.printer-inspector').getByText('running',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'2. Choose model and quantity',exact:true}).click();
 await page.getByLabel('Number of copies',{exact:true}).fill('2');
 await page.getByText('Advanced start options',{exact:true}).click();await page.getByRole('button',{name:'Start automatic printing',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
 expect(external).toEqual([]);
 await page.getByRole('button',{name:'Pause clock',exact:true}).click();
 await expect(page.getByRole('button',{name:'Run clock',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Printers',exact:true}).click();
 await page.getByLabel('Scenario',{exact:true}).selectOption('empty');
 await page.getByRole('checkbox',{name:/I understand/}).check();
 await page.getByRole('button',{name:'Reset scenario',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:/I understand/})).not.toBeChecked();
});

async function openPreparation(page:import('@playwright/test').Page){await page.getByRole('tab',{name:'Models',exact:true}).click();if(await page.locator('details.preparation-tools').getAttribute('open')===null)await page.getByText('Model preparation & support review',{exact:true}).click();}

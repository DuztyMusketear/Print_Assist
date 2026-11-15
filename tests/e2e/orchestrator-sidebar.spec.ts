import {test,expect} from '@playwright/test';

test('reference sidebar combines scenarios and reset with a real unconfigured sign-in prompt',async({page})=>{
 await page.goto('/');
 const sidebar=page.getByRole('complementary',{name:'Production controls'});
 await expect(sidebar.getByRole('heading',{name:'Orchestrator',exact:true})).toBeVisible();
 await expect(sidebar.getByRole('heading',{name:'Scenario controls',exact:true})).toBeVisible();
 await expect(sidebar.getByRole('heading',{name:'Agent network',exact:true})).toBeVisible();
 await expect(sidebar.getByRole('heading',{name:'Reset workshop',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Reset simulation scenario',exact:true})).toHaveCount(0);
 const chat=page.getByRole('region',{name:'Orchestrator chat'});
 await expect(chat.getByText(/registered OpenAI client/)).toBeVisible();
 await expect(chat.getByRole('button',{name:'Continue with ChatGPT'})).toBeDisabled();
 await expect(chat.getByRole('button',{name:'Send message'})).toBeDisabled();
 const headings=await sidebar.locator(':scope > section > header h2').allTextContents();expect(headings).toEqual(['Orchestrator','Scenario controls','Agent network']);
 expect(await chat.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(17, 25, 35)');
 await sidebar.getByText('Demo scenarios',{exact:true}).click();await expect(sidebar.getByRole('button',{name:'Trigger simulated event'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('signed-in chat uses actual UI transport, retries the same request and never changes production',async({page})=>{
 const connected={configured:true,connected:true,account_label:'Offline test operator',message:'Connected',models:[{id:'offline-test-model',name:'Offline test model'}]};
 const disconnected={configured:true,connected:false,account_label:null,message:'Sign in to OpenAI to load available models.',models:[]};
 const bodies:unknown[]=[];
 await page.route('**/api/orchestrator/connection',route=>route.fulfill({json:connected}));
 await page.route('**/api/orchestrator/chat',async route=>{bodies.push(route.request().postDataJSON());if(bodies.length===1)return route.abort('failed');return route.fulfill({json:{reply:'Offline provider fixture: inspect current deadlines before proposing a schedule.',model:'offline-test-model',read_only:true}});});
 await page.route('**/api/orchestrator/logout',route=>route.fulfill({json:disconnected}));
 await page.goto('/');
 const before=await(await page.request.get('/api/state')).json();
 const chat=page.getByRole('region',{name:'Orchestrator chat'});
 await expect(chat.getByText('Offline test operator')).toBeVisible();
 await expect(page.getByText(/Manual assistant connected/)).toBeVisible();
 await chat.getByRole('button',{name:'Factory status',exact:true}).click();
 await chat.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(chat.getByRole('button',{name:'Retry message',exact:true})).toBeVisible();
 await chat.getByRole('button',{name:'Retry message',exact:true}).click();
 await expect(chat.getByRole('log')).toContainText('Offline provider fixture: inspect current deadlines');
 expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);
 const after=await(await page.request.get('/api/state')).json();expect(after.orders).toEqual(before.orders);expect(after.jobs).toEqual(before.jobs);
 await expect(chat.getByText(/Recommendations only/)).toBeVisible();
 await chat.getByRole('button',{name:'Sign out'}).click();await expect(chat.getByRole('button',{name:'Continue with ChatGPT'})).toBeEnabled();
 await expect(chat.getByRole('log')).not.toContainText('Offline provider fixture');
});

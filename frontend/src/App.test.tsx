import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import App from './App';
vi.mock('./components/OrchestratorPanel',()=>({OrchestratorPanel:({onConnectionChange}:{onConnectionChange:(value:{configured:boolean;connected:boolean;account_label:string|null;message:string;models:[]})=>void})=><section aria-label="Orchestrator chat"><h2>Orchestrator</h2><button onClick={()=>onConnectionChange({configured:true,connected:true,account_label:'Test account',message:'Connected',models:[]})}>Connect test assistant</button></section>}));
const monitoring=vi.hoisted(()=>({read:undefined as undefined|(()=>Promise<void>)}));
vi.mock('./monitoring',()=>({useMonitoring:(read:()=>Promise<void>)=>{monitoring.read=read;}}));
async function pollState(){await act(async()=>{void monitoring.read!();});}
vi.mock('./components/useOrderEstimate',()=>({useOrderEstimate:()=>({estimate:undefined,busy:false,error:''})}));
vi.mock('./printers/scene',()=>({mountScene:()=>({command:()=>{},update:()=>{},dispose:()=>{}})}));
import {state,orderedState} from './test-fixtures';

test('explicit end-to-end incoming demo navigates directly to printer monitoring',async()=>{
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state))).mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('tab',{name:'Orders'}));await user.click(screen.getByRole('button',{name:'Simulate incoming order'}));
 await user.selectOptions(screen.getByLabelText('Incoming process'),'end_to_end');await user.click(screen.getByRole('button',{name:'Simulate order'}));
 await waitFor(()=>expect(screen.getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true'));
 expect(JSON.parse(String(transport.mock.calls[1][1]?.body))).toMatchObject({payload:{mode:'end_to_end',clock_speed:3600}});
});

test('incident policy commands use shared guarded transport from overview and printer inspection',async()=>{
 const transport=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify(state)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByText('Incident settings'));await user.selectOptions(screen.getByLabelText('Simulation recovery policy'),'automatic');
 expect(transport.mock.calls.at(-1)?.[0]).toBe('/api/incidents/policy');
 await user.click(screen.getByRole('tab',{name:'Printers'}));await user.click(screen.getByText('Incident settings'));await user.selectOptions(screen.getByLabelText('Simulation recovery policy'),'automatic');
 expect(JSON.parse(String(transport.mock.calls.at(-1)?.[1]?.body))).toMatchObject({session_id:state.session_id,expected_revision:0,payload:{mode:'automatic'}});
});

test('major tabs follow model to order to schedule and land on overview',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(state)));
 render(<App/>);await screen.findByText(/No orders yet/);
 expect(screen.getAllByRole('tab').map(tab=>tab.textContent)).toEqual(['Overview','Models','Orders','Schedule','Printers']);
 expect(screen.getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true');
 expect(screen.queryByRole('button',{name:'Refresh queue'})).not.toBeInTheDocument();
});

test('selected printer controls send guarded commands and show their updated status',async()=>{
  const printer={id:'printer-1',status:'running',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,printers:[printer]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,printers:[{...printer,status:'paused'}]})));
  const user=userEvent.setup();render(<App/>);
  await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Printers'}));
  await user.click(screen.getByRole('button',{name:'Pause Printer 1'}));
  await screen.findByRole('button',{name:'Resume Printer 1'});
  expect(transport.mock.calls[1][0]).toBe('/api/printers/control');
});

test('reset ignores a pre-reset refresh response and shows the replacement scenario',async()=>{
  let finish!:(response:Response)=>void;
  const next={...state,session_id:'00000000-0000-4000-8000-000000000099'};
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(orderedState)))
    .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
    .mockResolvedValueOnce(new Response(JSON.stringify(next)));
  const user=userEvent.setup();render(<App/>);await screen.findByText(/2 items/);
  await pollState();
  await user.click(screen.getByRole('tab',{name:'Printers'}));
  await user.click(screen.getByRole('checkbox',{name:/I understand/}));
  await user.click(screen.getByRole('button',{name:'Reset scenario'}));
  await user.click(screen.getByRole('tab',{name:'Orders'}));
  await user.click(screen.getByText('Custom order details'));
  await screen.findByText(/No orders yet/);
  await act(async()=>finish(new Response(JSON.stringify(orderedState))));
  expect(screen.queryByText(/2 items/)).not.toBeInTheDocument();
});

test('uncertain reset can replay its original receipt after refresh discovers new session',async()=>{
  const next={...state,session_id:'00000000-0000-4000-8000-000000000099'};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockRejectedValueOnce(new Error('Reset response lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify(next)))
    .mockResolvedValueOnce(new Response(JSON.stringify(next)));
  const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Printers'}));
  await user.click(screen.getByRole('checkbox',{name:/I understand/}));
  await user.click(screen.getByRole('button',{name:'Reset scenario'}));
  await screen.findByText('Reset response lost');
  await pollState();
  await waitFor(()=>expect(transport).toHaveBeenCalledTimes(3));
  await user.click(screen.getByRole('button',{name:'Retry production command'}));
  await waitFor(()=>expect(transport).toHaveBeenCalledTimes(4));
  expect(transport.mock.calls[1][1]!.body).toBe(transport.mock.calls[3][1]!.body);
});

test.each([[false,'Advance 1 hour'],[true,'Advance 1 hour'],[false,'Schedule automatically'],[true,'Schedule automatically']] as const)('reset supersedes in-flight production without stale success or failure (%s, %s)',async(fails,action)=>{
  let finish!:(response:Response)=>void;let reject!:(error:Error)=>void;
  const printer={id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
  const original={...state,printers:[printer]};
  const next={...original,session_id:'00000000-0000-4000-8000-000000000099'};
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original)))
    .mockImplementationOnce(()=>new Promise((resolve,fail)=>{finish=resolve;reject=fail;}))
    .mockResolvedValueOnce(new Response(JSON.stringify(next)))
    .mockResolvedValueOnce(new Response('',{status:409}));
  const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
  await openScheduleTools(user);
  await user.click(screen.getByRole('button',{name:action}));
  await user.click(screen.getByRole('tab',{name:'Printers'}));
  await user.click(screen.getByRole('checkbox',{name:/I understand/}));
  await user.click(screen.getByRole('button',{name:'Reset scenario'}));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:/I understand/})).not.toBeChecked());
  await user.click(screen.getByRole('button',{name:'Pause Printer 1'}));
  await screen.findByText(/Production command failed/);
  await act(async()=>{if(fails)reject(new Error('Old error'));else finish(new Response(JSON.stringify({...original,revision:10})));});
  expect(screen.getByText(/Production command failed/)).toBeInTheDocument();
});

test('server restart releases an uncertain production envelope and server errors retain retry safety',async()=>{
  let reject!:(error:Error)=>void;
  const next={...state,session_id:'00000000-0000-4000-8000-000000000099'};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail;}))
    .mockResolvedValueOnce(new Response(JSON.stringify(next)))
    .mockResolvedValueOnce(new Response('',{status:500}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...next,revision:1})));
  const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
  await openScheduleTools(user);
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await pollState();
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Retry production command'})).not.toBeInTheDocument());
  await act(async()=>reject(new Error('Old request lost')));
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await screen.findByText(/outcome could not be confirmed/);
  await user.click(screen.getByRole('button',{name:'Retry production command'}));
  await waitFor(()=>expect(transport).toHaveBeenCalledTimes(5));
  expect(transport.mock.calls[3][1]!.body).toBe(transport.mock.calls[4][1]!.body);
});

test.each(['order','model'] as const)('late pre-reset %s replies cannot erase new-session retry keys',async(kind)=>{
  let finish!:(response:Response)=>void;
  const next={...state,session_id:'00000000-0000-4000-8000-000000000099'};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)));
  if(kind==='order') transport.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
    .mockResolvedValueOnce(new Response(JSON.stringify(next)))
    .mockRejectedValueOnce(new Error('New response lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify({...next,revision:1,orders:orderedState.orders})));
  else transport.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
    .mockResolvedValueOnce(new Response(JSON.stringify(next)))
    .mockResolvedValueOnce(new Response(JSON.stringify(next)))
    .mockRejectedValueOnce(new Error('New response lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify(next)))
    .mockResolvedValueOnce(new Response(JSON.stringify({...next,revision:1,modeling_tasks:[modelTask]})));
  const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
  async function enter() {
    await user.click(screen.getByRole('tab',{name:kind==='order'?'Orders':'Models'}));if(kind==='model')await openPreparation(user);
    if(kind==='model') await fillModel(user);
    else {
      await user.click(screen.getByText('Custom order details'));
      await user.type(screen.getByLabelText('Production due (UTC)'),'2026-11-20T12:00');
      await user.type(screen.getByLabelText('Ship by (UTC)'),'2026-11-21T12:00');
    }
    if(kind==='order') await user.click(screen.getByRole('button',{name:'Add order'}));
  }
  await enter();
  await user.click(screen.getByRole('tab',{name:'Printers'}));
  await user.click(screen.getByRole('checkbox',{name:/I understand/}));
  await user.click(screen.getByRole('button',{name:'Reset scenario'}));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:/I understand/})).not.toBeChecked());
  await enter();await screen.findByText('New response lost');
  await act(async()=>finish(new Response(JSON.stringify(orderedState))));
  if(kind==='order') await user.click(screen.getByRole('button',{name:'Add order'}));
  else await user.click(screen.getByRole('button',{name:'Retry preset model send'}));
  await waitFor(()=>expect(transport).toHaveBeenCalledTimes(kind==='order'?5:7));
  const previousCommandIndex=kind==='order'?3:4;
  const retryCommandIndex=kind==='order'?4:6;
  expect(JSON.parse(String(transport.mock.calls[previousCommandIndex][1]!.body)).idempotency_key).toBe(JSON.parse(String(transport.mock.calls[retryCommandIndex][1]!.body)).idempotency_key);
});

test.each(['conflict','success','rejection'] as const)('reset supersedes pending modeling %s and preserves a new-session retry',async(outcome)=>{
 let finish!:(response:Response)=>void;
 const original={...state,modeling_tasks:[modelTask]};
 const next={...original,session_id:'00000000-0000-4000-8000-000000000099',modeling_tasks:[{...modelTask,title:'Replacement model'}]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original)));
 if(outcome==='conflict')transport.mockResolvedValueOnce(new Response('',{status:409}));
 transport.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
 .mockResolvedValueOnce(new Response(JSON.stringify(next)))
 .mockRejectedValueOnce(new Error('New modeling response lost'))
 .mockResolvedValueOnce(new Response(JSON.stringify({...next,revision:1,modeling_tasks:[{...next.modeling_tasks[0],stage:'supports'}]})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await openPreparation(user);await user.click(screen.getByRole('button',{name:'Prepare supports'}));
 const beforeReset=outcome==='conflict'?3:2;
 await waitFor(()=>expect(transport).toHaveBeenCalledTimes(beforeReset));
 await user.click(screen.getByRole('tab',{name:'Printers'}));await user.click(screen.getByRole('checkbox',{name:/I understand/}));
 await user.click(screen.getByRole('button',{name:'Reset scenario'}));
 await waitFor(()=>expect(screen.getByRole('checkbox',{name:/I understand/})).not.toBeChecked());
 await openPreparation(user);await user.click(screen.getByRole('button',{name:'Prepare supports'}));
 await screen.findByText('New modeling response lost');
 await act(async()=>finish(outcome==='rejection'?new Response('',{status:422}):new Response(JSON.stringify({...original,revision:2}))));
 expect(transport).toHaveBeenCalledTimes(beforeReset+2);
 expect(screen.getByRole('heading',{name:'Replacement model'})).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Retry modeling change'}));
 await screen.findByRole('button',{name:'Send model and support assessment to review'});
 expect(transport.mock.calls[beforeReset+2][1]!.body).toBe(transport.mock.calls[beforeReset+1][1]!.body);
});

test('a modeling conflict refresh from a different scenario asks for a fresh selection',async()=>{
 const original={...state,modeling_tasks:[modelTask]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original)))
 .mockResolvedValueOnce(new Response('',{status:409}))
 .mockResolvedValueOnce(new Response(JSON.stringify({...original,session_id:'00000000-0000-4000-8000-000000000099'})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await openPreparation(user);
 await user.click(screen.getByRole('button',{name:'Prepare supports'}));
 await screen.findByText('The demo scenario changed. Select the preset again.');
 expect(transport).toHaveBeenCalledTimes(3);
});

test.each([422,409])('a rejected modeling command releases its envelope for a different action (%s)',async(status)=>{
 const original={...state,modeling_tasks:[modelTask]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original)))
 .mockResolvedValueOnce(new Response('',{status}));
 if(status===409)transport.mockResolvedValueOnce(new Response(JSON.stringify(original))).mockResolvedValueOnce(new Response('',{status:422}));
 transport.mockResolvedValueOnce(new Response(JSON.stringify({...original,revision:1,modeling_tasks:[{...modelTask,color:'red'}]})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await openPreparation(user);
 await user.click(screen.getByRole('button',{name:'Prepare supports'}));await screen.findByRole('alert');
 await user.selectOptions(screen.getByRole('combobox',{name:'Color for Planter'}),'red');
 await waitFor(()=>expect(screen.getByRole('combobox',{name:'Color for Planter'})).toHaveValue('red'));
 expect(JSON.parse(String(transport.mock.calls.at(-1)![1]!.body)).payload.action).toBe('set-color');
});

test('a modeling conflict refresh preserves a newer same-session snapshot',async()=>{
 let finish!:(response:Response)=>void;
 const original={...state,modeling_tasks:[modelTask]};
 const newer={...original,revision:3,modeling_tasks:[{...modelTask,title:'Newer title'}]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original)))
 .mockResolvedValueOnce(new Response('',{status:409}))
 .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
 .mockResolvedValueOnce(new Response(JSON.stringify(newer)))
 .mockResolvedValueOnce(new Response(JSON.stringify({...original,revision:2})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await openPreparation(user);
 await user.click(screen.getByRole('button',{name:'Prepare supports'}));await waitFor(()=>expect(transport).toHaveBeenCalledTimes(3));
 await pollState();await screen.findByRole('heading',{name:'Newer title'});
 await act(async()=>finish(new Response(JSON.stringify({...original,revision:1}))));
 expect(screen.getByRole('heading',{name:'Newer title'})).toBeInTheDocument();
 expect(JSON.parse(String(transport.mock.calls[4][1]!.body)).expected_revision).toBe(1);
});

test.each(['monitor','preflight'] as const)('a changed scenario during preset %s prevents an obsolete model command',async(change)=>{
 let finish!:(response:Response)=>void;
 const next={...state,session_id:'00000000-0000-4000-8000-000000000099'};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
 .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
 .mockResolvedValueOnce(new Response(JSON.stringify(next)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('tab',{name:'Models'}));await fillModel(user);
 await waitFor(()=>expect(transport).toHaveBeenCalledTimes(2));
 if(change==='monitor')await pollState();
 await act(async()=>finish(new Response(JSON.stringify(change==='monitor'?state:next))));
 expect(transport.mock.calls.some(([url])=>url==='/api/modeling/tasks')).toBe(false);
 if(change==='preflight')await screen.findByText('The production state changed. Retry sending this preset to modeling.');
});

test('same-session background monitoring does not cancel a pending preset send',async()=>{
 let finish!:(response:Response)=>void;
 const task={...modelTask,title:'3DBenchy'};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
 .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
 .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1})))
 .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:2,modeling_tasks:[task]})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('tab',{name:'Models'}));await fillModel(user);await waitFor(()=>expect(transport).toHaveBeenCalledTimes(2));
 await pollState();await waitFor(()=>expect(transport).toHaveBeenCalledTimes(3));
 await act(async()=>finish(new Response(JSON.stringify({...state,revision:1}))));
 await screen.findByRole('combobox',{name:'Color for 3DBenchy'});
 expect(transport.mock.calls[3][0]).toBe('/api/modeling/tasks');
});

test('sending a preset preserves newer displayed state while using its refreshed revision',async()=>{
 const original={...state,revision:3,modeling_tasks:[modelTask]};
 let finish!:(response:Response)=>void;
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original)))
 .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:2})))
 .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await openPreparation(user);
 await fillModel(user);await waitFor(()=>expect(transport).toHaveBeenCalledTimes(3));
 expect(screen.getByRole('heading',{name:'Planter'})).toBeInTheDocument();
 expect(JSON.parse(String(transport.mock.calls[2][1]!.body)).expected_revision).toBe(2);
 await act(async()=>finish(new Response(JSON.stringify(original))));
});

test('modeling is available alongside the default production overview',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)));
  const user=userEvent.setup();
  render(<App/>);
  await screen.findByText(/No orders yet/);
  expect(screen.getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true');
  await openPreparation(user);
  expect(screen.getByRole('heading',{name:'Modeling dashboard'})).toBeVisible();
});

test('preset action opens modeling and creates a task directly without an intake form',async()=>{
 const presetTask={...modelTask,title:'3DBenchy',modelReference:'https://www.printables.com/model/3161-3d-benchy'};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state))).mockResolvedValueOnce(new Response(JSON.stringify(state))).mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,modeling_tasks:[presetTask]})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('tab',{name:'Models'}));
 await user.click(screen.getAllByRole('button',{name:'Send to modeling dashboard'})[0]);
 await screen.findByRole('button',{name:'Prepare supports'});
 expect(screen.queryByRole('heading',{name:'Add a model task'})).not.toBeInTheDocument();
 expect(await screen.findByRole('combobox',{name:'Color for 3DBenchy'})).toBeVisible();
 expect(transport.mock.calls[2][0]).toBe('/api/modeling/tasks');
 expect(JSON.parse(String(transport.mock.calls[2][1]!.body)).payload).toMatchObject({title:'3DBenchy',modelReference:'https://www.printables.com/model/3161-3d-benchy'});
 expect((document.querySelector('details.preparation-tools') as HTMLDetailsElement|null)?.open).toBe(true);
 expect(transport).toHaveBeenCalledTimes(3);
});

test('retries a stale modeling revision against refreshed state automatically',async()=>{
  const original={...state,modeling_tasks:[modelTask]};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original)))
    .mockResolvedValueOnce(new Response(JSON.stringify({detail:'Stale revision; refresh state before submitting'}),{status:409}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...original,revision:1})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...original,revision:2,modeling_tasks:[{...modelTask,stage:'supports',support_task:{id:'support-1',assessment_status:'pending'}}]})));
  const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
  await openPreparation(user);
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await screen.findByRole('combobox',{name:'Support requirement'});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(transport.mock.calls[2][0]).toBe('/api/state');
  expect(transport.mock.calls[3][0]).toBe('/api/modeling/actions');
});

async function fillModel(user:ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button',{name:'Send to modeling dashboard'})[0]);
}

const modelTask={id:'model-1',title:'Planter',modelReference:'planter.stl',stage:'modeling',duration_seconds:3600,filament_grams:30,filament_type:'PLA',color:'blue',required_capabilities:['FFF']};

test('modeling task color selection persists through the modeling action API',async()=>{
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[modelTask]}))).mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,modeling_tasks:[{...modelTask,color:'red'}]})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await openPreparation(user);
 await user.selectOptions(screen.getByRole('combobox',{name:'Color for Planter'}),'red');
 await waitFor(()=>expect(screen.getByRole('combobox',{name:'Color for Planter'})).toHaveValue('red'));
 expect(transport.mock.calls[1][0]).toBe('/api/modeling/actions');
 expect(JSON.parse(String(transport.mock.calls[1][1]!.body)).payload).toEqual({task_id:'model-1',action:'set-color',color:'red'});
});

test('saved modeling tasks can be created and moved through server commands',async()=>{
  const user=userEvent.setup();
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,modeling_tasks:[modelTask]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:2,modeling_tasks:[{...modelTask,stage:'supports',support_task:{id:'support-1',assessment_status:'pending'}}]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:3,modeling_tasks:[{...modelTask,stage:'review',support_task:{id:'support-1',assessment_status:'ready-for-review',supports_required:true}}]})));
  render(<App/>); await screen.findByText(/No orders yet/);
  await openPreparation(user);
  await fillModel(user);
  await user.click(await screen.findByRole('button',{name:'Prepare supports'}));
  await user.selectOptions(await screen.findByRole('combobox',{name:'Support requirement'}),'required');
  await user.click(screen.getByRole('button',{name:'Send model and support assessment to review'}));
  await screen.findByRole('button',{name:'Approve model and supports'});
  expect(String(transport.mock.calls[2][0])).toBe('/api/modeling/tasks');
  expect(String(transport.mock.calls[3][0])).toBe('/api/modeling/actions');
  const reviewCommand=JSON.parse(String(transport.mock.calls[4][1]!.body));
  expect(reviewCommand.payload.support_assessment.supports_required).toBe(true);
});

test('saved modeling tasks can be removed through a revisioned server command',async()=>{
  const user=userEvent.setup();
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[modelTask]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,modeling_tasks:[]})));
  render(<App/>); await screen.findByText(/No orders yet/);
  await openPreparation(user);
  await user.click(screen.getByRole('button',{name:'Remove Planter'}));
  await user.click(screen.getByRole('button',{name:'Confirm removal'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Remove Planter'})).not.toBeInTheDocument());
  expect(transport.mock.calls[1][0]).toBe('/api/modeling/actions');
  const command=JSON.parse(String(transport.mock.calls[1][1]!.body));
  expect(command.payload).toEqual({task_id:'model-1',action:'remove'});
});

test('blocks approved-task removal when the artifact appears in an order',async()=>{
  const task={...modelTask,stage:'approved'};
  const usedOrder={...orderedState.orders[0],artifact_id:'model-model-1'};
  const artifact={...state.artifacts[0],id:'model-model-1',name:'Planter'};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[task],orders:[usedOrder],artifacts:[...state.artifacts,artifact]})));
  const user=userEvent.setup();render(<App/>);
  await screen.findByRole('heading',{name:'Production queue (1)'});
  await openPreparation(user);
  await user.click(screen.getByRole('button',{name:'Remove Planter'}));
  expect(screen.getByRole('alert')).toHaveTextContent('approved artifact is already used by an order');
  expect(screen.queryByRole('dialog',{name:'Confirm task removal'})).not.toBeInTheDocument();
  expect(transport).toHaveBeenCalledTimes(1);
});

test('modeling handles uncertain retries, blocks different changes, and reports rejection',async()=>{
  const user=userEvent.setup();
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[modelTask]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[modelTask]})))
    .mockRejectedValueOnce(new Error('Response lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,modeling_tasks:[modelTask]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({detail:'Stale revision; refresh state before submitting'}),{status:409}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,modeling_tasks:[modelTask]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:2,modeling_tasks:[modelTask]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:2,modeling_tasks:[modelTask]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:3,modeling_tasks:[{...modelTask,stage:'supports',support_task:{id:'support-1',assessment_status:'pending'}}]})));
  render(<App/>); await screen.findByText(/No orders yet/);
  await openPreparation(user);
  await fillModel(user);
  await screen.findByText('Response lost');
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await screen.findByText('Retry the previous modeling change first.');
  await user.click(screen.getByRole('button',{name:'Retry preset model send'}));
  await screen.findByRole('button',{name:'Prepare supports'});
  await user.click(screen.getByRole('button',{name:'Retry modeling change'}));
  await screen.findByRole('button',{name:'Prepare supports'});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(JSON.parse(String(transport.mock.calls[2][1]!.body)).idempotency_key).toBe(JSON.parse(String(transport.mock.calls[4][1]!.body)).idempotency_key);
  expect(JSON.parse(String(transport.mock.calls[6][1]!.body)).idempotency_key).not.toBe(JSON.parse(String(transport.mock.calls[4][1]!.body)).idempotency_key);
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await waitFor(()=>expect(transport).toHaveBeenCalledTimes(9));
});

test('late modeling results cannot roll back refreshed production state',async()=>{
  let finish!:(response:Response)=>void;
  const user=userEvent.setup();
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[modelTask]})))
    .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:3,modeling_tasks:[{...modelTask,stage:'review'}]})));
  render(<App/>); await screen.findByText(/No orders yet/);
  await openPreparation(user);
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await pollState();
  await screen.findByRole('button',{name:'Approve model and supports'});
  await act(async()=>finish(new Response(JSON.stringify({...state,revision:1,modeling_tasks:[{...modelTask,stage:'supports'}]}))));
  expect(screen.getByRole('button',{name:'Approve model and supports'})).toBeInTheDocument();
});

test('lost modeling action can be retried after refresh changes its stage',async()=>{
  const user=userEvent.setup();
  const newer={...state,revision:1,modeling_tasks:[{...modelTask,stage:'supports'}]};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[modelTask]})))
    .mockRejectedValueOnce(new Error('Response lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify(newer)))
    .mockResolvedValueOnce(new Response(JSON.stringify(newer)));
  render(<App/>); await screen.findByText(/No orders yet/);
  await openPreparation(user);
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await screen.findByText('Response lost');
  await pollState();
  await screen.findByRole('button',{name:'Send model and support assessment to review'});
  await user.click(screen.getByRole('button',{name:'Retry modeling change'}));
  await waitFor(()=>expect(screen.queryByText('Response lost')).not.toBeInTheDocument());
  expect(transport.mock.calls[1][1]!.body).toBe(transport.mock.calls[3][1]!.body);
});

test('modeling retry failures are visible and a new session releases pending work',async()=>{
  const user=userEvent.setup();
  const newer={...state,session_id:'00000000-0000-4000-8000-000000000099',modeling_tasks:[modelTask]};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[modelTask]})))
    .mockRejectedValueOnce(new Error('Lost response'))
    .mockRejectedValueOnce(new Error('Still disconnected'))
    .mockResolvedValueOnce(new Response(JSON.stringify(newer)))
    .mockResolvedValueOnce(new Response(JSON.stringify(newer)));
  render(<App/>); await screen.findByText(/No orders yet/);
  await openPreparation(user);
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await screen.findByText('Lost response');
  await user.click(screen.getByRole('button',{name:'Retry modeling change'}));
  await screen.findByText('Still disconnected');
  await pollState();
  await waitFor(()=>expect(screen.queryByText('Still disconnected')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await waitFor(()=>expect(transport).toHaveBeenCalledTimes(5));
  expect(JSON.parse(String(transport.mock.calls[4][1]!.body)).session_id).toBe(newer.session_id);
});

test('overview shows simulated printers and tabs open the order workspace',async()=>{
  const user=userEvent.setup();
  const printers=[1,2,3].map(number=>({id:`printer-${number}`,status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}));
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,printers})));
  render(<App/>);
  expect(await screen.findByText('Printer 1')).toBeInTheDocument();
  expect(screen.getByText('Printer 3')).toBeInTheDocument();
  expect(screen.queryByRole('heading',{name:'New production order'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Production summary')).toBeInTheDocument();
  await user.click(screen.getByRole('tab',{name:'Orders'}));
  await user.click(screen.getByText('Custom order details'));
  expect(screen.getByRole('heading',{name:'New production order'})).toBeInTheDocument();
});

test('schedule tab submits automatic scheduling and displays running work',async()=>{
  const user=userEvent.setup();
  const running={...state,revision:1,jobs:[{id:'job-1',order_id:'order-1',printer_id:'printer-1',status:'running'}]};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockResolvedValueOnce(new Response(JSON.stringify(running)));
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await openScheduleTools(user);
  await user.click(screen.getByRole('button',{name:'Schedule automatically'}));
  expect(await screen.findByText(/Part 1/)).toBeInTheDocument();
  expect(String(transport.mock.calls[1][0])).toBe('/api/schedule');
  expect(JSON.parse(String(transport.mock.calls[1][1]!.body)).payload.mode).toBe('automatic');
});

test('operator can start a pending job and advance simulation time',async()=>{
  const user=userEvent.setup();
  const pending={...state,jobs:[{id:'job-1',order_id:'order-1',printer_id:'printer-1',status:'pending'}]};
  const running={...pending,revision:1,jobs:[{...pending.jobs[0],status:'running'}]};
  const completed={...running,revision:2,jobs:[{...running.jobs[0],status:'completed'}]};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(pending)))
    .mockResolvedValueOnce(new Response(JSON.stringify(running)))
    .mockResolvedValueOnce(new Response(JSON.stringify(completed)));
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await openScheduleTools(user);
  await user.click(screen.getByRole('button',{name:'Start Part 1'}));
  await screen.findByText(/running/);
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await screen.findByText(/completed/);
  expect(String(transport.mock.calls[1][0])).toBe('/api/start');
  expect(String(transport.mock.calls[2][0])).toBe('/api/advance');
});

test('operator can resume a paused job after restart',async()=>{
  const paused={...state,jobs:[{id:'job-1',order_id:'order-1',printer_id:'printer-1',status:'paused'}]};
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(paused)))
    .mockResolvedValueOnce(new Response(JSON.stringify({...paused,revision:1,jobs:[{...paused.jobs[0],status:'running'}]})));
  const user=userEvent.setup();
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await openScheduleTools(user);
  await user.click(screen.getByRole('button',{name:'Resume Part 1'}));
  expect(await screen.findByText(/running/)).toBeInTheDocument();
});

test('schedule and production failures are visible and can be retried',async()=>{
  const user=userEvent.setup();
  const pending={...state,jobs:[{id:'job-1',order_id:'order-1',printer_id:'printer-1',status:'pending'}]};
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(pending)))
    .mockResolvedValueOnce(new Response('',{status:409}))
    .mockResolvedValueOnce(new Response('',{status:409}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...pending,revision:1})));
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await openScheduleTools(user);
  await user.click(screen.getByRole('button',{name:'Schedule for manual start'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Scheduling failed');
  await user.click(screen.getByRole('button',{name:'Start Part 1'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Production command failed');
  await user.click(screen.getByRole('button',{name:'Schedule for manual start'}));
  await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('late scheduling and production results cannot replace a newer session',async()=>{
  const user=userEvent.setup();
  let finishSchedule!:(response:Response)=>void;
  let finishAdvance!:(response:Response)=>void;
  const newer={...orderedState,session_id:'00000000-0000-4000-8000-000000000099',revision:3,jobs:[{status:'running',printer_id:'printer-1'}]};
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockImplementationOnce(()=>new Promise(resolve=>{finishSchedule=resolve;}))
    .mockResolvedValueOnce(new Response(JSON.stringify(newer)))
    .mockImplementationOnce(()=>new Promise(resolve=>{finishAdvance=resolve;}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...newer,revision:4})));
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await openScheduleTools(user);
  await user.click(screen.getByRole('button',{name:'Schedule automatically'}));
  await pollState();
  await screen.findByText(/2 items/);
  await act(async()=>finishSchedule(new Response(JSON.stringify(orderedState))));
  expect(screen.getByText(/2 items/)).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await pollState();
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(5));
  await act(async()=>finishAdvance(new Response(JSON.stringify({...newer,revision:2}))));
  expect(screen.getByText(/2 items/)).toBeInTheDocument();
});

test('uncertain advance retry reuses its command key',async()=>{
  const user=userEvent.setup();
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockRejectedValueOnce(new Error('Response lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1})));
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await openScheduleTools(user);
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(JSON.parse(String(transport.mock.calls[1][1]!.body)).idempotency_key)
    .toBe(JSON.parse(String(transport.mock.calls[2][1]!.body)).idempotency_key);
});

test('an uncertain command must be retried before another production action',async()=>{
  const user=userEvent.setup();
  const pending={...state,jobs:[{id:'job-1',order_id:'order-1',printer_id:'printer-1',status:'pending'}]};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(pending)))
    .mockRejectedValueOnce(new Error('Response lost'));
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await openScheduleTools(user);
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button',{name:'Start Part 1'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Retry the previous production command');
  expect(transport).toHaveBeenCalledTimes(2);
});

test('a rejected stale production command can be retried after refresh',async()=>{
  const user=userEvent.setup();
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockResolvedValueOnce(new Response('',{status:409}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:2})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:3})));
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await openScheduleTools(user);
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await screen.findByRole('alert');
  await pollState();
  await waitFor(()=>expect(transport).toHaveBeenCalledTimes(3));
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(JSON.parse(String(transport.mock.calls[3][1]!.body)).expected_revision).toBe(2);
});

test('overview displays the current job and its progress for a printer',async()=>{
  const printer={id:'printer-1',status:'running',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
  const current={...state,printers:[printer],jobs:[{id:'job-1',order_id:'order-1',printer_id:'printer-1',status:'running',elapsed_seconds:3600,duration_seconds:7200}]};
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(current)));
  render(<App/>);
  expect(await screen.findByText(/Part 1/)).toBeInTheDocument();
  expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0);
});

test('overview handles a job without progress fields',async()=>{
  const printer={id:'printer-1',status:'running',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
  const current={...state,printers:[printer],jobs:[{id:'job-1',order_id:'order-1',printer_id:'printer-1',status:'running'}]};
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(current)));
  render(<App/>);
  expect(await screen.findByText(/Part 1.*0%/)).toBeInTheDocument();
});

test('loads state, saves an order, and refreshes the queue with agents OFF',async()=>{
  const user=userEvent.setup();
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockResolvedValueOnce(new Response(JSON.stringify(orderedState)))
    .mockResolvedValueOnce(new Response(JSON.stringify(orderedState)));
  render(<App/>);
  expect(screen.getByText(/Waiting for production state/)).toBeInTheDocument();
  expect(await screen.findByText(/No orders yet/)).toBeInTheDocument();
  expect(screen.getByText(/Agents OFF/)).toBeInTheDocument();
  await user.click(screen.getByRole('tab',{name:'Orders'}));
  await user.click(screen.getByText('Custom order details'));
  await user.type(screen.getByLabelText('Production due (UTC)'),'2026-11-15T12:00');
  await user.type(screen.getByLabelText('Ship by (UTC)'),'2026-11-16T12:00');
  await user.click(screen.getByRole('button',{name:'Add order'}));
  expect(await screen.findByText(/2 items/)).toBeInTheDocument();
  await pollState();
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));
});

test('server unavailable shows an error and refresh can recover',async()=>{
  const user=userEvent.setup();
  vi.spyOn(globalThis,'fetch').mockRejectedValueOnce(new Error('Server unavailable'))
    .mockResolvedValueOnce(new Response(JSON.stringify(state)));
  render(<App/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
  await pollState();
  expect(await screen.findByText(/No orders yet/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('uncertain save retry reuses the same idempotency key',async()=>{
  const user=userEvent.setup();
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockRejectedValueOnce(new Error('Response lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify(orderedState)));
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Orders'}));
  await user.click(screen.getByText('Custom order details'));
  await user.type(screen.getByLabelText('Production due (UTC)'),'2026-11-15T12:00');
  await user.type(screen.getByLabelText('Ship by (UTC)'),'2026-11-16T12:00');
  await user.click(screen.getByRole('button',{name:'Add order'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Response lost');
  await user.click(screen.getByRole('button',{name:'Add order'}));
  await screen.findByText(/2 items/);
  const first=JSON.parse(String(transport.mock.calls[1][1]!.body));
  const second=JSON.parse(String(transport.mock.calls[2][1]!.body));
  expect(second.idempotency_key).toBe(first.idempotency_key);
});

test('a late refresh cannot replace a saved order with old state',async()=>{
  const user=userEvent.setup();
  let finishRefresh!:(response:Response)=>void;
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockImplementationOnce(()=>new Promise(resolve=>{finishRefresh=resolve;}))
    .mockResolvedValueOnce(new Response(JSON.stringify(orderedState)));
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await pollState();
  await user.click(screen.getByRole('tab',{name:'Orders'}));
  await user.click(screen.getByText('Custom order details'));
  await user.type(screen.getByLabelText('Production due (UTC)'),'2026-11-15T12:00');
  await user.type(screen.getByLabelText('Ship by (UTC)'),'2026-11-16T12:00');
  await user.click(screen.getByRole('button',{name:'Add order'}));
  await screen.findByText(/2 items/);
  finishRefresh(new Response(JSON.stringify(state)));
  await waitFor(()=>expect(screen.queryByText(/No orders yet/)).not.toBeInTheDocument());
  expect(await screen.findByText(/2 items/)).toBeInTheDocument();
});

test('an old refresh failure cannot hide a newer successful refresh',async()=>{
  let fail!:(reason:Error)=>void;
  vi.spyOn(globalThis,'fetch').mockImplementationOnce(()=>new Promise((_resolve,reject)=>{fail=reject;}))
    .mockResolvedValueOnce(new Response(JSON.stringify(state)));
  render(<App/>);
  await pollState();
  await screen.findByText(/No orders yet/);
  await act(async()=>fail(new Error('Old connection failed')));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('late submission result does not overwrite newer refreshed state',async()=>{
  let finish!:(response:Response)=>void;
  const newer={...orderedState,revision:2,orders:[{...orderedState.orders[0],quantity:5}]};
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
    .mockResolvedValueOnce(new Response(JSON.stringify(newer)));
  const user=userEvent.setup();
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Orders'}));
  await user.click(screen.getByText('Custom order details'));
  await user.type(screen.getByLabelText('Production due (UTC)'),'2026-11-15T12:00');
  await user.type(screen.getByLabelText('Ship by (UTC)'),'2026-11-16T12:00');
  await user.click(screen.getByRole('button',{name:'Add order'}));
  expect(screen.getByRole('button',{name:'Saving…'})).toBeDisabled();
  await pollState();
  await screen.findByText(/5 items/);
  await act(async()=>finish(new Response(JSON.stringify(orderedState))));
  expect(screen.getByText(/5 items/)).toBeInTheDocument();
});

test.each([false,true])('refresh during a save cannot hide the successfully saved order (refresh finishes last: %s)',async(refreshLast)=>{
  let finish!:(response:Response)=>void;
  let finishRefresh!:(response:Response)=>void;
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
    .mockImplementationOnce(()=>new Promise(resolve=>{finishRefresh=resolve;}));
  const user=userEvent.setup();
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Orders'}));
  await user.click(screen.getByText('Custom order details'));
  await user.type(screen.getByLabelText('Production due (UTC)'),'2026-11-15T12:00');
  await user.type(screen.getByLabelText('Ship by (UTC)'),'2026-11-16T12:00');
  await user.click(screen.getByRole('button',{name:'Add order'}));
  await pollState();
  if(!refreshLast) await act(async()=>finishRefresh(new Response(JSON.stringify(state))));
  await act(async()=>finish(new Response(JSON.stringify(orderedState))));
  if(refreshLast) await act(async()=>finishRefresh(new Response(JSON.stringify(state))));
  expect(screen.getByText(/2 items/)).toBeInTheDocument();
});

test('replaying an uncertain save cannot roll back a newer queue revision',async()=>{
  const newer={...orderedState,revision:2,orders:[{...orderedState.orders[0],quantity:5}]};
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockRejectedValueOnce(new Error('Response lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify(newer)))
    .mockResolvedValueOnce(new Response(JSON.stringify(orderedState)));
  const user=userEvent.setup();
  render(<App/>);
  await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Orders'}));
  await user.click(screen.getByText('Custom order details'));
  await user.type(screen.getByLabelText('Production due (UTC)'),'2026-11-15T12:00');
  await user.type(screen.getByLabelText('Ship by (UTC)'),'2026-11-16T12:00');
  await user.click(screen.getByRole('button',{name:'Add order'}));
  await screen.findByRole('alert');
  await pollState();
  await screen.findByText(/5 items/);
  await user.click(screen.getByRole('button',{name:'Add order'}));
  await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByText(/5 items/)).toBeInTheDocument();
});


test('clock controls configure speed and pause running simulation',async()=>{
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,clock_speed:300})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:2,clock_speed:300,running:true})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:3,clock_speed:300,running:false})));
  const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
  await user.selectOptions(screen.getByLabelText('Clock speed'),'300');
  await waitFor(()=>expect(transport).toHaveBeenCalledTimes(2));
  await user.click(screen.getByRole('button',{name:'Run clock'}));
  await user.click(await screen.findByRole('button',{name:'Pause clock'}));
  await screen.findByRole('button',{name:'Run clock'});
  expect(JSON.parse(String(transport.mock.calls[3][1]!.body)).payload).toEqual({running:false,speed:300});
});

test.each([null,'2026-11-15T04:00:00Z'])('overview displays forecast and simulated telemetry (%s)',async(completion)=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...orderedState,
    forecasts:[{order_id:orderedState.orders[0].id,completion,risk:completion?'on_time':'unavailable',reason:'Capacity estimate'}],
    telemetry:[{printer_id:'printer-1',nozzle_c:210,bed_c:60}]})));
  render(<App/>);await screen.findByText(/Estimated print completion:/);
  expect(screen.getByText(/Estimated print completion:/)).toBeInTheDocument();
  expect(screen.getByText(/Estimated print completion:/)).toHaveTextContent('Capacity estimate');
  expect(screen.getByText(/Estimated print completion:/)).toHaveTextContent(completion ?? 'Unavailable');
});


test('clock starts with the default speed for a legacy snapshot',async()=>{
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,clock_speed:undefined})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,running:true,revision:1})));
  const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('button',{name:'Run clock'}));
  await screen.findByRole('button',{name:'Pause clock'});
  expect(JSON.parse(String(transport.mock.calls[1][1]!.body)).payload).toEqual({running:true,speed:60});
});


test.each(['automatic','manual'] as const)('approved model guides quantity and %s printing to the next tab',async(mode)=>{
 const approved={...modelTask,stage:'approved'};
 const profile={...state.artifacts[0],id:'model-'+modelTask.id,name:modelTask.title};
 const snapshot={...state,modeling_tasks:[approved],artifacts:[...state.artifacts,profile]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(snapshot)))
   .mockResolvedValueOnce(new Response(JSON.stringify({...snapshot,revision:1,running:mode==='automatic'})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await openPreparation(user);
 await user.click(screen.getByRole('button',{name:'Next: choose quantity'}));
 expect(screen.getByLabelText('Model to print')).toHaveValue(profile.id);
 await user.click(screen.getByRole('button',{name:mode==='automatic'?'Start automatic printing':'Plan manual printing'}));
 await waitFor(()=>expect(screen.getByRole('tab',{name:mode==='automatic'?'Overview':'Schedule'})).toHaveAttribute('aria-selected','true'));
 expect(transport.mock.calls[1][0]).toBe('/api/orders/plan');
 if(mode==='manual') await user.click(screen.getByRole('button',{name:'Next: monitor printers'}));
 await user.click(screen.getByRole('button',{name:'2. Choose model and quantity'}));
 await user.click(screen.getByRole('button',{name:'Add or prepare a model'}));
 expect(screen.getByRole('tab',{name:'Models'})).toHaveAttribute('aria-selected','true');
});

test('uncertain quick printing retries the same atomic command',async()=>{
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
 .mockRejectedValueOnce(new Error('Response lost')).mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,running:true})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('tab',{name:'Orders'}));
 await user.click(screen.getByRole('button',{name:'Start automatic printing'}));
 await screen.findAllByText('Response lost');
 await user.click(screen.getByRole('button',{name:'Start automatic printing'}));
 await waitFor(()=>expect(transport).toHaveBeenCalledTimes(3));
 expect(transport.mock.calls[1][1]!.body).toBe(transport.mock.calls[2][1]!.body);
});

test('pending work can be started from the overview inspector',async()=>{
 const printer={id:'printer-1',status:'reserved',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
 const original={...state,printers:[printer],jobs:[{id:'job-1',status:'pending',printer_id:'printer-1'}]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original))).mockResolvedValueOnce(new Response(JSON.stringify({...original,revision:1})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('button',{name:'Start print on Printer 1'}));
 await waitFor(()=>expect(transport).toHaveBeenCalledTimes(2));expect(transport.mock.calls[1][0]).toBe('/api/start');
});


test('pausing a moving clock refreshes and retries a known revision conflict once',async()=>{
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,running:true})))
 .mockResolvedValueOnce(new Response('',{status:409}))
 .mockResolvedValueOnce(new Response(JSON.stringify({...state,running:true,revision:2})))
 .mockResolvedValueOnce(new Response(JSON.stringify({...state,running:false,revision:3})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('button',{name:'Pause clock'}));
 await screen.findByRole('button',{name:'Run clock'});
 expect(transport).toHaveBeenCalledTimes(4);
 expect(JSON.parse(String(transport.mock.calls[3][1]!.body)).expected_revision).toBe(2);
});


test('clock pause conflict never crosses a changed session',async()=>{
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,running:true})))
 .mockResolvedValueOnce(new Response('',{status:409}))
 .mockResolvedValueOnce(new Response(JSON.stringify({...state,session_id:'00000000-0000-4000-8000-000000000099'})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('button',{name:'Pause clock'}));
 await screen.findByText(/Production command failed/);expect(transport).toHaveBeenCalledTimes(3);
});

test('reset supersedes a pending clock-pause refresh',async()=>{
 let finish!:(response:Response)=>void;
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,running:true})))
 .mockResolvedValueOnce(new Response('',{status:409}))
 .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
 .mockResolvedValueOnce(new Response(JSON.stringify({...state,session_id:'00000000-0000-4000-8000-000000000099'})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('button',{name:'Pause clock'}));await waitFor(()=>expect(transport).toHaveBeenCalledTimes(3));
 await user.click(screen.getByRole('tab',{name:'Printers'}));await user.click(screen.getByRole('checkbox',{name:/I understand/}));
 await user.click(screen.getByRole('button',{name:'Reset scenario'}));
 await screen.findByRole('button',{name:'Run clock'});
 await act(async()=>finish(new Response(JSON.stringify(state))));
 expect(transport).toHaveBeenCalledTimes(4);expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});


test('a late quick-print result cannot navigate away from a reset session',async()=>{
 let finish!:(response:Response)=>void;
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
 .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
 .mockResolvedValueOnce(new Response(JSON.stringify({...state,session_id:'00000000-0000-4000-8000-000000000099'})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('tab',{name:'Orders'}));await user.click(screen.getByRole('button',{name:'Start automatic printing'}));
 await user.click(screen.getByRole('tab',{name:'Printers'}));await user.click(screen.getByRole('checkbox',{name:/I understand/}));
 await user.click(screen.getByRole('button',{name:'Reset scenario'}));
 await waitFor(()=>expect(screen.getByRole('checkbox',{name:/I understand/})).not.toBeChecked());
 await act(async()=>finish(new Response(JSON.stringify({...state,running:true,revision:1}))));
 expect(screen.getByRole('tab',{name:'Printers'})).toHaveAttribute('aria-selected','true');
});


test('overview places floor above queue/activity and scenarios in the sidebar',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)));
 render(<App/>);await screen.findByText(/No orders yet/);
 expect(screen.getByRole('complementary',{name:'Production controls'})).toContainElement(screen.getByRole('heading',{name:'Reset workshop'}));
 expect(screen.getByRole('heading',{name:'Production activity'}).closest('.overview-bottom')).not.toBeNull();
 expect(screen.getByRole('region',{name:'Simulation clock'}).closest('header')).not.toBeNull();
});


test('selected printer follows the user between compact overview and detailed view',async()=>{
 const printers=[1,2,3].map(number=>({id:`printer-${number}`,status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}));
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,printers})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('button',{name:'Inspect Printer 2'}));
 await user.click(screen.getByRole('tab',{name:'Printers'}));
 expect(screen.getByRole('heading',{name:'Printer 2 details'})).toBeInTheDocument();
 await user.click(screen.getByRole('tab',{name:'Overview'}));
 expect(screen.getByRole('button',{name:'Inspect Printer 2'})).toHaveAttribute('aria-pressed','true');
});


test('overview scenario controls reset from the sidebar and inspector pauses the selected printer',async()=>{
 const printer={id:'printer-1',status:'running',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
 const initial={...state,printers:[printer]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(initial)))
 .mockResolvedValueOnce(new Response(JSON.stringify({...initial,revision:1,printers:[{...printer,status:'paused'}]})))
 .mockResolvedValueOnce(new Response(JSON.stringify({...initial,session_id:'00000000-0000-4000-8000-000000000099'})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('button',{name:'Pause Printer 1'}));await screen.findByRole('button',{name:'Resume Printer 1'});
 await user.click(screen.getByRole('checkbox',{name:/I understand/}));await user.click(screen.getByRole('button',{name:'Reset scenario'}));
 await waitFor(()=>expect(screen.getByRole('checkbox',{name:/I understand/})).not.toBeChecked());
 expect(transport.mock.calls[2][0]).toBe('/api/scenarios/reset');
});

test('detailed inspector retains manual start in the compact layout',async()=>{
 const printer={id:'printer-1',status:'reserved',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
 const initial={...state,printers:[printer],jobs:[{id:'job-1',printer_id:'printer-1',status:'pending'}]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(initial))).mockResolvedValueOnce(new Response(JSON.stringify({...initial,revision:1})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('tab',{name:'Printers'}));await user.click(screen.getByRole('button',{name:'Start print on Printer 1'}));
 await waitFor(()=>expect(transport).toHaveBeenCalledTimes(2));
 expect(transport.mock.calls[1][0]).toBe('/api/start');
});


test('idle overview start guidance opens model and quantity selection',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('button',{name:'Start a new print'}));
 expect(screen.getByLabelText('Model to print')).toBeInTheDocument();
});


test('idle inspector opens model selection and waiting work opens reviewable scheduling',async()=>{
 const initial={...orderedState,printers:[{id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}]};
 const proposal={id:'hash',session_id:initial.session_id,revision:initial.revision,mode:'automatic',assumptions:'Estimate',assignments:[{order_id:initial.orders[0].id,printer_id:'printer-1',start:'now',finish:'later',filament_grams:25,duration_seconds:60}],blocked:[]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(initial))).mockResolvedValueOnce(new Response(JSON.stringify(proposal))).mockResolvedValueOnce(new Response(JSON.stringify({...initial,revision:2})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/2 items/);
 await user.click(screen.getByRole('button',{name:'Choose a model for Printer 1'}));expect(screen.getByLabelText('Model to print')).toBeInTheDocument();
 await user.click(screen.getByRole('tab',{name:'Overview'}));await user.click(screen.getByRole('button',{name:'Review waiting work'}));
 await user.click(screen.getByRole('button',{name:'Preview schedule'}));await screen.findByText(/25 g \//);await user.click(screen.getByRole('button',{name:'Confirm and start printing'}));
 await waitFor(()=>expect(transport).toHaveBeenCalledTimes(3));expect(transport.mock.calls[2][0]).toBe('/api/schedule/apply');
 await user.click(screen.getByRole('tab',{name:'Printers'}));await user.click(screen.getByRole('button',{name:'Choose a model for Printer 1'}));expect(screen.getByLabelText('Model to print')).toBeInTheDocument();
});


test('review-first intake guides to Schedule without claiming printing has started',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state))).mockResolvedValueOnce(new Response(JSON.stringify({...orderedState,revision:1})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await user.click(screen.getByRole('button',{name:'Start a new print'}));
 await user.click(screen.getByRole('button',{name:'Review schedule first'}));await waitFor(()=>expect(screen.getByRole('tab',{name:'Schedule'})).toHaveAttribute('aria-selected','true'));
});

test('library selection guides to an order and uploaded profiles reach the guarded library command',async()=>{
 const uploaded={...state.artifacts[0],id:'uploaded-model',name:'Bracket'};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state))).mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,artifacts:[...state.artifacts,uploaded]})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await user.click(screen.getByRole('tab',{name:'Models'}));
 await user.click(screen.getByRole('button',{name:'Print Blue PLA figure'}));expect(screen.getByRole('tab',{name:'Orders'})).toHaveAttribute('aria-selected','true');
 await user.click(screen.getByRole('tab',{name:'Models'}));await user.click(screen.getByRole('button',{name:'Upload a model'}));
 await user.upload(screen.getByLabelText('STL model file'),new File(['mesh'],'bracket.stl'));await user.type(screen.getByLabelText('Saved model name'),'Bracket');await user.type(screen.getByLabelText('Print time per item (minutes)'),'20');await user.type(screen.getByLabelText('Filament per item (grams)'),'5');await user.selectOptions(screen.getByLabelText('Support assessment'),'not-required');await user.click(screen.getByLabelText('I have reviewed the model and its print settings'));await user.click(screen.getByRole('button',{name:'Save print-ready model'}));
 await screen.findByRole('button',{name:'Print Bracket'});expect(transport.mock.calls[1][0]).toBe('/api/library/models');
});

test('local shop acceptance guides to review and held production details can be corrected',async()=>{
 const request={id:'EXAMPLE-1',source:'example',sku:'FIGURE',product_name:'Figure',artifact_id:'figure-pla-blue',quantity:2,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z',status:'pending'};
 const loaded={...state,revision:1,shop_requests:[request]};const held={...loaded,revision:2,shop_requests:[{...request,status:'accepted'}],orders:orderedState.orders.map(order=>({...order,requires_schedule_review:true}))};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state))).mockResolvedValueOnce(new Response(JSON.stringify(loaded))).mockResolvedValueOnce(new Response(JSON.stringify(held))).mockResolvedValueOnce(new Response(JSON.stringify({...held,revision:3})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await user.click(screen.getByRole('tab',{name:'Orders'}));await user.click(screen.getByRole('button',{name:'Load example shop orders'}));await screen.findByText('EXAMPLE-1');await user.click(screen.getByRole('button',{name:'Review schedule for EXAMPLE-1'}));await screen.findByRole('heading',{name:'Orders awaiting confirmation'});
 expect(screen.getByRole('tab',{name:'Schedule'})).toHaveAttribute('aria-selected','true');await user.click(screen.getByRole('button',{name:/Inspect order/}));await user.click(screen.getByText('Edit quantity and dates'));await user.click(screen.getByRole('button',{name:'Save order changes'}));await user.click(screen.getByRole('button',{name:'Confirm changes'}));await waitFor(()=>expect(transport).toHaveBeenCalledTimes(4));expect(transport.mock.calls[3][0]).toBe('/api/orders/revise');
});

test('accepted requests reopen the schedule and live review offers an explicit simulation pause',async()=>{
 const request={id:'EXAMPLE-1',source:'example',sku:'FIGURE',product_name:'Figure',artifact_id:'figure-pla-blue',quantity:2,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z',status:'accepted'};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,clock_speed:undefined,running:true,shop_requests:[request]}))).mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await user.click(screen.getByRole('tab',{name:'Orders'}));await user.click(screen.getByRole('button',{name:'View print schedule'}));await user.click(screen.getByRole('button',{name:'Pause simulation for review'}));await screen.findByRole('button',{name:'Run clock'});
 expect(transport.mock.calls[1][0]).toBe('/api/clock');
});

test.each(['accept','reject'] as const)('late shop %s results cannot navigate out of a reset session',async(decision)=>{
 let finish!:(response:Response)=>void;
 const request={id:'EXAMPLE-1',source:'example',sku:'FIGURE',product_name:'Figure',artifact_id:'figure-pla-blue',quantity:2,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z',status:'pending'};
 const original={...state,shop_requests:[request]},reset={...state,session_id:'00000000-0000-4000-8000-000000000099'};
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original))).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce(new Response(JSON.stringify(reset)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await user.click(screen.getByRole('tab',{name:'Orders'}));await user.click(screen.getByRole('button',{name:decision==='accept'?'Review schedule for EXAMPLE-1':'Reject EXAMPLE-1'}));await user.click(screen.getByRole('tab',{name:'Printers'}));await user.click(screen.getByRole('checkbox',{name:/I understand/}));await user.click(screen.getByRole('button',{name:'Reset scenario'}));await waitFor(()=>expect(screen.getByRole('checkbox',{name:/I understand/})).not.toBeChecked());
 await act(async()=>finish(new Response(JSON.stringify({...original,revision:3}))));expect(screen.getByRole('tab',{name:'Printers'})).toHaveAttribute('aria-selected','true');
});

test('late confirmed schedule cannot navigate away from a reset session',async()=>{
 let finish!:(response:Response)=>void;const original={...orderedState,orders:orderedState.orders.map(order=>({...order,requires_schedule_review:true}))},reset={...state,session_id:'00000000-0000-4000-8000-000000000099'};
 const proposal={id:'plan',session_id:original.session_id,revision:original.revision,mode:'automatic',assumptions:'Estimate',assignments:[{order_id:original.orders[0].id,printer_id:'printer-1',start:'2026-11-15T00:00:00Z',finish:'2026-11-15T02:00:00Z',filament_grams:25,duration_seconds:7200}],blocked:[]};
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original))).mockResolvedValueOnce(new Response(JSON.stringify(proposal))).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce(new Response(JSON.stringify(reset)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/2 items/);await user.click(screen.getByRole('tab',{name:'Schedule'}));await user.click(screen.getByRole('button',{name:'Preview schedule'}));await screen.findByRole('button',{name:'Confirm and start printing'});await user.click(screen.getByRole('button',{name:'Confirm and start printing'}));await user.click(screen.getByRole('tab',{name:'Printers'}));await user.click(screen.getByRole('checkbox',{name:/I understand/}));await user.click(screen.getByRole('button',{name:'Reset scenario'}));await waitFor(()=>expect(screen.getByRole('checkbox',{name:/I understand/})).not.toBeChecked());await act(async()=>finish(new Response(JSON.stringify({...original,revision:3}))));expect(screen.getByRole('tab',{name:'Printers'})).toHaveAttribute('aria-selected','true');
});

async function openPreparation(user:ReturnType<typeof userEvent.setup>){await user.click(screen.getByRole('tab',{name:'Models'}));if(!document.querySelector('details.preparation-tools')!.hasAttribute('open'))await user.click(screen.getByText('Model preparation & support review'));}
async function openScheduleTools(user:ReturnType<typeof userEvent.setup>){await user.click(screen.getByRole('tab',{name:'Schedule'}));if(!document.querySelector('details.advanced-schedule')!.hasAttribute('open'))await user.click(screen.getByText('Manual scheduling tools'));}

test.each(['manual','automatic','unmatched'] as const)('individual incoming %s requests use guarded commands and automatic matches preview the queue',async(mode)=>{
 const request={id:'SIM-1',source:'simulation',sku:'MODEL-figure',product_name:'Figure',artifact_id:mode==='unmatched'?null:'figure-pla-blue',quantity:2,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z',status:mode==='automatic'?'accepted':'pending'};
 const response={...state,revision:1,shop_requests:[request],orders:mode==='automatic'?orderedState.orders.map(order=>({...order,requires_schedule_review:true})):[]};
 const proposal={id:'p',session_id:state.session_id,revision:1,mode:'automatic',assumptions:'Estimate',assignments:[],blocked:[]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state))).mockResolvedValueOnce(new Response(JSON.stringify(response))).mockResolvedValueOnce(new Response(JSON.stringify(proposal)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);await user.click(screen.getByRole('tab',{name:'Orders'}));await user.click(screen.getByRole('button',{name:'Simulate incoming order'}));
 if(mode!=='manual')await user.selectOptions(screen.getByLabelText('Incoming process'),'automatic');if(mode==='unmatched')await user.selectOptions(screen.getByLabelText('Incoming model'),'');await user.click(screen.getByRole('button',{name:'Simulate order'}));await waitFor(()=>expect(transport).toHaveBeenCalledTimes(mode==='automatic'?3:2));
 expect(transport.mock.calls[1][0]).toBe('/api/shop/simulate');expect(screen.getByRole('tab',{name:mode==='automatic'?'Schedule':'Orders'})).toHaveAttribute('aria-selected','true');
});

test('confirmed deletion preserves the source revision and removes the order from active overview totals',async()=>{
 const initial={...orderedState,visual_assets:[{id:'other',name:'Other',path:'/models/other.stl',units:'mm',rotation_degrees:[0,0,0]}]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(initial))).mockResolvedValueOnce(new Response(JSON.stringify({...initial,revision:2,orders:initial.orders.map(order=>({...order,status:'cancelled'}))})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/2 items/);await user.click(screen.getByRole('tab',{name:'Schedule'}));await user.click(screen.getByRole('button',{name:/Inspect order/}));await user.click(screen.getByRole('button',{name:'Delete scheduled order'}));await user.click(screen.getByRole('button',{name:'Confirm deletion'}));await waitFor(()=>expect(screen.queryByRole('button',{name:/Inspect order/})).not.toBeInTheDocument());
 const body=JSON.parse(String(transport.mock.calls[1][1]!.body));expect(body.expected_revision).toBe(1);expect(body.payload.confirmed).toBe(true);await user.click(screen.getByRole('tab',{name:'Overview'}));expect(screen.getByText('Items remaining').parentElement).toHaveTextContent('0');
});

test('a refreshed new session invalidates an open confirmation even when order IDs and revisions are reused',async()=>{
 const next={...orderedState,session_id:'00000000-0000-4000-8000-000000000099'};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(orderedState))).mockResolvedValueOnce(new Response(JSON.stringify(next)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/2 items/);await user.click(screen.getByRole('tab',{name:'Schedule'}));await user.click(screen.getByRole('button',{name:/Inspect order/}));await user.click(screen.getByRole('button',{name:'Delete scheduled order'}));await pollState();await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(transport).toHaveBeenCalledTimes(2);
});


test('demo events share guarded production commands and retain the overview',async()=>{
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state))).mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,scenario_events:[{event_id:'event-1',event:'marketplace_order',status:'accepted',notification:'Incoming simulated marketplace request',timestamp:state.simulation_time,tool_calls:[],impacts:[]}]})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByText('Demo scenarios',{exact:true}));
 await user.click(screen.getByRole('button',{name:'Trigger simulated event'}));
 expect(await screen.findByRole('status')).toHaveTextContent('Incoming simulated marketplace request');
 expect(transport.mock.calls[1][0]).toBe('/api/scenarios/events');
 expect(JSON.parse(String(transport.mock.calls[1][1]!.body))).toMatchObject({session_id:state.session_id,expected_revision:0,payload:{event:'marketplace_order',order:{mode:'manual',quantity:2}}});
 expect(screen.getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true');
});


test('overview groups the assistant, all scenario controls and actual capability status in reference order',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(state)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 const sidebar=screen.getByRole('complementary',{name:'Production controls'});
 expect(Array.from(sidebar.querySelectorAll(':scope > section')).map(section=>section.querySelector('h2')?.textContent)).toEqual(['Orchestrator','Scenario controls','Agent network']);
 expect(screen.getByRole('heading',{name:'Reset workshop'}).closest('.scenario-controls')).not.toBeNull();
 expect(screen.queryByRole('heading',{name:'Reset simulation scenario'})).not.toBeInTheDocument();
 expect(screen.getByText('Sign in required')).toBeVisible();
 await user.click(screen.getByRole('button',{name:'Connect test assistant'}));
 expect(screen.getByText('Connected',{exact:true})).toBeVisible();
 expect(screen.getByText(/Manual assistant connected/)).toBeVisible();
});

test('printer view uses the same unified simulated event commands and reset surface',async()=>{
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(state)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await user.click(screen.getByRole('tab',{name:'Printers'}));
 await user.click(screen.getByText('Demo scenarios',{exact:true}));
 await user.click(screen.getByRole('button',{name:'Trigger simulated event'}));
 expect(transport.mock.calls.at(-1)?.[0]).toBe('/api/scenarios/events');
 expect(screen.getByRole('heading',{name:'Reset workshop'})).toBeVisible();
});


test('assistant and scenario controls keep distinct React identities across state refreshes',async()=>{
 const warnings=vi.spyOn(console,'error').mockImplementation(()=>{});
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(state)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 await pollState();
 await user.click(screen.getByRole('button',{name:'Connect test assistant'}));
 expect(warnings.mock.calls.flat().join(' ')).not.toContain('same key');
});


test.each(['Overview','Printers'])('loaded filament can be updated from %s without replacing other printer controls',async(tab)=>{
 const printer={id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
 const initial={...state,printers:[printer]};
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(initial))).mockResolvedValueOnce(new Response(JSON.stringify({...initial,revision:1,printers:[{...printer,material:{type:'PLA',color:'black',grams:1000}}]})));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
 if(tab==='Printers')await user.click(screen.getByRole('tab',{name:'Printers'}));
 await user.click(screen.getByText('Load filament',{exact:true}));
 await user.selectOptions(screen.getByLabelText('Filament action'),'replace');await user.selectOptions(screen.getByLabelText('Loaded filament color'),'black');await user.click(screen.getByRole('checkbox',{name:/I confirm this is the filament/}));
 await user.click(screen.getByRole('button',{name:'Save loaded filament'}));
 await waitFor(()=>expect(transport.mock.calls[1][0]).toBe('/api/printers/material'));
 expect(JSON.parse(String(transport.mock.calls[1][1]!.body))).toMatchObject({payload:{color:'black',confirmed:true}});
 expect(screen.getByRole('button',{name:'Pause Printer 1'})).toBeVisible();
});


test('Print Assist brand returns to Overview with keyboard activation and keeps saved state',async()=>{
 const transport=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(orderedState)));
 const user=userEvent.setup();render(<App/>);await screen.findByText(/2 items/);
 await user.click(screen.getByRole('tab',{name:'Orders'}));
 const brand=screen.getByRole('button',{name:'Print Assist - Overview'});brand.focus();await user.keyboard('{Enter}');
 expect(screen.getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true');
 expect(screen.getByText('Items remaining').parentElement).toHaveTextContent('2');
 expect(transport).toHaveBeenCalledTimes(1);
});

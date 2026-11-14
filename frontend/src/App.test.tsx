import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import App from './App';
vi.mock('./monitoring',()=>({useMonitoring:()=>{}}));
vi.mock('./printers/scene',()=>({mountScene:()=>({command:()=>{},update:()=>{},dispose:()=>{}})}));
import {state,orderedState} from './test-fixtures';

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
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  await user.click(screen.getByRole('tab',{name:'Schedule'}));
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
  await user.click(screen.getByRole('tab',{name:'Schedule'}));
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
    .mockResolvedValueOnce(new Response(JSON.stringify(next)))
    .mockRejectedValueOnce(new Error('New response lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify({...next,revision:1,orders:kind==='order'?orderedState.orders:[],modeling_tasks:kind==='model'?[modelTask]:[]})));
  const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
  async function enter() {
    await user.click(screen.getByRole('tab',{name:kind==='order'?'Orders':'Modeling'}));
    if(kind==='model') await fillModel(user);
    else {
      await user.click(screen.getByText('Custom order details'));
      await user.type(screen.getByLabelText('Production due (UTC)'),'2026-11-20T12:00');
      await user.type(screen.getByLabelText('Ship by (UTC)'),'2026-11-21T12:00');
    }
    await user.click(screen.getByRole('button',{name:kind==='order'?'Add order':'Add to modeling'}));
  }
  await enter();
  await user.click(screen.getByRole('tab',{name:'Printers'}));
  await user.click(screen.getByRole('checkbox',{name:/I understand/}));
  await user.click(screen.getByRole('button',{name:'Reset scenario'}));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:/I understand/})).not.toBeChecked());
  await enter();await screen.findByText('New response lost');
  await act(async()=>finish(new Response(JSON.stringify(orderedState))));
  await user.click(screen.getByRole('button',{name:kind==='order'?'Add order':'Add to modeling'}));
  await waitFor(()=>expect(transport).toHaveBeenCalledTimes(5));
  expect(JSON.parse(String(transport.mock.calls[3][1]!.body)).idempotency_key).toBe(JSON.parse(String(transport.mock.calls[4][1]!.body)).idempotency_key);
});

test('modeling is available alongside the default production overview',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)));
  const user=userEvent.setup();
  render(<App/>);
  await screen.findByText(/No orders yet/);
  expect(screen.getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true');
  await user.click(screen.getByRole('tab',{name:'Modeling'}));
  expect(screen.getByRole('heading',{name:'Modeling dashboard'})).toBeVisible();
});

test('retry after a rejected modeling change refreshes instead of resubmitting rejected work',async()=>{
  const original={...state,modeling_tasks:[modelTask]};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(original)))
    .mockResolvedValueOnce(new Response('',{status:409}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...original,revision:1})));
  const user=userEvent.setup();render(<App/>);await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Modeling'}));
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await screen.findByText(/Modeling change rejected/);
  await user.click(screen.getByRole('button',{name:'Retry modeling change'}));
  await waitFor(()=>expect(screen.queryByText(/Modeling change rejected/)).not.toBeInTheDocument());
  expect(transport.mock.calls[2][0]).toBe('/api/state');
  expect(transport.mock.calls[2][1]).toBeUndefined();
});

async function fillModel(user:ReturnType<typeof userEvent.setup>) {
  const preparation=screen.getByText('Model preparation (team only)');
  if(!preparation.closest('details')!.open) await user.click(preparation);
  await user.type(screen.getByLabelText('Model name'),'Planter');
  await user.type(screen.getByLabelText('Model file reference'),'planter.stl');
  await user.type(screen.getByLabelText('Estimated print minutes'),'60');
  await user.type(screen.getByLabelText('Estimated filament grams'),'30');
  await user.type(screen.getByLabelText('Filament type'),'PLA');
  await user.type(screen.getByLabelText('Filament color'),'blue');
}

const modelTask={id:'model-1',title:'Planter',modelReference:'planter.stl',stage:'modeling',duration_seconds:3600,filament_grams:30,filament_type:'PLA',color:'blue',required_capabilities:['FFF']};

test('saved modeling tasks can be created and moved through server commands',async()=>{
  const user=userEvent.setup();
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:1,modeling_tasks:[modelTask]})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:2,modeling_tasks:[{...modelTask,stage:'supports'}]})));
  render(<App/>); await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Modeling'}));
  await fillModel(user);
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  await user.click(await screen.findByRole('button',{name:'Prepare supports'}));
  await screen.findByRole('button',{name:'Send to review'});
  expect(String(transport.mock.calls[1][0])).toBe('/api/modeling/tasks');
  expect(String(transport.mock.calls[2][0])).toBe('/api/modeling/actions');
});

test('modeling handles uncertain retries, blocks different changes, and reports rejection',async()=>{
  const user=userEvent.setup();
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[modelTask]})))
    .mockRejectedValueOnce(new Error('Response lost'))
    .mockResolvedValueOnce(new Response('',{status:409}))
    .mockResolvedValueOnce(new Response('',{status:409}));
  render(<App/>); await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Modeling'}));
  await fillModel(user);
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  await screen.findByText('Response lost');
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await screen.findByText('Retry the previous modeling change first.');
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  await screen.findByText(/Modeling change rejected/);
  expect(JSON.parse(String(transport.mock.calls[1][1]!.body)).idempotency_key).toBe(JSON.parse(String(transport.mock.calls[2][1]!.body)).idempotency_key);
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await waitFor(()=>expect(transport).toHaveBeenCalledTimes(4));
});

test('late modeling results cannot roll back refreshed production state',async()=>{
  let finish!:(response:Response)=>void;
  const user=userEvent.setup();
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[modelTask]})))
    .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...state,revision:3,modeling_tasks:[{...modelTask,stage:'review'}]})));
  render(<App/>); await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Modeling'}));
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
  await screen.findByRole('button',{name:'Approve'});
  await act(async()=>finish(new Response(JSON.stringify({...state,revision:1,modeling_tasks:[{...modelTask,stage:'supports'}]}))));
  expect(screen.getByRole('button',{name:'Approve'})).toBeInTheDocument();
});

test('lost modeling action can be retried after refresh changes its stage',async()=>{
  const user=userEvent.setup();
  const newer={...state,revision:1,modeling_tasks:[{...modelTask,stage:'supports'}]};
  const transport=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,modeling_tasks:[modelTask]})))
    .mockRejectedValueOnce(new Error('Response lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify(newer)))
    .mockResolvedValueOnce(new Response(JSON.stringify(newer)));
  render(<App/>); await screen.findByText(/No orders yet/);
  await user.click(screen.getByRole('tab',{name:'Modeling'}));
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await screen.findByText('Response lost');
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
  await screen.findByRole('button',{name:'Send to review'});
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
  await user.click(screen.getByRole('tab',{name:'Modeling'}));
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await screen.findByText('Lost response');
  await user.click(screen.getByRole('button',{name:'Retry modeling change'}));
  await screen.findByText('Still disconnected');
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  await user.click(screen.getByRole('tab',{name:'Schedule'}));
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
  await user.click(screen.getByRole('tab',{name:'Schedule'}));
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
  await user.click(screen.getByRole('tab',{name:'Schedule'}));
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
  await user.click(screen.getByRole('tab',{name:'Schedule'}));
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
  await user.click(screen.getByRole('tab',{name:'Schedule'}));
  await user.click(screen.getByRole('button',{name:'Schedule automatically'}));
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
  await screen.findByText(/2 items/);
  await act(async()=>finishSchedule(new Response(JSON.stringify(orderedState))));
  expect(screen.getByText(/2 items/)).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  await user.click(screen.getByRole('tab',{name:'Schedule'}));
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
  await user.click(screen.getByRole('tab',{name:'Schedule'}));
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
  await user.click(screen.getByRole('tab',{name:'Schedule'}));
  await user.click(screen.getByRole('button',{name:'Advance 1 hour'}));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));
});

test('server unavailable shows an error and refresh can recover',async()=>{
  const user=userEvent.setup();
  vi.spyOn(globalThis,'fetch').mockRejectedValueOnce(new Error('Server unavailable'))
    .mockResolvedValueOnce(new Response(JSON.stringify(state)));
  render(<App/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  await userEvent.setup().click(screen.getByRole('button',{name:'Refresh queue'}));
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
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  await user.click(screen.getByRole('button',{name:'Refresh queue'}));
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
  expect(screen.getByText(/Capacity estimate/)).toHaveTextContent(completion ?? 'Unavailable');
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
 await user.click(screen.getByRole('tab',{name:'Modeling'}));
 await user.click(screen.getByRole('button',{name:'Next: choose quantity'}));
 expect(screen.getByLabelText('Model to print')).toHaveValue(profile.id);
 await user.click(screen.getByRole('button',{name:mode==='automatic'?'Start automatic printing':'Plan manual printing'}));
 await waitFor(()=>expect(screen.getByRole('tab',{name:mode==='automatic'?'Overview':'Schedule'})).toHaveAttribute('aria-selected','true'));
 expect(transport.mock.calls[1][0]).toBe('/api/orders/plan');
 if(mode==='manual') await user.click(screen.getByRole('button',{name:'Next: monitor printers'}));
 await user.click(screen.getByRole('button',{name:'2. Choose model and quantity'}));
 await user.click(screen.getByRole('button',{name:'Add or prepare a model'}));
 expect(screen.getByRole('tab',{name:'Modeling'})).toHaveAttribute('aria-selected','true');
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

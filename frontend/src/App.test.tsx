import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import App from './App';
import {state,orderedState} from './test-fixtures';

test('overview shows simulated printers and tabs open the order workspace',async()=>{
  const user=userEvent.setup();
  const printers=[1,2,3].map(number=>({id:`printer-${number}`,status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}));
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({...state,printers})));
  render(<App/>);
  expect(await screen.findByText('printer-1')).toBeInTheDocument();
  expect(screen.getByText('printer-3')).toBeInTheDocument();
  expect(screen.queryByRole('heading',{name:'New production order'})).not.toBeInTheDocument();
  expect(screen.getByText(/Example production activity/)).toBeInTheDocument();
  await user.click(screen.getByRole('tab',{name:'Orders'}));
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
  expect(await screen.findByText(/job-1/)).toBeInTheDocument();
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
  await user.click(screen.getByRole('button',{name:'Start job-1'}));
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
  await user.click(screen.getByRole('button',{name:'Resume job-1'}));
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
  await user.click(screen.getByRole('button',{name:'Start job-1'}));
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
  await user.click(screen.getByRole('button',{name:'Start job-1'}));
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
  expect(await screen.findByText(/job-1/)).toBeInTheDocument();
  expect(screen.getByText(/50%/)).toBeInTheDocument();
});

test('overview handles a job without progress fields',async()=>{
  const printer={id:'printer-1',status:'running',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
  const current={...state,printers:[printer],jobs:[{id:'job-1',order_id:'order-1',printer_id:'printer-1',status:'running'}]};
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(current)));
  render(<App/>);
  expect(await screen.findByText(/job-1.*0%/)).toBeInTheDocument();
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

import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import App from './App';
import {state,orderedState} from './test-fixtures';

test('loads state, saves an order, and refreshes the queue with agents OFF',async()=>{
  const user=userEvent.setup();
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(state)))
    .mockResolvedValueOnce(new Response(JSON.stringify(orderedState)))
    .mockResolvedValueOnce(new Response(JSON.stringify(orderedState)));
  render(<App/>);
  expect(screen.getByText(/Waiting for production state/)).toBeInTheDocument();
  expect(await screen.findByText(/No orders yet/)).toBeInTheDocument();
  expect(screen.getByText(/Agents OFF/)).toBeInTheDocument();
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

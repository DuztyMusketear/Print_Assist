import {render,screen} from '@testing-library/react';
import {test,expect} from 'vitest';
import {OrderQueue} from './OrderQueue';
import {state,orderedState} from '../test-fixtures';
test('empty queue explains how to begin',()=>{
  render(<OrderQueue state={state}/>);
  expect(screen.getByText(/No orders yet/)).toBeInTheDocument();
});
test('saved order shows quantity, deadlines and completion separately',()=>{
  render(<OrderQueue state={orderedState}/>);
  expect(screen.getByText('Blue PLA figure')).toBeInTheDocument();
  expect(screen.getByText(/2 items/)).toHaveTextContent('queued');
  expect(screen.getByText(/Production due:/)).toHaveTextContent('2026-11-15T12:00:00Z');
  expect(screen.getByText(/0 completed/)).toBeInTheDocument();
});


test('compact queue presents models and assigned parts in a scrollable table',()=>{
 render(<OrderQueue compact state={{...orderedState,jobs:[{id:'order-1-1',order_id:orderedState.orders[0].id,printer_id:'printer-1',status:'running'}]}}/>);
 expect(screen.getByRole('table',{name:'Production queue'})).toBeInTheDocument();
 expect(screen.getByText('Printer 1')).toBeInTheDocument();
 expect(screen.getByText(/Part 1/)).toHaveTextContent('running');
 expect(screen.getByText('2 items')).toBeInTheDocument();
});


test.each([null,'2026-11-15T04:00:00Z'])('detailed queue retains forecast explanations (%s)',completion=>{
 render(<OrderQueue state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,completion,risk:completion?'on_time':'unavailable',reason:'Capacity estimate'}]}}/>);
 expect(screen.getByText(/Estimated print completion:/)).toHaveTextContent(completion ?? 'Unavailable');
 expect(screen.getByText(/Capacity estimate/)).toHaveTextContent('Shipping and packing are separate');
});

test('compact unassigned work keeps delivery details available in a disclosure',async()=>{
 render(<OrderQueue compact state={orderedState}/>);
 expect(screen.getByText('Unassigned')).toBeInTheDocument();
 expect(screen.getByText('Timing').closest('details')).not.toHaveAttribute('open');
 expect(screen.getByText(/Ship by:/)).toHaveTextContent(orderedState.orders[0].ship_by);
});

test.each([true,false])('deadline risk is red and readable without opening timing (compact %s)',compact=>{
 const view=render(<OrderQueue compact={compact} state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,risk:'unavailable',completion:null,reason:'Printer offline'}]}}/>);
 const risk=screen.getByText(/Estimated print completion:/);
 expect(risk).toHaveClass('deadline-risk');expect(risk.closest('details')).toBeNull();expect(risk).toBeVisible();
 expect(view.container.querySelector(compact?'tbody tr':'li')).toHaveClass('deadline-risk');
});

test('on-time work retains ordinary presentation',()=>{
 const view=render(<OrderQueue compact state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,risk:'on_time',completion:'2026-11-15T02:00:00Z',reason:''}]}}/>);
 expect(view.container.querySelector('.deadline-risk')).toBeNull();
});

test('compact empty queue explains how to start',()=>{
 render(<OrderQueue compact state={state}/>);expect(screen.getByText(/No orders yet/)).toBeVisible();
});

test('compact late forecast exposes its estimated finish immediately',()=>{
 render(<OrderQueue compact state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,risk:'late',completion:'2026-11-16T02:00:00Z',reason:'Queue delay'}]}}/>);
 expect(screen.getByText(/Estimated print completion:/)).toHaveTextContent('2026-11-16T02:00:00Z');
 expect(screen.getByText(/Queue delay/)).toBeVisible();
});

test('compact forecast preserves an unknown completion with an otherwise ordinary risk label',()=>{
 render(<OrderQueue compact state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,risk:'on_time',completion:null,reason:'Awaiting timestamp'}]}}/>);
 expect(screen.getByText(/Estimated print completion:/)).toHaveTextContent('Unavailable');
});

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

import {fireEvent,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import {OrderDrafts} from './OrderDrafts';
import {orderedState} from '../test-fixtures';

test('quantity and deadline corrections stay held until a fresh schedule is confirmed',async()=>{
 const change=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();
 render(<OrderDrafts state={{...orderedState,orders:orderedState.orders.map(order=>({...order,requires_schedule_review:true}))}} onRevise={change}/>);
 const card=screen.getByRole('button',{name:/Inspect order/});
 expect(within(card).getByText('Est. printer time: 4 h')).toBeInTheDocument();
 expect(within(card).getByText('Est. filament: 50.0 g / blue PLA')).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:/Inspect order/}));
 expect(within(screen.getByRole('region',{name:'Selected order details'})).getByText(/Total estimated printer time: 4 h/)).toHaveTextContent('Estimated filament: 50.0 g');
 await user.click(screen.getByText('Edit quantity and dates'));
 await user.clear(screen.getByLabelText('Revised copies'));await user.type(screen.getByLabelText('Revised copies'),'3');
 await user.click(screen.getByRole('button',{name:'Save order changes'}));
 expect(within(screen.getByRole('dialog')).getByText(/Revised estimated printer time: 6 h/)).toHaveTextContent('Estimated filament: 75.0 g / blue PLA');
 expect(change).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Confirm changes'}));
 expect(change).toHaveBeenCalledWith(expect.objectContaining({confirmed:true,order_id:orderedState.orders[0].id,order:expect.objectContaining({quantity:3})}),orderedState.revision);
});

test('editing errors preserve dates and committed/completed orders cannot be edited',async()=>{
 const change=vi.fn().mockRejectedValue(new Error('Cannot meet deadline')),user=userEvent.setup();
 const held={...orderedState.orders[0],requires_schedule_review:true};
 const view=render(<OrderDrafts state={{...orderedState,orders:[held]}} onRevise={change}/>);
 await user.click(screen.getByRole('button',{name:/Inspect order/}));
 await user.click(screen.getByText('Edit quantity and dates'));
 fireEvent.change(screen.getByLabelText('Revised print deadline (UTC)'),{target:{value:'2026-11-16T12:00'}});fireEvent.change(screen.getByLabelText('Revised ship deadline (UTC)'),{target:{value:'2026-11-17T12:00'}});
 await user.click(screen.getByRole('button',{name:'Save order changes'}));await user.click(screen.getByRole('button',{name:'Confirm changes'}));await screen.findByText('Cannot meet deadline');
 expect(screen.getByLabelText('Revised print deadline (UTC)')).toHaveValue('2026-11-16T12:00');
 view.rerender(<OrderDrafts state={{...orderedState,orders:[held],jobs:[{order_id:held.id,status:'running'}]}} onRevise={change}/>);expect(screen.queryByText('Edit quantity and dates')).not.toBeInTheDocument();
 view.rerender(<OrderDrafts state={{...orderedState,orders:[{...held,successful_quantity:1}]}} onRevise={change}/>);expect(screen.queryByText('Edit quantity and dates')).not.toBeInTheDocument();
});

test('queued order deletion has a confirmation and conflicts appear on compact cards',async()=>{
 const remove=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();
 render(<OrderDrafts state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,risk:'late',completion:'2026-11-16T00:00:00Z',reason:''}]}} onRevise={vi.fn()} onDelete={remove}/>);
 expect(screen.getByText('Deadline conflict')).toBeInTheDocument();await user.click(screen.getByRole('button',{name:/Inspect order/}));await user.click(screen.getByRole('button',{name:'Delete scheduled order'}));expect(remove).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Cancel'}));expect(remove).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Delete scheduled order'}));await user.click(screen.getByRole('button',{name:'Confirm deletion'}));expect(remove).toHaveBeenCalledWith({order_id:orderedState.orders[0].id,confirmed:true},orderedState.revision);
});

test.each(['revision','session'] as const)('stale %s confirmations cannot change refreshed or reset orders',async(kind)=>{
 const remove=vi.fn(),user=userEvent.setup();const view=render(<OrderDrafts state={orderedState} onRevise={vi.fn()} onDelete={remove}/>);
 await user.click(screen.getByRole('button',{name:/Inspect order/}));await user.click(screen.getByRole('button',{name:'Delete scheduled order'}));
 view.rerender(<OrderDrafts state={{...orderedState,...(kind==='revision'?{revision:2}:{session_id:'new-session'})}} onRevise={vi.fn()} onDelete={remove}/>);
 await user.click(screen.getByRole('button',{name:'Confirm deletion'}));await screen.findByRole('alert');expect(remove).not.toHaveBeenCalled();
});

test('unavailable capacity is visible and partial placements never imply a whole-order ETA',()=>{
 render(<OrderDrafts state={{...orderedState,jobs:[{order_id:orderedState.orders[0].id,printer_id:'printer-1',status:'planned',duration_seconds:7200}],forecasts:[{order_id:orderedState.orders[0].id,risk:'unavailable',completion:null,reason:'Insufficient compatible printer capacity or filament'}]}} onRevise={vi.fn()}/>);
 expect(screen.getByText('Needs attention')).toBeInTheDocument();expect(screen.getByText(/Insufficient compatible/)).toBeInTheDocument();expect(screen.getByText('Est. finish: Unavailable')).toBeInTheDocument();
});

test('cards distinguish blocked, overlapping, active and queued work and guard edits while the clock runs',async()=>{
 const user=userEvent.setup(),order=orderedState.orders[0];
 const proposal={id:'p',session_id:orderedState.session_id,revision:1,mode:'automatic' as const,assumptions:'',assignments:[],blocked:[{order_id:order.id,quantity:2,reason:'No stock'}]};
 const view=render(<OrderDrafts state={orderedState} proposal={proposal} onRevise={vi.fn()} onDelete={vi.fn()}/>);expect(screen.getByText('Capacity conflict')).toBeInTheDocument();
 const assignment={order_id:order.id,printer_id:'printer-1',start:'2026-11-15T01:00:00Z',finish:'2026-11-15T03:00:00Z',duration_seconds:7200,filament_grams:25};
 view.rerender(<OrderDrafts state={orderedState} proposal={{...proposal,blocked:[],assignments:[assignment]}} onRevise={vi.fn()}/>);expect(screen.getByText('Proposed')).toBeInTheDocument();
 view.rerender(<OrderDrafts state={orderedState} proposal={{...proposal,blocked:[],assignments:[assignment,assignment]}} onRevise={vi.fn()}/>);expect(screen.getByText('Printer overlap')).toBeInTheDocument();
 view.rerender(<OrderDrafts state={{...orderedState,jobs:[{order_id:order.id,printer_id:'printer-1',status:'running',duration_seconds:7200}]}} onRevise={vi.fn()}/>);expect(screen.getByText('Printing')).toBeInTheDocument();
 view.rerender(<OrderDrafts state={{...orderedState,running:true,jobs:[{order_id:order.id,printer_id:'printer-1',status:'planned',duration_seconds:7200}]}} onRevise={vi.fn()} onDelete={vi.fn()}/>);expect(screen.getByText('Scheduled')).toBeInTheDocument();await user.click(screen.getByRole('button',{name:/Inspect order/}));expect(screen.getByText(/Pause the simulation before editing/)).toBeVisible();expect(screen.getByRole('button',{name:'Delete scheduled order'})).toBeDisabled();await user.click(screen.getByRole('button',{name:'Close order details'}));expect(screen.queryByRole('region',{name:'Selected order details'})).not.toBeInTheDocument();
});

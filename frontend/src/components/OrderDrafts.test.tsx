import {fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import {OrderDrafts} from './OrderDrafts';
import {orderedState} from '../test-fixtures';

test('quantity and deadline corrections stay held until a fresh schedule is confirmed',async()=>{
 const change=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();
 render(<OrderDrafts state={{...orderedState,orders:orderedState.orders.map(order=>({...order,requires_schedule_review:true}))}} onRevise={change}/>);
 await user.click(screen.getByText('Edit quantity and dates'));
 await user.clear(screen.getByLabelText('Revised copies'));await user.type(screen.getByLabelText('Revised copies'),'3');
 await user.click(screen.getByRole('button',{name:'Save order changes'}));
 expect(change).toHaveBeenCalledWith(expect.objectContaining({order_id:orderedState.orders[0].id,order:expect.objectContaining({quantity:3})}));
});

test('editing errors preserve dates and committed/completed orders cannot be edited',async()=>{
 const change=vi.fn().mockRejectedValue(new Error('Cannot meet deadline')),user=userEvent.setup();
 const held={...orderedState.orders[0],requires_schedule_review:true};
 const view=render(<OrderDrafts state={{...orderedState,orders:[held]}} onRevise={change}/>);
 await user.click(screen.getByText('Edit quantity and dates'));
 fireEvent.change(screen.getByLabelText('Revised print deadline (UTC)'),{target:{value:'2026-11-16T12:00'}});fireEvent.change(screen.getByLabelText('Revised ship deadline (UTC)'),{target:{value:'2026-11-17T12:00'}});
 await user.click(screen.getByRole('button',{name:'Save order changes'}));await screen.findByText('Cannot meet deadline');
 expect(screen.getByLabelText('Revised print deadline (UTC)')).toHaveValue('2026-11-16T12:00');
 view.rerender(<OrderDrafts state={{...orderedState,orders:[held],jobs:[{order_id:held.id,status:'planned'}]}} onRevise={change}/>);expect(screen.queryByText('Edit quantity and dates')).not.toBeInTheDocument();
 view.rerender(<OrderDrafts state={{...orderedState,orders:[{...held,successful_quantity:1}]}} onRevise={change}/>);expect(screen.queryByText('Edit quantity and dates')).not.toBeInTheDocument();
});

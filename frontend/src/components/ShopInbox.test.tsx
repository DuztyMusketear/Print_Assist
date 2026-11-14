import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import {ShopInbox} from './ShopInbox';
import {state} from '../test-fixtures';

test('incoming simulation explains both paths through confirmation to the printers',async()=>{
 const user=userEvent.setup();render(<ShopInbox state={state} onLoad={vi.fn()} onDecision={vi.fn()} onSchedule={vi.fn()} onSimulate={vi.fn()}/>);
 await user.click(screen.getByText('How the order demo works'));
 expect(screen.getByText(/Manual: open Request details/)).toBeVisible();
 expect(screen.getByText(/Automatic: match the saved model/)).toBeVisible();
 expect(screen.getByText(/Confirm and start printing/)).toBeVisible();
 expect(screen.getByText(/Overview shows the assigned printers/)).toBeVisible();
});

test('example feed is explicit and unmatched requests require a saved-model selection',async()=>{
 const load=vi.fn(),decide=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();
 const row={id:'EXAMPLE-003',source:'example' as const,sku:'CUSTOM',product_name:'Custom',artifact_id:null,quantity:2,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z',status:'pending' as const};
 render(<ShopInbox state={{...state,shop_requests:[row]}} onLoad={load} onDecision={decide} onSchedule={vi.fn()}/>);
 await user.click(screen.getByRole('button',{name:'Load example shop orders'}));expect(load).toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'Review schedule for EXAMPLE-003'})).toBeDisabled();
 await user.selectOptions(screen.getByLabelText('Saved model for EXAMPLE-003'),'figure-pla-blue');
 await user.click(screen.getByRole('button',{name:'Review schedule for EXAMPLE-003'}));
 expect(decide).toHaveBeenCalledWith({request_id:'EXAMPLE-003',decision:'accept',artifact_id:'figure-pla-blue'});
});

test('matched, accepted and rejected requests show distinct actions; errors preserve pending review',async()=>{
 const user=userEvent.setup(),decide=vi.fn().mockRejectedValue(new Error('State changed')),schedule=vi.fn();
 const base={source:'example' as const,sku:'FIGURE',product_name:'Figure',artifact_id:'figure-pla-blue',quantity:1,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z'};
 render(<ShopInbox state={{...state,shop_requests:[{...base,id:'pending',status:'pending'},{...base,id:'accepted',status:'accepted'},{...base,id:'rejected',status:'rejected'}]}} onLoad={vi.fn()} onDecision={decide} onSchedule={schedule}/>);
 for(const details of screen.getAllByText('Request details'))await user.click(details);
 expect(screen.getByText(/Example product match supplied/)).toBeVisible();expect(screen.getByText(/Acceptance does not start/)).toBeVisible();expect(screen.getByText(/Rejected. No production/)).toBeVisible();
 await user.click(screen.getByRole('button',{name:'View print schedule'}));expect(schedule).toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Reject pending'}));expect(decide).toHaveBeenCalledWith({request_id:'pending',decision:'reject'});await screen.findByText('State changed');
});

test('empty local feed and loading errors remain explicit',async()=>{
 const user=userEvent.setup();render(<ShopInbox state={state} onLoad={vi.fn().mockRejectedValue(new Error('Load failed'))} onDecision={vi.fn()} onSchedule={vi.fn()}/>);
 expect(screen.getByText(/No incoming requests/)).toBeVisible();await user.click(screen.getByRole('button',{name:'Load example shop orders'}));await screen.findByText('Load failed');
});

test('removed production preserves a distinct incoming-request history',async()=>{
 const user=userEvent.setup();render(<ShopInbox state={{...state,shop_requests:[{id:'SIM-1',source:'simulation',sku:'model',product_name:'Figure',artifact_id:'figure-pla-blue',quantity:1,priority:0,production_due:'2026-11-16T00:00:00Z',ship_by:'2026-11-17T00:00:00Z',status:'cancelled'}]}} onLoad={vi.fn()} onDecision={vi.fn()} onSchedule={vi.fn()}/>);await user.click(screen.getByText('Request details'));expect(screen.getByText(/Removed from production/)).toBeVisible();
});

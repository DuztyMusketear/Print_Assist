import {render,screen,within} from '@testing-library/react';
import {test,expect} from 'vitest';
import {PrintTimeline} from './PrintTimeline';
import {orderedState} from '../test-fixtures';

test('printer lanes identify the actual model, proposed times and deadline risk',()=>{
 const plan={id:'plan',session_id:orderedState.session_id,revision:1,mode:'automatic' as const,assumptions:'estimate',blocked:[],assignments:[{order_id:orderedState.orders[0].id,printer_id:'printer-1',start:'2026-11-15T10:00:00Z',finish:'2026-11-15T14:00:00Z',filament_grams:25,duration_seconds:14400}]};
 render(<PrintTimeline state={{...orderedState,visual_assets:[{id:'other',name:'Other preview',path:'/models/other.stl',units:'mm',rotation_degrees:[0,0,0]}],printers:[{id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}]}} proposal={plan}/>);
 expect(screen.getByRole('heading',{name:'Print timeline'})).toBeInTheDocument();
 expect(screen.getByText('Blue PLA figure')).toBeInTheDocument();
 expect(screen.getByText('Blue PLA figure').closest('summary')).toHaveAccessibleName(/Blue PLA figure.*proposed.*Past production deadline/);
 expect(within(screen.getByRole('list',{name:'Order color key'})).getByText(/Status: proposed.*Past production deadline/)).toBeVisible();
 expect(screen.getByLabelText('Timeline for Printer 1')).toBeInTheDocument();
});

test('order colors match their key across printers and final slots mark whole-order completion',()=>{
 const first=orderedState.orders[0],second={...first,id:'order-2',quantity:1},printers=['printer-1','printer-2'].map(id=>({id,status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}));
 const assignment={order_id:first.id,printer_id:'printer-1',start:'2026-11-15T01:00:00Z',finish:'2026-11-15T03:00:00Z',duration_seconds:7200,filament_grams:25};
 const plan={id:'p',session_id:orderedState.session_id,revision:1,mode:'automatic' as const,assumptions:'',blocked:[],assignments:[assignment,{...assignment,printer_id:'printer-2',finish:'2026-11-15T04:00:00Z'},{...assignment,order_id:second.id,start:'2026-11-15T04:00:00Z',finish:'2026-11-15T06:00:00Z'}]};
 const view=render(<PrintTimeline state={{...orderedState,orders:[first,second],printers}} proposal={plan}/>);
 const key=screen.getByRole('list',{name:'Order color key'}),rows=within(key).getAllByRole('listitem'),jobs=view.container.querySelectorAll<HTMLElement>('.timeline-job');
 expect(rows).toHaveLength(2);expect(jobs[0].style.getPropertyValue('--order-color')).toBe(rows[0].style.getPropertyValue('--order-color'));
 expect(jobs[0].style.getPropertyValue('--order-color')).toBe(jobs[2].style.getPropertyValue('--order-color'));
 expect(rows[0].style.getPropertyValue('--order-color')).not.toBe(rows[1].style.getPropertyValue('--order-color'));
 expect(within(key).getAllByText(/Est. completion:/)).toHaveLength(2);
 expect(screen.getAllByLabelText(/Estimated order completion/)).toHaveLength(2);
 view.rerender(<PrintTimeline state={{...orderedState,printers}} proposal={{...plan,assignments:[assignment]}}/>);
 expect(screen.queryByLabelText(/Estimated order completion/)).not.toBeInTheDocument();expect(screen.getByText('Completion unavailable — review schedule')).toBeVisible();
});

test('active and held attempts preserve existing slots and missing timing never crashes the overview',()=>{
 const printer={id:'printer-1',status:'running',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
 const view=render(<PrintTimeline state={{...orderedState,printers:[printer],jobs:[{order_id:orderedState.orders[0].id,printer_id:printer.id,status:'running',elapsed_seconds:10},{order_id:'unknown',printer_id:printer.id,status:'pending',duration_seconds:100,estimated_start:'2026-11-15T02:00:00Z',estimated_finish:'2026-11-15T03:00:00Z'},{order_id:'untimed',printer_id:printer.id,status:'paused'}]}}/>);
 expect(screen.getByText('Blue PLA figure')).toBeInTheDocument();expect(screen.getByText(/Waiting for an explicit/)).toBeInTheDocument();
 view.rerender(<PrintTimeline state={orderedState}/>);expect(screen.getByText(/No scheduled jobs yet/)).toBeInTheDocument();
});

test('paused and queued work is reforecast after delays rather than ending in the past',()=>{
 const printer={id:'printer-1',status:'paused',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
 render(<PrintTimeline state={{...orderedState,simulation_time:'2026-11-15T14:00:00Z',printers:[printer],jobs:[{order_id:orderedState.orders[0].id,printer_id:printer.id,status:'paused',duration_seconds:7200,elapsed_seconds:3600,estimated_start:'2026-11-15T00:00:00Z',estimated_finish:'2026-11-15T02:00:00Z'},{order_id:orderedState.orders[0].id,printer_id:printer.id,status:'planned',duration_seconds:7200,estimated_start:'2026-11-15T02:00:00Z',estimated_finish:'2026-11-15T04:00:00Z'}]}}/>);
 expect(within(screen.getByRole('list',{name:'Order color key'})).getByText(/Past production deadline/)).toBeVisible();
});

test('a planned job on an otherwise empty printer starts its forecast at the current clock',()=>{
 const printer={id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
 render(<PrintTimeline state={{...orderedState,printers:[printer],jobs:[{order_id:orderedState.orders[0].id,printer_id:printer.id,status:'planned',duration_seconds:7200,elapsed_seconds:0}]}}/>);
 expect(screen.getByText('Blue PLA figure')).toBeVisible();expect(screen.getByText('planned')).toBeVisible();
});

test('calendar view controls and overlapping printer allocations are visible',async()=>{
 const {default:userEvent}=await import('@testing-library/user-event');const user=userEvent.setup(),printer={id:'printer-1',status:'running',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
 const proposal={id:'p',session_id:orderedState.session_id,revision:1,mode:'automatic' as const,assumptions:'',blocked:[],assignments:[{order_id:orderedState.orders[0].id,printer_id:printer.id,start:'2026-11-15T01:00:00Z',finish:'2026-11-15T03:00:00Z',duration_seconds:7200,filament_grams:25}]};
 render(<PrintTimeline state={{...orderedState,printers:[printer],jobs:[{order_id:orderedState.orders[0].id,printer_id:printer.id,status:'running',duration_seconds:7200}]}} proposal={proposal}/>);expect(within(screen.getByRole('list',{name:'Order color key'})).getByText(/Printer overlap/)).toBeVisible();await user.click(screen.getByRole('button',{name:'Week'}));expect(screen.getByLabelText('Calendar axis')).toHaveTextContent('Nov');await user.click(screen.getByRole('button',{name:'Month'}));expect(screen.getByLabelText('Calendar axis')).toHaveTextContent('Week of');
});

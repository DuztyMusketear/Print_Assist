import {render,screen} from '@testing-library/react';
import {test,expect} from 'vitest';
import {PrintTimeline} from './PrintTimeline';
import {orderedState} from '../test-fixtures';

test('printer lanes identify the actual model, proposed times and deadline risk',()=>{
 const plan={id:'plan',session_id:orderedState.session_id,revision:1,mode:'automatic' as const,assumptions:'estimate',blocked:[],assignments:[{order_id:orderedState.orders[0].id,printer_id:'printer-1',start:'2026-11-15T10:00:00Z',finish:'2026-11-15T14:00:00Z',filament_grams:25,duration_seconds:14400}]};
 render(<PrintTimeline state={{...orderedState,visual_assets:[{id:'other',name:'Other preview',path:'/models/other.stl',units:'mm',rotation_degrees:[0,0,0]}],printers:[{id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}]}} proposal={plan}/>);
 expect(screen.getByRole('heading',{name:'Print timeline'})).toBeInTheDocument();
 expect(screen.getByText('Blue PLA figure')).toBeInTheDocument();expect(screen.getByText(/Past production deadline/)).toBeInTheDocument();
 expect(screen.getByLabelText('Timeline for Printer 1')).toBeInTheDocument();
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
 expect(screen.getAllByText(/Past production deadline/)).toHaveLength(2);
});

test('a planned job on an otherwise empty printer starts its forecast at the current clock',()=>{
 const printer={id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
 render(<PrintTimeline state={{...orderedState,printers:[printer],jobs:[{order_id:orderedState.orders[0].id,printer_id:printer.id,status:'planned',duration_seconds:7200,elapsed_seconds:0}]}}/>);
 expect(screen.getByText('Blue PLA figure')).toBeVisible();expect(screen.getByText('planned')).toBeVisible();
});

import {render,screen} from '@testing-library/react';
import {test,expect} from 'vitest';
import {OperationalStatus} from './OperationalStatus';
import {state,orderedState} from '../test-fixtures';
import type {Snapshot} from '../api';

test('healthy dashboard has no operational status panel',()=>{
 const view=render(<OperationalStatus state={state}/>);expect(view.container).toBeEmptyDOMElement();
});

test('current late forecast identifies the order, model and specific late part with due and ETA',()=>{
 render(<OperationalStatus state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,risk:'late',completion:'2026-11-15T14:00:00Z',reason:'Deadline exceeded'}],jobs:[{id:'job-1',order_id:orderedState.orders[0].id,printer_id:'printer-1',status:'planned',duration_seconds:50400}]}}/>);
 const warning=screen.getByRole('list',{name:'Current deadline warnings'});
 expect(warning).toHaveTextContent('Blue PLA figure');expect(warning).toHaveTextContent('Order 000002');
 expect(warning).toHaveTextContent('Part 1');expect(warning).toHaveTextContent('Printer 1');
 expect(warning).toHaveTextContent('Production due:');expect(warning).toHaveTextContent('ETA:');
 expect(screen.getByText(/1 unassigned parts/)).toHaveClass('deadline-risk');
 expect(screen.getByText(/Part 1/)).toHaveClass('deadline-risk');
});

test('only unavailable or late parts are red, held jobs do not promise completion',()=>{
 render(<OperationalStatus state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,risk:'unavailable',completion:null,reason:'Printer paused; completion unavailable'}],printers:[{id:'printer-1',status:'paused',capabilities:[],material:{type:'PLA',color:'blue',grams:1000}}],jobs:[{id:'job-1',order_id:orderedState.orders[0].id,printer_id:'printer-1',status:'paused',duration_seconds:60},{id:'job-2',order_id:orderedState.orders[0].id,printer_id:'printer-2',status:'planned',duration_seconds:60}]}}/>);
 expect(screen.getByText(/Part 1/)).toHaveTextContent('ETA: unavailable');
 expect(screen.queryByText(/Part 2/)).not.toBeInTheDocument();
 expect(screen.getByText(/Printer paused; completion unavailable/)).toHaveTextContent('ETA: unavailable');
});

test('latest automatic order progress and transfer summary remain visible without historical risk coloring',()=>{
 const reports={...state,order_demonstrations:[{id:'old',order_id:'old',status:'completed',steps:[]},{id:'new',order_id:'new',status:'running',steps:[{id:'s',label:'Printing parts',status:'running',timestamp:state.simulation_time}]}],workload_transfers:[{id:'old',summary:'Old transfer'},{id:'new',summary:'Transferred two parts to Printer 2',source_printer:'printer-1',action:'offline',waste_grams:4,blocked:[]}]};
 const view=render(<OperationalStatus state={reports}/>);
 expect(screen.getByText(/Printing parts/)).toHaveTextContent('running');expect(screen.getByText(/Transferred two parts/)).toBeVisible();
 expect(screen.queryByText('Old transfer')).not.toBeInTheDocument();expect(view.container.querySelector('.deadline-risk')).toBeNull();
});

test('unmatched automatic orders show a useful attention reason without an order identifier',()=>{
 render(<OperationalStatus state={{...state,order_demonstrations:[{id:'d',order_id:null,status:'needs_attention',reason:'Choose a saved model',steps:[]}]}}/>);
 expect(screen.getByText(/Model match required/)).toBeVisible();expect(screen.getByText('Choose a saved model')).toHaveClass('deadline-risk');
});

test('historical manual completions do not block a current automatic part ETA',()=>{
 render(<OperationalStatus state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,risk:'late',completion:'2026-11-15T14:00:00Z',reason:''}],jobs:[{id:'job-0',order_id:orderedState.orders[0].id,printer_id:'printer-1',status:'completed',schedule_mode:'manual'},{id:'job-1',order_id:orderedState.orders[0].id,printer_id:'printer-1',status:'planned',schedule_mode:'automatic',duration_seconds:50400}]}}/>);
 expect(screen.getByText(/Part 1/)).not.toHaveTextContent('unavailable');
});

test('unknown models retain their artifact reference and irrelevant forecasts stay hidden',()=>{
 const snapshot:Snapshot={...orderedState,artifacts:[],forecasts:[{order_id:'missing',risk:'late',completion:null,reason:'Missing'},{order_id:orderedState.orders[0].id,risk:'unavailable',completion:null,reason:'No model'}],order_demonstrations:[{id:'d',order_id:orderedState.orders[0].id,status:'completed',reason:'Printing finished',steps:[]}]};
 const view=render(<OperationalStatus state={snapshot}/>);expect(screen.getByText(/figure-pla-blue/)).toBeVisible();expect(screen.getByText('Printing finished')).not.toHaveClass('deadline-risk');
 view.rerender(<OperationalStatus state={{...snapshot,orders:[{...snapshot.orders[0],status:'cancelled'}]}}/>);expect(screen.queryByRole('list',{name:'Current deadline warnings'})).not.toBeInTheDocument();
});

test.each(['offline','faulted','idle'])('unavailable printer and manual schedules expose unavailable part ETA (%s)',status=>{
 render(<OperationalStatus state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,risk:'unavailable',completion:null,reason:'Capacity unavailable'}],printers:[{id:'printer-1',status,capabilities:[],material:{type:'PLA',color:'blue',grams:1000}}],jobs:[{id:'job-1',order_id:orderedState.orders[0].id,printer_id:'printer-1',status:'planned',schedule_mode:status==='idle'?'manual':'automatic',duration_seconds:60}]}}/>);
 expect(screen.getByText(/Part 1/)).toHaveTextContent('ETA: unavailable');
});

test('a part without a known duration does not display a guessed finish',()=>{
 render(<OperationalStatus state={{...orderedState,artifacts:[],forecasts:[{order_id:orderedState.orders[0].id,risk:'unavailable',completion:null,reason:'No duration'}],jobs:[{id:'job-1',order_id:orderedState.orders[0].id,printer_id:'printer-1',status:'planned'}]}}/>);
 expect(screen.getByText(/Part 1/)).toHaveTextContent('ETA: unavailable');
});

test.each(['manual','automatic'])('started %s work keeps its late part ETA despite future manual queue holds',schedule_mode=>{
 const job={order_id:orderedState.orders[0].id,printer_id:'printer-1',duration_seconds:50400};
 render(<OperationalStatus state={{...orderedState,printers:[{id:'printer-1',status:'running',capabilities:[],material:{type:'PLA',color:'blue',grams:1000}}],forecasts:[{order_id:orderedState.orders[0].id,risk:'unavailable',completion:null,reason:'Queued manual work requires start'}],jobs:[{...job,id:'job-1',status:'running',schedule_mode},{...job,id:'job-2',status:'planned',schedule_mode:'manual'}]}}/>);
 expect(screen.getByText(/Part 1/)).toHaveTextContent('running');expect(screen.getByText(/Part 1/)).toHaveTextContent('ETA: 11/15/2026, 2:00:00 PM UTC');
 expect(screen.getByText(/Part 2/)).toHaveTextContent('ETA: unavailable');
});

test('a future manual hold only removes ETA for that queued part and work following it',()=>{
 const job={order_id:orderedState.orders[0].id,printer_id:'printer-1',duration_seconds:50400,status:'planned',schedule_mode:'automatic'};
 render(<OperationalStatus state={{...orderedState,forecasts:[{order_id:orderedState.orders[0].id,risk:'unavailable',completion:null,reason:'Manual queue hold'}],jobs:[{...job,id:'job-3',estimated_start:'2026-11-16T04:00:00Z'},{...job,id:'job-2',schedule_mode:'manual',estimated_start:'2026-11-15T14:00:00Z'},{...job,id:'job-1',estimated_start:'2026-11-15T00:00:00Z'}]}}/>);
 expect(screen.getByText(/Part 1/)).toHaveTextContent('ETA: 11/15/2026, 2:00:00 PM UTC');
 expect(screen.getByText(/Part 2/)).toHaveTextContent('ETA: unavailable');expect(screen.getByText(/Part 3/)).toHaveTextContent('ETA: unavailable');
});



test('deadline ordering keeps an urgent automatic ETA before a later manual queue hold',()=>{
 const later={...orderedState.orders[0],priority:10};
 const early={...later,id:'early',quantity:1,priority:0,production_due:'2026-11-15T03:00:00Z'};
 const job={printer_id:'printer-1',status:'planned',duration_seconds:14400};
 render(<OperationalStatus state={{...orderedState,orders:[later,early],forecasts:[{order_id:early.id,risk:'late',completion:'2026-11-15T04:00:00Z',reason:''}],jobs:[{...job,id:'job-1',order_id:later.id,schedule_mode:'manual',estimated_start:'2026-11-15T00:00:00Z'},{...job,id:'job-2',order_id:early.id,schedule_mode:'automatic',estimated_start:'2026-11-15T04:00:00Z'}]}}/>);
 expect(screen.getByText(/Part 2/)).toHaveTextContent('ETA: 11/15/2026, 4:00:00 AM UTC');
 expect(screen.getByText(/Part 2/)).not.toHaveTextContent('unavailable');
});

test('historical progress tolerates orphan queued references without inventing warnings',()=>{
 const job={order_id:'removed',printer_id:'printer-1',status:'planned',duration_seconds:60};
 render(<OperationalStatus state={{...state,jobs:[{...job,id:'a'},{...job,id:'b'}],order_demonstrations:[{id:'d',order_id:null,status:'needs_attention',reason:'Select a model',steps:[]}]}}/>);
 expect(screen.getByText('Select a model')).toBeVisible();
 expect(screen.queryByRole('list',{name:'Current deadline warnings'})).not.toBeInTheDocument();
});

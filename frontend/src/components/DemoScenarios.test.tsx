import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test,vi} from 'vitest';
import {DemoScenarios} from './DemoScenarios';
import {RejectedCommand} from '../api';
import {state} from '../test-fixtures';

const workshop={...state,printers:[{id:'lab-west',status:'running',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:500}}]};
async function open(){await userEvent.click(screen.getByText('Demo scenarios'));}
test('panel starts collapsed and describes deterministic simulated controls',async()=>{
 render(<DemoScenarios state={workshop} onTrigger={vi.fn()}/>);
 expect(screen.getByText('Demo scenarios').closest('details')).not.toHaveAttribute('open');await open();
 expect(screen.getByText('Deterministic tools; live agent orchestration is planned.')).toBeVisible();
 expect(screen.getByText(/Agent controls: OFF/)).toBeVisible();
 expect(screen.getByRole('option',{name:'lab-west - running'})).toBeInTheDocument();
});
test.each(['marketplace_order','urgent_order'])('%s sends configured order requirements and simulation clock',async event=>{
 const trigger=vi.fn().mockResolvedValue(undefined);render(<DemoScenarios state={workshop} onTrigger={trigger}/>);await open();
 fireEvent.change(screen.getByLabelText('Demo event'),{target:{value:event}});
 fireEvent.change(screen.getByLabelText('Product identifier'),{target:{value:'CUSTOM-42'}});
 fireEvent.change(screen.getByLabelText('Demo quantity'),{target:{value:'3'}});
 fireEvent.change(screen.getByLabelText('Demo priority'),{target:{value:'7'}});
 fireEvent.change(screen.getByLabelText('Deadline in simulated hours'),{target:{value:'4'}});
 fireEvent.change(screen.getByLabelText('Filament type'),{target:{value:'PETG'}});
 fireEvent.change(screen.getByLabelText('Filament color'),{target:{value:'orange'}});
 fireEvent.change(screen.getByLabelText('Order processing'),{target:{value:'end_to_end'}});
 fireEvent.change(screen.getByLabelText('Demo playback speed'),{target:{value:'300'}});
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));
 await waitFor(()=>expect(trigger).toHaveBeenCalledWith(expect.objectContaining({event,event_id:expect.any(String),product_id:'CUSTOM-42',filament_type:'PETG',color:'orange',recovery_mode:null,order:expect.objectContaining({artifact_id:'figure-pla-blue',quantity:3,priority:7,mode:'end_to_end',clock_speed:300,production_due:'2026-11-15T04:00:00.000Z'})})));
});
test.each(['thermal_fault','insufficient_filament','printer_restored'])('%s targets arbitrary printer identity and explicit recovery settings',async event=>{
 const trigger=vi.fn().mockResolvedValue(undefined);render(<DemoScenarios state={workshop} onTrigger={trigger}/>);await open();
 fireEvent.change(screen.getByLabelText('Demo event'),{target:{value:event}});
 fireEvent.change(screen.getByLabelText('Recovery mode'),{target:{value:'automatic'}});
 if(event==='insufficient_filament')fireEvent.change(screen.getByLabelText('Available filament (g)'),{target:{value:'2'}});
 if(event==='printer_restored'){
  expect(screen.getByRole('button',{name:'Trigger simulated event'})).toBeDisabled();
  await userEvent.click(screen.getByLabelText(/I inspected/));
  fireEvent.change(screen.getByLabelText('Refill filament (g)'),{target:{value:'750'}});
 }
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));
 await waitFor(()=>expect(trigger).toHaveBeenCalledWith(expect.objectContaining({event,printer_id:'lab-west',recovery_mode:'automatic',confirmed:event==='printer_restored',...(event==='printer_restored'?{refill_grams:750}:{}),...(event==='insufficient_filament'?{available_grams:2}:{})})));
});
test('uncertain outcome freezes settings and retries the exact event before accepting another',async()=>{
 const trigger=vi.fn().mockRejectedValueOnce(new Error('Outcome unknown')).mockResolvedValue(undefined);render(<DemoScenarios state={workshop} onTrigger={trigger}/>);await open();
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));await screen.findByRole('alert');
 expect(screen.getByLabelText('Demo event')).toBeDisabled();
 await userEvent.click(screen.getByRole('button',{name:'Retry simulated event'}));
 expect(trigger.mock.calls[1][0]).toBe(trigger.mock.calls[0][0]);
 await waitFor(()=>expect(screen.getByLabelText('Demo event')).toBeEnabled());
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));
 expect(trigger.mock.calls[2][0].event_id).not.toBe(trigger.mock.calls[0][0].event_id);
});
test('rejected events allow correction and report the reason',async()=>{
 const trigger=vi.fn().mockRejectedValue(new RejectedCommand('Printer is unavailable'));render(<DemoScenarios state={workshop} onTrigger={trigger}/>);await open();
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));expect(await screen.findByRole('alert')).toHaveTextContent('Printer is unavailable');
 expect(screen.getByLabelText('Demo event')).toBeEnabled();
});
test('empty workshop supports manual unmatched orders but prevents equipment events',async()=>{
 const trigger=vi.fn().mockResolvedValue(undefined);render(<DemoScenarios state={{...state,artifacts:[]}} onTrigger={trigger}/>);await open();
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));expect(trigger).toHaveBeenCalledWith(expect.objectContaining({order:expect.objectContaining({artifact_id:null,mode:'manual'})}));
 fireEvent.change(screen.getByLabelText('Demo event'),{target:{value:'thermal_fault'}});
 expect(screen.getByRole('button',{name:'Trigger simulated event'})).toBeDisabled();expect(screen.getByText(/No simulated printers/)).toBeVisible();
});
test('event history displays persisted outcomes, real tool names and deadline impacts',async()=>{
 const history={...workshop,scenario_events:[{event_id:'one',event:'thermal_fault',status:'applied',notification:'Printer isolated; work held',timestamp:state.simulation_time,impacts:[{order_id:'order-42',original_completion:null,revised_completion:'2026-11-16T00:00:00Z',production_due:'2026-11-15T12:00:00Z',risk:'late'}],tool_calls:[{name:'inject_fault',status:'applied',timestamp:state.simulation_time},{name:'review_recovery',status:'held',timestamp:state.simulation_time}]}]};
 render(<DemoScenarios state={history} onTrigger={vi.fn()}/>);await open();
 expect(screen.getByRole('status')).toHaveTextContent('Printer isolated; work held');
 expect(screen.getByText(/Original completion:/)).toHaveTextContent('unavailable');
 expect(screen.getByText(/Revised completion:/)).toHaveClass('deadline-risk');
 await userEvent.click(screen.getByText('Scenario event history (1)'));await userEvent.click(screen.getByText('Recorded deterministic tool calls'));expect(screen.getByText('inject_fault')).toBeVisible();expect(screen.getByText('review_recovery')).toBeVisible();expect(screen.getByText('review_recovery').closest('li')).toHaveTextContent('held');
});

test('pending requests disable duplicate submissions and preserve current recovery policy',async()=>{
 let finish!:()=>void;const trigger=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
 render(<DemoScenarios state={{...workshop,recovery_policy:'automatic'}} onTrigger={trigger}/>);await open();
 expect(screen.getByLabelText('Recovery mode')).toHaveValue('automatic');
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));
 expect(screen.getByRole('button',{name:'Sending simulated event...'})).toBeDisabled();expect(screen.getByLabelText('Demo event')).toBeDisabled();
 fireEvent.submit(screen.getByRole('button',{name:'Sending simulated event...'}).closest('form')!);expect(trigger).toHaveBeenCalledTimes(1);
 finish();await waitFor(()=>expect(screen.getByRole('button',{name:'Trigger simulated event'})).toBeEnabled());
});

test('demo events preserve recovery policy changed elsewhere until an explicit override is selected',async()=>{
 const trigger=vi.fn().mockResolvedValue(undefined);const view=render(<DemoScenarios state={workshop} onTrigger={trigger}/>);await open();
 view.rerender(<DemoScenarios state={{...workshop,recovery_policy:'automatic'}} onTrigger={trigger}/>);
 expect(screen.getByLabelText('Recovery mode')).toHaveValue('automatic');
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));
 expect(trigger).toHaveBeenLastCalledWith(expect.objectContaining({recovery_mode:null}));
 fireEvent.change(screen.getByLabelText('Recovery mode'),{target:{value:'review'}});
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));
 expect(trigger).toHaveBeenLastCalledWith(expect.objectContaining({recovery_mode:'review'}));
 expect(screen.getByLabelText('Recovery mode')).toHaveValue('automatic');
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));
 expect(trigger).toHaveBeenLastCalledWith(expect.objectContaining({recovery_mode:null}));
});

test('legacy snapshots without a recovery policy show review without implicitly setting it',async()=>{
 const legacy={...workshop};Reflect.deleteProperty(legacy,'recovery_policy');
 const trigger=vi.fn().mockResolvedValue(undefined);render(<DemoScenarios state={legacy} onTrigger={trigger}/>);await open();
 expect(screen.getByLabelText('Recovery mode')).toHaveValue('review');
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));
 expect(trigger).toHaveBeenCalledWith(expect.objectContaining({recovery_mode:null}));
});

test('changing saved models copies material requirements and unmatched selection keeps operator input',async()=>{
 const artifact={...state.artifacts[0],id:'alternate',name:'Alternate PETG part',filament_type:'PETG',color:'white'};
 const second={...workshop.printers[0],id:'printer-7',status:'idle'};
 const trigger=vi.fn().mockResolvedValue(undefined);render(<DemoScenarios state={{...workshop,artifacts:[...state.artifacts,artifact],printers:[...workshop.printers,second]}} onTrigger={trigger}/>);await open();
 fireEvent.change(screen.getByLabelText('Saved demo model'),{target:{value:'alternate'}});
 expect(screen.getByLabelText('Filament type')).toHaveValue('PETG');expect(screen.getByLabelText('Filament color')).toHaveValue('white');
 fireEvent.change(screen.getByLabelText('Saved demo model'),{target:{value:''}});expect(screen.getByText(/No saved model selected/)).toBeVisible();
 fireEvent.change(screen.getByLabelText('Saved demo model'),{target:{value:'alternate'}});
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));expect(trigger).toHaveBeenLastCalledWith(expect.objectContaining({order:expect.objectContaining({artifact_id:'alternate'})}));
 fireEvent.change(screen.getByLabelText('Demo event'),{target:{value:'thermal_fault'}});fireEvent.change(screen.getByLabelText('Simulated printer'),{target:{value:'printer-7'}});
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));expect(trigger).toHaveBeenLastCalledWith(expect.objectContaining({printer_id:'printer-7'}));
});

test('unknown failures display safe error text and retain the retry while enabled controls stay truthful',async()=>{
 render(<DemoScenarios state={{...workshop,controls:{agents_enabled:true,automatic_triggers:true}}} onTrigger={vi.fn().mockRejectedValue('network disconnected')}/>);await open();
 expect(screen.getByText(/Agent controls: ON/)).toHaveTextContent('Automatic triggers ON');
 await userEvent.click(screen.getByRole('button',{name:'Trigger simulated event'}));expect(await screen.findByRole('alert')).toHaveTextContent('The simulated event failed.');expect(screen.getByRole('button',{name:'Retry simulated event'})).toBeEnabled();
});

test('current capacity replaces removed selections and safe history has no warning color',async()=>{
 const trigger=vi.fn().mockResolvedValue(undefined);const view=render(<DemoScenarios state={workshop} onTrigger={trigger}/>);await open();
 view.rerender(<DemoScenarios state={{...workshop,printers:[{...workshop.printers[0],id:'replacement'}],scenario_events:[{event:'new_event',impacts:[false,[],{risk:'on_time',original_completion:12}],tool_calls:[{}]}]}} onTrigger={trigger}/>);
 fireEvent.change(screen.getByLabelText('Demo event'),{target:{value:'thermal_fault'}});
 expect(screen.getByLabelText('Simulated printer')).toHaveValue('replacement');
 expect(screen.getByText(/Revised completion:/)).not.toHaveClass('deadline-risk');
 expect(screen.getByText('Unnamed tool')).toBeInTheDocument();
});

test('history tolerates missing and malformed details without promising invented outcomes',async()=>{
 render(<DemoScenarios state={{...workshop,scenario_events:[{event:null,status:null,notification:null,impacts:[null,{order_id:null,risk:'unavailable'}],tool_calls:[]}]}} onTrigger={vi.fn()}/>);await open();
 expect(screen.getByRole('status')).toHaveTextContent('Scenario event recorded.');
 await userEvent.click(screen.getByText('Scenario event history (1)'));await userEvent.click(screen.getByText('Recorded deterministic tool calls'));expect(screen.getByText('No tool calls recorded.')).toBeVisible();
 expect(screen.getByText(/Revised completion:/)).toHaveTextContent('unavailable');
});

test('keeps reset visible inside the scenario controls panel while events are collapsed',()=>{render(<DemoScenarios state={state} onTrigger={vi.fn()} onReset={vi.fn()}/>);expect(screen.getByRole('heading',{name:'Scenario controls'})).toBeVisible();expect(screen.getByRole('heading',{name:'Reset workshop'})).toBeVisible();expect(screen.getByRole('button',{name:'Reset scenario'})).toBeVisible();});

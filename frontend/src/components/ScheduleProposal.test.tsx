import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import {ScheduleProposal} from './ScheduleProposal';
import {state} from '../test-fixtures';

test('guided confirmation shows deadline problems and submits the server deadline guard',async()=>{
 const proposal={id:'hash',session_id:state.session_id,revision:0,mode:'automatic',assumptions:'Estimate',assignments:[{order_id:'order-1',printer_id:'printer-1',start:'2026-11-15T00:00:00Z',finish:'2026-11-15T02:00:00Z',filament_grams:25,duration_seconds:7200}],blocked:[]};
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(proposal)));
 const user=userEvent.setup(),apply=vi.fn().mockResolvedValue(undefined);
 const view=render(<ScheduleProposal guided state={state} onApply={apply}/>);
 await user.click(screen.getByRole('button',{name:'Preview schedule'}));await screen.findByRole('button',{name:'Confirm and start printing'});
 expect(screen.getByText(/Proposed jobs: estimated printer time: 2 h/)).toHaveTextContent('Estimated filament: 25.0 g');
 await user.click(screen.getByRole('button',{name:'Confirm and start printing'}));
 expect(apply).toHaveBeenCalledWith({proposal_id:'hash',mode:'automatic',clock_speed:60,require_on_time:true});
 view.rerender(<ScheduleProposal guided state={{...state,orders:[{id:'order-1',artifact_id:'figure-pla-blue',quantity:1,priority:0,production_due:'2026-11-15T01:00:00Z',ship_by:'2026-11-16T00:00:00Z',status:'queued',successful_quantity:0}]}} onApply={apply}/>);
 expect(screen.getByRole('button',{name:'Confirm and start printing'})).toBeDisabled();
 expect(screen.getByText(/This plan cannot meet/)).toBeInTheDocument();
});
test('preview shows future slots and material before guarded apply; stale revisions disable it',async()=>{
 const proposal={id:'hash',session_id:state.session_id,revision:0,mode:'automatic',assumptions:'Model estimates',assignments:[{order_id:'order-1',printer_id:'printer-1',start:'2026-11-15T00:00:00Z',finish:'2026-11-15T02:00:00Z',filament_grams:25,duration_seconds:7200}],blocked:[]};
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(proposal)));
 const user=userEvent.setup(),onApply=vi.fn().mockResolvedValue(undefined);
 const view=render(<ScheduleProposal state={state} onApply={onApply}/>);
 await user.click(screen.getByRole('button',{name:'Preview schedule'}));await screen.findByText(/25 g/);
 await user.click(screen.getByRole('button',{name:'Apply reviewed schedule'}));expect(onApply).toHaveBeenCalledWith({proposal_id:'hash',mode:'automatic',clock_speed:60});
 view.rerender(<ScheduleProposal state={{...state,revision:1}} onApply={onApply}/>);
 expect(screen.getByRole('button',{name:'Apply reviewed schedule'})).toBeDisabled();expect(screen.getByText(/State changed/)).toBeInTheDocument();
});


test('manual previews explain blocked work, empty plans and server failures',async()=>{
 const proposal={id:'manual',session_id:state.session_id,revision:0,mode:'manual',assumptions:'Model estimates',assignments:[],blocked:[{order_id:'order-1',quantity:2,reason:'No filament'}]};
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response('',{status:500})).mockResolvedValueOnce(new Response(JSON.stringify(proposal)));
 const user=userEvent.setup();const view=render(<ScheduleProposal state={{...state,material_reservations:[{printer_id:'printer-1',stock_grams:100,reserved_grams:25,available_grams:75}]}} onApply={vi.fn()}/>);
 expect(screen.getByText(/25.0 g reserved/)).toBeInTheDocument();
 await user.selectOptions(screen.getByLabelText('Review playback speed'),'1');
 await user.selectOptions(screen.getByLabelText('Proposed start mode'),'manual');await user.click(screen.getByRole('button',{name:'Preview schedule'}));await screen.findByText(/Unable to preview/);
 await user.click(screen.getByRole('button',{name:'Preview schedule'}));await screen.findByText(/No new assignments/);expect(screen.getByText(/No filament/)).toBeInTheDocument();
 view.rerender(<ScheduleProposal state={{...state,running:true}} onApply={vi.fn()}/>);expect(screen.getByRole('button',{name:'Preview schedule'})).toBeDisabled();expect(screen.getByText(/Pause clock to preview/)).toBeInTheDocument();
});

test.each(['session','revision'])('late %s preview results and failed applies report clear errors',async(kind)=>{
 const proposal={id:'hash',session_id:state.session_id,revision:0,mode:'automatic',assumptions:'Estimate',assignments:[{order_id:'order-1',printer_id:'printer-1',start:'now',finish:'later',filament_grams:25,duration_seconds:60}],blocked:[]};
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify(proposal))).mockResolvedValueOnce(new Response(JSON.stringify({...proposal,...(kind==='session'?{session_id:'other'}:{revision:2})})));
 const user=userEvent.setup();render(<ScheduleProposal state={state} onApply={vi.fn().mockRejectedValue(new Error('Proposal rejected'))}/>);
 await user.click(screen.getByRole('button',{name:'Preview schedule'}));await screen.findByText(/25 g/);
 await user.click(screen.getByRole('button',{name:'Apply reviewed schedule'}));await screen.findByText('Proposal rejected');
 await user.click(screen.getByRole('button',{name:'Preview schedule'}));await screen.findByText(/State changed. Preview the current/);
});


test('preview mode cannot be changed while its request is pending',async()=>{
 let finish!:(response:Response)=>void;vi.spyOn(globalThis,'fetch').mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const user=userEvent.setup();render(<ScheduleProposal state={state} onApply={vi.fn()}/>);
 await user.click(screen.getByRole('button',{name:'Preview schedule'}));
 expect(screen.getByLabelText('Proposed start mode')).toBeDisabled();
 finish(new Response(JSON.stringify({id:'p',session_id:state.session_id,revision:0,mode:'automatic',assignments:[],blocked:[],assumptions:'Estimate'})));
 await screen.findByText('No new assignments available.');expect(screen.getByLabelText('Proposed start mode')).toBeEnabled();
});

test('guided manual confirmation preserves the explicit-start mode',async()=>{
 const proposal={id:'manual',session_id:state.session_id,revision:0,mode:'manual',assumptions:'Estimate',assignments:[{order_id:'order-1',printer_id:'printer-1',start:'2026-11-15T00:00:00Z',finish:'2026-11-15T02:00:00Z',filament_grams:25,duration_seconds:7200}],blocked:[]};
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(proposal)));
 const apply=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();render(<ScheduleProposal guided state={state} onApply={apply}/>);
 await user.selectOptions(screen.getByLabelText('Proposed start mode'),'manual');await user.click(screen.getByRole('button',{name:'Preview schedule'}));await screen.findByRole('button',{name:'Confirm manual schedule'});await user.click(screen.getByRole('button',{name:'Confirm manual schedule'}));expect(apply).toHaveBeenCalledWith({proposal_id:'manual',mode:'manual',clock_speed:60,require_on_time:true});
});

test('automatic incoming review previews once and reports preview mode changes to order cards',async()=>{
 const proposal={id:'auto',session_id:state.session_id,revision:0,mode:'automatic',assignments:[],blocked:[],assumptions:'Estimate'};
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(proposal))),onPreview=vi.fn(),user=userEvent.setup();render(<ScheduleProposal guided autoPreview state={state} onApply={vi.fn()} onPreview={onPreview}/>);await screen.findByText('No new assignments available.');expect(fetch).toHaveBeenCalledOnce();expect(onPreview).toHaveBeenCalledWith(proposal);await user.selectOptions(screen.getByLabelText('Proposed start mode'),'manual');expect(onPreview).toHaveBeenLastCalledWith(undefined);
});

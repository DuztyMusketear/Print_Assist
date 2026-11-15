import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test,vi} from 'vitest';
import {IncidentPanel} from './IncidentPanel';
import {state} from '../test-fixtures';

const incident={id:'incident-a',printer_id:'press-west',fault_type:'thermal',timestamp:'2026-11-15T00:00:00Z',status:'awaiting_review',summary:'Printing stopped safely.',waste_grams:3,equipment_cleared:false};
const snapshot={...state,incidents:[incident],recovery_policy:'review' as const};
const proposal={id:'proposal-a',incident_id:incident.id,session_id:state.session_id,revision:0,summary:'Move the interrupted work.',assignments:[{order_id:'order-a',printer_id:'press-east',start:'now',finish:'later',duration_seconds:60,filament_grams:8}],blocked:[],impacts:[{order_id:'order-a',original_completion:'before',revised_completion:'after',delta_seconds:60,production_due:'due',risk:'late',original_printers:['press-west'],revised_printers:['press-east'],change:'direct',waste_grams:3}]};
async function inspectIncident() {await userEvent.setup().click(screen.getAllByRole('button',{name:'Inspect incident'}).at(-1)!);}

test('reviews durable incident impacts and forwards the reviewed revision',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(proposal)));
 const command=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();
 const view=render(<IncidentPanel state={snapshot} onCommand={command}/>);await inspectIncident();
 expect(screen.getByText('Printing stopped safely.')).toBeInTheDocument();
 expect(screen.getByText('Deterministic simulation summary \u00b7 Agents remain off.')).toBeVisible();
 expect(screen.getByText(/3.0 g/)).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Preview recovery'}));
 await screen.findByText('Move the interrupted work.');
 await user.click(screen.getByText('Order schedule impact (1)'));
 expect(screen.getByRole('table',{name:'Order schedule impact'})).toHaveTextContent('before');
 await user.click(screen.getByRole('checkbox',{name:/I reviewed/}));
 await user.click(screen.getByRole('button',{name:'Apply recovery'}));
 expect(command).toHaveBeenCalledWith('/api/incidents/recover',{incident_id:'incident-a',proposal_id:'proposal-a',confirmed:true},0);
 view.rerender(<IncidentPanel state={{...snapshot,revision:1}} onCommand={command}/>);
 expect(screen.getByRole('button',{name:'Apply recovery'})).toBeDisabled();
 expect(screen.getByText(/State changed/)).toBeInTheDocument();
});

test('recommendations and assignment lists stay collapsed until requested',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({...proposal,mitigations:['Add compatible capacity']})));
 const user=userEvent.setup();render(<IncidentPanel state={snapshot} onCommand={vi.fn()}/>);await inspectIncident();
 await user.click(screen.getByRole('button',{name:'Preview recovery'}));
 const recommendation=await screen.findByText('Add compatible capacity');
 expect(recommendation).not.toBeVisible();
 await user.click(screen.getByText('Recommended actions'));
 expect(recommendation).toBeVisible();
 expect(screen.getByText('Proposed assignments (1)').closest('details')).not.toHaveAttribute('open');
});
test('injects the selected simulated printer and keeps policy independent of agents',async()=>{
 const command=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();
 render(<IncidentPanel state={{...state,printers:[{id:'press-west',status:'running',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:50}}]}} selectedPrinter='press-west' onCommand={command}/>);
 await user.click(screen.getByText('Incident settings'));await user.click(screen.getByText('Simulate a fault on press-west'));
 await user.selectOptions(screen.getByLabelText('Simulated fault'),'network_disconnect');
 await user.click(screen.getByRole('button',{name:'Inject simulated fault'}));
 expect(command).toHaveBeenCalledWith('/api/incidents/inject',{printer_id:'press-west',fault_type:'network_disconnect',event_id:expect.any(String)},0);
 await user.selectOptions(screen.getByLabelText('Simulation recovery policy'),'automatic');
 expect(command).toHaveBeenLastCalledWith('/api/incidents/policy',{mode:'automatic'},0);
 expect(screen.getByText(/Never clears equipment/)).toBeInTheDocument();
});
test('blocked and unknown impacts preserve uncertainty; rejected reviews retain equipment isolation',async()=>{
 const result={...proposal,assignments:[],blocked:[{order_id:'order-a',quantity:2,reason:'Refill compatible stock'}],impacts:[{...proposal.impacts[0],original_completion:null,revised_completion:null,delta_seconds:null,change:'indirect'}]};
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(result)));
 const command=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();
 render(<IncidentPanel state={{...snapshot,incidents:[{...incident,progress:{completed:1,remaining:2}}]}} onCommand={command}/>);await inspectIncident();
 await user.click(screen.getByRole('button',{name:'Preview recovery'}));await screen.findByText(/No feasible assignments/);
 expect(screen.getByText(/Unknown \/ unresolved/)).toBeInTheDocument();expect(screen.getByText(/Refill compatible stock/)).toBeInTheDocument();
 expect(screen.getByText(/1 completed \/ 2 remaining/)).toBeInTheDocument();
 await user.click(screen.getByRole('checkbox',{name:/I reviewed/}));expect(screen.getByRole('button',{name:'Apply recovery'})).toBeDisabled();
 await user.click(screen.getByRole('button',{name:'Reject recovery'}));expect(command).toHaveBeenCalledWith('/api/incidents/reject',{incident_id:incident.id,confirmed:true},0);
 expect(screen.getByText(/Equipment isolated/)).toBeInTheDocument();
});
test.each(['filament_runout','thermal'])('clearance requires acknowledged %s repair and positive refill where applicable',async(fault_type)=>{
 const command=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();render(<IncidentPanel state={{...snapshot,incidents:[{...incident,fault_type}]}} onCommand={command}/>);await inspectIncident();

 expect(screen.getByRole('button',{name:'Mark resolved'})).toBeDisabled();
 await user.click(screen.getByRole('checkbox',{name:/I acknowledge/}));
 if(fault_type==='filament_runout') {expect(screen.getByRole('button',{name:'Mark resolved'})).toBeDisabled();await user.type(screen.getByLabelText('Refill stock (grams)'),'100');}
 await user.click(screen.getByRole('button',{name:'Mark resolved'}));
 expect(command).toHaveBeenCalledWith('/api/incidents/clear',{incident_id:incident.id,confirmed:true,...(fault_type==='filament_runout'?{refill_grams:100}:{})},0);
});
test('history inspection and repaired equipment are durable while clock review is paused explicitly',async()=>{
 const user=userEvent.setup();render(<IncidentPanel state={{...snapshot,running:true,incidents:[{...incident,id:'older',equipment_cleared:true},{...incident,id:'newer'}]}} onCommand={vi.fn()}/>);await inspectIncident();
 expect(screen.getByRole('button',{name:'Preview recovery'})).toBeDisabled();expect(screen.getByText(/Pause the simulation clock explicitly/)).toBeInTheDocument();
 await user.selectOptions(screen.getByLabelText('Incident history'),'older');expect(screen.getByText(/Equipment clearance recorded/)).toBeInTheDocument();expect(screen.queryByText('Resolve physical issue')).not.toBeInTheDocument();
});
test.each(['fetch','session','revision','command'])('reports %s failures without approving stale recovery',async(kind)=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({...proposal,...(kind==='session'?{session_id:'reset'}:kind==='revision'?{revision:4}:{})}),{status:kind==='fetch'?500:200}));
 const command=vi.fn().mockRejectedValue(new Error('Recovery rejected')),user=userEvent.setup();render(<IncidentPanel state={snapshot} onCommand={command}/>);await inspectIncident();
 await user.click(screen.getByRole('button',{name:'Preview recovery'}));
 if(kind==='command'){await screen.findByText(proposal.summary);await user.click(screen.getByRole('checkbox',{name:/I reviewed/}));await user.click(screen.getByRole('button',{name:'Apply recovery'}));}
 expect(await screen.findByRole('alert')).toHaveTextContent(kind==='fetch'?'Unable to preview':kind==='command'?'Recovery rejected':'State changed');
});
test('keyboard confirmation uses reviewed revision and zero or faster schedule changes stay signed honestly',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({...proposal,impacts:[{...proposal.impacts[0],delta_seconds:0},{...proposal.impacts[0],order_id:'order-b',delta_seconds:-60}]})));
 const user=userEvent.setup();render(<IncidentPanel state={snapshot} onCommand={vi.fn()}/>);await inspectIncident();await user.click(screen.getByRole('button',{name:'Preview recovery'}));await screen.findByText(proposal.summary);
 expect(screen.getByText('0 s')).toBeInTheDocument();expect(screen.getByText('-60 s')).toBeInTheDocument();
 screen.getByRole('checkbox',{name:/I reviewed/}).focus();await user.keyboard(' ');await user.tab();expect(screen.getByRole('button',{name:'Apply recovery'})).toHaveFocus();
});
test('repair acknowledgement survives clock revisions and submits the current revision',async()=>{
 const user=userEvent.setup(),command=vi.fn();const view=render(<IncidentPanel state={snapshot} onCommand={command}/>);await inspectIncident();
await user.click(screen.getByRole('checkbox',{name:/I acknowledge/}));
 expect(screen.getByRole('button',{name:'Mark resolved'})).toBeEnabled();
 await user.click(screen.getByRole('checkbox',{name:/I acknowledge/}));expect(screen.getByRole('button',{name:'Mark resolved'})).toBeDisabled();await user.click(screen.getByRole('checkbox',{name:/I acknowledge/}));
 view.rerender(<IncidentPanel state={{...snapshot,running:true,revision:1}} onCommand={command}/>);
 expect(screen.getByRole('button',{name:'Mark resolved'})).toBeEnabled();
 await user.click(screen.getByRole('button',{name:'Mark resolved'}));
 expect(command).toHaveBeenCalledWith('/api/incidents/clear',{incident_id:incident.id,confirmed:true},1);
});
test('part lineage compares preserved, blocked and restarted equipment and timing',async()=>{
 const parts=[{part_key:'part-old',order_id:'order-a',original_job_id:'failed-job',revised_job_id:'replacement-job',original_printer:'press-west',revised_printer:'press-east',original_start:'old-start',original_finish:'old-finish',revised_start:'new-start',revised_finish:'new-finish',action:'restarted'},{part_key:'part-blocked',order_id:'order-b',original_job_id:null,revised_job_id:null,original_printer:null,revised_printer:null,original_start:null,original_finish:null,revised_start:null,revised_finish:null,action:'blocked'}];
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({...proposal,part_impacts:parts})));
 const user=userEvent.setup();render(<IncidentPanel state={snapshot} onCommand={vi.fn()}/>);await inspectIncident();await user.click(screen.getByRole('button',{name:'Preview recovery'}));
 const lineage=await screen.findByText('Part lineage and schedule changes');expect(lineage.parentElement).not.toHaveAttribute('open');await user.click(lineage);
 expect(screen.getByRole('table',{name:'Part schedule impact'})).toHaveTextContent(/Part 1.*Attempt ed-job.*Attempt nt-job/);expect(screen.getByRole('table',{name:'Part schedule impact'})).toHaveTextContent('Unknown');
 expect(screen.getByRole('table',{name:'Part schedule impact'})).not.toHaveTextContent('part-old');expect(screen.getByRole('table',{name:'Part schedule impact'})).not.toHaveTextContent('replacement-job');
});
test('persistent evidence and decisions retain rejection, refill and proposal history after refresh',async()=>{
 render(<IncidentPanel state={{...snapshot,incidents:[{...incident,telemetry:{nozzle_c:310,connected:false},actions:[{timestamp:'repair-time',action:'equipment_cleared',outcome:'inspected',refill_grams:150}],proposal_versions:[{decision:'rejected',timestamp:'decision-time',proposal:{...proposal,summary:'Earlier rejected assignment'}}]}]}} onCommand={vi.fn()}/>);await inspectIncident();
 expect(screen.getByText('nozzle c').nextElementSibling).toHaveTextContent('310');expect(screen.getByText(/equipment_cleared/)).toBeInTheDocument();expect(screen.getByText('refill grams').nextElementSibling).toHaveTextContent('150');expect(screen.getByText(/Earlier rejected assignment/)).toHaveTextContent('rejected');
});
test('older persisted decisions without their own timestamp refer to the action history',async()=>{
 render(<IncidentPanel state={{...snapshot,incidents:[{...incident,proposal_versions:[{decision:'applied',proposal:{...proposal,mitigations:['Inspect persisted recommendation']}}]}]}} onCommand={vi.fn()}/>);await inspectIncident();
 expect(screen.getByText(/decision time: See action history/)).toBeInTheDocument();
});
test('thermal trigger evidence and missing spool correction stay distinct from isolated readings and scrap',async()=>{
 render(<IncidentPanel state={{...snapshot,incidents:[{...incident,trigger_telemetry:{nozzle_c:350},before_telemetry:{nozzle_c:210},inventory_adjustment_grams:120}]}} onCommand={vi.fn()}/>);await inspectIncident();
 expect(screen.getByText(/Trigger telemetry:/)).toHaveTextContent('350');expect(screen.getByText(/Pre-isolation telemetry:/)).toHaveTextContent('210');expect(screen.getByText(/Stock adjustment: 120/)).toHaveTextContent('separate from failed-print waste');
});
test('late recovery plans explain recommended operator mitigations',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({...proposal,mitigations:['Use an explicitly supplied faster prepared profile','Agree a later production deadline']})));
 const user=userEvent.setup();render(<IncidentPanel state={snapshot} onCommand={vi.fn()}/>);await inspectIncident();await user.click(screen.getByRole('button',{name:'Preview recovery'}));
 expect(await screen.findByText('Agree a later production deadline')).toBeInTheDocument();
});


test('compact flags keep detail and simulator settings closed until inspected',async()=>{
 const user=userEvent.setup();render(<IncidentPanel state={snapshot} onCommand={vi.fn()}/>);
 expect(screen.getByText(/Physical action needed/)).toBeVisible();
 expect(screen.queryByText('Printing stopped safely.')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Preview recovery'})).not.toBeInTheDocument();
 expect(screen.getByLabelText('Simulation recovery policy')).not.toBeVisible();
 await user.click(screen.getByRole('button',{name:'Inspect incident'}));
 expect(screen.getByText('Printing stopped safely.')).not.toBeVisible();await user.click(screen.getByText('Incident summary and waste'));expect(screen.getByText('Printing stopped safely.')).toBeVisible();
 await user.click(screen.getByRole('button',{name:'Close incident details'}));
 expect(screen.queryByText('Printing stopped safely.')).not.toBeInTheDocument();
});

test.each([false,true])('already applied recovery only permits previews for held work %s',async(held)=>{
 const user=userEvent.setup();render(<IncidentPanel state={{...snapshot,incidents:[{...incident,status:'recovering',applied:{id:'applied'},progress:{completed:1,remaining:2,held}}]}} onCommand={vi.fn()}/>);
 await user.click(screen.getByRole('button',{name:'Inspect incident'}));
 expect(screen.getByText('Recovery already applied')).toBeVisible();
 expect(screen.getByText(/1 completed \/ 2 remaining/)).toBeVisible();
 expect(Boolean(screen.queryByRole('button',{name:'Preview recovery'}))).toBe(held);
});

test('network restoration uses printer confirmation rather than manual repair',async()=>{
 const user=userEvent.setup(),command=vi.fn().mockResolvedValue(undefined);render(<IncidentPanel state={{...snapshot,incidents:[{...incident,fault_type:'network_disconnect'}]}} onCommand={command}/>);
 expect(screen.getByText('Awaiting printer signal')).toBeVisible();
 await user.click(screen.getByRole('button',{name:'Inspect incident'}));
 expect(screen.getByText('Waiting for printer confirmation')).toBeVisible();
 expect(screen.queryByRole('button',{name:'Mark resolved'})).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Simulate connection restored'}));
 expect(command).toHaveBeenCalledWith('/api/incidents/telemetry',{incident_id:incident.id,connected:true,safe_to_resume:true},0);
});

test.each([JSON.stringify({detail:'Incident recovery has already been applied'}),JSON.stringify({detail:{unknown:true}}),'invalid'])('preview rejection shows server reason or safe fallback: %s',async(body)=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(body,{status:409}));
 const user=userEvent.setup();render(<IncidentPanel state={snapshot} onCommand={vi.fn()}/>);
 await user.click(screen.getByRole('button',{name:'Inspect incident'}));await user.click(screen.getByRole('button',{name:'Preview recovery'}));
 expect(await screen.findByRole('alert')).toHaveTextContent(body.includes('already been applied')?'Incident recovery has already been applied':'Unable to preview recovery');
});


test('inspection stays selected across printer updates and resolves physically independently from recovery',async()=>{
 const user=userEvent.setup(),command=vi.fn();const view=render(<IncidentPanel state={snapshot} onCommand={command}/>);
 await user.click(screen.getByRole('button',{name:'Inspect incident'}));await user.click(screen.getByText('Incident evidence and action history'));
 view.rerender(<IncidentPanel state={{...snapshot,revision:1,incidents:[{...incident,status:'recovering',equipment_cleared:true,applied:{id:'saved'}},{...incident,id:'new-incident'}]}} onCommand={command}/>);
 expect(screen.getByLabelText('Incident history')).toHaveValue(incident.id);
 expect(screen.getByText('Incident evidence and action history').closest('details')).toHaveAttribute('open');
 expect(screen.getByText('Resolved')).toBeVisible();expect(screen.getByText('Recovery already applied')).toBeVisible();
 expect(screen.queryByText('Resolve physical issue')).not.toBeInTheDocument();
 view.rerender(<IncidentPanel state={{...state,incidents:[]}} onCommand={command}/>);
 expect(screen.queryByRole('button',{name:'Close incident details'})).not.toBeInTheDocument();
});


test('resolved idle faults have no outstanding work without claiming a recovery was applied',async()=>{
 const user=userEvent.setup();render(<IncidentPanel state={{...snapshot,incidents:[{...incident,status:'resolved',equipment_cleared:true}]}} onCommand={vi.fn()}/>);
 await user.click(screen.getByRole('button',{name:'Inspect incident'}));
 expect(screen.getByText('No outstanding recovery work')).toBeVisible();expect(screen.queryByText('Recovery already applied')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Preview recovery'})).not.toBeInTheDocument();
});

 test.each([{session_id:'new-session'},{incidents:[{...incident,fault_type:'nozzle_clog'}]}])('repair acknowledgement clears for replacement session or fault %j',async(change)=>{
 const user=userEvent.setup();const view=render(<IncidentPanel state={snapshot} onCommand={vi.fn()}/>);await inspectIncident();await user.click(screen.getByRole('checkbox',{name:/I acknowledge/}));
 view.rerender(<IncidentPanel state={{...snapshot,...change}} onCommand={vi.fn()}/>);expect(screen.getByRole('button',{name:'Mark resolved'})).toBeDisabled();
 });
 test('shipping impact warns visibly while distinguishing production deadlines',async()=>{
 const user=userEvent.setup();render(<IncidentPanel state={{...snapshot,incidents:[{...incident,impacts:[{...proposal.impacts[0],ship_by:'2026-11-17T12:00:00Z',shipping_risk:'late'}]}]}} onCommand={vi.fn()}/>);await inspectIncident();await user.click(screen.getByText('Order schedule impact (1)'));
 expect(screen.getByRole('table',{name:'Order schedule impact'})).toHaveTextContent('2026-11-17T12:00:00Z / late');expect(screen.getByText(/Printing continues/)).toBeVisible();
 });


test('an unavailable shipping estimate stays red and does not promise a ship date',async()=>{
 render(<IncidentPanel state={{...snapshot,incidents:[{...incident,impacts:[{...proposal.impacts[0],risk:'unavailable',shipping_risk:'unavailable',ship_by:'2026-11-17T12:00:00Z'}]}]}} onCommand={vi.fn()}/>);await inspectIncident();
 expect(screen.getByText('2026-11-17T12:00:00Z / unavailable')).toHaveClass('deadline-risk');
});


test('on-time recovery estimates remain ordinary text instead of red alerts',async()=>{
 render(<IncidentPanel state={{...snapshot,incidents:[{...incident,impacts:[{...proposal.impacts[0],risk:'on_time',shipping_risk:'on_time',ship_by:'2026-11-17T12:00:00Z'}]}]}} onCommand={vi.fn()}/>);await inspectIncident();
 expect(screen.getByText('2026-11-17T12:00:00Z / on_time')).not.toHaveClass('deadline-risk');
});


test.each(['filament_runout','nozzle_clog'])('inspection immediately exposes guarded %s resolution before collapsed reports',async(fault_type)=>{
 render(<IncidentPanel state={{...snapshot,incidents:[{...incident,fault_type,impacts:proposal.impacts}]}} onCommand={vi.fn()}/>);await inspectIncident();
 expect(screen.getByRole('button',{name:'Mark resolved'})).toBeVisible();
 expect(screen.getByRole('button',{name:'Mark resolved'})).toBeDisabled();
 if(fault_type==='filament_runout')expect(screen.getByLabelText('Refill stock (grams)')).toBeVisible();
 else expect(screen.getByText(/Clear the nozzle clog, inspect the hotend/)).toBeVisible();
 expect(screen.getByText('Order schedule impact (1)').closest('details')).not.toHaveAttribute('open');
 expect(screen.getByText('Production deadlines at risk: 1.')).toBeVisible();
 expect(screen.getByRole('table',{name:'Order schedule impact'})).not.toBeVisible();
});

test('acknowledges filament already added without adding it twice',async()=>{const user=userEvent.setup(),command=vi.fn().mockResolvedValue(undefined);render(<IncidentPanel state={{...snapshot,printers:[{id:'press-west',status:'faulted',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:120}}],incidents:[{...incident,fault_type:'filament_runout',refilled_grams:120}]}} onCommand={command}/>);await inspectIncident();expect(screen.getByText(/Filament added/)).toBeInTheDocument();expect(screen.getByText(/Leave the refill field blank/)).toBeVisible();await user.click(screen.getByRole('checkbox',{name:/I acknowledge/}));expect(screen.getByRole('button',{name:'Mark resolved'})).toBeEnabled();await user.click(screen.getByRole('button',{name:'Mark resolved'}));expect(command).toHaveBeenCalledWith('/api/incidents/clear',{incident_id:incident.id,confirmed:true},0);});

test.each([[0,120],[120,0]])('requires a positive refill when existing evidence or stock is absent (%s, %s)',async(refilled_grams,grams)=>{const user=userEvent.setup(),command=vi.fn();render(<IncidentPanel state={{...snapshot,printers:[{id:'press-west',status:'faulted',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams}}],incidents:[{...incident,fault_type:'filament_runout',refilled_grams}]}} onCommand={command}/>);await inspectIncident();await user.click(screen.getByRole('checkbox',{name:/I acknowledge/}));expect(screen.getByRole('button',{name:'Mark resolved'})).toBeDisabled();expect(screen.queryByText(/Filament added/)).not.toBeInTheDocument();});

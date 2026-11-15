import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi,beforeEach} from 'vitest';
import {QuickPrint} from './QuickPrint';
import {state} from '../test-fixtures';
import {useOrderEstimate} from './useOrderEstimate';
vi.mock('./useOrderEstimate',()=>({useOrderEstimate:vi.fn(()=>({estimate:undefined,busy:false,error:''}))}));
beforeEach(()=>{vi.mocked(useOrderEstimate).mockReturnValue({estimate:undefined,busy:false,error:''});});

test('compact order planning searches models, keeps the library choice and offers feasible alternatives',async()=>{
 vi.mocked(useOrderEstimate).mockReturnValue({estimate:{session_id:state.session_id,revision:0,feasible:false,on_time_quantity:3,estimated_finish:'2026-11-16T12:00:00Z',reason:'Only 3 copies fit'},busy:false,error:''});
 const user=userEvent.setup();render(<QuickPrint guided state={{...state,artifacts:[...state.artifacts,{...state.artifacts[0],id:'boat',name:'Boat'}]}} initialModel="boat" onQueue={vi.fn()} onModels={vi.fn()}/>);
 expect(screen.getByLabelText('Model to print')).toHaveValue('boat');await user.type(screen.getByLabelText('Search models for this order'),'Boat');expect(screen.getByRole('option',{name:'Boat'})).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Increase copies'}));expect(screen.getByLabelText('Number of copies')).toHaveValue(2);await user.clear(screen.getByLabelText('Number of copies'));await user.type(screen.getByLabelText('Number of copies'),'20');await user.click(screen.getByRole('button',{name:'Use 3 copies'}));expect(screen.getByLabelText('Number of copies')).toHaveValue(3);
 await user.click(screen.getByRole('button',{name:'Move dates to earliest fit'}));expect(screen.getByLabelText('Finish printing by (UTC)')).toHaveValue('2026-11-16T12:00');
 expect(screen.getByText(/Playback speed does not change manufacturing/)).toBeInTheDocument();
});

test('guided intake shows deadlines and reviews a held order before any printing',async()=>{
 const user=userEvent.setup(),queue=vi.fn().mockResolvedValue(undefined);
 render(<QuickPrint guided state={{...state,visual_assets:[{id:'other',name:'Other preview',path:'/models/other.stl',units:'mm',rotation_degrees:[0,0,0]}]}} onQueue={queue} onModels={vi.fn()}/>);
 expect(screen.getByLabelText('Finish printing by (UTC)')).toBeVisible();
 expect(screen.getByLabelText('Ship order by (UTC)')).toBeVisible();
 expect(screen.getByRole('button',{name:'Start automatic printing'})).not.toBeVisible();
 await user.click(screen.getByRole('button',{name:'Review schedule first'}));
 expect(queue).toHaveBeenCalledWith(expect.objectContaining({mode:'automatic',review_only:true}));
 await user.click(screen.getByText('Advanced start options'));
 expect(screen.getByRole('button',{name:'Plan manual printing'})).toBeVisible();
});

test('prepared model supplies estimates and automatic/manual orders need only quantity',async()=>{
 const user=userEvent.setup();const onQueue=vi.fn().mockResolvedValue(undefined);
 render(<QuickPrint state={state} onQueue={onQueue} onModels={vi.fn()}/>);
 expect(screen.getByText(/120 min per part/)).toHaveTextContent('25 g');
 await user.clear(screen.getByLabelText('Number of copies'));await user.type(screen.getByLabelText('Number of copies'),'3');
 expect(screen.getByText(/Total estimated printer time: 6 h/)).toHaveTextContent('Estimated filament: 75.0 g');
 expect(screen.getByText(/Total estimated printer time: 6 h/)).toHaveTextContent('blue PLA');
 expect(screen.getByText(/Printer time is summed/)).toBeInTheDocument();
 await user.selectOptions(screen.getByLabelText('Automatic playback speed'),'1');
 await user.click(screen.getByRole('button',{name:'Start automatic printing'}));
 expect(onQueue).toHaveBeenLastCalledWith(expect.objectContaining({mode:'automatic',order:expect.objectContaining({quantity:3,artifact_id:'figure-pla-blue'})}));
 await user.click(screen.getByRole('button',{name:'Plan manual printing'}));
 expect(onQueue).toHaveBeenLastCalledWith(expect.objectContaining({mode:'manual'}));
 await user.click(screen.getByRole('button',{name:'Review schedule first'}));expect(onQueue).toHaveBeenLastCalledWith(expect.objectContaining({review_only:true,mode:'automatic'}));
});


test('model selection, editable deadlines and failures guide the user without losing choices',async()=>{
 const user=userEvent.setup();const onQueue=vi.fn().mockRejectedValue(new Error('Response lost'));const onModels=vi.fn();
 render(<QuickPrint state={{...state,artifacts:[...state.artifacts,{...state.artifacts[0],id:'second',name:'Tray'}]}} onQueue={onQueue} onModels={onModels} initialModel="second"/>);
 await user.selectOptions(screen.getByLabelText('Model to print'),'figure-pla-blue');
 await user.click(screen.getByRole('button',{name:'Add or prepare a model'}));expect(onModels).toHaveBeenCalledOnce();
 await user.click(screen.getByText('Delivery dates (optional changes)'));
 await user.clear(screen.getByLabelText('Quick ship by (UTC)'));await user.type(screen.getByLabelText('Quick ship by (UTC)'),'2026-11-14T00:00');
 await user.click(screen.getByRole('button',{name:'Start automatic printing'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Printing must finish');expect(onQueue).not.toHaveBeenCalled();
 await user.clear(screen.getByLabelText('Quick print due (UTC)'));await user.type(screen.getByLabelText('Quick print due (UTC)'),'2026-11-13T00:00');
 await user.click(screen.getByRole('button',{name:'Start automatic printing'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Response lost');
});

test('missing prepared models cannot start printing',()=>{
 render(<QuickPrint state={{...state,artifacts:[]}} onQueue={vi.fn()} onModels={vi.fn()}/>);
 expect(screen.getByText(/No prepared model available/)).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Start automatic printing'})).toBeDisabled();
});

test('earliest-fit dates round up fractional minutes and a faster prepared profile remains an explicit choice',async()=>{
 vi.mocked(useOrderEstimate).mockReturnValue({estimate:{session_id:state.session_id,revision:0,feasible:false,on_time_quantity:0,estimated_finish:'2026-11-16T12:00:30Z',reason:'Late'},busy:false,error:''});
 const model={...state.artifacts[0],visual_asset_id:'part'},user=userEvent.setup();render(<QuickPrint guided state={{...state,artifacts:[model,{...model,id:'fast',name:'Fast prepared profile',duration_seconds:3600}]}} onQueue={vi.fn()} onModels={vi.fn()}/>);
 await user.click(screen.getByRole('button',{name:'Move dates to earliest fit'}));expect(screen.getByLabelText('Finish printing by (UTC)')).toHaveValue('2026-11-16T12:01');await user.type(screen.getByLabelText('Search models for this order'),'Blue PLA figure');await user.click(screen.getByRole('button',{name:'Use faster profile: Fast prepared profile'}));expect(screen.getByLabelText('Model to print')).toHaveValue('fast');expect(screen.getByLabelText('Search models for this order')).toHaveValue('');
});

test('busy, feasible and failed estimates remain readable; quantity and model search work by keyboard',async()=>{
 const user=userEvent.setup();vi.mocked(useOrderEstimate).mockReturnValue({estimate:undefined,busy:true,error:''});const view=render(<QuickPrint guided state={state} onQueue={vi.fn()} onModels={vi.fn()}/>);expect(screen.getByText(/Checking current printer/)).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Increase copies'}));await user.click(screen.getByRole('button',{name:'Decrease copies'}));expect(screen.getByLabelText('Number of copies')).toHaveValue(1);await user.type(screen.getByLabelText('Search models for this order'),'PLA{Enter}');
 vi.mocked(useOrderEstimate).mockReturnValue({estimate:{session_id:state.session_id,revision:0,feasible:true,on_time_quantity:1,estimated_finish:null,reason:'Fits'},busy:false,error:''});view.rerender(<QuickPrint guided state={state} onQueue={vi.fn()} onModels={vi.fn()}/>);expect(screen.getByText('Fits the selected deadline')).toBeInTheDocument();
 vi.mocked(useOrderEstimate).mockReturnValue({estimate:undefined,busy:false,error:'Unable to estimate'});view.rerender(<QuickPrint guided state={state} onQueue={vi.fn()} onModels={vi.fn()}/>);expect(screen.getByRole('alert')).toHaveTextContent('Unable to estimate');
});


test('order search filters out the previous selection, matches material/color and explains an empty result',async()=>{
 const user=userEvent.setup(),queue=vi.fn();
 const models=[...state.artifacts,{...state.artifacts[0],id:'boat',name:'Boat',filament_type:'PETG',color:'red'}];
 render(<QuickPrint guided state={{...state,artifacts:models}} onQueue={queue} onModels={vi.fn()}/>);
 await user.type(screen.getByLabelText('Search models for this order'),'  boat  ');
 expect(screen.queryByRole('option',{name:'Blue PLA figure'})).not.toBeInTheDocument();
 expect(screen.getByLabelText('Model to print')).toHaveValue('');
 expect(screen.getByRole('button',{name:'Review schedule first'})).toBeDisabled();
 await user.selectOptions(screen.getByLabelText('Model to print'),'boat');
 expect(screen.getByText(/Total estimated printer time/)).toHaveTextContent('red PETG');
 await user.clear(screen.getByLabelText('Search models for this order'));await user.type(screen.getByLabelText('Search models for this order'),'red');
 expect(screen.getByRole('option',{name:'Boat'})).toBeInTheDocument();
 await user.clear(screen.getByLabelText('Search models for this order'));await user.type(screen.getByLabelText('Search models for this order'),'missing model{Enter}');
 expect(screen.getByText(/No models match/)).toBeVisible();expect(screen.getByLabelText('Model to print')).toBeDisabled();expect(queue).not.toHaveBeenCalled();
});


test('background capacity checks retain the last checked result and distinguish a failed refresh',()=>{
 const estimate={session_id:state.session_id,revision:0,feasible:true,on_time_quantity:1,estimated_finish:null,reason:'Fits'};
 vi.mocked(useOrderEstimate).mockReturnValue({estimate,busy:true,error:'',checkedAt:state.simulation_time});
 const view=render(<QuickPrint guided state={state} onQueue={vi.fn()} onModels={vi.fn()}/>);
 expect(screen.getByText('Fits the selected deadline')).toBeVisible();expect(screen.queryByText(/Checking current printer/)).not.toBeInTheDocument();expect(screen.getByText(/Last checked:/)).toHaveTextContent('UTC');
 vi.mocked(useOrderEstimate).mockReturnValue({estimate,busy:false,error:'Unable to refresh'});
 view.rerender(<QuickPrint guided state={state} onQueue={vi.fn()} onModels={vi.fn()}/>);
 expect(screen.getByText('Previous estimate (refresh failed)')).toBeVisible();expect(screen.queryByText('Fits the selected deadline')).not.toBeInTheDocument();
});

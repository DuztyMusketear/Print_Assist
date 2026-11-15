import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test,vi} from 'vitest';
import {state as baseline} from '../test-fixtures';
const state={...baseline,printers:[{id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}]};
import {FilamentSetup} from './FilamentSetup';
test('loading requires acknowledgement and sends chosen spool details',async()=>{const load=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();render(<FilamentSetup state={state} printer={state.printers[0]} onLoad={load}/>);await user.click(screen.getByText('Load filament'));await user.selectOptions(screen.getByLabelText('Filament action'),'replace');expect(screen.getByRole('button',{name:'Save loaded filament'})).toBeDisabled();await user.selectOptions(screen.getByLabelText('Loaded filament color'),'black');await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Save loaded filament'}));expect(load).toHaveBeenCalledWith({printer_id:'printer-1',filament_type:'PLA',color:'black',grams:1000,confirmed:true,mode:'replace'});});
test('active work prevents spool replacement',async()=>{render(<FilamentSetup state={state} printer={{...state.printers[0],status:'running'}} onLoad={vi.fn()}/>);await userEvent.click(screen.getByText('Load filament'));await userEvent.selectOptions(screen.getByLabelText('Filament action'),'replace');expect(screen.getByRole('button',{name:'Save loaded filament'})).toBeDisabled();expect(screen.getByText(/active print cannot change filament/)).toBeVisible();});


test('edited spool settings invalidate acknowledgement and failures are visible for retry',async()=>{
 const user=userEvent.setup(),load=vi.fn().mockRejectedValue(new Error('Printer changed. Retry after checking its spool.'));
 render(<FilamentSetup state={state} printer={state.printers[0]} onLoad={load}/>);await user.click(screen.getByText('Load filament'));await user.selectOptions(screen.getByLabelText('Filament action'),'replace');
 await user.click(screen.getByRole('checkbox'));await user.selectOptions(screen.getByLabelText('Loaded filament type'),'PETG');expect(screen.getByRole('checkbox')).not.toBeChecked();
 await user.click(screen.getByRole('checkbox'));await user.clear(screen.getByLabelText('Spool stock (grams)'));await user.type(screen.getByLabelText('Spool stock (grams)'),'250');expect(screen.getByRole('checkbox')).not.toBeChecked();
 await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Save loaded filament'}));expect(await screen.findByRole('alert')).toHaveTextContent('Printer changed');expect(load).toHaveBeenCalledWith(expect.objectContaining({filament_type:'PETG',grams:250}));
});


test.each(['printer-1','another-printer'])('queued commitments only prevent replacing their own spool (%s)',async printer_id=>{
 render(<FilamentSetup state={{...state,jobs:[{id:'queued',printer_id,status:'planned'}]}} printer={state.printers[0]} onLoad={vi.fn()}/>);await userEvent.click(screen.getByText('Load filament'));await userEvent.selectOptions(screen.getByLabelText('Filament action'),'replace');
 expect(screen.getByRole('checkbox')).toHaveProperty('disabled',printer_id==='printer-1');
});

test.each(['running','faulted','reserved','paused','offline','idle'])('adds matching filament while %s without changing material',async status=>{const load=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();render(<FilamentSetup state={state} printer={{...state.printers[0],status}} onLoad={load}/>);await user.click(screen.getByText('Load filament'));expect(screen.getByLabelText('Loaded filament type')).toBeDisabled();expect(screen.getByLabelText('Loaded filament color')).toBeDisabled();await user.clear(screen.getByLabelText('Filament to add (grams)'));await user.type(screen.getByLabelText('Filament to add (grams)'),'120');await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Add filament'}));expect(load).toHaveBeenCalledWith({printer_id:'printer-1',filament_type:'PLA',color:'blue',grams:120,confirmed:true,mode:'refill'});});

test('refill explains available actions, validates positive stock and reports retry errors',async()=>{const user=userEvent.setup(),load=vi.fn().mockRejectedValue(new Error('Stock changed; retry.'));render(<FilamentSetup state={state} printer={{...state.printers[0],status:'running'}} onLoad={load}/>);await user.click(screen.getByText('Load filament'));expect(screen.queryByText(/active print cannot change filament/)).not.toBeInTheDocument();expect(screen.getByText(/resolves filament runout and insufficient-material faults automatically/)).toBeVisible();await user.click(screen.getByRole('checkbox'));await user.clear(screen.getByLabelText('Filament to add (grams)'));expect(screen.getByRole('checkbox')).not.toBeChecked();await user.click(screen.getByRole('checkbox'));expect(screen.getByRole('button',{name:'Add filament'})).toBeDisabled();await user.type(screen.getByLabelText('Filament to add (grams)'),'25');await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Add filament'}));expect(await screen.findByRole('alert')).toHaveTextContent('Stock changed; retry.');expect(screen.getByRole('button',{name:'Add filament'})).toBeEnabled();});

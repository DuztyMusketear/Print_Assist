import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import {OrderSimulation} from './OrderSimulation';
import {state} from '../test-fixtures';

test('simulate one incoming request in manual or automatic matching mode with saved model details',async()=>{
 const simulate=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();render(<OrderSimulation state={state} onSimulate={simulate}/>);
 await user.click(screen.getByRole('button',{name:'Simulate incoming order'}));await user.selectOptions(screen.getByLabelText('Incoming process'),'automatic');await user.click(screen.getByRole('button',{name:'Simulate order'}));
 await waitFor(()=>expect(simulate).toHaveBeenCalledWith(expect.objectContaining({artifact_id:'figure-pla-blue',quantity:2,mode:'automatic'})));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('incoming request edits, unmatched choices and errors remain in the dialog for correction',async()=>{
 const simulate=vi.fn().mockRejectedValue(new Error('State changed')),user=userEvent.setup();render(<OrderSimulation state={state} initialModel="figure-pla-blue" onSimulate={simulate}/>);
 await user.click(screen.getByRole('button',{name:'Simulate incoming order'}));await user.selectOptions(screen.getByLabelText('Incoming model'),'');await user.clear(screen.getByLabelText('Incoming quantity'));await user.type(screen.getByLabelText('Incoming quantity'),'5');
 fireEvent.change(screen.getByLabelText('Incoming print deadline (UTC)'),{target:{value:'2026-11-17T00:00'}});await user.click(screen.getByRole('button',{name:'Simulate order'}));await screen.findByText('Printing must finish before shipment.');expect(simulate).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Incoming ship deadline (UTC)'),{target:{value:'2026-11-18T00:00'}});await user.click(screen.getByRole('button',{name:'Simulate order'}));await screen.findByText('State changed');expect(simulate).toHaveBeenCalledWith(expect.objectContaining({artifact_id:null,quantity:5,mode:'manual'}));await user.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('an empty model library can still simulate an unmatched manual request',async()=>{
 const user=userEvent.setup(),simulate=vi.fn().mockResolvedValue(undefined);render(<OrderSimulation state={{...state,artifacts:[]}} onSimulate={simulate}/>);await user.click(screen.getByRole('button',{name:'Simulate incoming order'}));await user.click(screen.getByRole('button',{name:'Simulate order'}));await waitFor(()=>expect(simulate).toHaveBeenCalledWith(expect.objectContaining({artifact_id:null})));
});

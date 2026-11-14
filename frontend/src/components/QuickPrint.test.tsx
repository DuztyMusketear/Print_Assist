import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import {QuickPrint} from './QuickPrint';
import {state} from '../test-fixtures';

test('prepared model supplies estimates and automatic/manual orders need only quantity',async()=>{
 const user=userEvent.setup();const onQueue=vi.fn().mockResolvedValue(undefined);
 render(<QuickPrint state={state} onQueue={onQueue} onModels={vi.fn()}/>);
 expect(screen.getByText(/120 min per part/)).toHaveTextContent('25 g');
 await user.clear(screen.getByLabelText('Number of copies'));await user.type(screen.getByLabelText('Number of copies'),'3');
 await user.click(screen.getByRole('button',{name:'Start automatic printing'}));
 expect(onQueue).toHaveBeenLastCalledWith(expect.objectContaining({mode:'automatic',order:expect.objectContaining({quantity:3,artifact_id:'figure-pla-blue'})}));
 await user.click(screen.getByRole('button',{name:'Plan manual printing'}));
 expect(onQueue).toHaveBeenLastCalledWith(expect.objectContaining({mode:'manual'}));
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

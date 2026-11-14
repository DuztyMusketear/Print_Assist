import {fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import {ConfirmDialog} from './ConfirmDialog';

test('confirmation is explicit, cancel and Escape leave the operation untouched',async()=>{
 const confirm=vi.fn(),cancel=vi.fn(),user=userEvent.setup();render(<ConfirmDialog title="Delete scheduled order?" confirmLabel="Delete order" onConfirm={confirm} onCancel={cancel}><p>Robot ×20</p></ConfirmDialog>);
 expect(screen.getByRole('dialog',{name:'Delete scheduled order?'})).toBeVisible();await user.keyboard('{Escape}');expect(cancel).toHaveBeenCalledOnce();expect(confirm).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Delete order'}));expect(confirm).toHaveBeenCalledOnce();
});

test('keyboard traversal reaches form fields and wraps through all modal controls',async()=>{
 const user=userEvent.setup();render(<ConfirmDialog title="Incoming" confirmLabel="Create" onConfirm={vi.fn()} onCancel={vi.fn()}><label>Model<input/></label></ConfirmDialog>);
 screen.getByRole('button',{name:'Cancel'}).focus();await user.tab();expect(screen.getByRole('button',{name:'Create'})).toHaveFocus();await user.tab();expect(screen.getByLabelText('Model')).toHaveFocus();await user.tab({shift:true});expect(screen.getByRole('button',{name:'Create'})).toHaveFocus();
});

test('busy dialogs block dismissal, while normal Tab/Shift-Tab and Cancel remain usable',async()=>{
 const cancel=vi.fn(),user=userEvent.setup();const view=render(<ConfirmDialog title="Busy" confirmLabel="Confirm" busy onConfirm={vi.fn()} onCancel={cancel}>Saving</ConfirmDialog>);
 fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});fireEvent.keyDown(screen.getByRole('dialog'),{key:'Tab'});expect(cancel).not.toHaveBeenCalled();
 view.rerender(<ConfirmDialog title="Busy" confirmLabel="Confirm" onConfirm={vi.fn()} onCancel={cancel}>Ready</ConfirmDialog>);screen.getByRole('button',{name:'Cancel'}).focus();await user.tab({shift:true});expect(screen.getByRole('button',{name:'Confirm'})).toHaveFocus();await user.tab({shift:true});expect(screen.getByRole('button',{name:'Cancel'})).toHaveFocus();await user.tab();await user.keyboard('a');await user.click(screen.getByRole('button',{name:'Cancel'}));expect(cancel).toHaveBeenCalledOnce();
});

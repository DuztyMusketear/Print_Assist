import {render,screen} from '@testing-library/react';
import {expect,test} from 'vitest';
import {state as baseline} from '../test-fixtures';
const state={...baseline,printers:[{id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}]};
import {MaterialCompatibility} from './MaterialCompatibility';
test('black model explains blue loaded spools and gives a matching material action',()=>{render(<MaterialCompatibility state={{...state,artifacts:[{...state.artifacts[0],color:'black'}]}} artifactId={state.artifacts[0].id}/>);expect(screen.getByRole('note')).toHaveTextContent('blue spool cannot print a black part');expect(screen.getByText(/Loaded spools/)).toHaveTextContent('blue PLA');});
test('matching material is clear without a mismatch alert',()=>{render(<MaterialCompatibility state={state} artifactId={state.artifacts[0].id}/>);expect(screen.queryByRole('note')).not.toBeInTheDocument();});
test('missing models stay empty and unregistered capacity is explained',()=>{const view=render(<MaterialCompatibility state={state} artifactId="missing"/>);expect(view.container).toBeEmptyDOMElement();view.rerender(<MaterialCompatibility state={{...state,printers:[]}} artifactId={state.artifacts[0].id}/>);expect(screen.getByText(/No printers registered/)).toBeVisible();});

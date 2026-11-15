import {render,screen} from '@testing-library/react';
import {test,expect} from 'vitest';
import {AgentNetwork} from './AgentNetwork';
import {state} from '../test-fixtures';
test('labels deterministic tools and disconnected specialists honestly',()=>{const {rerender}=render(<AgentNetwork state={state}/>);expect(screen.getByText('Sign in required')).toBeInTheDocument();expect(screen.getAllByText('Not connected')).toHaveLength(3);expect(screen.getAllByText('Deterministic tools')).toHaveLength(3);rerender(<AgentNetwork state={{...state,controls:{...state.controls,automatic_triggers:true}}} connected/>);expect(screen.getByText('Connected')).toBeInTheDocument();expect(screen.getByText(/Automatic triggers on/)).toBeInTheDocument();});

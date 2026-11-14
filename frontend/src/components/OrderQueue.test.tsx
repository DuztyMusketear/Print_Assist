import {render,screen} from '@testing-library/react';
import {test,expect} from 'vitest';
import {OrderQueue} from './OrderQueue';
import {state,orderedState} from '../test-fixtures';
test('empty queue explains how to begin',()=>{
  render(<OrderQueue state={state}/>);
  expect(screen.getByText(/No orders yet/)).toBeInTheDocument();
});
test('saved order shows quantity, deadlines and completion separately',()=>{
  render(<OrderQueue state={orderedState}/>);
  expect(screen.getByText('Blue PLA figure')).toBeInTheDocument();
  expect(screen.getByText(/2 items/)).toHaveTextContent('queued');
  expect(screen.getByText(/Production due:/)).toHaveTextContent('2026-11-15T12:00:00Z');
  expect(screen.getByText(/0 completed/)).toBeInTheDocument();
});

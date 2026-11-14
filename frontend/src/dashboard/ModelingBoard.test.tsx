import {fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test} from 'vitest';
import {ModelingBoard} from './ModelingBoard';

test('moves a model task through supports and review to approval',async()=>{
  const user=userEvent.setup();render(<ModelingBoard/>);
  await user.type(screen.getByLabelText('Model name'),'Dragon figurine');
  await user.type(screen.getByLabelText('Model file reference'),'dragon-v2.stl');
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  await user.type(screen.getByLabelText('Model name'),'Desk planter');
  await user.type(screen.getByLabelText('Model file reference'),'planter.stl');
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  expect(screen.getByRole('region',{name:'Modeling stage'})).toHaveTextContent('Desk planter');
  expect(screen.getByRole('region',{name:'Modeling stage'})).toHaveTextContent('Dragon figurine');
  await user.click(screen.getAllByRole('button',{name:'Prepare supports'})[0]);
  expect(screen.getByRole('region',{name:'Supports stage'})).toHaveTextContent('dragon-v2.stl');
  await user.click(screen.getByRole('button',{name:'Send to review'}));
  await user.click(screen.getByRole('button',{name:'Approve'}));
  expect(screen.getByText('Ready for production queue')).toBeInTheDocument();
});

test('returns a revision request to modeling and labels its review outcome',async()=>{
  const user=userEvent.setup();render(<ModelingBoard/>);
  await user.type(screen.getByLabelText('Model name'),'Planter');
  await user.type(screen.getByLabelText('Model file reference'),'planter.stl');
  await user.click(screen.getByRole('button',{name:'Add to modeling'}));
  await user.click(screen.getByRole('button',{name:'Prepare supports'}));
  await user.click(screen.getByRole('button',{name:'Send to review'}));
  await user.click(screen.getByRole('button',{name:'Request changes'}));
  expect(screen.getByRole('region',{name:'Modeling stage'})).toHaveTextContent('Review requested changes');
});

test('explains when required task details are missing',()=>{
  render(<ModelingBoard/>);
  fireEvent.submit(screen.getByRole('button',{name:'Add to modeling'}).closest('form')!);
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a model name and file reference');
});

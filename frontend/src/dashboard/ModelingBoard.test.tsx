import {fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test,vi} from 'vitest';
import {ModelingBoard} from './ModelingBoard';

test('selected catalog visual is passed to persisted modeling tasks',async()=>{
  const onCreate=vi.fn().mockResolvedValue(undefined);
  render(<ModelingBoard onCreate={onCreate} visualAssets={[{id:'example-tower',name:'Example tower',path:'/models/example-tower.stl',units:'mm',rotation_degrees:[0,0,0]}]}/>);
  await userEvent.setup().click(screen.getByText('Model preparation (team only)'));
  fireEvent.change(screen.getByLabelText('Model name'),{target:{value:'Part'}});
  fireEvent.change(screen.getByLabelText('Model file reference'),{target:{value:'part.stl'}});
  const user=userEvent.setup();
  await user.selectOptions(screen.getByLabelText('3D preview model'),'example-tower');
  fireEvent.submit(screen.getByRole('button',{name:'Add to modeling'}).closest('form')!);
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({visual_asset_id:'example-tower'}));
});

test('explains model inputs with examples and offers common filament choices',async()=>{
  render(<ModelingBoard items={[]} onCreate={vi.fn()}/>);
  await userEvent.setup().click(screen.getByText('Model preparation (team only)'));
  expect(screen.getByLabelText('Model name')).toHaveAccessibleDescription(/Dragon figurine/);
  expect(screen.getByLabelText('Model file reference')).toHaveAccessibleDescription(/does not upload/);
  expect(screen.getByLabelText('Estimated print minutes')).toHaveAccessibleDescription(/one item/);
  expect(screen.getByRole('combobox',{name:'Filament type'})).toHaveAttribute('list','filament-types');
  expect(document.querySelector('#filament-types option[value="PETG"]')).not.toBeNull();
  expect(document.querySelector('#filament-colors option[value="blue"]')).not.toBeNull();
  const user=userEvent.setup();
  await user.type(screen.getByRole('combobox',{name:'Filament type'}),'Custom blend');
  expect(screen.getByRole('combobox',{name:'Filament type'})).toHaveValue('Custom blend');
});

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


test('prepared profile import supplies estimates and removes compatibility jargon',async()=>{
 const onCreate=vi.fn().mockResolvedValue(undefined);const user=userEvent.setup();
 render(<ModelingBoard onCreate={onCreate}/>);
 const profile={title:'Tray',modelReference:'tray.stl',duration_seconds:600,filament_grams:25.125,filament_type:'PLA',color:'blue'};
 const file=new File([JSON.stringify(profile)],'tray.json',{type:'application/json'});
 Object.defineProperty(file,'text',{value:async()=>JSON.stringify(profile)});
 await user.upload(screen.getByLabelText('Prepared model profile'),file);
 await screen.findByText(/Profile ready: Tray/);
 expect(screen.queryByLabelText(/Required printer capabilities/)).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Add to modeling'}));
 expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({...profile,required_capabilities:['FFF']}));
});


test('invalid or oversized profile imports report preparation guidance',async()=>{
 const user=userEvent.setup();render(<ModelingBoard onCreate={vi.fn()}/>);
 const invalid=new File(['{}'],'bad.json',{type:'application/json'});Object.defineProperty(invalid,'text',{value:async()=>'{}'});
 await user.upload(screen.getByLabelText('Prepared model profile'),invalid);
 expect(await screen.findByRole('alert')).toHaveTextContent('Ask the model preparer');
 const oversized=new File(['large'],'large.json',{type:'application/json'});Object.defineProperty(oversized,'size',{value:1000001});
 await user.upload(screen.getByLabelText('Prepared model profile'),oversized);
 expect(await screen.findByRole('alert')).toHaveTextContent('too large');
 await user.upload(screen.getByLabelText('Prepared model profile'),[]);
});

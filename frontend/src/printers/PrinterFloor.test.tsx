import {fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test,vi} from 'vitest';
import {PrinterFloor} from './PrinterFloor';
import {state,orderedState} from '../test-fixtures';
vi.mock('./PrinterScene',()=>({PrinterScene:({label}:{label:string})=><div role="group" aria-label={label}/> }));
const printers=[1,2,3].map(number=>({id:`printer-${number}`,status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}));
const asset={id:'example-tower',name:'Example tower',path:'/models/example-tower.stl',units:'mm' as const,rotation_degrees:[0,0,0] as [number,number,number]};
test('overview shows three views; detail selection and example preview remain local',async()=>{
  const user=userEvent.setup();const snapshot={...state,printers,visual_assets:[asset]};
  const view=render(<PrinterFloor state={snapshot} detailed={false}/>);
  expect(screen.getAllByRole('group')).toHaveLength(3);
  view.rerender(<PrinterFloor state={snapshot} detailed/>);
  await user.click(screen.getByRole('button',{name:'Inspect printer-2'}));
  expect(screen.getByRole('group',{name:'3D view of printer-2'})).toBeInTheDocument();
  await user.click(screen.getByRole('checkbox',{name:'Preview example part'}));
  expect(screen.getByText(/Example geometry/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Example progress'),{target:{value:'75'}});
  expect(screen.getByText('75%')).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Inspect printer-3'}));
  expect(screen.getByRole('checkbox',{name:'Preview example part'})).not.toBeChecked();
  view.rerender(<PrinterFloor state={{...state,printers:[]}} detailed/>);
  expect(screen.getByText('No virtual printers available')).toBeInTheDocument();
});
test('resolves visual association and displays job status and progress',()=>{
  render(<PrinterFloor state={{...orderedState,printers,visual_assets:[asset],artifacts:[{...state.artifacts[0],visual_asset_id:asset.id}],jobs:[{id:'job-1',printer_id:'printer-1',order_id:orderedState.orders[0].id,status:'running',elapsed_seconds:3600,duration_seconds:7200}]}} detailed={false}/>);
  expect(screen.getByText(/job-1.*50%/)).toBeInTheDocument();
});

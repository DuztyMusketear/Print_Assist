import {fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test,vi} from 'vitest';
import {PrinterFloor} from './PrinterFloor';
import {state,orderedState} from '../test-fixtures';
vi.mock('./PrinterScene',()=>({PrinterScene:({label,printing}:{label:string;printing?:boolean})=><div role="group" aria-label={label} data-printing={String(printing)}/> }));
const printers=[1,2,3].map(number=>({id:`printer-${number}`,status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}));
const asset={id:'example-tower',name:'Example tower',path:'/models/example-tower.stl',units:'mm' as const,rotation_degrees:[0,0,0] as [number,number,number]};

test.each([['thermal','Physical intervention required.'],['network_disconnect','Awaiting printer confirmation.']])('isolated floor cards retain a visible %s cause and resolution warning', (type,warning)=>{
 render(<PrinterFloor state={{...state,printers:[{...printers[0],status:'faulted',fault:{type}}]}} detailed={false}/>);
 expect(screen.getByText(`Isolated: ${type.replaceAll('_',' ')}. ${warning}`)).toBeInTheDocument();
});
test('overview shows three views; detail selection and example preview remain local',async()=>{
  const user=userEvent.setup();const snapshot={...state,printers,visual_assets:[asset]};
  const view=render(<PrinterFloor state={snapshot} detailed={false}/>);
  expect(screen.getAllByRole('group',{name:/3D view/})).toHaveLength(3);
  view.rerender(<PrinterFloor state={snapshot} detailed/>);
  await user.click(screen.getByRole('button',{name:'Inspect Printer 2'}));
  expect(screen.getByRole('group',{name:'3D view of Printer 2'})).toBeInTheDocument();
  await user.click(screen.getByRole('checkbox',{name:'Preview example part'}));
  expect(screen.getByText(/Example geometry/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Example progress'),{target:{value:'75'}});
  expect(screen.getByText('75%')).toBeInTheDocument();
  await user.click(screen.getByRole('heading',{name:'Printer 2'}));
  expect(screen.getByRole('checkbox',{name:'Preview example part'})).toBeChecked();
  await user.click(screen.getByRole('button',{name:'Inspect Printer 3'}));
  expect(screen.getByRole('checkbox',{name:'Preview example part'})).not.toBeChecked();
  view.rerender(<PrinterFloor state={{...state,printers:[]}} detailed/>);
  expect(screen.getByText('No virtual printers available')).toBeInTheDocument();
});
test('resolves visual association and displays job status and progress',()=>{
  render(<PrinterFloor state={{...orderedState,printers,telemetry:[{printer_id:'printer-1',nozzle_c:210,bed_c:60,simulated:true,connected:true}],visual_assets:[asset],artifacts:[{...state.artifacts[0],visual_asset_id:asset.id}],jobs:[{id:'job-1',printer_id:'printer-1',order_id:orderedState.orders[0].id,status:'running',elapsed_seconds:3600,duration_seconds:7200}]}} detailed={false}/>);
  expect(screen.getByText(/Part 1.*50%/)).toBeInTheDocument();
  expect(screen.getByRole('region',{name:'Selected printer details'})).toHaveTextContent('210 C / 60 C');
});


test('overview selection exposes the same inspector and manual start/control actions',async()=>{
 const user=userEvent.setup();const onControl=vi.fn().mockResolvedValue(undefined);const onStart=vi.fn().mockResolvedValue(undefined);
 render(<PrinterFloor state={{...orderedState,printers:printers.map(p=>({...p,status:'reserved'})),jobs:[{id:'job-2',printer_id:'printer-2',order_id:orderedState.orders[0].id,status:'pending',duration_seconds:7200,elapsed_seconds:0}]}} detailed={false} onControl={onControl} onStart={onStart}/>);
 await user.click(screen.getByRole('button',{name:'Inspect Printer 2'}));
 expect(screen.getByRole('heading',{name:'Printer 2 details'})).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Start print on Printer 2'}));
 expect(onStart).toHaveBeenCalledWith('job-2');
 await user.click(screen.getByRole('button',{name:'Pause Printer 2'}));
 expect(onControl).toHaveBeenCalledWith('printer-2','pause');
});


test('head motion is enabled only for actual running jobs on the running clock',()=>{
 const snapshot={...state,running:true,printers:printers.map(p=>({...p,status:'running'})),jobs:[{id:'job-1',printer_id:'printer-1',status:'running'}]};
 const view=render(<PrinterFloor state={snapshot} detailed={false}/>);
 expect(screen.getByRole('group',{name:'3D view of Printer 1'})).toHaveAttribute('data-printing','true');
 expect(screen.getByRole('group',{name:'3D view of Printer 2'})).toHaveAttribute('data-printing','false');
 view.rerender(<PrinterFloor state={{...snapshot,jobs:[{...snapshot.jobs[0],status:'pending'}]}} detailed={false}/>);
 expect(screen.getByRole('group',{name:'3D view of Printer 1'})).toHaveAttribute('data-printing','false');
});

import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,test,vi} from 'vitest';
import {PrinterControls,ScenarioReset,ActivityFeed} from './ProductionControls';

test('printer actions follow operational state and surface failures',async()=>{
  const user=userEvent.setup();const onControl=vi.fn().mockResolvedValue(undefined);
  const view=render(<PrinterControls id="printer-1" status="running" onControl={onControl}/>);
  await user.click(screen.getByRole('button',{name:'Pause Printer 1'}));
  expect(onControl).toHaveBeenCalledWith('printer-1','pause');
  await user.click(screen.getByRole('button',{name:'Take Printer 1 offline'}));
  view.rerender(<PrinterControls id="printer-1" status="offline" onControl={onControl}/>);
  await user.click(screen.getByRole('button',{name:'Bring Printer 1 online'}));
  view.rerender(<PrinterControls id="printer-1" status="paused" onControl={onControl}/>);
  onControl.mockRejectedValueOnce(new Error('Printer state changed'));
  await user.click(screen.getByRole('button',{name:'Resume Printer 1'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Printer state changed');
  view.rerender(<PrinterControls id="printer-1" status="faulted" onControl={onControl}/>);
  expect(screen.getByText(/No manual controls/)).toBeInTheDocument();
});

test('reset requires acknowledgment, supports scenario selection and reports failure',async()=>{
  const user=userEvent.setup();const onReset=vi.fn().mockResolvedValue(undefined);
  render(<ScenarioReset onReset={onReset}/>);
  expect(screen.getByRole('button',{name:'Reset scenario'})).toBeDisabled();
  await user.selectOptions(screen.getByLabelText('Scenario'),'seeded');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button',{name:'Reset scenario'}));
  expect(onReset).toHaveBeenCalledWith('seeded');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  await user.selectOptions(screen.getByLabelText('Scenario'),'empty');
  onReset.mockRejectedValueOnce(new Error('Reset failed'));
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button',{name:'Reset scenario'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reset failed');
});

test('activity distinguishes entity references, sources and legacy events',()=>{
  const view=render(<ActivityFeed events={[]}/>);
  expect(screen.getByText('No activity yet')).toBeInTheDocument();
  view.rerender(<ActivityFeed events={[
    {type:'job_assigned',timestamp:'2026-11-15T00:00:00Z',message:'Assigned work',source:'simulation',status:'accepted',printer_id:'printer-1',job_id:'job-1',order_id:'order-1'},
    {type:'order_created',timestamp:'2026-11-15T00:00:00Z'},
  ]}/>);
  expect(screen.getByText('Assigned work')).toBeInTheDocument();
  expect(screen.getByText(/Printer 1/)).toHaveTextContent('Order ORDER1');
  expect(screen.getByText('order created')).toBeInTheDocument();
});

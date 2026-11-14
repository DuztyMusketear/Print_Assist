import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {test,expect,vi} from 'vitest';
import {PrintingGuidance} from './PrintingGuidance';
import {state,orderedState} from '../test-fixtures';
test('idle completed workshops guide to new printing instead of only clock controls',async()=>{
 const onNewPrint=vi.fn(),onSchedule=vi.fn();const user=userEvent.setup();
 const view=render(<PrintingGuidance state={state} onNewPrint={onNewPrint} onSchedule={onSchedule}/>);
 expect(screen.getByText(/No print jobs are assigned/)).toBeInTheDocument();
 view.rerender(<PrintingGuidance state={{...orderedState,orders:orderedState.orders.map(o=>({...o,successful_quantity:o.quantity}))}} onNewPrint={onNewPrint} onSchedule={onSchedule}/>);
 expect(screen.getByText(/All requested prints are complete/)).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Start a new print'}));expect(onNewPrint).toHaveBeenCalledOnce();
 view.rerender(<PrintingGuidance state={orderedState} onNewPrint={onNewPrint} onSchedule={onSchedule}/>);
 await user.click(screen.getByRole('button',{name:'Review waiting work'}));expect(onSchedule).toHaveBeenCalledOnce();
 const active={...state,printers:[{id:'printer-1',status:'running',capabilities:[],material:{type:'PLA',color:'blue',grams:100}}]};
 view.rerender(<PrintingGuidance state={active} onNewPrint={onNewPrint} onSchedule={onSchedule}/>);expect(screen.getByText(/clock is paused/)).toBeInTheDocument();
 view.rerender(<PrintingGuidance state={{...active,running:true}} onNewPrint={onNewPrint} onSchedule={onSchedule}/>);expect(screen.getByText(/simulation is running/)).toBeInTheDocument();
});

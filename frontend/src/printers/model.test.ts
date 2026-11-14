import {expect,test} from 'vitest';
import {state,orderedState} from '../test-fixtures';
import {printerView} from './model';

const printer={id:'printer-1',status:'idle',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}};
test('empty bed has no model; unknown printer is rejected',()=>{
  expect(printerView({...state,printers:[printer]},printer.id).job).toBeUndefined();
  expect(()=>printerView(state,'missing')).toThrow('Unknown printer');
});
test('selects active work over completed work and resolves its own artifact',()=>{
  const snapshot={...orderedState,printers:[printer],jobs:[
    {id:'old',printer_id:printer.id,status:'completed',order_id:orderedState.orders[0].id},
    {id:'current',printer_id:printer.id,status:'paused',order_id:orderedState.orders[0].id,elapsed_seconds:3600,duration_seconds:7200}]};
  expect(printerView(snapshot,printer.id)).toMatchObject({job:{id:'current'},artifact:{id:'figure-pla-blue'},progress:0.5});
});
test('completed work stays visible, unknown artifact stays unresolved, progress is bounded',()=>{
  expect(printerView({...state,printers:[printer],jobs:[{id:'done',printer_id:printer.id,status:'completed'}]},printer.id).progress).toBe(1);
  for(const [elapsed,duration,expected] of [[200,100,1],[-2,100,0],[0,0,0],[NaN,100,0]]) {
    expect(printerView({...state,printers:[printer],jobs:[{id:'job',printer_id:printer.id,status:'running',elapsed_seconds:elapsed,duration_seconds:duration}]},printer.id).progress).toBe(expected);
  }
});

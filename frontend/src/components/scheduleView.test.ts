import {test,expect} from 'vitest';
import {timelineSlots,timelineOrders,calendarWindow,formatScheduleTime,type Slot} from './scheduleView';
import {orderedState} from '../test-fixtures';

test('calendar axes show aligned UTC day, week and month ticks with bounded long ranges',()=>{
 const now=Date.parse('2026-11-15T12:00:00Z');
 for(const scale of ['day','week','month'] as const){const view=calendarWindow(now,now,now+3600000,scale);expect(view.ticks.length).toBeGreaterThan(1);expect(view.ticks.length).toBeLessThanOrEqual(15);expect(view.finish-view.start).toBeGreaterThanOrEqual(86400000);}
 expect(calendarWindow(now,now,now+365*86400000,'day').ticks.length).toBeLessThanOrEqual(15);
});

test('overlapping allocations and missed deadlines are explicit conflicts',()=>{
 const snapshot={...orderedState,printers:[{id:'printer-1',status:'running',capabilities:['FFF'],material:{type:'PLA',color:'blue',grams:1000}}],jobs:[{id:'job-1',order_id:orderedState.orders[0].id,printer_id:'printer-1',status:'running',duration_seconds:7200,elapsed_seconds:0}]};
 const proposal={id:'plan',session_id:snapshot.session_id,revision:snapshot.revision,mode:'automatic' as const,assumptions:'estimate',blocked:[],assignments:[{order_id:orderedState.orders[0].id,printer_id:'printer-1',start:'2026-11-15T01:00:00Z',finish:'2026-11-15T14:00:00Z',duration_seconds:46800,filament_grams:25}]};
 const slots=timelineSlots(snapshot,proposal);expect(slots.every(slot=>slot.overlap)).toBe(true);expect(slots[1].late).toBe(true);
});

test('planning summaries and the calendar axis use the same explicit UTC timezone',()=>{
 expect(formatScheduleTime('2026-11-15T00:00:00Z')).toContain('11/15/2026');expect(formatScheduleTime('2026-11-15T00:00:00Z')).toContain('UTC');
});

const first=orderedState.orders[0],second={...first,id:'order-2',quantity:1};
const slot:Slot={order_id:first.id,printer_id:'printer-1',start:'2026-11-15T01:00:00Z',finish:'2026-11-15T03:00:00Z',status:'planned',late:false,overlap:false};
test('each order keeps its own color across printers, completed work and later arrivals',()=>{
 const snapshot={...orderedState,orders:[first,second]},slots=[slot,{...slot,printer_id:'printer-2',finish:'2026-11-15T04:00:00Z'},{...slot,order_id:second.id}];
 const groups=timelineOrders(snapshot,slots);
 expect(groups).toHaveLength(2);expect(groups[0].color).not.toBe(groups[1].color);
 expect(groups[0].finish).toBe('2026-11-15T04:00:00.000Z');expect(groups[1].finish).toBe(new Date(slot.finish).toISOString());
 expect(timelineOrders({...snapshot,orders:[{...first,status:'completed',successful_quantity:2},second,{...second,id:'order-3'}]},[slots[2]])[0].color).toBe(groups[1].color);
});

test('partial, blocked, overlapping, unavailable and unknown work cannot promise an order finish',()=>{
 expect(timelineOrders(orderedState,[slot])[0].finish).toBeUndefined();
 expect(timelineOrders({...orderedState,orders:[{...first,successful_quantity:1}]},[slot])[0].finish).toBe(new Date(slot.finish).toISOString());
 const snapshot={...orderedState,orders:[second]},shown={...slot,order_id:second.id};
 const proposal={id:'p',session_id:snapshot.session_id,revision:1,mode:'automatic' as const,assumptions:'',assignments:[],blocked:[{order_id:second.id,quantity:1,reason:'No stock'}]};
 expect(timelineOrders(snapshot,[shown],proposal)[0].finish).toBeUndefined();
 expect(timelineOrders(snapshot,[{...shown,overlap:true}])[0].finish).toBeUndefined();
 expect(timelineOrders({...snapshot,forecasts:[{order_id:second.id,risk:'unavailable',completion:null,reason:'No stock'}]},[shown])[0].finish).toBeUndefined();
 expect(timelineOrders({...snapshot,orders:[{...second,requires_schedule_review:true}],forecasts:[{order_id:second.id,risk:'unavailable',completion:null,reason:'Previously held'}]},[shown],{...proposal,blocked:[]})[0].finish).toBe(new Date(slot.finish).toISOString());
 const orphan=timelineOrders(snapshot,[{...shown,order_id:'orphan'}])[0];expect(orphan.finish).toBeUndefined();expect(orphan.id).toBe('orphan');expect(orphan.color).not.toBe(timelineOrders(snapshot,[shown])[0].color);
 expect(timelineOrders(snapshot,[])).toEqual([]);
});

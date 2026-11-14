import {test,expect} from 'vitest';
import {printerLabel,partLabel,orderLabel} from './display';
test('operator labels hide long identifiers without changing command IDs',()=>{
 expect(printerLabel('printer-1')).toBe('Printer 1');
 expect(printerLabel('station-ff')).toBe('station-ff');
 expect(partLabel('00000000-0000-4000-8000-000000000001-1')).toBe('Part 1');
 expect(orderLabel('00000000-0000-4000-8000-000000000001')).toBe('Order 000001');
});

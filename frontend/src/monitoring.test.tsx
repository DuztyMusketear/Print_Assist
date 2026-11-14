import {renderHook,act} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
import {useMonitoring} from './monitoring';

test('monitoring waits for each read and cancels on unmount',async()=>{
  vi.useFakeTimers();
  let finish!:()=>void;
  const read=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const view=renderHook(()=>useMonitoring(read));
  await act(()=>vi.advanceTimersByTimeAsync(1000));
  expect(read).toHaveBeenCalledTimes(1);
  await act(()=>vi.advanceTimersByTimeAsync(5000));
  expect(read).toHaveBeenCalledTimes(1);
  await act(async()=>finish());
  await act(()=>vi.advanceTimersByTimeAsync(1000));
  expect(read).toHaveBeenCalledTimes(2);
  view.unmount();
  await act(async()=>finish());
  await act(()=>vi.advanceTimersByTimeAsync(5000));
  expect(read).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});

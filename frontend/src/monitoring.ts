import {useEffect,useRef} from 'react';
export function useMonitoring(read:()=>Promise<void>) {
  const latest=useRef(read);latest.current=read;
  useEffect(()=>{
    let stopped=false;let timer:ReturnType<typeof setTimeout>;
    async function poll() {
      await latest.current();
      if(!stopped) timer=setTimeout(()=>void poll(),1000);
    }
    timer=setTimeout(()=>void poll(),1000);
    return ()=>{stopped=true;clearTimeout(timer);};
  },[]);
}

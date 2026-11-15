import {useEffect,useRef,useState} from 'react';
import type {Snapshot,OrderInput} from '../api';
import type {components} from '../types';
type EstimateState={estimate:components['schemas']['OrderEstimate']|undefined;busy:boolean;error:string;checkedAt?:string};
export function useOrderEstimate(state:Snapshot,order:OrderInput|undefined,enabled:boolean):EstimateState{
 const [estimate,setEstimate]=useState<components['schemas']['OrderEstimate']>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [checkedAt,setCheckedAt]=useState<string>();
 const signature=JSON.stringify(order);
 // Revision, activity, telemetry and projected reports do not change capacity.
 const capacity=JSON.stringify([state.simulation_time,state.printers,state.jobs,state.orders,state.artifacts]);
 const latest=useRef({state,capacity});latest.current={state,capacity};
 useEffect(()=>{
  setEstimate(undefined);setCheckedAt(undefined);setError('');setBusy(false);
  if(!enabled||!order)return;
  let live=true,checked:string|undefined;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function refresh(){
   const current=latest.current;
   if(checked!==current.capacity){
    const requested=current.capacity;setBusy(true);
    try{
     const response=await fetch('/api/orders/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:current.state.session_id,order}),signal:controller.signal});
     if(!response.ok)throw new Error('Unable to check this draft. Refresh state and check the quantity and dates.');
     const result:components['schemas']['OrderEstimate']=await response.json();
     if(live&&result.session_id===current.state.session_id){setEstimate(result);setCheckedAt(current.state.simulation_time);setError('');checked=requested;}
    }catch(reason){if(live)setError((reason as Error).message);}
    finally{if(live)setBusy(false);}
   }
   // Read the newest snapshot at each interval. Live ticks cannot reset this
   // timer or cancel a useful response, and unchanged polling makes no request.
   if(live)timer=setTimeout(()=>void refresh(),5000);
  }
  setBusy(true);timer=setTimeout(()=>void refresh(),250);
  return ()=>{live=false;controller.abort();clearTimeout(timer);};
 },[enabled,signature,state.session_id]);
 return {estimate,busy,error,checkedAt};
}

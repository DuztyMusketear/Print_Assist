import {useEffect,useState} from 'react';
import type {Snapshot,OrderInput} from '../api';
import type {components} from '../types';
export function useOrderEstimate(state:Snapshot,order:OrderInput|undefined,enabled:boolean){
 const [estimate,setEstimate]=useState<components['schemas']['OrderEstimate']>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const signature=JSON.stringify(order);
 useEffect(()=>{
  setEstimate(undefined);setError('');setBusy(false);
  if(!enabled||!order)return;
  let live=true;const controller=new AbortController();setBusy(true);
  const timer=setTimeout(()=>{void fetch('/api/orders/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:state.session_id,order}),signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('Unable to check this draft. Refresh state and check the quantity and dates.');
   const result:components['schemas']['OrderEstimate']=await response.json();
   if(live&&result.session_id===state.session_id)setEstimate(result);
  }).catch(reason=>{if(live)setError((reason as Error).message);}).finally(()=>{if(live)setBusy(false);});},250);
  return ()=>{live=false;controller.abort();clearTimeout(timer);};
 },[enabled,signature,state.session_id,state.revision]);
 return {estimate,busy,error};
}

import {useEffect,useId,useRef,type ReactNode} from 'react';
export function ConfirmDialog({title,confirmLabel,onConfirm,onCancel,children,busy=false}:{title:string;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void;children:ReactNode;busy?:boolean}){
 const ref=useRef<HTMLElement>(null),id=useId();
 useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current!.querySelector<HTMLElement>('input,select,textarea,button')!.focus();return ()=>previous.focus();},[]);
 return <div className="confirm-backdrop"><section ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className="confirm-dialog" onKeyDown={event=>{
  if(event.key==='Escape'&&!busy)onCancel();
  if(event.key==='Tab'){
   const buttons=Array.from(ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'));
   if(buttons.length){const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  }
 }}><h2 id={id}>{title}</h2>{children}<div className="dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" disabled={busy} onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

import {cloneElement,useState,type ReactElement} from 'react';

type Props={id:string;label:string;help:string;children:ReactElement<{id?:string;'aria-describedby'?:string}>};
export function EntryField({id,label,help,children}:Props) {
  const [hovered,setHovered]=useState(false);
  const [focused,setFocused]=useState(false);
  const helpId=id+'-help';
  return <div className="entry-field">
    <div className="field-heading"><label htmlFor={id}>{label}</label>
      <span className="field-help" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
        <button className="help-icon" type="button" aria-label={`Help for ${label}`} aria-describedby={helpId}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onClick={()=>setFocused(true)}
          onKeyDown={event=>{if(event.key==='Escape'){setHovered(false);setFocused(false);}}}>i</button>
        <span id={helpId} role="tooltip" className="field-tooltip" hidden={!(hovered||focused)}>{help}</span>
      </span>
    </div>
    {cloneElement(children,{id,'aria-describedby':helpId})}
  </div>;
}

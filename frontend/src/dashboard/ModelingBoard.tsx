import {useState,type FormEvent} from 'react';
import {advanceWorkItem,createWorkItem,type WorkItem,type WorkflowAction} from './workflow';

const stages=['modeling','supports','review','approved'] as const;
const labels:Record<WorkItem['stage'],string>={modeling:'Modeling',supports:'Supports',review:'Review',approved:'Approved'};

export function ModelingBoard() {
  const [items,setItems]=useState<WorkItem[]>([]);
  const [title,setTitle]=useState('');
  const [reference,setReference]=useState('');
  const [error,setError]=useState('');
  function add(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const item=createWorkItem(crypto.randomUUID(),title,reference);
      setItems(current=>[...current,item]);
      setTitle('');setReference('');setError('');
    } catch(reason) {setError((reason as Error).message);}
  }
  function move(item:WorkItem,action:WorkflowAction) {
    setItems(current=>current.map(candidate=>candidate.id===item.id?advanceWorkItem(candidate,action):candidate));
    setError('');
  }
  return <div className="dashboard">
    <div className="dashboard-intro"><div><p className="eyebrow">MODEL PREPARATION</p><h2>Modeling dashboard</h2><p className="muted">Track each design through modeling, support preparation, and human review.</p></div><span className="local-tag">LOCAL WORKFLOW · NO MODEL CALLS</span></div>
    <form className="work-form" onSubmit={add}>
      <div><h3>Add a model task</h3><p className="muted">Start from an operator-supplied model file reference.</p></div>
      <label>Model name<input value={title} onChange={event=>setTitle(event.target.value)} placeholder="e.g. Dragon figurine" /></label>
      <label>Model file reference<input value={reference} onChange={event=>setReference(event.target.value)} placeholder="e.g. dragon-v2.stl" /></label>
      <button type="submit">Add to modeling</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <div className="workflow-board" aria-label="Model preparation stages">
      {stages.map(stage=>{
        const laneItems=items.filter(item=>item.stage===stage);
        return <section className="workflow-lane" key={stage} aria-label={`${labels[stage]} stage`}>
          <div className="lane-heading"><h3>{labels[stage]}</h3><span>{laneItems.length}</span></div>
          {laneItems.length===0?<p className="muted lane-empty">Nothing here yet</p>:laneItems.map(item=><article className="work-card" key={item.id}>
            <h4>{item.title}</h4><p className="file-reference">{item.modelReference}</p>
            {item.reviewOutcome && <p className="review-note">Review requested changes · returned to modeling</p>}
            {stage==='modeling' && <button className="secondary" onClick={()=>move(item,'prepare-supports')}>Prepare supports</button>}
            {stage==='supports' && <button className="secondary" onClick={()=>move(item,'submit-review')}>Send to review</button>}
            {stage==='review' && <div className="review-actions"><button onClick={()=>move(item,'approve')}>Approve</button><button className="secondary" onClick={()=>move(item,'request-changes')}>Request changes</button></div>}
            {stage==='approved' && <span className="approved-label">Ready for production queue</span>}
          </article>)}
        </section>;
      })}
    </div>
    <p className="workflow-footnote">Stage changes are deterministic and operator-controlled. Model generation and slicing integrations are not enabled.</p>
  </div>;
}

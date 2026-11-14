export type WorkStage='modeling'|'supports'|'review'|'approved';
export type ReviewOutcome='changes-requested';
export interface WorkItem {
  id:string;
  title:string;
  modelReference:string;
  stage:WorkStage;
  reviewOutcome?:ReviewOutcome;
}
export type WorkflowAction='prepare-supports'|'submit-review'|'approve'|'request-changes';

export function createWorkItem(id:string,title:string,modelReference:string):WorkItem {
  const cleanTitle=title.trim();
  const cleanReference=modelReference.trim();
  if(!cleanTitle || !cleanReference) throw new Error('Enter a model name and file reference');
  return {id,title:cleanTitle,modelReference:cleanReference,stage:'modeling'};
}

export function advanceWorkItem(item:WorkItem,action:WorkflowAction):WorkItem {
  if(action==='prepare-supports' && item.stage==='modeling') return {...item,stage:'supports',reviewOutcome:undefined};
  if(action==='submit-review' && item.stage==='supports') return {...item,stage:'review'};
  if(action==='approve' && item.stage==='review') return {...item,stage:'approved',reviewOutcome:undefined};
  if(action==='request-changes' && item.stage==='review') return {...item,stage:'modeling',reviewOutcome:'changes-requested'};
  const requested=action==='prepare-supports'?'prepare supports':action==='submit-review'?'submit for review':action==='request-changes'?'request changes':'approve';
  throw new Error(`Cannot ${requested} while ${item.stage}`);
}

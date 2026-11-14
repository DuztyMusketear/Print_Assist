export type WorkStage='modeling'|'supports'|'review'|'approved';
export type ReviewOutcome='changes-requested';
export interface SupportAssessment {
  supports_required:boolean;
  support_reference?:string|null;
  support_material_grams?:number|null;
  removal_notes?:string|null;
}
export interface SupportTask {
  id:string;
  assessment_status:'pending'|'ready-for-review'|'not-required';
  supports_required?:boolean|null;
  support_reference?:string|null;
  support_material_grams?:number|null;
  removal_notes?:string|null;
}
export interface WorkItem {
  id:string;
  title:string;
  modelReference:string;
  stage:WorkStage;
  reviewOutcome?:ReviewOutcome|null;
  support_task?:SupportTask|null;
}
export type WorkflowAction='prepare-supports'|'submit-review'|'approve'|'request-changes';

export function createWorkItem(id:string,title:string,modelReference:string):WorkItem {
  const cleanTitle=title.trim();
  const cleanReference=modelReference.trim();
  if(!cleanTitle || !cleanReference) throw new Error('Enter a model name and file reference');
  return {id,title:cleanTitle,modelReference:cleanReference,stage:'modeling',support_task:null};
}

export function advanceWorkItem(item:WorkItem,action:WorkflowAction,assessment?:SupportAssessment):WorkItem {
  if(action==='prepare-supports' && item.stage==='modeling') return {...item,stage:'supports',reviewOutcome:undefined,
    support_task:{id:`${item.id}-support`,assessment_status:'pending'}};
  if(action==='submit-review' && item.stage==='supports') {
    if(!item.support_task||item.support_task.assessment_status!=='pending'||!assessment) throw new Error('Complete the support assessment before continuing');
    const support_task={...item.support_task,...assessment,assessment_status:assessment.supports_required?'ready-for-review' as const:'not-required' as const};
    return {...item,support_task,stage:'review'};
  }
  if(action==='approve' && item.stage==='review') {
    if(!item.support_task||!['ready-for-review','not-required'].includes(item.support_task.assessment_status)) throw new Error('A completed support assessment is required before approval');
    return {...item,stage:'approved',reviewOutcome:undefined};
  }
  if(action==='request-changes' && item.stage==='review') return {...item,stage:'modeling',reviewOutcome:'changes-requested',support_task:null};
  const requested=action==='prepare-supports'?'prepare supports':action==='submit-review'?'submit for review':action==='request-changes'?'request changes':'approve';
  throw new Error(`Cannot ${requested} while ${item.stage}`);
}

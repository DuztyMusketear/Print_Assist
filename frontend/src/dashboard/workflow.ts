export type WorkStage='modeling'|'supports'|'review'|'approved';
export type ReviewOutcome='changes-requested';
export const FILAMENT_COLOR_CHOICES=['blue','black','white','gray','red'] as const;
export type FilamentColor=typeof FILAMENT_COLOR_CHOICES[number];
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
  duration_seconds?:number;
  filament_grams?:number;
  filament_type?:string;
  color?:string;
  required_capabilities?:string[];
  stage:WorkStage;
  reviewOutcome?:ReviewOutcome|null;
  support_task?:SupportTask|null;
}
export type WorkflowAction='set-color'|'prepare-supports'|'submit-review'|'approve'|'request-changes';

export function createWorkItem(id:string,title:string,modelReference:string,profile?:Pick<WorkItem,'duration_seconds'|'filament_grams'|'filament_type'|'color'|'required_capabilities'>):WorkItem {
  const cleanTitle=title.trim();
  const cleanReference=modelReference.trim();
  if(!cleanTitle || !cleanReference) throw new Error('Enter a model name and file reference');
  return {id,title:cleanTitle,modelReference:cleanReference,...profile,stage:'modeling',support_task:null};
}

export function advanceWorkItem(item:WorkItem,action:WorkflowAction,assessment?:SupportAssessment,color?:FilamentColor):WorkItem {
  if(action==='set-color' && item.stage==='modeling' && color) return {...item,color};
  if(action==='set-color') throw new Error('Choose a valid color while the model is in Modeling');
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

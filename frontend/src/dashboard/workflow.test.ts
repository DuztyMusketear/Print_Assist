import {describe,expect,test} from 'vitest';
import {advanceWorkItem,createWorkItem,type WorkItem} from './workflow';

const item:WorkItem={id:'job-1',title:'Dragon figurine',modelReference:'dragon-v2.stl',stage:'modeling'};
const requiredSupports={supports_required:true,support_reference:'dragon-supports.3mf',support_material_grams:5,removal_notes:'Remove below the wings.'};

describe('model preparation workflow',()=>{
  test('new work starts in modeling and advances through supports and review',()=>{
    const created=createWorkItem('job-2','Desk planter','planter.stl');
    expect(created).toEqual({id:'job-2',title:'Desk planter',modelReference:'planter.stl',stage:'modeling',support_task:null});
    const supports=advanceWorkItem(created,'prepare-supports');
    expect(supports.support_task).toMatchObject({assessment_status:'pending'});
    const review=advanceWorkItem(supports,'submit-review',requiredSupports);
    expect([supports.stage,review.stage]).toEqual(['supports','review']);
    expect(review.support_task).toMatchObject({...requiredSupports,assessment_status:'ready-for-review'});
  });

  test('review approval completes work and revision requests return it to modeling',()=>{
    const review=advanceWorkItem(advanceWorkItem(item,'prepare-supports'),'submit-review',requiredSupports);
    expect(advanceWorkItem(review,'approve').stage).toBe('approved');
    expect(advanceWorkItem(review,'request-changes')).toMatchObject({stage:'modeling',support_task:null});
  });

  test('a no-support assessment goes directly to review and is included in approval',()=>{
    const supportStage=advanceWorkItem(item,'prepare-supports');
    const review=advanceWorkItem(supportStage,'submit-review',{supports_required:false});
    expect(review.stage).toBe('review');
    expect(review.support_task).toMatchObject({supports_required:false,assessment_status:'not-required'});
    expect(advanceWorkItem(review,'approve').stage).toBe('approved');
  });

  test('requires a support assessment before leaving the supports stage',()=>{
    const supportStage=advanceWorkItem(item,'prepare-supports');
    expect(()=>advanceWorkItem(supportStage,'submit-review'))
      .toThrow('Complete the support assessment before continuing');
    expect(()=>advanceWorkItem({...supportStage,support_task:null},'submit-review',requiredSupports))
      .toThrow('Complete the support assessment before continuing');
    expect(()=>advanceWorkItem({...supportStage,support_task:{...supportStage.support_task!,assessment_status:'ready-for-review'}},'submit-review',requiredSupports))
      .toThrow('Complete the support assessment before continuing');
  });

  test('does not approve a review package without an assessed support task',()=>{
    const review={...item,stage:'review' as const};
    expect(()=>advanceWorkItem(review,'approve')).toThrow('A completed support assessment is required before approval');
  });

  test('rejects actions that do not apply to the current stage',()=>{
    expect(()=>advanceWorkItem(item,'approve')).toThrow('Cannot approve while modeling');
  });

  test.each(['','   '])('requires a model name: %j',title=>{
    expect(()=>createWorkItem('job',title,'model.stl')).toThrow('Enter a model name and file reference');
  });

  test('requires a file reference',()=>{
    expect(()=>createWorkItem('job','Model','  ')).toThrow('Enter a model name and file reference');
  });

  test.each([
    ['modeling','submit-review'],['modeling','approve'],['modeling','request-changes'],
    ['supports','prepare-supports'],['supports','approve'],['supports','request-changes'],
    ['review','prepare-supports'],['review','submit-review'],
    ['approved','prepare-supports'],['approved','submit-review'],['approved','approve'],['approved','request-changes'],
  ] as const)('rejects %s -> %s', (stage,action)=>{
    const subject={...item,stage};
    expect(()=>advanceWorkItem(subject,action)).toThrow(`Cannot `);
  });
});

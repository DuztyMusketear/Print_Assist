import {describe,expect,test} from 'vitest';
import {advanceWorkItem,createWorkItem,type WorkItem} from './workflow';

const item:WorkItem={id:'job-1',title:'Dragon figurine',modelReference:'dragon-v2.stl',stage:'modeling'};

describe('model preparation workflow',()=>{
  test('new work starts in modeling and advances through supports and review',()=>{
    const created=createWorkItem('job-2','Desk planter','planter.stl');
    expect(created).toEqual({id:'job-2',title:'Desk planter',modelReference:'planter.stl',stage:'modeling'});
    const supports=advanceWorkItem(created,'prepare-supports');
    const review=advanceWorkItem(supports,'submit-review');
    expect([supports.stage,review.stage]).toEqual(['supports','review']);
  });

  test('review approval completes work and revision requests return it to modeling',()=>{
    const review=advanceWorkItem(advanceWorkItem(item,'prepare-supports'),'submit-review');
    expect(advanceWorkItem(review,'approve').stage).toBe('approved');
    expect(advanceWorkItem(review,'request-changes').stage).toBe('modeling');
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

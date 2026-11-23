import {describe,it,expect} from 'vitest';
import {exportSize,shareableWins,prefilledWins} from '@/lib/batch6-rules';
import {TEMPLATE_DAYS,AUDIENCE_SIZE} from '@/lib/batch6-data';
import type {UserHabit,Checkin} from '@/lib/data';
const habit=(key:string)=>({id:key,template:{key}} as UserHabit);
const check=(key:string,value:number)=>({user_habit_id:key,value} as Checkin);
describe('batch 6 concrete rules',()=>{
 it('story export is exactly 1080 × 1920',()=>expect(exportSize(false)).toEqual({width:1080,height:1920}));
 it('square export is exactly 1080 × 1080',()=>expect(exportSize(true)).toEqual({width:1080,height:1080}));
 it('private Fajr wins are excluded from shares',()=>expect(shareableWins(['water','fajr'],false)).toEqual(['water']));
 it('explicit public consent permits Fajr sharing',()=>expect(shareableWins(['water','fajr'],true)).toEqual(['water','fajr']));
 it('water needs 2 L, not 1.9 L',()=>{expect(prefilledWins([habit('water')],[check('water',1.9)])).toEqual([]);expect(prefilledWins([habit('water')],[check('water',2)])).toEqual(['water']);});
 it('reading needs 10 pages, not 9',()=>{expect(prefilledWins([habit('read')],[check('read',9)])).toEqual([]);expect(prefilledWins([habit('read')],[check('read',10)])).toEqual(['read']);});
 it('steps need 8000, not 7999',()=>{expect(prefilledWins([habit('steps')],[check('steps',7999)])).toEqual([]);expect(prefilledWins([habit('steps')],[check('steps',8000)])).toEqual(['steps']);});
 it('templates use the requested lengths',()=>expect(TEMPLATE_DAYS).toEqual({winter_arc:40,ramadan:30,summer_body:45,reading:21,steps:30,custom:7}));
 it('audiences retain the requested group bands',()=>expect(AUDIENCE_SIZE).toMatchObject({solo:'1',duo:'2',squad:'3–10',club:'11–100',company:'100+'}));
});

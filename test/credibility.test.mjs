import test from 'node:test';
import assert from 'node:assert/strict';
import {scenario,inside,exposed,composeAdvisory} from '../public/scenario.js';
import {datasets,priorityActions} from '../public/evidence.js';
import {sourceRegister,sourceStamp,selectedEvidence,actionEvidence} from '../public/evidence-ui.js';
import {approveReview,invalidateReview,canExport,reviewedExport} from '../public/review.js';
import {draftAdvisory} from '../gemini.mjs';

test('boundary points, touching and collinear road edges count; disjoint roads do not',()=>{
 const polygon=[[0,0],[2,0],[2,2],[0,2]];
 for(const p of [[0,0],[1,0],[2,1],[2,2]])assert.equal(inside(p,polygon),true);
 for(const line of [[[-1,0],[1,0]],[[-1,-1],[0,0]],[[-1,1],[3,1]]])assert.equal(exposed({geometry:line},polygon),true);
 assert.equal(exposed({geometry:[[-2,0],[-1,0]]},polygon),false);
});

test('every layer has visible provenance and exported source metadata',()=>{
 const register=sourceRegister(),s=scenario(3);
 assert.deepEqual(Object.keys(datasets),['basemap','track','wind','rain','surge','assets','exposure','actions']);
 for(const d of Object.values(datasets)){
  assert.ok(register.includes(d.name));assert.ok(register.includes(sourceStamp(d.id)));
  assert.equal(d.label,'SYNTHETIC');assert.match(d.timestamp,/^2026-09-29T06:00:00Z$/);
  assert.deepEqual(s.datasets[d.id],d);assert.ok(d.limitations.length>30);
 }
 assert.ok(s.rows.every(a=>a.provenance.id==='assets'));
});

test('CS-01 timeline, asset score, causal action and draft agree end to end',()=>{
 const early=scenario(0),peak=scenario(3),recovery=scenario(6);
 assert.equal(peak.id,'CS-01');assert.equal(peak.hour,18);assert.equal(peak.strength,1);
 assert.equal(peak.wind,135);assert.equal(peak.rainfall,280);assert.equal(peak.surgeHeight,2.4);
 assert.ok(peak.affected>early.affected);assert.ok(recovery.affected<peak.affected);
 const hospital=peak.rows.find(a=>a.id==='H01');
 assert.deepEqual(hospital.factors,{rainfall:35,surge:45,vulnerability:20});assert.equal(hospital.score,100);
 assert.ok(selectedEvidence(hospital).includes('35 rainfall + 45 surge + 20 vulnerability = 100/100'));
 assert.match(selectedEvidence(hospital),/backup power/);
 assert.ok(actionEvidence(peak,12).includes('H01'));
 for(const a of priorityActions(peak))assert.ok(peak.rows.find(row=>row.id===a.id).score>0);
 for(const language of ['English','Odia','Hindi'])assert.ok(composeAdvisory(language,3,['H01']).includes('35 + 45 + 20 = 100/100'));
 for(let i=0;i<=6;i++)for(const a of scenario(i).rows)assert.equal(a.score,Math.min(100,Object.values(a.factors).reduce((x,y)=>x+y,0)));
});

test('review is bound to exact text, language and step; invalidation blocks export',()=>{
 const s={draft:composeAdvisory('English',3),language:'English',step:3,reviewed:false};
 assert.equal(canExport(s),false);assert.throws(()=>reviewedExport(s),/Human review/);
 approveReview(s);assert.equal(canExport(s),true);assert.match(reviewedExport(s),/Not an official warning/);
 for(const [field,value] of [['draft','changed'],['language','Odia'],['step',2]]){
  const changed={...s,[field]:value};assert.equal(canExport(changed),false);
 }
 invalidateReview(s);assert.equal(canExport(s),false);
 const empty={...s,draft:'   '};approveReview(empty);assert.equal(canExport(empty),false);
});

const response=text=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]})});
test('missing, invalid, timed out and malformed Gemini configurations fall back without leaking secrets',async()=>{
 const input={language:'English',step:3},key='test-only-secret';
 const absent=await draftAdvisory(input,{env:{},fetchImpl:()=>{throw Error('Must not call provider');}});
 assert.equal(absent.provider,'Local grounded template');
 for(const fetchImpl of [async()=>({ok:false}),async()=>{throw Error('timeout '+key);},async()=>response('not JSON'),async()=>response('{"assetIds":["H01"],"forecast":"evacuate now"}'),async()=>response('{"assetIds":["UNKNOWN"]}'),async()=>response('{"assetIds":["H01","H01"]}'),async()=>({ok:true,json:async()=>({candidates:[]})})]){
  const value=await draftAdvisory(input,{env:{GEMINI_API_KEY:key,GEMINI_MODEL:'invalid-model'},fetchImpl});
  assert.equal(value.provider,'Local grounded template');assert.ok(value.fallbackReason);
  assert.equal(value.text,absent.text);assert.equal(value.reviewRequired,true);
  assert.ok(!JSON.stringify(value).includes(key));
 }
});

test('Gemini receives only synthetic app facts; accepted IDs render deterministic text',async()=>{
 let request;
 const value=await draftAdvisory({language:'Hindi',step:3},{env:{GEMINI_API_KEY:'test-only-secret'},fetchImpl:async(url,options)=>{
  request=JSON.parse(options.body);assert.equal(options.headers['x-goog-api-key'],'test-only-secret');
  assert.ok(!url.includes('test-only-secret'));return response('{"assetIds":["H01"]}');
 }});
 const context=JSON.parse(request.contents[0].parts[0].text);
 assert.equal(context.scenarioId,'CS-01');assert.ok(context.unknowns.includes('Actual asset operating status'));
 assert.ok(context.allowed.every(a=>a.score>0));
 assert.equal(value.text,composeAdvisory('Hindi',3,['H01']));assert.match(value.provider,/Gemini-selected/);
});

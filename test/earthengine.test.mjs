import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {EE_DATASETS,parseEarthEngine,contextCues,assetContext,contextSummary} from '../public/earthengine.js';
import {eePanel,eeMapLayer,eeAssetEvidence} from '../public/earthengine-ui.js';
import {loadEarthEngine} from '../earthengine-store.mjs';
import {scenario} from '../public/scenario.js';
import {approveReview,canExport} from '../public/review.js';
import {draftAdvisory} from '../gemini.mjs';

// ARTIFICIAL PARSER FIXTURE. Never installed under data/ or public/ and never
// presented as real Earth Engine observations. Values only exercise code paths.
function fixture(){
 const manifest={schemaVersion:1,bundleId:'TEST-ONLY-NOT-OBSERVED',producer:'Google Earth Engine',label:'HISTORICAL CONTEXT',name:'Artificial test fixture',processedAt:'2026-09-30T00:00:00Z',aoi:[86.59,20.30,86.64,20.35],gridDegrees:.05,eventStart:'2021-05-24',eventEnd:'2021-05-26',preStart:'2021-05-10',preEnd:'2021-05-24',postStart:'2021-05-27',postEnd:'2021-06-10',datasets:EE_DATASETS.map(id=>({id,source:'TEST FIXTURE ONLY',resolution:'Test resolution metadata',observation:'Test observation metadata',limitation:'Artificial values, not derived from Earth Engine'})),limitations:['Artificial fixture. No scientific meaning.'],rainfall:{complete:true,expectedDays:2,availableDays:2,dates:[Date.parse('2021-05-24'),Date.parse('2021-05-25')],coverageStart:'1981-01-01',availableThrough:'2021-05-26T00:00:00Z'},sentinel1:{available:false,reason:'No test SAR imagery',preDates:[],postDates:[]},preview:null};
 const geojson={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[[[86.59,20.30],[86.64,20.30],[86.64,20.35],[86.59,20.35],[86.59,20.30]]]},properties:{cell_id:'test-cell',bundle_id:manifest.bundleId,area_km2:28,elevation_mean_m:4,slope_mean_deg:1,landcover_mode:40,built_fraction:.2,mangrove_fraction:.1,water_occurrence_pct:30,rainfall_mm:170,rainfall_days:2,s1_delta_db:null}}]};
 return {manifest,geojson};
}
test('EE Drive manifest envelope and compact grid parse; nullable data stays unknown',()=>{
 const {manifest,geojson}=fixture();
 const envelope={type:'FeatureCollection',features:[{type:'Feature',geometry:null,properties:{manifest_json:JSON.stringify(manifest)}}]};
 const bundle=parseEarthEngine(envelope,geojson);
 assert.equal(bundle.grid.features.length,1);assert.equal(contextCues(bundle.grid.features[0].properties).count,3);
 geojson.features[0].properties.rainfall_mm=null;
 const cues=contextCues(parseEarthEngine(manifest,geojson).grid.features[0].properties);
 assert.equal(cues.count,2);assert.equal(cues.known,2);assert.equal(cues.factors[1].flag,null);
});
test('EE rejects wrong run, absent provenance, invalid numeric values and contradictory availability',()=>{
 for(const mutate of [
  f=>f.geojson.features[0].properties.bundle_id='other-run',
  f=>f.manifest.datasets.pop(),
  f=>f.geojson.features[0].properties.rainfall_mm=-1,
  f=>f.geojson.features[0].properties.s1_delta_db=-2,
  f=>f.manifest.rainfall.complete=false,
  f=>f.manifest.eventEnd='2021-02-30',
  f=>f.geojson.features.push({...structuredClone(f.geojson.features[0]),properties:{...f.geojson.features[0].properties,cell_id:'duplicate-area'}}),
 ]){const f=fixture();mutate(f);assert.throws(()=>parseEarthEngine(f.manifest,f.geojson));}
});
test('EE point/road intersections produce separate, reproducible context cues; scenario score unchanged',()=>{
 const f=fixture(),bundle=parseEarthEngine(f.manifest,f.geojson),s=scenario(3),hospital=s.rows.find(a=>a.id==='H01');
 const c=assetContext(hospital,bundle);assert.equal(c.cells.length,1);assert.equal(c.count,3);assert.equal(c.known,3);
 assert.equal(assetContext({...hospital,geometry:[[86.58,20.32],[86.65,20.32]]},bundle).cells.length,1);
 assert.equal(assetContext({...hospital,lon:86.4,lat:20.4},bundle).count,null);
 assert.equal(hospital.score,100);assert.deepEqual(hospital.factors,{rainfall:35,surge:45,vulnerability:20});
 assert.match(c.action,/backup power/);assert.match(eeAssetEvidence(hospital,bundle),/Synthetic score unchanged/);
 assert.equal(contextSummary(bundle,[hospital]).assets[0].count,3);
});
test('EE provenance UI labels imported historical context, escapes metadata and renders real geometry',()=>{
 const f=fixture();f.manifest.name='<script>untrusted</script>';
 const bundle=parseEarthEngine(f.manifest,f.geojson),html=eePanel({bundle,status:'available'},scenario(3).rows,'test-cell');
 assert.match(html,/imported historical export/);assert.match(html,/end exclusive/);assert.match(html,/2026-09-30T00:00:00Z/);
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
 for(const id of EE_DATASETS)assert.ok(html.includes(id));
 assert.match(eeMapLayer(bundle,p=>p,null),/Historical grid test-cell/);
 assert.match(eePanel({bundle:null,reason:'Files absent'},[],null),/synthetic fallback/);
});
test('EE loader handles absent, malformed and valid files without installing fake production data',async()=>{
 const prefix=resolve(tmpdir(),'cycloneshield-ee-test-'),directory=await mkdtemp(prefix);
 try{
  assert.equal((await loadEarthEngine(directory)).status,'unavailable');
  const f=fixture();await writeFile(join(directory,'manifest.geojson'),JSON.stringify(f.manifest));await writeFile(join(directory,'grid.geojson'),'not JSON');
  assert.equal((await loadEarthEngine(directory)).status,'unavailable');
  await writeFile(join(directory,'grid.geojson'),JSON.stringify(f.geojson));
  const first=await loadEarthEngine(directory);assert.equal(first.status,'available');assert.equal(first.preview,null);
  f.geojson.features[0].properties.rainfall_mm=180;await writeFile(join(directory,'grid.geojson'),JSON.stringify(f.geojson));
  assert.notEqual((await loadEarthEngine(directory)).revision,first.revision);
 }finally{assert.ok(resolve(directory).startsWith(prefix));await rm(directory,{recursive:true,force:true});}
});
test('Gemini receives computed context; output remains constrained and review binds revision',async()=>{
 const f=fixture(),bundle=parseEarthEngine(f.manifest,f.geojson);let payload;
 const result=await draftAdvisory({language:'English',step:3},{env:{GEMINI_API_KEY:'test-only'},earthEngine:bundle,fetchImpl:async(_url,options)=>{
  payload=JSON.parse(options.body);return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"assetIds":["H01"]}'}]}}]})};
 }});
 const context=JSON.parse(payload.contents[0].parts[0].text).earthEngine;
 assert.equal(context.assets.find(a=>a.id==='H01').count,3);assert.match(result.text,/IMPORTED HISTORICAL CONTEXT/);
 assert.match(result.text,/3 screening cues \/ 3 known inputs/);
 const state={draft:result.text,language:'English',step:3,contextRevision:'first'};approveReview(state);assert.equal(canExport(state),true);state.contextRevision='changed';assert.equal(canExport(state),false);
});

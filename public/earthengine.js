import {exposed} from './scenario.js';
import {actionCatalog} from './evidence.js';

export const EE_DATASETS=['USGS/SRTMGL1_003','ESA/WorldCover/v200','JRC/GSW1_4/GlobalSurfaceWater','UCSB-CHG/CHIRPS/DAILY','COPERNICUS/S1_GRD'];
const fail=message=>{throw Error('Earth Engine export: '+message);};
const text=(v,max=500)=>typeof v==='string'&&v.length>0&&v.length<=max;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const nullable=(v,min,max)=>v==null?null:number(v,min,max)?v:fail('invalid numeric summary');
export function unavailableEarthEngine(reason='No Earth Engine exports installed. Synthetic scenario only.'){
  return {status:'unavailable',reason,revision:'none',bundle:null};
}
export function parseEarthEngine(rawManifest,geojson){
  let m=rawManifest;
  if(m?.type==='FeatureCollection'){
    if(m.features?.length!==1||!text(m.features[0]?.properties?.manifest_json,100000))fail('invalid manifest feature');
    m=JSON.parse(m.features[0].properties.manifest_json);
  }
  if(m?.schemaVersion!==1||m.producer!=='Google Earth Engine'||m.label!=='HISTORICAL CONTEXT'||!text(m.bundleId,100)||!text(m.name,200)||!text(m.processedAt,40)||!Number.isFinite(Date.parse(m.processedAt)))fail('missing provenance');
  if(![m.eventStart,m.eventEnd,m.preStart,m.preEnd,m.postStart,m.postEnd].every(date)||m.eventStart>=m.eventEnd||m.preStart>=m.preEnd||m.postStart>=m.postEnd||m.preEnd>m.postStart)fail('invalid observation dates');
  const expectedDays=(Date.parse(m.eventEnd)-Date.parse(m.eventStart))/86400000;
  if(expectedDays>31)fail('rainfall range exceeds 31 days');
  if(!Array.isArray(m.aoi)||m.aoi.length!==4||!number(m.aoi[0],84,88)||!number(m.aoi[2],84,88)||!number(m.aoi[1],18,22)||!number(m.aoi[3],18,22)||m.aoi[0]>=m.aoi[2]||m.aoi[1]>=m.aoi[3]||!number(m.gridDegrees,.05,.1))fail('unsupported AOI/grid');
  if(!Array.isArray(m.datasets)||m.datasets.length!==5||EE_DATASETS.some(id=>m.datasets.filter(d=>d.id===id).length!==1)||m.datasets.some(d=>!['source','resolution','observation','limitation'].every(k=>text(d[k],1500))))fail('incomplete source metadata');
  if(!Array.isArray(m.limitations)||!m.limitations.length||m.limitations.some(x=>!text(x,1500)))fail('missing limitations');
  const r=m.rainfall,s=m.sentinel1;
  if(!r||typeof r.complete!=='boolean'||r.expectedDays!==expectedDays||!Number.isInteger(r.availableDays)||r.availableDays<0||r.availableDays>31||!Array.isArray(r.dates)||r.dates.length!==r.availableDays||r.dates.some(t=>!number(t,Date.parse(m.eventStart),Date.parse(m.eventEnd)-1)||t%86400000!==0)||!text(r.availableThrough,40)||!Number.isFinite(Date.parse(r.availableThrough))||r.coverageStart!=='1981-01-01'||(r.complete&&(r.availableDays!==expectedDays||new Set(r.dates).size!==expectedDays)))fail('invalid rainfall availability');
  if(!s||typeof s.available!=='boolean'||!text(s.reason,500)||!Array.isArray(s.preDates)||!Array.isArray(s.postDates)||s.preDates.length>100||s.postDates.length>100||s.preDates.some(t=>!number(t,Date.parse(m.preStart),Date.parse(m.preEnd)-1))||s.postDates.some(t=>!number(t,Date.parse(m.postStart),Date.parse(m.postEnd)-1)))fail('invalid SAR availability');
  if(s.available&&(!Number.isInteger(s.orbit)||!['ASCENDING','DESCENDING'].includes(s.pass)||!number(s.coverage,.8,1.01)||!s.preDates.length||!s.postDates.length))fail('SAR lacks matched observations/coverage');
  if(geojson?.type!=='FeatureCollection'||!Array.isArray(geojson.features)||!geojson.features.length||geojson.features.length>200)fail('expected 1–200 grid cells');
  const ids=new Set();
  const features=geojson.features.map(f=>{
    const p=f.properties,g=f.geometry,ring=g?.coordinates?.[0];
    if(p?.bundle_id!==m.bundleId||!text(p.cell_id,40)||ids.has(p.cell_id)||g?.type!=='Polygon'||g.coordinates.length!==1||!Array.isArray(ring)||ring.length!==5)fail('invalid cell or mismatched export run');
    ids.add(p.cell_id);
    if(ring.some(c=>!Array.isArray(c)||c.length!==2||!number(c[0],m.aoi[0]-1e-7,m.aoi[2]+1e-7)||!number(c[1],m.aoi[1]-1e-7,m.aoi[3]+1e-7))||ring[0][0]!==ring[4][0]||ring[0][1]!==ring[4][1])fail('invalid cell coordinates');
    const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]),bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
    if(bounds[2]<=bounds[0]||bounds[3]<=bounds[1]||bounds[2]-bounds[0]>m.gridDegrees+1e-7||bounds[3]-bounds[1]>m.gridDegrees+1e-7||ring.slice(0,4).some((c,i)=>c[0]!==ring[i+1][0]&&c[1]!==ring[i+1][1]))fail('expected rectangular summary grid');
    const properties={cell_id:p.cell_id,bundle_id:p.bundle_id,area_km2:nullable(p.area_km2,.001,200),elevation_mean_m:nullable(p.elevation_mean_m,-500,9000),slope_mean_deg:nullable(p.slope_mean_deg,0,90),landcover_mode:nullable(p.landcover_mode,10,100),built_fraction:nullable(p.built_fraction,0,1),mangrove_fraction:nullable(p.mangrove_fraction,0,1),water_occurrence_pct:nullable(p.water_occurrence_pct,0,100),rainfall_mm:nullable(p.rainfall_mm,0,10000),s1_delta_db:nullable(p.s1_delta_db,-100,100),rainfall_days:p.rainfall_days};
    if(properties.landcover_mode!==null&&![10,20,30,40,50,60,70,80,90,95,100].includes(properties.landcover_mode))fail('unknown WorldCover class');
    if(properties.area_km2===null||![0,expectedDays].includes(properties.rainfall_days)||(!r.complete&&(properties.rainfall_days!==0||properties.rainfall_mm!==null))||(properties.rainfall_mm!==null&&properties.rainfall_days!==expectedDays)||(!s.available&&properties.s1_delta_db!==null))fail('missing values presented as measurements');
    return {type:'Feature',geometry:g,properties,bounds};
  });
  for(let i=0;i<features.length;i++)for(let j=i+1;j<features.length;j++){
    const a=features[i].bounds,b=features[j].bounds;
    if(Math.min(a[2],b[2])-Math.max(a[0],b[0])>1e-7&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>1e-7)fail('overlapping cells');
  }
  // Normalize to supported metadata only. Imported strings must still be escaped in UI.
  return {manifest:{schemaVersion:1,bundleId:m.bundleId,producer:m.producer,label:m.label,name:m.name,processedAt:m.processedAt,aoi:m.aoi,gridDegrees:m.gridDegrees,eventStart:m.eventStart,eventEnd:m.eventEnd,preStart:m.preStart,preEnd:m.preEnd,postStart:m.postStart,postEnd:m.postEnd,datasets:m.datasets.map(({id,source,resolution,observation,limitation})=>({id,source,resolution,observation,limitation})),limitations:m.limitations,rainfall:r,sentinel1:s,preview:s.available&&m.preview?.kind==='s1-vv-delta-db'?{kind:'s1-vv-delta-db',file:'preview.png',minDb:-6,maxDb:6}:null},grid:{type:'FeatureCollection',features}};
}

// These are explicitly assumed screening rules, NOT an empirical risk score.
// Keep separate from the synthetic 0–100 scenario score to avoid double counting.
export function contextCues(properties){
  const p=properties;
  const factors=[{name:'Low mean elevation',value:p.elevation_mean_m,unit:'m',rule:'≤5 m',flag:p.elevation_mean_m==null?null:p.elevation_mean_m<=5},
    {name:'Period rainfall',value:p.rainfall_mm,unit:'mm over event window',rule:'≥150 mm',flag:p.rainfall_mm==null?null:p.rainfall_mm>=150},
    {name:'Historical water occurrence',value:p.water_occurrence_pct,unit:'%',rule:'≥20%',flag:p.water_occurrence_pct==null?null:p.water_occurrence_pct>=20}];
  return {factors,count:factors.filter(f=>f.flag===true).length,known:factors.filter(f=>f.flag!==null).length};
}
export function assetContext(asset,bundle){
  if(!bundle)return {cells:[],count:null,known:0,action:'No imported Earth Engine context. Synthetic exercise only.'};
  const cells=bundle.grid.features.filter(f=>exposed(asset,f.geometry.coordinates[0])).map(f=>({id:f.properties.cell_id,...contextCues(f.properties),properties:f.properties}));
  const representative=[...cells].sort((a,b)=>b.count-a.count||b.known-a.known||a.id.localeCompare(b.id))[0];
  return {cells,count:representative?.count??null,known:representative?.known??0,representative:representative?.id??null,action:cells.length?`${actionCatalog[asset.type].English} Verify local conditions; grid context is not a measurement at this fictional asset.`:'Outside imported grid; no data does not mean safe.'};
}
export function contextSummary(bundle,assets){
  if(!bundle)return null;
  return {label:'IMPORTED HISTORICAL CONTEXT + SYNTHETIC ASSETS',bundleId:bundle.manifest.bundleId,processedAt:bundle.manifest.processedAt,eventStart:bundle.manifest.eventStart,eventEnd:bundle.manifest.eventEnd,datasets:bundle.manifest.datasets,limitations:bundle.manifest.limitations,screeningRules:'1 cue each for mean elevation ≤5m, period rainfall ≥150mm, historical occurrence ≥20%; arbitrary, not validated. No scenario-score modification.',assets:assets.map(a=>({id:a.id,...assetContext(a,bundle)}))};
}
export function contextAppendix(bundle,assets,ids=assets.map(a=>a.id)){
  if(!bundle)return '';
  const m=bundle.manifest;
  return `\n\nIMPORTED HISTORICAL CONTEXT · ${m.name}\nPeriod ${m.eventStart} to ${m.eventEnd} (end exclusive); processed ${m.processedAt}. Independent of synthetic timeline.\n`+assets.filter(a=>ids.includes(a.id)).map(a=>{
    const c=assetContext(a,bundle);
    return `${a.id}: ${c.cells.length} intersecting grid cell(s); ${c.count===null?'context unknown':`${c.count} screening cues / ${c.known} known inputs in representative cell ${c.representative}`}. ${c.cells.find(cell=>cell.id===c.representative)?.factors.map(f=>`${f.name}: ${f.value==null?'unknown':f.value.toFixed(1)+' '+f.unit}`).join('; ')??''}. ${c.action}`;
  }).join('\n')+'\nScreening assumptions: elevation ≤5 m, period rainfall ≥150 mm, historical water occurrence ≥20%. One cue per condition; highest cue-count cell represents multi-cell roads. These are not calibrated risk or forecast values. Synthetic 0–100 score is unchanged. Source: operator-supplied Earth Engine export; source epochs differ.';
}

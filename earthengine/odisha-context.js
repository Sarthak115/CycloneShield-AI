/* CycloneShield: paste into https://code.earthengine.google.com/ and Run.
 * Requires an Earth Engine-enabled Cloud project selected in the Code Editor.
 * This script creates export TASKS; the operator must review and run them.
 * Retrospective context only: NOT a cyclone forecast, surge model, flood map,
 * damage classifier or validated risk model. No fictional app assets enter EE.
 */
var CONFIG = {
  // WGS84 [west,south,east,north], configurable small coastal Odisha rectangle.
  // Default covers the Paradip pilot; avoid large/global AOIs.
  bounds: [86.35, 20.15, 86.75, 20.50],
  gridDegrees: 0.05, // ~5 km, not a claim of 10 m rainfall precision.
  label: 'Paradip May 2021 retrospective context',
  eventStart: '2021-05-24', eventEnd: '2021-05-31', // end EXCLUSIVE; 7 daily totals.
  preStart: '2021-05-10', preEnd: '2021-05-24', // pre-event SAR window, exclusive end.
  postStart: '2021-05-27', postEnd: '2021-06-10', // post-window, not peak inundation.
  pass: 'DESCENDING', // identical pass + IW + VV + relative orbit required.
  minCommonCoverage: 0.80, // analyst eligibility rule, NOT validation confidence.
  folder: 'CycloneShield',
};
if(CONFIG.minCommonCoverage<0.8 || CONFIG.minCommonCoverage>1)throw new Error('Common SAR coverage threshold must be 0.8–1.');
var b = CONFIG.bounds;
var nx = Math.ceil((b[2]-b[0])/CONFIG.gridDegrees - 1e-8);
var ny = Math.ceil((b[3]-b[1])/CONFIG.gridDegrees - 1e-8);
if (b[0]<84 || b[2]>88 || b[1]<18 || b[3]>22 || nx<1 || ny<1 || nx*ny>200 || (CONFIG.gridDegrees<0.05 || CONFIG.gridDegrees>0.1)) {
  throw new Error('Use a small coastal Odisha AOI, 0.05–0.1 degree cells and <=200 cells.');
}
function days(start,end) { return (Date.parse(end)-Date.parse(start))/86400000; }
var expectedDays=days(CONFIG.eventStart,CONFIG.eventEnd);
if (!(expectedDays>=1 && expectedDays<=31) || !(days(CONFIG.preStart,CONFIG.preEnd)>0 && days(CONFIG.preStart,CONFIG.preEnd)<=45) || !(days(CONFIG.postStart,CONFIG.postEnd)>0 && days(CONFIG.postStart,CONFIG.postEnd)<=45) || CONFIG.preEnd>CONFIG.postStart) {
  throw new Error('Use ordered non-overlapping SAR windows <=45 days; rainfall window 1–31 days.');
}
var aoi=ee.Geometry.Rectangle(b,'EPSG:4326',false);
var processedAt=new Date().toISOString(); // time script submitted, not observation time.
var bundleId='odisha-'+processedAt;
var cells=[];
for(var x=0;x<nx;x++)for(var y=0;y<ny;y++){
  var west=b[0]+x*CONFIG.gridDegrees,south=b[1]+y*CONFIG.gridDegrees;
  cells.push(ee.Feature(ee.Geometry.Rectangle([west,south,Math.min(b[2],west+CONFIG.gridDegrees),Math.min(b[3],south+CONFIG.gridDegrees)],'EPSG:4326',false),{cell_id:'c'+x+'_'+y,bundle_id:bundleId}));
}
var grid=ee.FeatureCollection(cells);

// Dataset metadata is exported with measurements. Source resolutions are not
// replaced by grid size. Native projection/transforms are used for reduction.
var sources=[
  {id:'USGS/SRTMGL1_003',source:'NASA / USGS / JPL SRTM v3',resolution:'1 arc-second (~30 m)',observation:'2000-02-11 to 2000-02-22',url:'https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003',limitation:'Void-filled radar elevation, possible canopy/building bias; not current ground survey or coastal flood depth.'},
  {id:'ESA/WorldCover/v200',source:'ESA WorldCover consortium',resolution:'10 m',observation:'2021 annual map',url:'https://developers.google.com/earth-engine/datasets/catalog/ESA_WorldCover_v200',limitation:'Annual class context, not event-time damage or population. CC BY 4.0; attribution required.'},
  {id:'JRC/GSW1_4/GlobalSurfaceWater',source:'EC JRC / Google',resolution:'30 m',observation:'1984-03-16 to 2021-12-31',url:'https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater',limitation:'Historical water detection occurrence over valid observations, not flood probability; includes observations after the chosen May event.'},
  {id:'UCSB-CHG/CHIRPS/DAILY',source:'UCSB Climate Hazards Center CHIRPS v2 daily',resolution:'0.05 degrees (~5.6 km at equator)',observation:CONFIG.eventStart+' to '+CONFIG.eventEnd+' (end exclusive)',url:'https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY',limitation:'Daily satellite/station precipitation estimate, coverage begins 1981-01-01 (50S–50N). Actual latest available date is recorded at execution. Not a live gauge or forecast.'},
  {id:'COPERNICUS/S1_GRD',source:'Copernicus / ESA Sentinel-1 GRD via Earth Engine',resolution:'10 m pixel spacing selected; effective IW resolution is coarser (~20 m); summaries sampled at 30 m',observation:CONFIG.preStart+' to '+CONFIG.preEnd+' vs '+CONFIG.postStart+' to '+CONFIG.postEnd+' (ends exclusive)',url:'https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD',limitation:'VV dB median change can reflect soil moisture, vegetation, tides, geometry or speckle. Not a flood/damage measurement. Acquisition dates may miss peak conditions.'}
];
// Static datasets are clipped to the AOI (small buffer for slope derivatives).
var dem=ee.Image('USGS/SRTMGL1_003').select('elevation');
var demProjection=dem.projection();
var terrain=ee.Terrain.slope(dem.clip(aoi.buffer(100))).rename('slope_deg');
var cover=ee.Image(ee.ImageCollection('ESA/WorldCover/v200').filterBounds(aoi).filterDate('2021-01-01','2022-01-01').first()).select('Map');
var water=ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence');
// Date and AOI filters precede any rainfall/SAR composite or reduction.
var chirpsAOI=ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY').filterBounds(aoi);
var rain=chirpsAOI.filterDate(CONFIG.eventStart,CONFIG.eventEnd).select('precipitation');
var s1=ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(aoi)
  .filter(ee.Filter.eq('instrumentMode','IW')).filter(ee.Filter.eq('orbitProperties_pass',CONFIG.pass))
  .filter(ee.Filter.eq('resolution_meters',10)).filter(ee.Filter.listContains('transmitterReceiverPolarisation','VV'));
var pre=s1.filterDate(CONFIG.preStart,CONFIG.preEnd),post=s1.filterDate(CONFIG.postStart,CONFIG.postEnd);
// Metadata lookup only; no global raster calculations. Latest CHIRPS timestamp
// is read from an AOI-filtered collection so no fixed "present" coverage is claimed.
ee.Dictionary({rainCount:rain.size(),rainDates:rain.aggregate_array('system:time_start'),chirpsLatest:chirpsAOI.aggregate_max('system:time_start'),preOrbits:pre.aggregate_array('relativeOrbitNumber_start'),postOrbits:post.aggregate_array('relativeOrbitNumber_start')}).evaluate(function(info,error){
  if(error){print('Metadata failed. No exports created.',error);return;}
  var common=info.preOrbits.filter(function(o){return info.postOrbits.indexOf(o)>=0;}).sort(function(a,b){return a-b;});
  if(!common.length){buildExports(null,{available:false,reason:'No common relative orbit in both filtered SAR windows',preDates:[],postDates:[]},info);return;}
  // Select lowest common orbit deterministically; inspect dates/coverage in Console.
  // No mixing of relative orbits; change CONFIG.pass/windows if this one is unsuitable.
  var orbit=common[0],p=pre.filter(ee.Filter.eq('relativeOrbitNumber_start',orbit)),q=post.filter(ee.Filter.eq('relativeOrbitNumber_start',orbit));
  function clean(image){var vv=image.select('VV');return vv.updateMask(image.select('angle').gte(30).and(image.select('angle').lte(45)).and(vv.gt(-35))).clip(aoi);}
  var before=p.map(clean).median(),after=q.map(clean).median();
  var delta=after.subtract(before).rename('s1_delta_db'); // post minus pre in dB.
  // Exclude edge/no-data pixels; temporal median reduces but does not eliminate speckle.
  // Coverage estimated on a 100 m check grid only; no measurement sharpening.
  var validArea=ee.Image.pixelArea().updateMask(delta.mask()).reduceRegion({reducer:ee.Reducer.sum(),geometry:aoi,scale:100,maxPixels:1e6}).get('area');
  ee.Dictionary({coverage:ee.Number(ee.Algorithms.If(validArea,validArea,0)).divide(aoi.area(1)),preDates:p.aggregate_array('system:time_start'),postDates:q.aggregate_array('system:time_start'),preIds:p.aggregate_array('system:index'),postIds:q.aggregate_array('system:index')}).evaluate(function(meta,err){
    if(err){print('SAR eligibility evaluation failed; exporting other context only.',err);buildExports(null,{available:false,reason:'SAR eligibility evaluation failed',preDates:[],postDates:[]},info);return;}
    meta.orbit=orbit;meta.pass=CONFIG.pass;meta.available=meta.coverage>=CONFIG.minCommonCoverage;
    meta.reason=meta.available?'Matched orbit/windows; sufficient common valid coverage for descriptive comparison':'Common valid coverage below configured threshold';
    buildExports(meta.available?delta:null,meta,info);
  });
});

function buildExports(delta,sar,info){
  var rainComplete=info.rainCount===expectedDays && info.rainDates.filter(function(t,i,a){return a.indexOf(t)===i;}).length===expectedDays;
  var rainfallImage=null,rainProjection=null;
  if(rainComplete){
    rainProjection=ee.Image(rain.first()).projection();
    // Sum daily mm, mask any pixel missing even one day. Native 0.05-degree
    // projection retained. Null is missing data, never zero rainfall.
    rainfallImage=rain.sum().updateMask(rain.count().eq(expectedDays)).rename('rainfall_mm');
  }
  function reduce(image,geometry,reducer,projection,scale){
    var options={reducer:reducer,geometry:geometry,maxPixels:2e6,tileScale:2};
    if(projection){options.crs=projection;options.crsTransform=projection.transform();}
    else{options.crs='EPSG:32645';options.scale=scale;}
    return image.reduceRegion(options);
  }
  var summary=grid.map(function(f){
    var g=f.geometry();
    var elevation=reduce(dem.clip(aoi),g,ee.Reducer.mean(),demProjection).get('elevation');
    var slope=reduce(terrain,g,ee.Reducer.mean(),demProjection).get('slope_deg');
    var land=cover.clip(aoi),waterAOI=water.clip(aoi);
    var landStats=reduce(land.eq(50).rename('built_fraction').addBands(land.eq(95).rename('mangrove_fraction')),g,ee.Reducer.mean(),cover.projection());
    return f.set({area_km2:g.area(1).divide(1e6),elevation_mean_m:elevation,slope_mean_deg:slope,
      landcover_mode:reduce(land,g,ee.Reducer.mode(),cover.projection()).get('Map'),
      built_fraction:landStats.get('built_fraction'),mangrove_fraction:landStats.get('mangrove_fraction'),
      water_occurrence_pct:reduce(waterAOI,g,ee.Reducer.mean(),water.projection()).get('occurrence'),
      rainfall_mm:rainComplete?reduce(rainfallImage,g,ee.Reducer.mean(),rainProjection).get('rainfall_mm'):null,
      rainfall_days:rainComplete?expectedDays:0,
      s1_delta_db:delta?reduce(delta,g,ee.Reducer.mean(),null,30).get('s1_delta_db'):null});
  });
  var manifest={schemaVersion:1,bundleId:bundleId,producer:'Google Earth Engine',label:'HISTORICAL CONTEXT',name:CONFIG.label,processedAt:processedAt,
    aoi:b,gridDegrees:CONFIG.gridDegrees,eventStart:CONFIG.eventStart,eventEnd:CONFIG.eventEnd,
    preStart:CONFIG.preStart,preEnd:CONFIG.preEnd,postStart:CONFIG.postStart,postEnd:CONFIG.postEnd,
    datasets:sources,rainfall:{complete:rainComplete,expectedDays:expectedDays,availableDays:info.rainCount,dates:info.rainDates,coverageStart:'1981-01-01',availableThrough:new Date(info.chirpsLatest).toISOString()},
    sentinel1:sar,preview:delta?{kind:'s1-vv-delta-db',file:'preview.png',minDb:-6,maxDb:6}:null,
    limitations:['No cyclone forecasting, calibrated flood/surge simulation or population estimates.','Source epochs differ: SRTM 2000, WorldCover 2021, JRC 1984–2021, rainfall/SAR selected dates.','Mean elevation can hide local low areas; mean rainfall is coarse gridded context.','SAR change is not flood extent or damage; no impact attribution is made.','Null values mean no usable data; synthetic app assets remain fictional.','Grid cells summarize native source pixels, not individual asset measurements.']};
  // Compact 56-cell default: no per-pixel vectorization or global reduceToVectors.
  Export.table.toDrive({collection:summary,description:'CycloneShield_grid',folder:CONFIG.folder,fileNamePrefix:'grid',fileFormat:'GeoJSON'});
  // A one-feature GeoJSON containing the JSON manifest is Drive-compatible.
  Export.table.toDrive({collection:ee.FeatureCollection([ee.Feature(null,{manifest_json:JSON.stringify(manifest)})]),description:'CycloneShield_manifest',folder:CONFIG.folder,fileNamePrefix:'manifest',fileFormat:'GeoJSON'});
  if(delta){
    var rgb=delta.visualize({min:-6,max:6,palette:['2166ac','f7f7f7','b2182b']}).clip(aoi);
    // Lightweight 100 m RGB GeoTIFF for GIS inspection, NOT numerical analysis.
    Export.image.toDrive({image:rgb,description:'CycloneShield_s1_comparison',folder:CONFIG.folder,fileNamePrefix:'s1-comparison',region:aoi,scale:100,crs:'EPSG:4326',maxPixels:1e6,fileFormat:'GeoTIFF'});
    // Optional app/Gemini preview: open this URL and Save image as preview.png.
    // PNG is a visualization only; the authoritative numerical input is the grid.
    print('Optional preview.png URL (temporary; save locally)',rgb.getThumbURL({region:aoi,dimensions:768,format:'png'}));
    Map.addLayer(delta,{min:-6,max:6,palette:['2166ac','f7f7f7','b2182b']},'Historical S1 VV delta (dB); NOT flood extent');
  }
  Map.centerObject(aoi,10);Map.addLayer(grid,{color:'267c68'},'Summary grid (not hazard boundary)');
  print('Manifest: inspect epochs, availability and limitations before starting Tasks',manifest);
  print('Summary preview',summary.limit(3));
  print('Start grid + manifest Tasks from THIS run; do not mix exports between runs.');
}

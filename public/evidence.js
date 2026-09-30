// Every rendered data layer has an authored timestamp, not an observation time.
export const authoredAt = '2026-09-29T06:00:00Z';
export const datasets = Object.fromEntries([
  ['basemap', 'Coastline, rivers, roads and place labels', 'Hand-drawn schematic; place names give approximate context only. No surveyed geography or navigable routes.'],
  ['track', 'Cyclone track and envelope', 'Seven authored positions at six-hour intervals. Envelope is decorative scenario extent, not forecast probability.'],
  ['wind', 'Wind input', 'Rounded 60 + 75 × intensity multiplier, in km/h. Not a forecast; wind does not enter the exposure score.'],
  ['rain', 'Rainfall / flood footprint', 'Rounded 280 × intensity multiplier, in mm/24h. Polygon is authored geometry; no runoff, flood depth or observed rainfall.'],
  ['surge', 'Storm-surge footprint', '2.4 × intensity multiplier, rounded to one decimal metre. Polygon is an authored band, not modeled inundation.'],
  ['assets', 'Facilities, road segments and vulnerability', 'Twelve fictional assets. Vulnerability is an assumed 1–5 score; status, capacity and service population are unknown.'],
  ['exposure', 'Exposure indicator', 'Derived from synthetic geometry. Boundary contact counts as overlap. Weights and thresholds are arbitrary planning rules, not calibrated risk.'],
  ['actions', 'Preparedness suggestions', 'Authored exercise checklist selected by asset type and hazard overlap. Requires local verification; not an official instruction.'],
].map(([id,name,limitations])=>[id,{id,name,label:'SYNTHETIC',source:'CycloneShield authored sample v1',timestamp:authoredAt,limitations}]));

export const exercise = {
  id:'CS-01', name:'Paradip coastal approach exercise', label:'SYNTHETIC',
  description:'A fictional cyclone approaches the Paradip coast, peaks at T+18h, then weakens inland. Hazard footprints expand and contract with an authored intensity schedule; they are not generated from the cyclone position.',
  multipliers:[.25,.4,.65,1,.9,.7,.45],
  unknowns:['Actual asset operating status','Verified shelter capacity','Population exposed','Flood depth','Validated probability or confidence','Real cyclone forecast'],
};

export function sourceLabel(id){const d=datasets[id];return `${d.label} · ${d.source} · authored ${d.timestamp}`;}
export const actionCatalog = {
  hospital:{English:'Verify backup power and essential medicine stocks with the facility coordinator.',Hindi:'स्वास्थ्य केंद्र के समन्वयक से बैकअप बिजली और आवश्यक दवाओं के भंडार की पुष्टि करें।',Odia:'ସ୍ୱାସ୍ଥ୍ୟକେନ୍ଦ୍ରର ସମନ୍ୱୟକଙ୍କ ସହ ବିକଳ୍ପ ବିଦ୍ୟୁତ୍ ଏବଂ ଆବଶ୍ୟକ ଔଷଧ ମହଜୁଦ ଯାଞ୍ଚ କରନ୍ତୁ।'},
  shelter:{English:'Confirm shelter capacity and accessible entry with the local coordinator; availability is unknown.',Hindi:'स्थानीय समन्वयक से आश्रय क्षमता और सुगम प्रवेश की पुष्टि करें; उपलब्धता अज्ञात है।',Odia:'ସ୍ଥାନୀୟ ସମନ୍ୱୟକଙ୍କ ସହ ଆଶ୍ରୟସ୍ଥଳର କ୍ଷମତା ଏବଂ ସୁଗମ ପ୍ରବେଶ ଯାଞ୍ଚ କରନ୍ତୁ; ଉପଲବ୍ଧତା ଅଜଣା।'},
  road:{English:'Ask local coordinators to verify alternate access; no road closure or safe route is confirmed.',Hindi:'स्थानीय समन्वयकों से वैकल्पिक पहुँच की जाँच कराएँ; सड़क बंद होने या सुरक्षित मार्ग की पुष्टि नहीं हुई है।',Odia:'ସ୍ଥାନୀୟ ସମନ୍ୱୟକଙ୍କୁ ବିକଳ୍ପ ରାସ୍ତା ଯାଞ୍ଚ କରିବାକୁ କୁହନ୍ତୁ; ରାସ୍ତା ବନ୍ଦ କିମ୍ବା ସୁରକ୍ଷିତ ଥିବା ନିଶ୍ଚିତ ହୋଇନାହିଁ।'},
  power:{English:'Ask the utility coordinator to review backup arrangements; actual outage status is unknown.',Hindi:'बिजली सेवा समन्वयक से बैकअप व्यवस्था की समीक्षा कराएँ; बिजली कटौती का कोई अवलोकन नहीं है।',Odia:'ବିଦ୍ୟୁତ୍ ସେବା ସମନ୍ୱୟକଙ୍କୁ ବିକଳ୍ପ ବ୍ୟବସ୍ଥା ଯାଞ୍ଚ କରିବାକୁ କୁହନ୍ତୁ; ବିଦ୍ୟୁତ୍ ବିଭ୍ରାଟର କୌଣସି ପର୍ଯ୍ୟବେକ୍ଷଣ ନାହିଁ।'},
  water:{English:'Verify drinking-water reserves and facility backup plans; contamination is not established.',Hindi:'पीने के पानी के भंडार और केंद्र की बैकअप योजना की पुष्टि करें; प्रदूषण स्थापित नहीं हुआ है।',Odia:'ପାନୀୟ ଜଳ ମହଜୁଦ ଏବଂ କେନ୍ଦ୍ରର ବିକଳ୍ପ ଯୋଜନା ଯାଞ୍ଚ କରନ୍ତୁ; ଦୂଷିତ ହେବା ନିଶ୍ଚିତ ହୋଇନାହିଁ।'},
};
export function assetReason(a){return `${[a.rainfall?'rainfall footprint':null,a.stormSurge?'surge footprint':null].filter(Boolean).join(' + ')||'no modeled footprint'}; assumed vulnerability ${a.vulnerability}/5`;}
export function assetAction(a){return a.score>0?actionCatalog[a.type].English:'Outside the modeled footprints; this does not establish safety. Verify actual conditions and maintain routine preparedness.';}
export function priorityActions(s){return s.rows.filter(a=>a.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).map(a=>({id:a.id,type:a.type,name:a.name,reason:assetReason(a),action:assetAction(a),score:a.score}));}

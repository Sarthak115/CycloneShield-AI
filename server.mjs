import {readFile,mkdir,appendFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {draftAdvisory,geminiModel} from './gemini.mjs';
import {loadEarthEngine} from './earthengine-store.mjs';
const root=fileURLToPath(new URL('./public/',import.meta.url));
// Vercel's deployment filesystem is read-only. This scratch store is NOT durable.
const temporaryStorage=process.env.VERCEL==='1';
const dataDir=temporaryStorage?resolve(tmpdir(),'cycloneshield-incidents'):fileURLToPath(new URL('./data/',import.meta.url));
const seen=new Set();
try{for(const line of (await readFile(resolve(dataDir,'incidents.jsonl'),'utf8')).trim().split('\n'))if(line)seen.add(JSON.parse(line).id);}catch(e){if(e.code!=='ENOENT')throw e;}
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req){
 // Vercel may supply a parsed body; ordinary Node requests expose a stream.
 if(req.body!==undefined){const text=Buffer.isBuffer(req.body)?req.body.toString('utf8'):typeof req.body==='string'?req.body:JSON.stringify(req.body);if(text.length>16000)throw Error('Request too large');return JSON.parse(text);}
 let text='';for await(const chunk of req){text+=chunk;if(text.length>16000)throw Error('Request too large');}return JSON.parse(text);
}
export default async function handler(req,res){try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/api/earthengine'){
  const ee=await loadEarthEngine();const {preview,...payload}=ee;return json(res,200,{...payload,previewAvailable:!!preview});
 }
 if(req.method==='GET'&&url.pathname==='/api/earthengine/preview'){
  const ee=await loadEarthEngine();if(!ee.preview)return json(res,404,{error:'No eligible imported preview'});
  res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(ee.preview);
 }
 if(req.method==='GET'&&url.pathname==='/api/status'){
  const ee=await loadEarthEngine();return json(res,200,{gemini:!!process.env.GEMINI_API_KEY?.trim(),geminiModel:geminiModel(),modelAccess:'Unverified until provider call or npm run check:gemini',earthEngine:{status:ee.status,mode:ee.reason,revision:ee.revision},meteorology:'No live source configured; authored scenario plus optional historical CHIRPS export',firebase:'Not configured',incidentStorage:temporaryStorage?'Temporary Vercel scratch storage; no durable receipt or cross-instance deduplication':'Local JSONL store'});
 }
 if(req.method==='POST'&&url.pathname==='/api/advisory'){
 const input=await body(req);if(!['English','Hindi','Odia'].includes(input.language)||!Number.isInteger(input.step)||input.step<0||input.step>6)return json(res,400,{error:'Invalid language or timeline step'});
 const ee=await loadEarthEngine();if(input.contextRevision!==undefined&&input.contextRevision!==ee.revision)return json(res,409,{error:'Earth Engine context changed. Reload and review a new draft.'});
 return json(res,200,await draftAdvisory(input,{earthEngine:ee.bundle,preview:ee.preview}));}
 if(req.method==='POST'&&url.pathname==='/api/incidents'){const x=await body(req);if(typeof x.id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(x.id)||!['Flooding','Road blocked','Medical need','Shelter issue'].includes(x.type)||typeof x.description!=='string'||x.description.length<3||x.description.length>1200)return json(res,400,{error:'Invalid incident'});if(!seen.has(x.id)){seen.add(x.id);try{await mkdir(dataDir,{recursive:true});await appendFile(resolve(dataDir,'incidents.jsonl'),JSON.stringify({id:x.id,type:x.type,description:x.description,receivedAt:new Date().toISOString(),exercise:true})+'\n');}catch(e){seen.delete(x.id);throw e;}}return json(res,200,{id:x.id,status:temporaryStorage?'Received temporarily by demo server; not durably stored or sent to emergency services':'Received by demo server; not sent to emergency services',durable:!temporaryStorage});}
 if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Unknown endpoint'});
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 const resource=url.pathname==='/'?'/index.html':url.pathname==='/favicon.ico'?'/favicon.svg':url.pathname;
 const path=resolve(root,'.'+decodeURIComponent(resource));if(!path.startsWith(root))return json(res,403,{error:'Forbidden'});
 const content=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});res.end(content);
 }catch(e){json(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'Not found':'Request could not be processed'});}}

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import * as entrypoint from '../server.mjs';

test('Vercel entrypoint exports only a request handler and imports without binding a port',()=>{
 assert.deepEqual(Object.keys(entrypoint),['default']);
 assert.equal(typeof entrypoint.default,'function');
 const child=spawnSync(process.execPath,['--input-type=module','-e',"await import('./server.mjs'); console.log('imported')"],{timeout:5000,encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),'imported');
});

test('default handler serves static files, APIs, parsed bodies and streamed bodies',async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/api/advisory?parsed')req.body={language:'English',step:3};
  return entrypoint.default(req,res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const [path,type] of [['/','text/html'],['/favicon.ico','image/svg+xml'],['/favicon.svg','image/svg+xml'],['/app.js','text/javascript'],['/style.css','text/css'],['/sw.js','text/javascript'],['/earthengine.js','text/javascript']]){
   const response=await fetch(base+path);assert.equal(response.status,200,path);assert.ok(response.headers.get('content-type').startsWith(type),path);assert.ok((await response.text()).length>0);
  }
  for(const path of ['/api/status','/api/earthengine']){
   const response=await fetch(base+path);assert.equal(response.status,200);assert.ok(await response.json());
  }
  for(const suffix of ['', '?parsed']){
   const response=await fetch(base+'/api/advisory'+suffix,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'English',step:3})});
   assert.equal(response.status,200);const value=await response.json();assert.equal(value.reviewRequired,true);assert.equal(value.provider,'Local grounded template');
  }
  assert.equal((await fetch(base+'/.env')).status,404);
  assert.equal((await fetch(base+'/api/missing')).status,404);
 }finally{await new Promise(r=>server.close(r));}
});

test('Vercel incident receipt uses temporary storage and reports its limits',()=>{
 const script=`
  import http from 'node:http';
  import assert from 'node:assert/strict';
  import {randomUUID} from 'node:crypto';
  const {default:handler}=await import('./server.mjs');
  const server=http.createServer(handler);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
   const base='http://127.0.0.1:'+server.address().port;
   const status=await (await fetch(base+'/api/status')).json();
   assert.match(status.incidentStorage,/Temporary/);
   const incident={id:randomUUID(),type:'Flooding',description:'Automated exercise runtime test'};
   for(let i=0;i<2;i++){
    const response=await fetch(base+'/api/incidents',{method:'POST',body:JSON.stringify(incident)});
    assert.equal(response.status,200);
    const receipt=await response.json();assert.equal(receipt.durable,false);assert.match(receipt.status,/not durably stored/);
   }
  }finally{await new Promise(r=>server.close(r));}
 `;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,VERCEL:'1',GEMINI_API_KEY:''},timeout:15000,encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);
});

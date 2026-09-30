import {readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
for(const folder of ['public','scripts','test','earthengine'])for(const f of await readdir(folder))if(/\.(js|mjs)$/.test(f))execFileSync(process.execPath,['--check',`${folder}/${f}`],{stdio:'inherit'});
for(const file of ['server.mjs','gemini.mjs','earthengine-store.mjs'])execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
console.log('All JavaScript syntax checks passed. Native browser modules: no compilation required.');

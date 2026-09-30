import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseEarthEngine,unavailableEarthEngine} from './public/earthengine.js';
const defaultDirectory=fileURLToPath(new URL('./data/earthengine/',import.meta.url));
export async function loadEarthEngine(directory=defaultDirectory){
  try{
    const read=async file=>{const path=resolve(directory,file);if((await stat(path)).size>2_000_000)throw Error('Export exceeds 2 MB limit');return JSON.parse(await readFile(path,'utf8'));};
    const [manifest,grid]=await Promise.all([read('manifest.geojson'),read('grid.geojson')]);
    const bundle=parseEarthEngine(manifest,grid);
    const hash=createHash('sha256').update(JSON.stringify(bundle));
    let preview=null;
    if(bundle.manifest.preview){try{const path=resolve(directory,'preview.png');if((await stat(path)).size<=1_000_000){const bytes=await readFile(path);if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))preview=bytes;}}catch{/* Optional preview never blocks summaries. */}}
    const revision=hash.update(preview??'no-preview').digest('hex');
    return {status:'available',reason:'Imported Earth Engine export; not a live connection. Origin supplied by operator, not independently authenticated.',revision,bundle,preview};
  }catch(error){return unavailableEarthEngine(error.code==='ENOENT'?'Earth Engine exports absent. Synthetic fallback active.':'Earth Engine exports rejected: '+error.message+'. Synthetic fallback active.');}
}

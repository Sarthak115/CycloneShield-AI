import {geminiModel} from '../gemini.mjs';
const model=geminiModel(),key=process.env.GEMINI_API_KEY?.trim();
if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$/.test(model)){
  console.error('Invalid GEMINI_MODEL identifier. Use a model code, not a URL or models/ prefix.');process.exitCode=1;
}else if(!key){
  console.log(`Model identifier: ${model}. No API key configured; account availability is unverified. Demo fallback remains available.`);
}else{
  try{
    // Metadata request only: no image, prompt, user report or geospatial data sent.
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw Error();
    const metadata=await r.json();if(!metadata.supportedGenerationMethods?.includes('generateContent'))throw Error();
    console.log(`${model}: account can retrieve model metadata and generateContent is listed. A generation call may still fail due to quota or policy.`);
  }catch{console.error('Model could not be verified (credentials, model availability or connection). No secrets logged; application falls back to templates.');process.exitCode=1;}
}

import {scenario,composeAdvisory} from './public/scenario.js';
import {contextSummary,contextAppendix} from './public/earthengine.js';
import {priorityActions,exercise} from './public/evidence.js';

export const geminiModel=(env=process.env)=>env.GEMINI_MODEL?.trim()||'gemini-2.5-flash';
// Gemini may select approved asset/action IDs, never author factual prose.
// Even a hallucinated forecast in otherwise valid JSON is rejected.
export function validateSelection(value,allowed){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Array.isArray(value.assetIds))throw Error('Invalid selection');
  const ids=value.assetIds;
  if(ids.length<1||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!allowed.includes(id)))throw Error('Unsupported asset selection');
  return ids;
}
export async function draftAdvisory({language,step},{env=process.env,fetchImpl=fetch,earthEngine=null,preview=null}={}){
  const s=scenario(step),actions=priorityActions(s);
  let ids=actions.slice(0,3).map(a=>a.id),provider='Local grounded template',fallbackReason=null;
  const key=env.GEMINI_API_KEY?.trim();
  if(key&&actions.length){try{
    const model=geminiModel(env);if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$/.test(model))throw Error('Invalid model identifier');
    const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(12000),
      body:JSON.stringify({systemInstruction:{parts:[{text:'Select up to three exposed asset IDs for an exercise advisory, using only supplied facts. Return ONLY JSON {"assetIds":[...]}. Do not return prose, new facts, numerical forecasts, warnings, evacuation orders or asset-status claims. Unknowns remain unknown. Scenario hazards and infrastructure are synthetic. Any imported Earth Engine context is retrospective, with differing source epochs. An optional image is only a descriptive visualization: never infer measurements, flood extent, damage or asset status from it. Use computed grid summaries only; you are selecting reviewed content, not forecasting.'}]},contents:[{parts:[{text:JSON.stringify({language,scenarioId:s.id,hour:s.hour,provenance:s.provenance,unknowns:exercise.unknowns,allowed:actions,earthEngine:contextSummary(earthEngine,s.rows)})},...(preview&&earthEngine?.manifest.preview?[{inlineData:{mimeType:'image/png',data:preview.toString('base64')}}]:[])]}],generationConfig:{temperature:0,maxOutputTokens:300,responseMimeType:'application/json',thinkingConfig:{thinkingBudget:0}}}),
    });
    if(!response.ok)throw Error('Provider unavailable');
    const output=await response.json();
    if(output.candidates?.[0]?.finishReason!=='STOP')throw Error('Incomplete provider response');
    const raw=output.candidates[0].content?.parts?.map(p=>p.text||'').join('');
    ids=validateSelection(JSON.parse(raw),actions.map(a=>a.id));
    provider='Gemini-selected priorities · grounded template text';
  }catch{fallbackReason='Gemini unavailable or unsupported output rejected; local grounded template used.';}}
  const text=composeAdvisory(language,step,ids)+contextAppendix(earthEngine,s.rows,ids);
  return {text,provider,fallbackReason,reviewRequired:true,scenarioStep:step,scenarioId:s.id,provenance:s.provenance};
}

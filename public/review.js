// Approval binds to exact text, language, scenario and time. Never persisted.
export function reviewKey(state){return JSON.stringify([state.draft,state.language,'CS-01',state.step,state.contextRevision??'none']);}
export function invalidateReview(state){state.reviewed=false;state.reviewToken=null;}
export function approveReview(state){state.reviewed=Boolean(state.draft.trim());state.reviewToken=state.reviewed?reviewKey(state):null;}
export function canExport(state){return Boolean(state.draft.trim())&&state.reviewed===true&&state.reviewToken===reviewKey(state);}
export function reviewedExport(state){if(!canExport(state))throw Error('Human review required');return `EXERCISE ONLY · Not an official warning\nScenario CS-01 · T+${state.step*6}h · ${state.language}\nSynthetic source: CycloneShield authored sample v1 · 2026-09-29T06:00:00Z\n\n${state.draft}\n\nReviewed on device: ${new Date().toISOString()}`;}

# CycloneShield AI

An offline-capable cyclone preparedness **exercise prototype**, focused on Paradip in Jagatsinghpur district, Odisha. Everything needed for the first demo runs without API keys, external map tiles or dependencies.

## Run

Requires Node.js 22+ (tested on 24). No npm install is needed.

```sh
npm start
# http://localhost:3000
npm test
npm run build
npm run lint
```

`npm run dev` enables Node watch mode. Build and lint check all source syntax; native ES modules do not require bundling. No TypeScript compiler or lint framework is installed.

Optional: copy `.env.example` to `.env`. `PORT` defaults to 3000; `HOST` defaults to loopback. Never expose this unauthenticated demo server publicly without authentication, rate limiting, secure transport and a data retention policy.

## Three-minute demo walkthrough

- **0:00–0:35 — State what is real.** Start with `npm start`. Show the Earth Engine status: without files it explicitly says synthetic fallback. With real exports installed, show imported historical dates, processing time and source resolutions. Neither mode is a live forecast. Exact export/import instructions: [earthengine/README.md](earthengine/README.md).
- **0:35–1:10 — Inspect context.** If exports exist, enable Earth Engine context and select a grid cell. Show mean elevation, land-cover class/fractions, historical water occurrence, available period rainfall and optional radar change. Null means unknown. The SAR preview is not a flood map. If no exports exist, demonstrate the disabled toggle and explain the remaining manual export step rather than showing fake measurements.
- **1:10–1:45 — Connect data to action.** Select a fictional hospital or road. Inspect intersecting historical grid cells and separate context cues (assumed elevation/rainfall/water thresholds). Compare the unchanged CS-01 synthetic score and preparedness check. At T+18h, H01 has `35 rainfall + 45 surge + 20 vulnerability = 100/100`; this is not a probability. Timeline changes synthetic hazards only, never historical acquisition dates.
- **1:45–2:25 — Explain and review.** Open Advisories, select English/Odia/Hindi and generate. Gemini optionally receives server-computed summaries and an eligible local image, but may return only approved asset IDs. All measurements/explanations come from templates. Approve, then edit or change time to show export locking again. Refreshing changed imported data also invalidates review.
- **2:25–3:00 — Demonstrate resilience.** Save an offline package in CycloneLink. After the first online load/cache, stop the server and reload: app, templates and the latest accepted historical summaries remain available, with an offline snapshot label. Restart `npm start`. Exercise incident queues still synchronize to this demo server only. No emergency dispatch, Firebase or MANET is claimed.

Export snapshot includes scenario polygons/score components and, when available, Earth Engine source metadata and asset-to-grid context. Technical audit text in localized advisories remains English. No credentials or exports are required to run the synthetic demo.

## Architecture and provenance

- `public/scenario.js`: shared deterministic geometry/exposure engine, sample assets, track and multilingual templates. Used by browser and server to avoid divergent numbers.
- `public/evidence.js`, `evidence-ui.js`: per-layer provenance, scenario assumptions and hazard → asset → suggested action explanations. `public/review.js`: approval bound to exact draft, language and time.
- `earthengine/odisha-context.js`: configurable Earth Engine Code Editor script and compact Drive exports. `earthengine-store.mjs`: validates local exports and optionally loads an image. `public/earthengine.js`, `earthengine-ui.js`: shared import validation, context intersections and SVG overlay/provenance.
- `public/app.js`, `style.css`: responsive map-first interface, accessible semantic controls, inline SVG cartography. No external tiles/fonts are needed. The geography is a hand-drawn **schematic**, not a survey map.
- `server.mjs`: same-origin static server, status and incident ingestion endpoints. `gemini.mjs` is the server-only constrained Gemini adapter. Request size/field limits; fixed public directory; key never sent to the client. The server is a single-process demonstration store, not a production synchronized database.
- `public/sw.js`: shell/data cache; API calls never cached. Incident queue and tasks use device-local storage. Browsers can clear this storage; use export for a portable snapshot. Offline use requires localhost or HTTPS and a completed initial cache.

**All track coordinates, facility locations, road segments, vulnerability scores, wind, rainfall and surge inputs are synthetic, authored for this exercise at 2026-09-29 06:00 UTC.** Geographic place names give approximate context only. Facilities are fictional; they are not verified hospitals or shelters. No live/historical forecast feed or official warnings are represented. Optional installed Earth Engine exports provide separately labeled historical satellite/terrain/rainfall context, never replacements for these synthetic scenario inputs. The dataset timestamp is fixed; exported-at timestamps describe exports only.

Rainfall overlap is a rectangular planning footprint, not flood modeling. Surge uses an illustrative coastal polygon, without bathymetry, elevation, tide, waves or defenses. The track envelope is not a probability cone. Inputs peak at T+18h. Point containment and road/polygon segment intersection determine exposure, including boundary contact. The +0/+6/+12/+18/+24/+30/+36h intensity multipliers are 0.25/0.4/0.65/1/0.9/0.7/0.45. Hazard geometry scales by this schedule, not by a physical track-to-impact model. Score = 35 rainfall + 45 surge + 4 × assumed vulnerability (1–5), capped at 100 and applied only on overlap. High ≥70; elevated >0; outside footprint does not mean safe. No numerical confidence or loss estimates are claimed. The insurance threshold is illustrative with no contract or payout.

## Optional Google integrations

### Gemini

Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` (default `gemini-2.5-flash`, replace with a model enabled for your account). Restart the server. `POST /api/advisory` accepts `{ "language": "English", "step": 3 }`. The server reconstructs scenario facts rather than accepting client-supplied risk values.

For verifiable grounding, Gemini is limited to **selecting up to three exposed asset IDs** from the supplied allowlist. Only completed JSON with exactly `assetIds`, unique eligible IDs and no additional fields is accepted. Arbitrary generated prose, unsupported IDs, malformed JSON, blocked/truncated output, invalid keys/models and timeouts all fall back to deterministic local priorities. Approved templates render every number, explanation, action and unknown; raw model text is never displayed. This intentionally replaces unrestricted AI drafting with constrained AI-assisted assembly. The frontend receives no key. When exports are installed, the server supplies computed summaries/source metadata and optionally the local eligible S1 PNG. Measurements are never inferred from the image. Tests inject a fake provider to cover failure and success without network access or credentials; live Gemini has not been verified. The configured default `gemini-2.5-flash` matches the official model identifier; `npm run check:gemini` checks account model metadata when a key is present. Missing or invalid credentials retain template fallback.

Human and native-language review remain required, including for authored translations. Review binds to the exact text/language/time and imported context revision and resets on edits; downloaded text always includes an exercise/source wrapper. It is an on-device gate, not authenticated approval or public dispatch. Technical audit metadata and sample asset names remain in English in localized drafts.

Official reference: https://ai.google.dev/api/generate-content

### Earth Engine workflow (implemented; manual export required)

See [earthengine/README.md](earthengine/README.md) for exact setup, source definitions, reductions and manual steps. Paste `earthengine/odisha-context.js` into the authenticated Code Editor. It uses SRTM, WorldCover, JRC surface water, CHIRPS and conditionally eligible Sentinel-1. Default: 56 reporting cells over the Paradip coast, historical rainfall 24–30 May 2021, with separate SAR windows. Source dates/resolutions are recorded in a Drive manifest; this is not a reconstruction of validated cyclone impacts.

Run the Drive Tasks, then put the **same-run** `grid.geojson` and `manifest.geojson` into **`data/earthengine/`**. Optionally save that run's printed S1 PNG thumbnail as `preview.png`. The app reads these locally via `/api/earthengine`; it does not authenticate to Earth Engine or fetch live data. `EARTH_ENGINE_PROJECT` remains a documentation-only setting; select the project in Code Editor. No SDK or new dependency is needed.

Only validated compact exports are enabled on the map. Absent/invalid/mismatched exports retain explicit synthetic fallback. Imported geometry intersects fictional points and roads. Context cues (one each for mean elevation ≤5m, period rainfall ≥150mm, historical occurrence ≥20%) are separate, arbitrary screening assumptions; they do not change the original 0–100 score. All matched cells and input values are inspectable. Missing data remain unknown; no population exposure or satellite-derived asset status is asserted.

The default CHIRPS v2 product begins 1981-01-01 at 0.05° (~5.6km at the equator), with actual available-through timestamp queried at script execution; no claim of current coverage is hard-coded. No live meteorological feed is configured or implemented. SRTM 2000, annual WorldCover 2021 and JRC 1984–2021 are contextual epochs, not synchronous event observations. Sentinel-1 comparison is omitted unless matching-orbit scenes and ≥80% common valid coverage exist. The script has not been executed against authenticated Earth Engine here; only syntax/import logic and artificial test fixtures are verified.

### Firebase / CycloneLink

Firebase is not configured. `POST /api/incidents` is the clean synchronization boundary for replacing the local JSONL store with an authenticated database. Add identity, per-user access rules and conflict/retention semantics before enabling public synchronization. Proposed MANET relaying is explanatory only: no Bluetooth/Wi-Fi peer discovery or multi-hop transport exists or has been tested.

## Limits

Not an operational warning system. No validated hazard modeling, route safety, verified capacities, official advisory dispatch, authentication, production audit trail or active emergency response. Human-review acknowledgment is an on-device UX gate, not authenticated authority approval. Queue persistence depends on browser storage. The Node server should run as one process; production deduplication needs a transactional database. Real authoritative sources must be licensed, retrieved and validated before operational use. Consult IMD (https://mausam.imd.gov.in/) and OSDMA (https://www.osdma.org/) for official information.

## Data-source inventory and historical scope

All eight dataset entries carry `SYNTHETIC`, source `CycloneShield authored sample v1`, and authoring timestamp `2026-09-29T06:00:00Z`. These labels appear beside metrics, in the map's source register, in selected-asset details, and in exported snapshots. Source records explain limitations for each layer.

| Layer | Origin and limitation |
| --- | --- |
| Basemap | Hand-drawn coast, rivers, decorative roads and labels; not surveyed or navigable |
| Track/envelope | Seven authored positions; not an IMD track or probability cone |
| Wind | Synthetic input, rounded `60 + 75 × multiplier`; not part of exposure score |
| Rainfall/flood | Synthetic `280 × multiplier` mm/24h and polygon; no measured rainfall or flood depth |
| Surge | Synthetic `2.4 × multiplier` metres and coastal band; no hydrodynamic model |
| Assets/vulnerability | Twelve fictional locations/segments and assumed integer vulnerability values |
| Exposure | Deterministic geometry overlap and arbitrary weights; not calibrated loss or probability |
| Actions | Authored preparedness suggestions tied to asset type and overlap; verify locally |

No historical dataset is bundled. Historical context is available only after genuine operator exports are installed. The [IMD 2013 cyclone-report archive](https://rsmcnewdelhi.imd.gov.in/archive-report.php?internal_menu=MjY%3D&year=MjAxMw%3D%3D) was inspected as a credible historical source, but no matching local hazard fields or verified assets were ingested. It is a reference, **not provenance for these synthetic layers or the independent Earth Engine context**. CS-01 is not a reconstruction of Phailin or any real cyclone. Keeping the existing schematic explicit avoids mixing historical observations with invented local impacts.

## Implemented versus planned

Implemented: local scenario engine and SVG map; score decomposition; provenance registry; asset-linked preparedness checks; reviewed multilingual template assembly; constrained server-only Gemini selection with fallback; cached app/package; device queue and local HTTP synchronization; Earth Engine Code Editor exporter and validated file import, historical context overlay, asset/grid intersection, optional S1 preview, and source-bound Gemini input.

Planned only: live meteorological/track ingestion and direct Earth Engine server authentication, Firebase authentication/database, verified shelter and population data, calibrated flood/surge models, public advisory dispatch and MANET relaying. `EARTH_ENGINE_PROJECT` is a reserved configuration value only; no credentials are required for this demo.

## Validation

`npm test` runs focused tests covering geometry (including boundary contact), source labels/export metadata, the CS-01 hazard-to-action journey, score components, localized templates, missing/failing/malformed Gemini responses, accepted constrained selections, review invalidation, input validation and secret-file isolation. Earth Engine tests use clearly artificial fixtures only in isolated temporary test directories, covering manifest/geometry validation, missing-data behavior, provenance escaping, fallback, point/road context and approval revision. Provider tests use injected fakes and do not call Google. Build/lint run source syntax checks, not a TypeScript compiler or full linter. No dependencies were added.

## New/updated files for Earth Engine

- Added `earthengine/odisha-context.js`, `earthengine/README.md`, `earthengine-store.mjs`, `public/earthengine.js`, `public/earthengine-ui.js`, `scripts/check-gemini.mjs`, and `test/earthengine.test.mjs`.
- Updated `server.mjs`, `gemini.mjs`, `public/app.js`, `public/review.js`, `public/sw.js`, `public/style.css`, `scripts/check.mjs`, `package.json`, `.env.example`, and this README.
- Existing scenario inputs, score weights, asset fixtures and original tests are preserved. No real Earth Engine export or placeholder masquerading as one was added to the data directory.
#   C y c l o n e S h i e l d - A I  
 
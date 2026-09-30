# Earth Engine export workflow

The script is **Code Editor JavaScript**, not a local Node program. It has been syntax-checked locally; authenticated Earth Engine execution and real exports must be performed by the operator. No measured exports are bundled. Test fixtures are artificial and never installed in the app.

## Exact manual steps

1. Sign in at https://code.earthengine.google.com/ with Earth Engine access. Select a registered Google Cloud project with the Earth Engine API enabled. See https://developers.google.com/earth-engine/guides/access . No service-account file or secret belongs in this repository. `EARTH_ENGINE_PROJECT` alone does not authenticate anything.
2. Paste `earthengine/odisha-context.js` into a new Code Editor script. Review `CONFIG`: default rectangle `[86.35,20.15,86.75,20.50]`, rainfall **2021-05-24 inclusive through 2021-05-31 exclusive**, SAR pre **May 10–24**, post **May 27–June 10**, ends exclusive. This is a retrospective window, not a validated reconstruction of a named cyclone. Change dates/AOI for another coastal Odisha case; retain a small rectangle, 0.05–0.1 degree cells and at most 200 cells. Default is 56 cells.
3. Click **Run**. Inspect Console metadata, rainfall day count, selected Sentinel-1 relative orbit, acquisition timestamps and common valid-pixel coverage. All grid calculations stay inside the AOI. No matching SAR orbit or coverage below 80% produces **no SAR output**; other context still exports. If necessary change pass/date windows and rerun; do not invent availability.
4. In **Tasks**, manually run `CycloneShield_grid` and `CycloneShield_manifest` exports to Drive. If created, also run `CycloneShield_s1_comparison` for a small RGB GeoTIFF. Wait for tasks to complete; an unstarted task is not an export. Use the grid and manifest from the **same run**, with matching bundle IDs.
5. Download the Drive GeoJSON files. Create `data/earthengine/` in this repo and put them there as **`grid.geojson`** and **`manifest.geojson`**. Drive can add extensions or suffixes; rename them exactly. No conversion tool is required. The manifest is a one-feature GeoJSON with `manifest_json` in its properties; the parser also accepts that decoded JSON object under the same filename. Files are limited to 2 MB each.
6. Optional image: if SAR is eligible, open the temporary PNG thumbnail URL printed by the script, then save it as `data/earthengine/preview.png` (≤1 MB). This must be the preview from the same run; the app cannot authenticate image origin. The exported GeoTIFF is for external GIS viewing, not a browser PNG. Do not simply rename a TIFF to PNG. No image is necessary for summaries or offline use.
7. Run **`npm start`**, open http://localhost:3000 and click **Check exported data / Reload exported data**. Enable **Earth Engine context** in the map layer row. Expand its provenance panel, select a grid cell, then select a fictional asset. Export snapshot includes context. No server restart is needed after replacing exports; explicitly refresh the context. Malformed, incomplete or mismatched files are rejected rather than displayed as real data.

## Source meaning, reductions and limitations

| Dataset | Source epoch / resolution | Exported statistic |
| --- | --- | --- |
| `USGS/SRTMGL1_003` | 11–22 February 2000; 1 arc-second, about 30 m | Cell mean elevation (m) and slope (degrees); void-filled radar surface, not surveyed local flood elevation |
| `ESA/WorldCover/v200` | 2021 annual map; 10 m | Modal class, fractions of valid class pixels that are built-up (50) and mangroves (95); annual context not event damage |
| `JRC/GSW1_4/GlobalSurfaceWater` | 16 March 1984–31 December 2021; 30 m | Mean `occurrence` percentage over valid product pixels; water detection frequency, not flood probability |
| `UCSB-CHG/CHIRPS/DAILY` | Daily from 1 January 1981, approximately 50°S–50°N; 0.05° (~5.6 km at equator) | Sum daily mm over the selected window, then cell mean at native projection/transform; latest available catalog timestamp queried at execution |
| `COPERNICUS/S1_GRD` | Selected actual pre/post dates; IW VV, 10 m spacing, effective resolution coarser (~20 m) | Mean post-minus-pre median VV backscatter (dB), reduced at 30 m; optional 100 m visualization, never a flood classification |

All source URLs and limitations are in the script and manifest. Data attribution: NASA/USGS/JPL SRTM, ESA WorldCover consortium (CC BY 4.0), EC JRC/Google surface-water product, UCSB Climate Hazards Center CHIRPS, Copernicus/ESA Sentinel-1. Consult their catalog pages for licensing and citations before distribution.

Static datasets reduce independently at their native projection/transform; sources are not stacked onto a fictitious common high-resolution grid. The 0.05° cells are reporting areas. CHIRPS may provide only one or a few coarse pixels per cell; grid clipping/interpolation cannot create new meteorological information. Missing days cause rainfall summaries to be withheld; missing per-pixel days remain masked. Null means unknown, never zero. Means exclude masked pixels and may not describe the entire cell. Source epochs differ; WorldCover/JRC include observations after the chosen event. Coastal/ocean cells may have little usable terrain/land-cover data.

Sentinel-1 uses one common relative orbit and pass, IW, VV and 10 m sampling. Angle mask 30–45° and VV >−35 dB are simple edge/noise screens, not scientific validation. Post minus pre temporal-median dB retains effects of moisture, land-cover changes, tides, geometry and speckle. Approximate common validity at 100 m must cover ≥80% of the AOI; no comparison is exported otherwise. No speckle calibration, flood threshold, permanent-water exclusion or validation labels are supplied because no flood classifier is claimed.

## App interpretation

The original CS-01 wind/rain/surge cards and 0–100 score remain **synthetic**. New imported context has fixed historical dates, independent of the animation. SVG polygons use exported WGS84 coordinates; the existing hand-drawn basemap remains synthetic and is not a georeferenced satellite basemap. The view expands to accommodate a different valid AOI; place labels remain approximate.

The app calculates **context cues separately**: one each for mean elevation ≤5 m, period rainfall ≥150 mm and historical water occurrence ≥20%. These are explicitly arbitrary screening assumptions, not validated cyclone risk. It reports `cue count / number of known inputs`, without treating missing fields as zero. Land cover and radar change remain descriptive. Points and road segments intersect grid polygons with boundary contact included. Multiple cells at a point boundary can match; a road's representative cell is the highest cue count, then most known inputs, then cell ID. Every matched cell remains inspectable. No combined scenario/context score or affected-population claim is made.

Imported metadata is operator supplied, not a cryptographically verified Earth Engine origin. The parser validates shape, finite values, dates, required source metadata, availability and matching bundle IDs. It rejects overlapping rectangles. A content revision binds advisory approval to the loaded summaries (and preview). Server-side drafts reject stale client revisions. Local cache preserves the latest accepted context for offline viewing with an **OFFLINE SNAPSHOT** label; an explicit missing/invalid response clears stale context. Offline image previews are omitted; all grid summaries remain usable.

## Meteorology and Gemini

No live weather/forecast service or authoritative track is configured. Historical CHIRPS is the meteorological context; the original manually authored scenario remains a separate input. Live IMD/feed ingestion is not implemented.

`gemini-2.5-flash` is a documented model code: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash . The app supports `GEMINI_MODEL` and keeps the API key server-side. Run `npm run check:gemini` to check configured model metadata/access; no key means verification is explicitly unavailable. Code tests use a fake provider, not Google.

Gemini receives computed grid summaries, source epochs, limitations and approved asset actions. If supplied and eligible, the local PNG is sent as an optional visual aid; no arbitrary URL is fetched. Gemini can select only allowlisted asset IDs. All factual text and measurements are rendered deterministically from application inputs. Image-derived measurements, unsupported output or free-form claims are never accepted. Human approval still precedes export, and a changed context revision invalidates it. Translation review is required; technical audit context remains in English.

# 5476 Maryland — House Explorer

An interactive viewer for 5476 S Maryland Parkway. Built from the **V9.4 client handover**, with the two floors, current interior geometry, original material textures, room viewpoints and dimensioned plans.

## Run locally

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. Production build: `npm run build`; serve `dist/` at the root of a static website. No API key, database or environment variables are required.

## Experience

- Both floors side by side, individual floor views, and the assembled house.
- 13 space choices covering the house, two bedroom suites, kitchen, living area, garage, powder room, stairs, hall recess, laundry and courtyard.
- Orbit, pan and first-person walk. Dragging looks around; WASD/arrows or the on-screen pad move; shift moves faster.
- Walk mode is built for standing inside the house rather than inspecting it from outside, so entering it takes over the display: the cutaway is switched off, ceilings on, and the two floors are put into their assembled positions. Leaving walk hands all three back.
- Walking collides with the geometry. A step stops short of a surface, and a fully blocked step slides along the wall instead of sticking, so a walker cannot wedge into a corner. There is still no stair traversal.
- Q/E, or the pad's Up/Down, change storey. Levels are discrete: a press lands standing on the next slab and turns to face the open part of the room it arrives in, rather than drifting the camera up into a floor.
- Turn, tilt, zoom, reset, fullscreen and current-view PNG export, all reachable without a pointer.
- Cutaway walls, ceiling visibility and auto rotation.
- Click a visible object for its source name, category, note and available evidence references.
- Original dimensioned floor plans with fit and zoom.
- Responsive desktop/mobile navigation, and a fallback that leaves the plans usable if WebGL or model loading fails.

## Fidelity and limits

`public/model/house.json` derives from `06-model/v9/model.json`, version `v9.4-client-handover`. All **1,350 current existing-condition objects** retain their exact source vertices, polygons and material assignments. The 2,090-object native source also contains historical, demolition, superseded, staging and unbuilt objects, which are excluded from the web scene. The manifest records source and download SHA-256 hashes.

The renderer rotates source Z-up coordinates to Y-up and converts inches to metres: `[x,y,z] → [x,z,-y] × 0.0254`. Concave polygons are triangulated for rendering. Both-floor inspection translates the entire upper floor 9 metres sideways and lowers it by the source floor elevation; assembled and interior views use source positions. The cutaway clips tall wall/opening/finish surfaces at 1.10 metres above each floor for inspection. These are display operations, not edits to the source files.

Finishes use the handover's reconstructed textures. Environment illumination, shadows and ambient occlusion are presentation lighting, not measured site lighting. This is a real-time visualization, not a photograph, a field-certified as-built, or a construction-ready dimensional survey. Outstanding source uncertainties remain visible in the interface and in the original handover/audit PDF. Unbuilt shower glass is not introduced. Older interior renders are not reused.

## Source files

`public/documents/` holds exact copies of the five client handover files and the ZIP. **They are not published in this repository**, so a fresh clone does not redistribute the client's native models or PDFs, and the site no longer links to them: this is a viewer, not a download library. Their names, byte sizes and SHA-256 checksums stay recorded in `public/model/manifest.json`, and the asset test verifies them whenever the files are present locally.

The model geometry in `public/model/house.json` _is_ published, since the explorer cannot run without it. The original handover files remain untouched outside this repository.

## Checks

```sh
npm test
npm run build
npx playwright install chromium
# Start npm run dev separately on port 5173, then:
npx playwright test
```

Asset tests check revision, finite geometry, face indices, material/texture references, scene memberships and all downloadable file hashes (skipped when the source files are absent). When the original workspace is available, they also compare every exported vertex, polygon and material assignment against the source.

Browser tests cover actual rendering, floor and room navigation, display controls, object inspection, plan zoom, mobile layout, model-fetch failure recovery, and the walk-through: enclosure and layout takeover, standing height, wall collision and escape, storey changes, and the pointer-free camera buttons. Screenshots are saved to `docs/screenshots/`.

## Refreshing the source assets

The checked-in assets make the website self-contained. To intentionally regenerate them from the original sibling workspace:

```sh
python3 -m pip install pymupdf
npm run assets
npm test
```

`prepare_assets.py` reads the original model and handover files, exports the filtered dataset, copies textures and documents, renders both current plan pages, and writes a hash manifest. The copied documents are no longer served by the site; they are kept so the manifest checksums stay verifiable. It never runs model rebuild scripts or saves over native files.

## Repository and publication

Published to `tehronporter/5476smarylandparkway`, which is public. The application, the model geometry and the rendered plan images are published; the native/PDF/ZIP handover files are excluded via `.gitignore` and remain local only.

Implementation uses TypeScript, Vite and Three.js. See the [Vite guide](https://vite.dev/guide/) and [Three.js documentation](https://threejs.org/docs/).

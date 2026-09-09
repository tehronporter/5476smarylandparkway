# Website verification — 9 September 2026

## Revision state

The interactive model and the dimensioned plans carry **v9.5-representation-repair**. The downloadable SketchUp and Blender files still carry **v9.4-client-handover**: they can only be reissued on a machine with Blender 4.5.9 and SketchUp, neither of which is installed on the authoring machine. The manifest labels each download with its own revision, the About panel states the split, and `06-model/v9/sync_gate.py` reports the native receipts as PENDING — failing outright if that declaration goes missing or disagrees with `audit/native-staging.json`. `FINAL-CLIENT-HANDOVER/` is untouched and still verifies against its manifest.

## What changed in v9.5

The upstairs read as having no walls because the cutaway clips walls to 1.10 m above their own floor and the toggle had no interior guard; inside a room the eye sits at 1.78 m. All 34 upper-floor walls were present and full height throughout. The control is now held and locked in interior views.

Ten representation defects were repaired in the model itself, including the kitchen tile that spanned the open garage doorway, the garage wall that stopped 3.625 in above its slab, three unsupported stair-nook shelves, and the missing ceilings over both showers. Uncovered upper-floor area fell from 55.8 sf to 9.3 sf, the remainder being the stair void. Five further candidates were declined and recorded as open issues rather than modelled from insufficient evidence.

The site converts the V9.4 handover into an interactive client viewer. Source documents and native models are preserved; only derived website assets are written.

## Source integrity

- 6 asset checks pass, including exact source vertex/polygon/material parity for all 1,350 exported objects.
- Source SHA-256: `57ab65d3f0fba834509aa2fca80c73e4936ba09ec88ae14e03cdd6132ac402e0`.
- All five original client files and the ZIP match their source checksums when present locally; the check skips in a public checkout, where those files are not published. The site no longer serves them.
- Material files, source scene memberships and geometry indices resolve correctly.
- The model's field gate remains `NOT_PASSED`; digital parity does not establish site accuracy.

Production TypeScript/Vite build passes. Eight browser scenarios passed across the main walkthrough and targeted final checks; no unexpected JavaScript/console errors were detected in the checked flows.

## Browser evidence

| Flow             | Check                                                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3D load          | 1,263 objects in the default ceiling-free view; 1,350 in the full client interior view; over 28,000 rendered triangles in the default view                                                                                                                             |
| Model navigation | All 13 space choices, both-floor inspection, individual floors and assembled positions                                                                                                                                                                                 |
| Display          | Ceiling and cutaway state, auto rotation, camera reset and free-walk movement                                                                                                                                                                                          |
| Inspection       | Clicked mesh resolves to the corresponding source object and detail panel                                                                                                                                                                                              |
| Export           | Current-view PNG download                                                                                                                                                                                                                                              |
| Fullscreen       | Native fullscreen where available, with viewport expansion fallback                                                                                                                                                                                                    |
| Plans            | Both original sheets, whole-sheet Fit and working zoom                                                                                                                                                                                                                 |
| Mobile           | 390 × 844 layout, spaces drawer, room selection and plans; no page-width overflow                                                                                                                                                                                      |
| Recovery         | A failed model fetch leaves the dimensioned plans accessible                                                                                                                                                                                                           |
| Walk setup       | Entering walk switches the cutaway off, ceilings on and the floors into assembled positions, starts at the entry, and stands the camera on the ground slab at eye height. The sidebar switches follow the mode and lock while walking; leaving walk restores all three |
| Walk collision   | 60 forward steps stop against the geometry rather than crossing it, further steps hold position, and reversing always frees a blocked walker                                                                                                                           |
| Storey change    | Q/E and the pad's Up/Down land standing on the next slab; repeated presses stay put instead of drifting into the roof                                                                                                                                                  |
| Camera buttons   | Turn and tilt move the camera with no pointer input                                                                                                                                                                                                                    |

Browser screenshots were visually reviewed for every space. The garage camera was adjusted toward the source utility equipment; the hall camera now faces the stepped recess. Laundry is an isolated inspection view, with the door hidden. The source's loose hall cabinet remains omitted from clean client views, as disclosed in the interface.

## Review images

- [Desktop explorer](screenshots/desktop.png)
- [Kitchen](screenshots/kitchen.png)
- [Mobile explorer](screenshots/mobile.png)
- [Dimensioned plans](screenshots/plans.png)
- [Walk-through, standing at the entry](screenshots/walk-entry.png)
- [Walk-through, one storey up](screenshots/walk-upper.png)

## Practical limits

Lighting is illustrative; material textures and proxy details inherit the source model's approximations. This is a real-time reconstruction, not a photographic capture. Walking collides with wall, floor and fixture geometry and slides along blocked surfaces, but there is no stair traversal: Q/E changes storey instead. Collision is resolved by ray casts from the eye, so it tracks surfaces rather than a modelled body. Native fullscreen depends on browser support; the expansion fallback stays within the browser window. Google Fonts is optional and has system-font fallbacks.

The browser requires WebGL 2 for 3D. Documents remain usable without it. The static build is intended to be served at a domain root. No production URL has been published. The public repository carries the application, the model geometry and the rendered plan images; the native/PDF/ZIP handover files are excluded and remain local only. The site is now a viewer: it no longer offers the handover documents for download.

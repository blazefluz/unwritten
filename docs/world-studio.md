# World Studio prototype

A separate experiment at **http://127.0.0.1:3040/studio**. Build a small 3D room with an embodied Meta AI collaborator. The original Unwritten workspace remains at `/`.

## Run

```bash
npm ci --prefix web
npm run dev --prefix web
```

The Python bridge defaults to `.venv/bin/python` at the repository root. Install the existing Python requirements in that environment, or set `UNWRITTEN_PYTHON` to another compatible interpreter.

Local catalog controls and the limited local text-command parser work without credentials. For AI editing, set `MODEL_API_KEY` in the gitignored `web/.env.local` and restart Next. The server invokes `MetaClient.ask_json` using Muse Spark through Meta's endpoint; no other model is part of this product. Opening the page only checks whether a key is configured. Each submitted Meta request sends the current scene, catalog, selected object ID and request text to Meta. Requests are local-only and require no database.

## What works

- A 12 × 10 metre room, ten procedural object types, up to 40 objects.
- Robot collaborator that moves toward the selection and gestures during AI requests. Avatar movement is illustrative; it does not perform obstacle-aware pathfinding.
- Orbit, plan and walk views. Walk mode: focus the canvas, then WASD or arrow keys; drag to look. Navigation does not enforce furniture collisions.
- Click or use the object list to select. Inspector buttons move by 0.5 m, rotate by 90°, resize, recolor and delete.
- Natural-language requests become schema-validated add/update/remove/lighting commands. “This” refers to the selected object. Left/right/front/back refer to room axes.
- Footprint overlap and room-bound checks before changes commit. Conflicting proposals remain previews; discard them or use the deterministic nearest-space search. Rugs can overlap furniture intentionally.
- Thirty scene undo steps, browser autosave and validated JSON import/export. New scenes and example loads are undoable. Conversation is not saved or included in exports.
- A bounded, explicitly labelled **local command parser**, separate from Meta AI. It supports catalog additions, selected-object movement, quarter turns, basic colors, size and lighting. The maker’s market example is scripted, not AI output.
- Responsive HTML controls, keyboard-accessible object editing, reduced-motion handling, avatar pause, capped render resolution, hidden/offscreen render pause, WebGL failure message and portable scene export.

## Tonight's demo

1. Choose Meta mode and ask: “Build a maker’s market with a worktable, two shelves, a display counter and a plant. Keep a clear gap between each object.”
2. Select the table. Ask: “Make this green and move it one metre to the right.”
3. Deliberately propose overlapping furniture. Show the preview, then choose **Find space** or **Discard**.
4. Switch to plan view to inspect the layout, then walk view to enter it.
5. Ask for nighttime lighting; export the scene and demonstrate Undo.

If the API is unavailable, choose Local mode and the built-in example, explicitly describing it as a scripted fallback rather than a successful AI call.

## Verification and limits

```bash
npm run test:studio --prefix web
npm run typecheck --prefix web
npm run build --prefix web
.venv/bin/python -m pytest -q
```

Offline TypeScript tests cover spatial geometry, vehicle meshes, EV equations, creation checks, world expansion, migration and malformed imports. The Python bridge has an offline fake-client test. These are code checks, not evidence of spatial reasoning quality.

Real API smoke tests returned a valid single-table proposal in approximately 7.6 seconds, a six-object market layout with no footprint conflicts in 16.6 seconds, and a selected-table recolor in 6.6 seconds while preserving all unrelated objects. These are individual integration observations, not latency or quality benchmarks. The opt-in `npx --prefix web tsx web/tests/studio-live.ts` repeats the two-step layout/edit test against a running local server and makes paid Meta calls; it is excluded from offline tests. Browser control was initially unavailable. Subsequent Chrome checks exercised desktop/mobile layouts, presets, real Meta creation/edits, incompatible dimensions, scene persistence, generated geometry and world expansion. Inspect the final demo path again before recording.

This is a catalog-based scene editor, not a mesh generator, physics optimizer or simulation of structural integrity. It does not establish safety, accessible routes, manufacturing dimensions or material strength. Objects sit on the floor; no stacking or free-form geometry. Rotated floor rectangles are conservative footprints, not full 3D collision meshes. The robot is a procedural avatar, not a separately autonomous agent. Stopping a browser request prevents applying its result but may not cancel a Meta request already running on the server.

## New work and third-party pieces

World Studio's scene editor, procedural room/furniture/avatar, deterministic checks, proposal preview, local parser, Meta prompt/schema and studio UI were built during the hackathon. Existing repository code supplies the Next.js shell, local-origin guard, Python bridge and Meta API client.

Third-party: Three.js supplies WebGL rendering, geometry and OrbitControls; Next.js/React supply the application framework; Zod validates inputs; Lucide supplies interface icons; tsx runs TypeScript tests. The existing `openai` SDK is used exclusively for Meta's compatible endpoint. No third-party 3D models, textures, photographs or generated image assets are included.

## Car design scene

**http://127.0.0.1:3040/studio/car** is a separate concept-design studio. Use the **Market / Car design** navigation to switch. Each scene has its own browser storage key and JSON file format, so designing a car does not replace the market layout. Scene geometry/configuration persists; conversation and undo history are session-local.

Create a coupe, sedan or SUV from a clearly labelled preset, or ask Muse to create one. Length, width, height, wheelbase and wheel radius drive the procedural 3D model. Body paint, roof finish and rear spoiler are editable. Orbit, side, front and plan views plus dimension guides help compare proportions. Number inputs accept metres; press Enter or leave the field to apply. Sliders apply directly. Undo, browser autosave, import and export work independently from the market editor.

AI requests use `MetaClient.ask_json` through `/api/studio/car`. Returned configurations are validated in code, including wheel fit within the body and minimum vertical room above the wheels. Invalid proposals leave the current car unchanged. The local parser supports explicit numeric dimensions, basic colors, body-style presets and spoilers; it is not AI.

This is a visual parametric concept model, not automotive CAD, physics, aerodynamics, crash analysis, manufacturability or a simulation of a functioning vehicle. The original car scene started with a parametric shell; the generative EV extension below adds custom meshes and illustrative vehicle internals. Dimensions represent the visual model, not manufacturing tolerances. Original parametric body/wheel geometry and the car scene UI are new hackathon work; rendering uses the existing Three.js dependency.

Offline checks include three-preset geometry bounds, four-wheel construction, dimension-driven mesh changes, wheelbase positions, spoiler presence, invalid dimensions, unrelated-field preservation and cross-scene import rejection.

## Generative EV workbench and expandable world

The car scene now has **Body / EV / AI parts / Analysis / World** tools. The user selected electric propulsion rather than combustion. It includes a visible chassis, battery modules, motor housing and rotor, reduction units, drive shafts, inverter, radiator and illustrative coolant routes. Body, chassis and exploded views reveal the assembly; rotor animation is slowed illustrative motion, not an operating motor simulation.

### AI can create geometry

Muse is no longer limited to predefined furniture or car presets in the car scene. It can author new parts using boxes, cylinders, spheres, toruses, arbitrary closed 2D extrusion profiles, revolved lathe profiles, and custom indexed triangle meshes. Every part has a name, purpose, position, rotation, material, assumed mass and group. It can create multi-part assemblies and revise the current configuration. The input/output protocol is declarative geometry, not executable model-authored code. Limits: 48 custom parts per vehicle; 1,200 vertices / 2,400 triangles per custom mesh; bounded finite coordinates. Coordinate arrays, mesh indices, zero-area triangles/profiles and renderer bounds are checked. Self-intersection, watertightness, topology, strength and manufacturing feasibility are not fully checked.

The API will not accept a completion-only response to an explicit new-part creation request without actual new part geometry. One bounded revision includes validation errors and the invalid proposal. A failure leaves the current design unchanged. This establishes that geometry was returned, not that it serves its intended function.

A real Meta integration test authored a flared extruded inlet scoop, splitter vane, stepped lathe motor casing and mounting bracket. It preserved the current envelope and EV assumptions. This is a single generative integration result, not evidence of engineering validity or novel invention. Earlier integration attempts exposed an application schema-conversion bug that prohibited coordinate arrays; it was corrected and covered by a regression check before this successful result.

### Expand the world

Add design bays through the UI, or ask Muse to create new bays with alternative vehicles and generated assemblies. Bays have separate world positions and configurations; selecting one changes the active design without replacing others. World view frames the collection. Pan beyond the original platform; the floor and grid follow the camera. This is an expandable, bounded prototype (24 bays, six new bays per AI proposal), not an infinite streamed world. All bays are included in JSON export. OBJ export covers the active concept assembly in metres, not an engineering STEP/BREP solid.

### Reproducible engineering estimates

The Analysis panel runs deterministic calculations on explicit inputs:

- Steady-speed aerodynamic, rolling and uphill loads; wheel/shaft/bus power and current.
- Constant-efficiency battery energy use and steady-speed range, including an assumed I²R pack loss.
- Simple constant-torque/constant-power motor envelope, gearing RPM ceiling and axle packaging checks.
- Lumped cooling heat rejection, estimated losses and coolant-flow requirement.
- A 63-candidate battery module-count / column-layout study seeking the lightest assumed-mass candidate that meets a target steady-speed range and the listed checks.

Assumptions are editable and exported with results. Default component capacities, masses, motor ratings/efficiencies, Cd, frontal-area factor, rolling coefficient, radiator UA and coolant properties are illustrative input assumptions, not measured component data or AI predictions. Generated-part assumed masses add to the mass estimate; their geometry does not automatically change Cd, thermal conductance, motor power or material strength. Glider mass excludes the entered pack, drive system and generated-part mass. Drive-system hardware includes a disclosed 35 kg per-motor allowance. Temperature effects on battery efficiency, acceleration/regeneration, wind, tyre dynamics, drive cycles and thermal transients are omitted. The gearing RPM ceiling is not an achievable top-speed prediction.

Sources for physical principles and component categories: [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/), [US DOE EV components](https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work). These sources do not validate the application or its chosen assumptions.

The system can create geometry, compare concepts, check selected numerical relationships and export the work. It does not produce a proven functioning electric motor, validated vehicle, electromagnetic design, CFD/FEA analysis or production-ready manufacturing package.

For a fully AI-authored body, Muse can select `shellMode=generated` and create body panels or surfaces in `parts`; this hides the starting shell while retaining wheels and the EV platform. Body geometry source is also editable in the Body panel.

A later real browser run expanded the saved world with a Cooling study bay containing an authored extruded duct, stepped lathe housing and bracket, while retaining the current vehicle. These are integration checks, not a mechanical validation or novelty assessment.

A real follow-up API test revised the generated mounting bracket from a box to an L-profile extrusion while preserving its ID, position, assumed mass, unrelated parts and EV settings. The OBJ export was downloaded and inspected (10,341 vertices, 8,836 faces in that particular pre-revision assembly). Cross-tab draft synchronization now loads changes from other studio tabs and rejects an AI response if its input world changed while the request ran.

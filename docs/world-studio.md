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

The seven offline TypeScript tests cover geometry, rotation/scale, layout validity, transaction isolation, placement repair, contextual commands and malformed imports. The Python bridge has an offline fake-client test. These are code checks, not evidence of spatial reasoning quality.

Real API smoke tests returned a valid single-table proposal in approximately 7.6 seconds, a six-object market layout with no footprint conflicts in 16.6 seconds, and a selected-table recolor in 6.6 seconds while preserving all unrelated objects. These are individual integration observations, not latency or quality benchmarks. The opt-in `npx --prefix web tsx web/tests/studio-live.ts` repeats the two-step layout/edit test against a running local server and makes paid Meta calls; it is excluded from offline tests. Browser visual QA was unavailable in the implementation session because local browser control was disabled. Inspect desktop and mobile rendering before recording the final demo.

This is a catalog-based scene editor, not a mesh generator, physics optimizer or simulation of structural integrity. It does not establish safety, accessible routes, real-world dimensions or material strength. Objects sit on the floor; no stacking or free-form geometry. Rotated floor rectangles are conservative footprints, not full 3D collision meshes. The robot is a procedural avatar, not a separately autonomous agent. Stopping a browser request prevents applying its result but may not cancel a Meta request already running on the server.

## New work and third-party pieces

World Studio's scene editor, procedural room/furniture/avatar, deterministic checks, proposal preview, local parser, Meta prompt/schema and studio UI were built during the hackathon. Existing repository code supplies the Next.js shell, local-origin guard, Python bridge and Meta API client.

Third-party: Three.js supplies WebGL rendering, geometry and OrbitControls; Next.js/React supply the application framework; Zod validates inputs; Lucide supplies interface icons; tsx runs TypeScript tests. The existing `openai` SDK is used exclusively for Meta's compatible endpoint. No third-party 3D models, textures, photographs or generated image assets are included.

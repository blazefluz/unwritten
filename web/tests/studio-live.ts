// Explicit opt-in real Meta integration smoke; not part of offline test:studio.
import assert from "node:assert/strict";
import {
  EMPTY_WORLD,
  applyProposal,
  inspectScene,
  proposalSchema,
  repairPlacement,
  type World,
} from "../lib/studio/scene";
async function ask(
  scene: World,
  prompt: string,
  selectedId: string | null = null,
) {
  const start = Date.now();
  const response = await fetch("http://127.0.0.1:3040/api/studio", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3040",
    },
    body: JSON.stringify({ scene, prompt, selectedId }),
    signal: AbortSignal.timeout(230000),
  });
  const data = await response.json();
  assert.equal(response.status, 200, data.error);
  const proposal = proposalSchema.parse(data);
  let world = applyProposal(scene, proposal);
  const initialConflicts = inspectScene(world).length;
  if (initialConflicts) {
    const ids = proposal.actions.flatMap((a) =>
      a.type === "add" || a.type === "update" ? [a.object.id] : [],
    );
    const fixed = repairPlacement(world, ids);
    assert.ok(fixed, "proposal must be repairable");
    world = fixed;
  }
  assert.equal(inspectScene(world).length, 0);
  console.log(
    JSON.stringify({
      elapsedSeconds: (Date.now() - start) / 1000,
      actions: proposal.actions.length,
      objects: world.objects.length,
      initialConflicts,
    }),
  );
  return world;
}
async function main() {
  const world = await ask(
    EMPTY_WORLD,
    "Build a small maker’s market: one worktable, two shelves, one display counter, one plant and one chair. Place everything inside the room with gaps. Exactly six objects.",
  );
  assert.equal(world.objects.length, 6);
  const table = world.objects.find((o) => o.kind === "table");
  assert.ok(table);
  const edited = await ask(
    world,
    "Make this blue (#5d7d99). Keep its position and all other objects unchanged.",
    table.id,
  );
  const changed = edited.objects.find((o) => o.id === table.id);
  assert.ok(changed);
  assert.equal(changed.color.toLowerCase(), "#5d7d99");
  assert.deepEqual(
    edited.objects.filter((o) => o.id !== table.id),
    world.objects.filter((o) => o.id !== table.id),
  );
  assert.equal(changed.x, table.x);
  assert.equal(changed.z, table.z);
  console.log(
    "Real Meta build + selected-object edit passed. This is an integration smoke, not a quality benchmark.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

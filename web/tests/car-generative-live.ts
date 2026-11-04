// Opt-in paid Meta integration check. Requires the running local server.
import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { CAR_PRESETS, carProposalSchema } from "../lib/studio/car";
import { generatedPartBounds } from "../lib/studio/part-model";
async function main() {
  const start = Date.now();
  const response = await fetch("http://127.0.0.1:3040/api/studio/car", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3040",
    },
    body: JSON.stringify({
      car: CAR_PRESETS.coupe,
      selectedPart: null,
      prompt:
        "Create a NEW bespoke cooling inlet and motor housing assembly, at least 3 new purposeful geometry parts. Use an extruded flared inlet profile and a revolved lathe motor casing with a stepped profile. Add a mounting bracket. Put the inlet at the front, housing near the rear motor. Do not change existing dimensions or EV settings. These must be your own geometry in parts, not changes to preset fields.",
    }),
    signal: AbortSignal.timeout(230000),
  });
  const raw = await response.json();
  assert.equal(response.status, 200, raw.error);
  const proposal = carProposalSchema.parse(raw);
  await writeFile(
    "/tmp/world-studio-generative-response.json",
    JSON.stringify(raw, null, 2),
  );
  console.log(proposal.message);
  assert.ok(proposal.car);
  assert.ok(
    proposal.car.parts.length >= 3,
    "new parts must actually be returned",
  );
  assert.ok(proposal.car.parts.some((p) => p.geometry.type === "extrude"));
  assert.ok(proposal.car.parts.some((p) => p.geometry.type === "lathe"));
  for (const part of proposal.car.parts) {
    const bounds = generatedPartBounds(part);
    assert.ok(Number.isFinite(bounds.min.x));
  }
  assert.equal(proposal.car.length, CAR_PRESETS.coupe.length);
  assert.deepEqual(proposal.car.ev, CAR_PRESETS.coupe.ev);
  await writeFile(
    "/tmp/world-studio-generative-car.json",
    JSON.stringify(proposal, null, 2),
  );
  console.log(
    JSON.stringify({
      seconds: (Date.now() - start) / 1000,
      parts: proposal.car.parts.map((p) => ({
        name: p.name,
        geometry: p.geometry.type,
      })),
      revised: raw.revised,
    }),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

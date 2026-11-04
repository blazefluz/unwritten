import { carProposalSchema, type CarConfig } from "./car";

/** Null is an absent AI replacement, never an instruction to erase a vehicle.
 * Clearing a bay remains an explicit, undoable UI action. */
export function normalizeCarProposal(
  value: unknown,
  current: CarConfig | null,
) {
  const proposal = carProposalSchema.parse(value);
  if (current && proposal.car === null) {
    proposal.car = structuredClone(current);
    proposal.message = `${proposal.message.slice(0, 1350)}\nCode retained the current vehicle because the response did not supply a replacement.`;
  }
  return proposal;
}

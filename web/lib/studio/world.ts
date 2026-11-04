import { carDocumentSchema, type CarDocument } from "./car";
export function synchronizeDocument(input: CarDocument): CarDocument {
  const next = structuredClone(input);
  if (!next.bays.length && next.car) {
    const id = "bay-1";
    next.bays = [{ id, name: "Design bay 1", x: 0, z: 0, car: next.car }];
    next.activeBayId = id;
  }
  const active = next.bays.find((b) => b.id === next.activeBayId);
  if (active) active.car = next.car;
  return carDocumentSchema.parse(next);
}
export function addDesignBay(doc: CarDocument): CarDocument {
  const next = synchronizeDocument(doc);
  if (next.bays.length >= 24)
    throw new Error(
      "This prototype supports 24 design bays. Export a world before starting another.",
    );
  const i = next.bays.length,
    id = `bay-${crypto.randomUUID().slice(0, 8)}`;
  next.bays.push({
    id,
    name: `Design bay ${i + 1}`,
    x: (i % 4) * 10,
    z: Math.floor(i / 4) * 12,
    car: structuredClone(next.car),
  });
  next.activeBayId = id;
  return synchronizeDocument(next);
}
export function selectDesignBay(doc: CarDocument, id: string): CarDocument {
  const bay = doc.bays.find((b) => b.id === id);
  if (!bay) throw new Error("Design bay not found.");
  return synchronizeDocument({
    ...doc,
    activeBayId: id,
    car: structuredClone(bay.car),
  });
}

export function appendDesignBays(
  doc: CarDocument,
  bays: { name: string; car: CarDocument["car"] }[],
): CarDocument {
  let next = synchronizeDocument(doc);
  for (const design of bays) {
    if (next.bays.length >= 24)
      throw new Error("The proposed world exceeds 24 design bays.");
    const i = next.bays.length,
      id = `bay-${crypto.randomUUID().slice(0, 8)}`;
    next.bays.push({
      id,
      name: design.name,
      x: (i % 4) * 10,
      z: Math.floor(i / 4) * 12,
      car: structuredClone(design.car),
    });
    if (!next.activeBayId) {
      next.activeBayId = id;
      next.car = structuredClone(design.car);
    }
  }
  return synchronizeDocument(next);
}

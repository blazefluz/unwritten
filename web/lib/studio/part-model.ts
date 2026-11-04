import * as THREE from "three";
import type { GeneratedPart } from "./generated-parts";
export function createGeneratedPart(part: GeneratedPart) {
  const g = part.geometry;
  let geometry: THREE.BufferGeometry;
  if (g.type === "box") geometry = new THREE.BoxGeometry(...g.size);
  else if (g.type === "cylinder")
    geometry = new THREE.CylinderGeometry(
      g.radiusTop,
      g.radiusBottom,
      g.length,
      g.segments,
    );
  else if (g.type === "sphere")
    geometry = new THREE.SphereGeometry(g.radius, 24, 16);
  else if (g.type === "torus")
    geometry = new THREE.TorusGeometry(g.radius, g.tube, 12, 40);
  else if (g.type === "extrude") {
    const shape = new THREE.Shape(
      g.profile.map((p) => new THREE.Vector2(...p)),
    );
    shape.closePath();
    geometry = new THREE.ExtrudeGeometry(shape, {
      depth: g.depth,
      bevelEnabled: false,
      curveSegments: 12,
    });
  } else if (g.type === "lathe")
    geometry = new THREE.LatheGeometry(
      g.profile.map((p) => new THREE.Vector2(...p)),
      40,
    );
  else {
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(g.vertices.flat(), 3),
    );
    geometry.setIndex(g.triangles.flat());
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();
  const material = new THREE.MeshPhysicalMaterial({
    color: part.color,
    roughness: part.material === "rubber" ? 0.9 : 0.35,
    metalness: ["metal", "copper"].includes(part.material) ? 0.65 : 0.05,
    transparent: part.material === "glass",
    opacity: part.material === "glass" ? 0.4 : 1,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...part.position);
  mesh.rotation.set(
    ...(part.rotation.map((v) => (v * Math.PI) / 180) as [
      number,
      number,
      number,
    ]),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = part.name;
  mesh.userData.generatedPartId = part.id;
  return mesh;
}
export function generatedPartBounds(part: GeneratedPart) {
  const mesh = createGeneratedPart(part);
  mesh.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(mesh);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
  return bounds;
}

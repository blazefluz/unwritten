import * as THREE from "three";
import type { CarConfig } from "./car";

/** Procedural visual geometry. x = length, y = height, z = width. */
export function createCarModel(car: CarConfig): THREE.Group {
  const group = new THREE.Group();
  const { length: l, width: w, height: h, wheelRadius: r, wheelbase: wb } = car;
  const paint = new THREE.MeshPhysicalMaterial({
    color: car.color,
    metalness: 0.45,
    roughness: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
  });
  const roof = new THREE.MeshPhysicalMaterial({
    color: car.roofColor,
    metalness: 0.4,
    roughness: 0.25,
    clearcoat: 0.9,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#273b46",
    metalness: 0.35,
    roughness: 0.14,
    clearcoat: 1,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: "#202427",
    roughness: 0.9,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: "#c8ced1",
    metalness: 0.8,
    roughness: 0.25,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#242d31",
    roughness: 0.55,
  });
  const lamp = new THREE.MeshStandardMaterial({
    color: "#fff8da",
    emissive: "#fff0c2",
    emissiveIntensity: 0.7,
  });
  const rearLamp = new THREE.MeshStandardMaterial({
    color: "#b92120",
    emissive: "#8c0b06",
    emissiveIntensity: 0.5,
  });
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const box = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material,
  ) => add(new THREE.BoxGeometry(sx, sy, sz), mat, x, y, z);
  const belt = Math.max(r * 1.65, h * (car.style === "suv" ? 0.52 : 0.48));
  const bottom = r * 0.65;
  const body = new THREE.Shape();
  body.moveTo(-l / 2 + 0.12, bottom);
  body.lineTo(l / 2 - 0.12, bottom);
  body.quadraticCurveTo(l / 2, bottom, l / 2, bottom + 0.15);
  body.lineTo(l / 2, belt - 0.11);
  body.quadraticCurveTo(l / 2, belt, l / 2 - 0.16, belt);
  body.lineTo(-l / 2 + 0.16, belt);
  body.quadraticCurveTo(-l / 2, belt, -l / 2, belt - 0.12);
  body.lineTo(-l / 2, bottom + 0.13);
  body.quadraticCurveTo(-l / 2, bottom, -l / 2 + 0.12, bottom);
  const bodyMesh = add(
    new THREE.ExtrudeGeometry(body, {
      depth: w * 0.9,
      bevelEnabled: false,
      curveSegments: 12,
    }),
    paint,
    0,
    0,
    -w * 0.45,
  );
  bodyMesh.name = "body";
  const backBase = car.style === "suv" ? -l * 0.4 : -l * 0.29;
  const backTop =
    car.style === "suv"
      ? -l * 0.35
      : car.style === "sedan"
        ? -l * 0.19
        : -l * 0.15;
  const frontTop = car.style === "coupe" ? l * 0.07 : l * 0.12;
  const frontBase = l * 0.29;
  const cabin = new THREE.Shape();
  cabin.moveTo(backBase, belt);
  cabin.lineTo(backTop, h - 0.08);
  cabin.quadraticCurveTo(backTop + 0.02, h, backTop + 0.11, h);
  cabin.lineTo(frontTop - 0.08, h);
  cabin.quadraticCurveTo(frontTop, h, frontTop + 0.045, h - 0.09);
  cabin.lineTo(frontBase, belt);
  cabin.closePath();
  const cabinDepth = w * 0.77;
  add(
    new THREE.ExtrudeGeometry(cabin, {
      depth: cabinDepth,
      bevelEnabled: false,
      curveSegments: 16,
    }),
    glass,
    0,
    0,
    -cabinDepth / 2,
  ).name = "cabin";
  box(
    (backTop + frontTop) / 2,
    h - 0.035,
    0,
    frontTop - backTop,
    0.07,
    cabinDepth + 0.035,
    roof,
  ).name = "roof";
  // Painted pillars retain a visible silhouette around the dark glazing.
  const pillar = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    z: number,
  ) => {
    const mesh = box(
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      z,
      0.055,
      Math.hypot(x2 - x1, y2 - y1),
      0.035,
      paint,
    );
    mesh.rotation.z = -Math.atan2(x2 - x1, y2 - y1);
  };
  for (const side of [-1, 1]) {
    pillar(backBase, belt, backTop + 0.05, h - 0.02, (side * cabinDepth) / 2);
    pillar(frontBase, belt, frontTop, h - 0.04, (side * cabinDepth) / 2);
    if (car.style !== "coupe")
      pillar(-0.04 * l, belt, -0.04 * l, h - 0.04, (side * cabinDepth) / 2);
    box(
      -l * 0.08,
      belt - 0.1,
      side * (w * 0.45 + 0.008),
      0.19,
      0.035,
      0.02,
      chrome,
    );
    box(0, bottom + 0.06, side * w * 0.455, l * 0.72, 0.045, 0.035, dark);
  }
  const wheelStart = group.children.length;
  for (const x of [-wb / 2, wb / 2])
    for (const side of [-1, 1]) {
      const z = side * (w / 2 - 0.17);
      const tyre = add(
        new THREE.CylinderGeometry(r, r, 0.23, 40),
        rubber,
        x,
        r,
        z,
      );
      tyre.rotation.x = Math.PI / 2;
      tyre.name = "wheel";
      const faceZ = z + side * 0.118;
      const rim = add(
        new THREE.CylinderGeometry(r * 0.69, r * 0.69, 0.018, 32),
        chrome,
        x,
        r,
        faceZ,
      );
      rim.rotation.x = Math.PI / 2;
      const inset = add(
        new THREE.CylinderGeometry(r * 0.57, r * 0.57, 0.023, 32),
        dark,
        x,
        r,
        faceZ + side * 0.012,
      );
      inset.rotation.x = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        const spoke = box(
          x + Math.sin(a) * r * 0.27,
          r + Math.cos(a) * r * 0.27,
          faceZ + side * 0.03,
          0.04,
          r * 0.58,
          0.018,
          chrome,
        );
        spoke.rotation.z = -a;
      }
      const hub = add(
        new THREE.CylinderGeometry(r * 0.13, r * 0.13, 0.03, 16),
        chrome,
        x,
        r,
        faceZ + side * 0.035,
      );
      hub.rotation.x = Math.PI / 2;
    }
  for (const child of group.children.slice(wheelStart)) child.userData.subsystem = "wheels";
  for (const side of [-1, 1]) {
    box(l / 2 - 0.012, belt - 0.1, side * w * 0.3, 0.025, 0.07, w * 0.2, lamp);
    box(
      -l / 2 + 0.012,
      belt - 0.09,
      side * w * 0.3,
      0.025,
      0.065,
      w * 0.2,
      rearLamp,
    );
  }
  box(l / 2 - 0.015, bottom + 0.14, 0, 0.025, 0.12, w * 0.42, dark);
  box(-l / 2 + 0.012, bottom + 0.12, 0, 0.024, 0.12, w * 0.26, dark);
  if (car.spoiler) {
    const y = Math.min(h - 0.12, belt + 0.24);
    for (const side of [-1, 1])
      box(
        -l * 0.42,
        (belt + y) / 2,
        side * w * 0.3,
        0.045,
        y - belt,
        0.06,
        dark,
      );
    box(-l * 0.42, y, 0, 0.25, 0.055, w * 0.87, roof).name = "spoiler";
  }
  return group;
}
export function disposeCarGroup(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  group.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.LineSegments ||
      child instanceof THREE.Sprite ||
      child instanceof THREE.Line
    ) {
      if ("geometry" in child) child.geometry.dispose();
      for (const m of Array.isArray(child.material)
        ? child.material
        : [child.material])
        materials.add(m);
    }
  });
  for (const material of materials) {
    if ("map" in material && material.map instanceof THREE.Texture)
      material.map.dispose();
    material.dispose();
  }
  group.clear();
}

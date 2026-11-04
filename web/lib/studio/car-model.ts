import * as THREE from "three";
import type { CarConfig } from "./car";

/** Procedural visual geometry. x = length, y = height, z = width. */
export function createCarModel(car: CarConfig): THREE.Group {
  const group = new THREE.Group();
  const { length: l, width: w, height: h, wheelRadius: r, wheelbase: wb } = car;
  const paint = new THREE.MeshPhysicalMaterial({
    color: car.color,
    metalness: 0.22,
    roughness: 0.34,
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
  const belt = Math.max(r * 1.8, h * 0.49);
  const bottom = r * 0.58;
  // Loft a rounded shoulder across the length, with true open wheel cutouts.
  const positions: number[] = [],
    indices: number[] = [];
  const rows = 120,
    rings = 48;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows,
      x = (t - 0.5) * l;
    const taper = 0.83 + 0.17 * Math.sin(Math.PI * t) ** 0.45;
    const axleDistance = Math.min(Math.abs(x - wb / 2), Math.abs(x + wb / 2));
    const arch =
      axleDistance < r * 1.12
        ? r + Math.sqrt((r * 1.12) ** 2 - axleDistance ** 2)
        : bottom;
    const shoulder = belt + 0.055 * Math.cos((x / l) * Math.PI);
    for (let j = 0; j <= rings; j++) {
      const angle = (j / rings) * Math.PI * 2;
      const side = Math.sin(angle),
        top = Math.cos(angle);
      const sideHeight = Math.max(shoulder, arch + 0.035);
      const y =
        top >= 0
          ? shoulder +
            top * 0.045 +
            (sideHeight - shoulder) * Math.abs(side) ** 6
          : arch + (sideHeight - arch) * (1 - Math.abs(top) ** 0.35);
      const z = Math.sign(side) * Math.abs(side) ** 0.35 * w * 0.5 * taper;
      positions.push(x, y, z);
      if (i < rows && j < rings) {
        const k = i * (rings + 1) + j;
        indices.push(
          k,
          k + rings + 1,
          k + 1,
          k + 1,
          k + rings + 1,
          k + rings + 2,
        );
      }
    }
  }
  for (let j = 1; j < rings - 1; j++) {
    indices.push(0, j + 1, j);
    const end = rows * (rings + 1);
    indices.push(end, end + j, end + j + 1);
  }
  const bodyGeometry = new THREE.BufferGeometry();
  bodyGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  bodyGeometry.setIndex(indices);
  bodyGeometry.computeVertexNormals();
  paint.side = THREE.DoubleSide;
  add(bodyGeometry, paint, 0, 0, 0).name = "body";
  const backBase = -l * (car.style === "suv" ? 0.4 : 0.33);
  const backTop = -l * (car.style === "suv" ? 0.3 : 0.18);
  const frontTop = l * 0.08,
    frontBase = l * 0.28;
  // Cross sections taper towards the roof rather than extruding flat side walls.
  const sections = [
    [backBase, belt + 0.015, w * 0.4],
    [backTop, h * 0.96, w * 0.32],
    [-l * 0.05, h, w * 0.33],
    [frontTop, h * 0.97, w * 0.32],
    [frontBase, belt + 0.025, w * 0.39],
  ];
  const cabinPoints: number[] = [],
    cabinIndices: number[] = [];
  for (const [x, y, half] of sections) {
    for (let j = 0; j <= 24; j++) {
      const u = (j / 24) * 2 - 1;
      cabinPoints.push(x, y - 0.045 * u * u, half * u);
    }
  }
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 24; j++) {
      const k = i * 25 + j;
      cabinIndices.push(k, k + 1, k + 25, k + 1, k + 26, k + 25);
    }
  const glazing = new THREE.BufferGeometry();
  glazing.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(cabinPoints, 3),
  );
  glazing.setIndex(cabinIndices);
  glazing.computeVertexNormals();
  glass.side = THREE.DoubleSide;
  add(glazing, glass, 0, 0, 0).name = "cabin";
  function seam(points: number[][], material = dark, radius = 0.008) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...(p as [number, number, number]))),
    );
    const geometry = new THREE.TubeGeometry(curve, 40, radius, 6, false);
    const vertices = geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++)
      vertices.setX(i, THREE.MathUtils.clamp(vertices.getX(i), -l / 2, l / 2));
    return add(geometry, material, 0, 0, 0);
  }
  for (const side of [-1, 1]) {
    const outline = sections.map(([x, y, half]) => [x, y - 0.045, side * half]);
    seam(outline, paint, 0.025);
    // Side glass follows the roof taper; painted pillars and sill surround it.
    const sideShape = new THREE.BufferGeometry();
    const pts = [
      [backBase, belt, side * w * 0.4],
      [backTop, h * 0.96 - 0.045, side * w * 0.32],
      [frontTop, h * 0.97 - 0.045, side * w * 0.32],
      [frontBase, belt, side * w * 0.39],
    ];
    sideShape.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(pts.flat(), 3),
    );
    sideShape.setIndex([0, 1, 2, 0, 2, 3]);
    sideShape.computeVertexNormals();
    add(sideShape, glass, 0, 0, 0);
    seam(
      [
        [backBase, belt, side * w * 0.4],
        [frontBase, belt, side * w * 0.39],
      ],
      chrome,
      0.012,
    );
    seam(
      [
        [-l * 0.07, belt, side * w * 0.397],
        [-l * 0.07, h - 0.045, side * w * 0.33],
      ],
      dark,
      0.022,
    );
    seam(
      [
        [frontBase, belt, side * w * 0.39],
        [frontTop, h * 0.97 - 0.045, side * w * 0.32],
      ],
      paint,
      0.028,
    );
    seam(
      [
        [backBase, belt, side * w * 0.4],
        [backTop, h * 0.96 - 0.045, side * w * 0.32],
      ],
      paint,
      0.04,
    );
    // Door shut line, recessed handle, rocker and sculpted mirror housing.
    seam(
      [
        [l * 0.21, belt, side * w * 0.478],
        [l * 0.2, bottom + 0.12, side * w * 0.478],
        [-l * 0.2, bottom + 0.12, side * w * 0.478],
        [-l * 0.21, belt, side * w * 0.478],
      ],
      dark,
      0.006,
    );
    box(
      -l * 0.12,
      belt - 0.1,
      side * w * 0.484,
      0.16,
      0.025,
      0.018,
      chrome,
    ).name = "door-handle";
    box(0, bottom + 0.02, side * w * 0.465, l * 0.55, 0.055, 0.055, dark);
    seam(
      [
        [l * 0.19, belt + 0.08, side * w * 0.39],
        [l * 0.18, belt + 0.13, side * w * 0.47],
      ],
      dark,
      0.022,
    );
    const mirror = add(
      new THREE.SphereGeometry(1, 24, 16),
      paint,
      l * 0.18,
      belt + 0.15,
      side * w * 0.473,
    );
    mirror.scale.set(0.13, 0.065, w * 0.027);
    mirror.name = "mirror";
    const reflective = add(
      new THREE.SphereGeometry(1, 20, 12),
      chrome,
      l * 0.18 - 0.035,
      belt + 0.15,
      side * w * 0.475,
    );
    reflective.scale.set(0.095, 0.047, w * 0.028);
    // Bonnet character lines and narrow wraparound LED signatures.
    seam(
      [
        [l * 0.27, belt + 0.03, side * w * 0.26],
        [l * 0.4, belt + 0.025, side * w * 0.29],
        [l * 0.47, belt - 0.025, side * w * 0.3],
      ],
      paint,
      0.009,
    );
    seam(
      [
        [l * 0.495, belt - 0.08, side * w * 0.16],
        [l * 0.495, belt - 0.08, side * w * 0.32],
        [l * 0.46, belt - 0.06, side * w * 0.39],
      ],
      lamp,
      0.018,
    );
    seam(
      [
        [-l * 0.495, belt - 0.08, side * w * 0.12],
        [-l * 0.495, belt - 0.08, side * w * 0.34],
        [-l * 0.46, belt - 0.06, side * w * 0.39],
      ],
      rearLamp,
      0.018,
    );
  }
  // Painted roof insert leaves front and rear glazing exposed.
  const roofPanel = add(
    new THREE.SphereGeometry(1, 40, 20),
    roof,
    -l * 0.05,
    h - 0.043,
    0,
  );
  roofPanel.scale.set(l * 0.14, 0.043, w * 0.33);
  roofPanel.name = "roof";
  const wheelStart = group.children.length;
  for (const x of [-wb / 2, wb / 2])
    for (const side of [-1, 1]) {
      const z = side * (w / 2 - 0.17);
      const tyre = add(
        new THREE.TorusGeometry(r * 0.79, r * 0.21, 16, 64),
        rubber,
        x,
        r,
        z,
      );
      tyre.rotation.x = 0;
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
  for (const child of group.children.slice(wheelStart))
    child.userData.subsystem = "wheels";
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

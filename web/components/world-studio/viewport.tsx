"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  CATALOG,
  footprint,
  inspectScene,
  type SceneObject,
  type World,
} from "@/lib/studio/scene";
import { shopperAt, type DayResult } from "@/lib/studio/shoppers";

export type ViewMode = "orbit" | "top" | "walk";
type Props = {
  world: World;
  selectedId: string | null;
  preview: World | null;
  issueIds: string[];
  busy: boolean;
  paused: boolean;
  view: ViewMode;
  onSelect: (id: string | null) => void;
  onBuild?: (progress: BuildProgress | null) => void;
  /** Animate the avatar building changed objects (AI, commands, examples). */
  choreograph?: boolean;
  /** Allow direct drag-to-move in orbit and plan views. */
  editable?: boolean;
  onMove?: (id: string, x: number, z: number) => void;
  /** One-line reasons, by object id, spoken while the avatar builds. */
  reasons?: Record<string, string>;
  /** A simulated shop day to play back; a new object restarts playback. */
  day?: DayResult | null;
  onDayTick?: (tick: DayTick) => void;
};
export type DayTick = {
  inside: number;
  arrived: number;
  sold: number;
  done: boolean;
};
const DAY_SPEED = 2.2; // simulated seconds per real second
export type BuildProgress = {
  label: string;
  done: number;
  total: number;
  reason?: string;
};
type BuildJob = {
  object: SceneObject;
  group: THREE.Group;
  old?: THREE.Group;
  reason?: string;
};
type Engine = {
  sync: (props: Props) => void;
  setView: (view: ViewMode) => void;
  dispose: () => void;
};
function material(
  color: string,
  extra: THREE.MeshStandardMaterialParameters = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.03,
    ...extra,
  });
}
function box(
  parent: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  mat: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(
  parent: THREE.Group,
  top: number,
  bottom: number,
  height: number,
  position: [number, number, number],
  mat: THREE.Material,
  segments = 20,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, height, segments),
    mat,
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function sphere(
  parent: THREE.Group,
  radius: number,
  position: [number, number, number],
  mat: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function createObject(o: SceneObject, ghost = false): THREE.Group {
  const root = new THREE.Group();
  root.userData.objectId = o.id;
  const paint = material(o.color);
  const wood = material("#c39a70");
  const dark = material("#3e4540");
  const pale = material("#e8e5dc");
  root.userData.ownedMaterials = [paint, wood, dark, pale];
  const [w, h, d] = CATALOG[o.kind].size;
  if (o.kind === "table" || o.kind === "counter") {
    box(root, [w, 0.12, d], [0, h - 0.06, 0], o.kind === "table" ? wood : pale);
    if (o.kind === "counter") {
      box(root, [w - 0.12, h - 0.15, d - 0.12], [0, (h - 0.15) / 2, 0], paint);
      for (let x = -w / 2 + 0.18; x < w / 2; x += 0.18)
        box(
          root,
          [0.025, h - 0.22, 0.03],
          [x, h / 2 - 0.08, d / 2 - 0.04],
          wood,
        );
    } else {
      for (const x of [-w / 2 + 0.12, w / 2 - 0.12])
        for (const z of [-d / 2 + 0.1, d / 2 - 0.1])
          box(root, [0.09, h - 0.12, 0.09], [x, (h - 0.12) / 2, z], paint);
      box(root, [w - 0.2, 0.08, d - 0.2], [0, 0.25, 0], paint);
    }
  } else if (o.kind === "shelf") {
    for (const x of [-w / 2 + 0.045, w / 2 - 0.045])
      for (const z of [-d / 2 + 0.045, d / 2 - 0.045])
        box(root, [0.07, h, 0.07], [x, h / 2, z], paint);
    for (const y of [0.14, 0.77, 1.4, 2.03])
      box(root, [w, 0.07, d], [0, y, 0], wood);
    // Small display pieces are part of this catalog asset, not separately counted inventory.
    for (let i = 0; i < 4; i++)
      box(
        root,
        [0.18, 0.32 + (i % 2) * 0.1, 0.27],
        [-0.55 + i * 0.23, 0.97, 0],
        i % 2 ? pale : paint,
      );
    cylinder(root, 0.13, 0.11, 0.3, [0.45, 1.59, 0], pale);
  } else if (o.kind === "chair" || o.kind === "stool") {
    const seat = o.kind === "chair" ? 0.53 : h - 0.08;
    cylinder(root, w * 0.46, w * 0.46, 0.1, [0, seat, 0], paint);
    for (const x of [-w * 0.3, w * 0.3])
      for (const z of [-d * 0.3, d * 0.3])
        box(root, [0.055, seat, 0.055], [x, seat / 2, z], wood);
    if (o.kind === "chair") {
      for (const x of [-0.25, 0.25])
        box(root, [0.05, 0.5, 0.05], [x, 0.8, -0.25], wood);
      box(root, [0.6, 0.29, 0.07], [0, 0.9, -0.25], paint);
    }
  } else if (o.kind === "plant") {
    cylinder(root, 0.27, 0.19, 0.45, [0, 0.225, 0], material("#bd7655"));
    cylinder(root, 0.24, 0.24, 0.025, [0, 0.45, 0], material("#594c3b"));
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const y = 0.85 + (i % 3) * 0.18;
      const leaf = sphere(
        root,
        0.28,
        [Math.cos(a) * 0.18, y, Math.sin(a) * 0.18],
        paint,
      );
      leaf.scale.set(0.6, 1.65, 0.55);
      leaf.rotation.z = Math.cos(a) * 0.6;
      cylinder(root, 0.015, 0.02, y - 0.4, [0, (y + 0.4) / 2, 0], paint, 8);
    }
  } else if (o.kind === "lamp") {
    cylinder(root, 0.28, 0.3, 0.055, [0, 0.03, 0], dark);
    cylinder(root, 0.025, 0.025, 1.8, [0, 0.93, 0], dark, 10);
    cylinder(root, 0.17, 0.32, 0.4, [0, 2, 0], paint);
    const bulb = sphere(
      root,
      0.1,
      [0, 1.84, 0],
      material("#fff0ba", { emissive: "#ffd477", emissiveIntensity: 0.9 }),
    );
    bulb.castShadow = false;
    const glow = new THREE.PointLight("#ffc46b", 0, 5.5, 1.6);
    glow.position.set(0, 1.7, 0);
    glow.userData.lampGlow = true;
    root.add(glow);
  } else if (o.kind === "partition") {
    box(root, [w, h - 0.12, 0.18], [0, h / 2 + 0.06, 0], paint);
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2])
      box(root, [0.12, 0.08, 0.65], [x, 0.04, 0], dark);
    for (let x = -w / 2 + 0.15; x < w / 2; x += 0.2)
      box(root, [0.025, h - 0.3, 0.015], [x, h / 2, 0.098], wood);
  } else if (o.kind === "crate") {
    for (const y of [0.13, 0.33, 0.53]) {
      for (const z of [-d / 2 + 0.035, d / 2 - 0.035])
        box(root, [w, 0.15, 0.055], [0, y, z], paint);
      for (const x of [-w / 2 + 0.035, w / 2 - 0.035])
        box(root, [0.055, 0.15, d], [x, y, 0], paint);
    }
    box(root, [w, 0.06, d], [0, 0.03, 0], wood);
  } else {
    box(root, [w, h, d], [0, h / 2 + 0.008, 0], paint);
    for (const x of [-w / 2 + 0.14, w / 2 - 0.14])
      box(root, [0.045, 0.003, d - 0.2], [x, h + 0.01, 0], pale);
  }
  root.position.set(o.x, 0, o.z);
  root.rotation.y = (o.rotation * Math.PI) / 180;
  root.scale.setScalar(o.scale);
  if (ghost)
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const source = child.material as THREE.MeshStandardMaterial;
        child.material = source.clone();
        child.material.transparent = true;
        child.material.opacity = 0.3;
        child.material.depthWrite = false;
        child.castShadow = false;
      }
    });
  return root;
}
function disposeGroup(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  group.traverse((child) => {
    (child.userData.ownedMaterials || []).forEach((m: THREE.Material) =>
      materials.add(m),
    );
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.LineSegments ||
      child instanceof THREE.LineLoop
    ) {
      child.geometry.dispose();
      const ms = Array.isArray(child.material)
        ? child.material
        : [child.material];
      ms.forEach((m) => materials.add(m));
    }
  });
  materials.forEach((m) => m.dispose());
  group.clear();
}
function createEngine(
  host: HTMLDivElement,
  initial: Props,
  onError: () => void,
): Engine {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive 3D space. Select objects here or use the object list. Drag to orbit; scroll to zoom.",
  );
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.tabIndex = 0;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eeeeeb");
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(14.8, 12, 16);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.6, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 2;
  controls.maxDistance = 32;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.update();
  const ambient = new THREE.HemisphereLight("#fff6e9", "#768078", 2.7);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff0d7", 4);
  sun.position.set(-3, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
  });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#d1e4ff", 1);
  fill.position.set(8, 5, -5);
  scene.add(fill);
  const room = new THREE.Group();
  scene.add(room);
  const floor = box(
    room,
    [12.2, 0.18, 10.2],
    [0, -0.09, 0],
    material("#dedbd2"),
  );
  floor.castShadow = false;
  box(room, [12.2, 0.22, 10.2], [0, -0.28, 0], material("#d0cec7"));
  box(room, [12.2, 3.3, 0.12], [0, 1.65, -5.05], material("#e7e5df"));
  box(room, [0.12, 3.3, 10.2], [-6.05, 1.65, 0], material("#e1dfd7"));
  box(room, [12, 0.1, 0.08], [0, 0.05, -4.95], material("#bab8b0"));
  box(room, [0.08, 0.1, 10], [-5.95, 0.05, 0], material("#bab8b0"));
  const windowMat = material("#c4d9db", {
    emissive: "#c7e1e3",
    emissiveIntensity: 0.2,
  });
  for (const x of [1.3, 2.65, 4]) {
    box(room, [1.2, 1.65, 0.08], [x, 2.1, -4.96], windowMat);
    for (const dx of [-0.62, 0.62])
      box(room, [0.055, 1.8, 0.14], [x + dx, 2.1, -4.9], material("#f4f3ed"));
    box(room, [1.3, 0.08, 0.28], [x, 1.25, -4.85], material("#f4f3ed"));
  }
  const grid = new THREE.GridHelper(12, 24, "#b9b7ae", "#c9c7bf");
  grid.position.y = 0.006;
  grid.scale.z = 10 / 12;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.3;
  scene.add(grid);
  const objects = new THREE.Group(),
    overlay = new THREE.Group();
  scene.add(objects, overlay);
  const robot = new THREE.Group();
  scene.add(robot);
  robot.position.set(2.8, 0, 2.5);
  const porcelain = material("#f5f1e8"),
    robotDark = material("#273c38"),
    orange = material("#ff682b");
  const body = box(robot, [0.44, 0.55, 0.34], [0, 0.88, 0], porcelain);
  const head = box(robot, [0.55, 0.4, 0.4], [0, 1.4, 0], porcelain);
  box(robot, [0.43, 0.23, 0.035], [0, 1.4, 0.215], robotDark);
  const eyeMat = material("#a9f1c7", {
    emissive: "#79d7b0",
    emissiveIntensity: 0.7,
  });
  for (const x of [-0.1, 0.1]) sphere(robot, 0.038, [x, 1.42, 0.245], eyeMat);
  cylinder(robot, 0.025, 0.025, 0.15, [0, 1.7, 0], robotDark, 8);
  sphere(robot, 0.055, [0, 1.8, 0], orange);
  box(robot, [0.18, 0.08, 0.02], [0, 0.95, 0.185], orange);
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.31, 1.06, 0);
    robot.add(arm);
    box(arm, [0.12, 0.4, 0.14], [0, -0.15, 0], porcelain);
    sphere(arm, 0.085, [0, -0.38, 0], robotDark);
    return arm;
  });
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.13, 0.62, 0);
    robot.add(leg);
    box(leg, [0.14, 0.4, 0.16], [0, -0.2, 0], robotDark);
    box(leg, [0.19, 0.13, 0.29], [0, -0.45, 0.045], porcelain);
    return leg;
  });
  const robotRing = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.4, 48),
    new THREE.MeshBasicMaterial({
      color: "#ff682b",
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    }),
  );
  robotRing.rotation.x = -Math.PI / 2;
  robotRing.position.y = 0.02;
  robot.add(robotRing);
  let props = initial,
    lastWorld: World | null = null,
    currentView: ViewMode = "orbit";
  let frame = 0,
    lastTime = 0,
    visible = true;
  const target = new THREE.Vector3(2.8, 0, 2.5),
    restTarget = new THREE.Vector3(2.8, 0, 2.5),
    keys = new Set<string>();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const down = new THREE.Vector2(),
    lastPointer = new THREE.Vector2();
  let looking = false;
  const raycaster = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    floorHit = new THREE.Vector3(),
    dragOverlay = new THREE.Group();
  scene.add(dragOverlay);
  let drag: {
    id: string;
    group: THREE.Group;
    object: SceneObject;
    dx: number;
    dz: number;
    x: number;
    z: number;
    active: boolean;
  } | null = null;
  let resetDragged: string | null = null;
  function aim(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
  }
  function pick(e: PointerEvent) {
    aim(e);
    let object: THREE.Object3D | undefined = raycaster.intersectObjects(
      objects.children,
      true,
    )[0]?.object;
    while (object && !object.userData.objectId) object = object.parent!;
    return object as THREE.Group | undefined;
  }
  // Runs in the capture phase so OrbitControls never starts an orbit when the
  // pointer lands on furniture: that gesture moves the object instead.
  function grab(e: PointerEvent) {
    if (
      currentView === "walk" ||
      !props.editable ||
      !props.onMove ||
      buildQueue.length ||
      e.button !== 0
    )
      return;
    const group = pick(e);
    const object = props.world.objects.find(
      (o) => o.id === group?.userData.objectId,
    );
    if (
      !group ||
      !object ||
      !raycaster.ray.intersectPlane(floorPlane, floorHit)
    )
      return;
    controls.enabled = false;
    drag = {
      id: object.id,
      group,
      object,
      dx: object.x - floorHit.x,
      dz: object.z - floorHit.z,
      x: object.x,
      z: object.z,
      active: false,
    };
  }
  function dragTo(e: PointerEvent) {
    if (!drag) return;
    if (
      !drag.active &&
      down.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) <= 5
    )
      return;
    if (!drag.active) {
      drag.active = true;
      props.onSelect(drag.id);
      renderer.domElement.style.cursor = "grabbing";
    }
    aim(e);
    if (!raycaster.ray.intersectPlane(floorPlane, floorHit)) return;
    const f = footprint(drag.object);
    const snap = (v: number) => Math.round(v * 4) / 4;
    drag.x = THREE.MathUtils.clamp(
      snap(floorHit.x + drag.dx),
      -6 + f.w / 2,
      6 - f.w / 2,
    );
    drag.z = THREE.MathUtils.clamp(
      snap(floorHit.z + drag.dz),
      -5 + f.d / 2,
      5 - f.d / 2,
    );
    drag.group.position.set(drag.x, 0, drag.z);
    const moved = { ...drag.object, x: drag.x, z: drag.z };
    const clash = inspectScene({
      ...props.world,
      objects: props.world.objects.map((o) => (o.id === moved.id ? moved : o)),
    }).some((issue) => issue.ids.includes(moved.id));
    disposeGroup(dragOverlay);
    ring(moved, clash ? "#c93527" : "#2f8a4f", clash, dragOverlay);
  }
  function drop() {
    if (!drag) return;
    const finished = drag;
    drag = null;
    controls.enabled = currentView !== "walk";
    disposeGroup(dragOverlay);
    renderer.domElement.style.cursor = "";
    if (!finished.active) return;
    // Snap back visually; the committed scene (or a conflict preview) redraws it.
    resetDragged = finished.id;
    if (finished.x !== finished.object.x || finished.z !== finished.object.z)
      props.onMove?.(finished.id, finished.x, finished.z);
    else finished.group.position.set(finished.object.x, 0, finished.object.z);
  }
  function hover(e: PointerEvent) {
    if (drag || e.buttons || currentView === "walk") return;
    renderer.domElement.style.cursor = props.editable && pick(e) ? "grab" : "";
  }
  function pointerDown(e: PointerEvent) {
    down.set(e.clientX, e.clientY);
    lastPointer.copy(down);
    looking = true;
  }
  function pointerMove(e: PointerEvent) {
    if (drag) return dragTo(e);
    hover(e);
    if (!looking || currentView !== "walk") return;
    const dx = e.clientX - lastPointer.x,
      dy = e.clientY - lastPointer.y;
    lastPointer.set(e.clientX, e.clientY);
    const look = controls.target.clone().sub(camera.position);
    const spherical = new THREE.Spherical().setFromVector3(look);
    spherical.theta -= dx * 0.005;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi - dy * 0.005,
      0.3,
      Math.PI - 0.3,
    );
    controls.target
      .copy(camera.position)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    camera.lookAt(controls.target);
  }
  function pointerEnd() {
    looking = false;
    drop();
  }
  function click(e: PointerEvent) {
    looking = false;
    const dragged = drag?.active;
    drop();
    if (dragged) return;
    if (down.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hits = raycaster.intersectObjects(objects.children, true);
    let object = hits[0]?.object;
    while (object && !object.userData.objectId) object = object.parent!;
    props.onSelect(object?.userData.objectId || null);
  }
  function keyDown(e: KeyboardEvent) {
    if (
      currentView !== "walk" ||
      ![
        "w",
        "a",
        "s",
        "d",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.key)
    )
      return;
    keys.add(e.key.toLowerCase());
    e.preventDefault();
  }
  function keyUp(e: KeyboardEvent) {
    keys.delete(e.key.toLowerCase());
  }
  function blur() {
    keys.clear();
  }
  host.addEventListener("pointerdown", grab, { capture: true });
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointerup", click);
  renderer.domElement.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerEnd);
  renderer.domElement.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  renderer.domElement.addEventListener("blur", blur);
  function contextLost(e: Event) {
    e.preventDefault();
    onError();
  }
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resize.observe(host);
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  });
  observer.observe(host);
  function ring(
    object: SceneObject,
    color: string,
    dashed = false,
    into: THREE.Group = overlay,
  ) {
    const f = footprint(object);
    const points = [
      [-f.w / 2, -f.d / 2],
      [f.w / 2, -f.d / 2],
      [f.w / 2, f.d / 2],
      [-f.w / 2, f.d / 2],
    ].map(([x, z]) => new THREE.Vector3(x + object.x, 0.045, z + object.z));
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      dashed
        ? new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08 })
        : new THREE.LineBasicMaterial({ color }),
    );
    line.computeLineDistances();
    if (into === dragOverlay) {
      // Keep the drag outline visible through the object being carried.
      (line.material as THREE.Material).depthTest = false;
      line.renderOrder = 10;
    }
    into.add(line);
  }
  // Build choreography: changed objects wait off-stage until the avatar
  // reaches them, so a proposal appears to be built piece by piece. The scene
  // state itself is already committed; this only staggers what is drawn.
  let buildQueue: BuildJob[] = [],
    buildTotal = 0,
    buildDone = 0,
    workTime = 0;
  function beside(object: SceneObject, out: THREE.Vector3) {
    const f = footprint(object);
    return out.set(
      THREE.MathUtils.clamp(object.x + f.w / 2 + 0.65, -5.4, 5.4),
      0,
      THREE.MathUtils.clamp(object.z + f.d / 2 + 0.6, -4.4, 4.4),
    );
  }
  function reportBuild() {
    const job = buildQueue[0];
    props.onBuild?.(
      job
        ? {
            label: job.object.label,
            done: buildDone,
            total: buildTotal,
            reason: job.reason,
          }
        : null,
    );
  }
  // Speech bubble that follows the avatar's head while it explains a step.
  const bubble = document.createElement("div");
  bubble.className = "ws-bubble";
  bubble.setAttribute("aria-hidden", "true");
  host.appendChild(bubble);
  const head3 = new THREE.Vector3();
  let bubbleText = "",
    bubbleLinger = 0;
  function speak(text: string) {
    if (text === bubbleText) return;
    bubbleText = text;
    bubble.textContent = text;
    bubble.classList.toggle("is-visible", Boolean(text));
  }
  function placeBubble() {
    if (!bubbleText) return;
    head3.copy(robot.position).setY(2.05).project(camera);
    const behind = head3.z > 1;
    const rect = renderer.domElement.getBoundingClientRect();
    bubble.style.transform = `translate(${((head3.x + 1) / 2) * rect.width}px, ${((1 - head3.y) / 2) * rect.height}px) translate(-50%, -100%)`;
    bubble.style.visibility = behind ? "hidden" : "";
  }
  function place(job: BuildJob, animate: boolean) {
    if (job.old) {
      objects.remove(job.old);
      disposeGroup(job.old);
    }
    lampGlow(job.group);
    if (animate) {
      job.group.userData.targetScale = job.object.scale;
      job.group.scale.setScalar(0.01);
    }
    objects.add(job.group);
  }
  function lampGlow(group: THREE.Object3D) {
    const night = props.world.lighting === "night";
    group.traverse((child) => {
      if (child.userData.lampGlow)
        (child as THREE.PointLight).intensity = night ? 7 : 0;
    });
  }
  function flushBuild() {
    bubbleLinger = 0;
    speak("");
    if (!buildQueue.length) return;
    buildQueue.forEach((job) => place(job, false));
    buildQueue = [];
    buildTotal = buildDone = workTime = 0;
    reportBuild();
  }
  // Shop day playback: simple procedural shoppers following precomputed plans.
  const crowd = new THREE.Group();
  scene.add(crowd);
  let playing: DayResult | null = null,
    dayClock = 0,
    lastTick = "";
  const skin = ["#e2b58f", "#a8714f", "#f0cdb0", "#6f4a35"];
  function startDay(day: DayResult | null) {
    disposeGroup(crowd);
    playing = day;
    dayClock = 0;
    lastTick = "";
    if (!day) return;
    for (const plan of day.shoppers) {
      const person = new THREE.Group();
      cylinder(person, 0.15, 0.2, 0.75, [0, 0.72, 0], material(plan.color), 12);
      cylinder(person, 0.06, 0.06, 0.36, [0, 0.18, 0], material("#2f3433"), 8);
      sphere(person, 0.14, [0, 1.25, 0], material(skin[plan.id % skin.length]));
      const bag = box(
        person,
        [0.22, 0.24, 0.1],
        [0.24, 0.62, 0.05],
        material("#ff682b"),
      );
      bag.name = "bag";
      bag.visible = false;
      person.visible = false;
      person.userData.plan = plan;
      crowd.add(person);
    }
  }
  function playDay(dt: number) {
    if (!playing) return;
    if (!props.paused) dayClock += dt * DAY_SPEED;
    let inside = 0,
      arrived = 0,
      sold = 0;
    for (const person of crowd.children) {
      const plan = person.userData.plan as DayResult["shoppers"][number];
      if (dayClock >= plan.keyframes[0].t) arrived += 1;
      if (plan.paidAt !== null && dayClock >= plan.paidAt) sold += 1;
      const at = shopperAt(plan, dayClock);
      person.visible = Boolean(at);
      if (!at) continue;
      inside += 1;
      person.position.set(at.x, 0, at.z);
      if (at.moving) person.rotation.y = at.heading;
      person.position.y = at.moving
        ? Math.abs(Math.sin(dayClock * 7 + plan.id)) * 0.035
        : 0;
      person.getObjectByName("bag")!.visible = at.carrying;
    }
    const done = dayClock > playing.duration;
    const tick = `${inside}|${arrived}|${sold}|${done}`;
    if (tick !== lastTick) {
      lastTick = tick;
      props.onDayTick?.({ inside, arrived, sold, done });
    }
    if (done) playing = null;
  }
  function sync(next: Props) {
    const dayChanged =
      next.day !== props.day ||
      (next.day && !playing && !crowd.children.length);
    props = next;
    if (dayChanged) startDay(props.day || null);
    const night = props.world.lighting === "night";
    scene.background = new THREE.Color(night ? "#222d35" : "#eeeeeb");
    ambient.intensity = night ? 1 : 2.7;
    sun.intensity = night ? 0.8 : 4;
    fill.intensity = night ? 1.8 : 1;
    sun.color.set(night ? "#ffbf78" : "#fff0d7");
    if (lastWorld !== props.world) {
      const first = lastWorld === null;
      flushBuild();
      const previous = new Map(
        lastWorld?.objects.map((o) => [o.id, JSON.stringify(o)]) || [],
      );
      const current = new Map(
        props.world.objects.map((o) => [o.id, JSON.stringify(o)]),
      );
      const replaced = new Map<string, THREE.Group>();
      for (const group of [...objects.children] as THREE.Group[]) {
        const id = group.userData.objectId;
        if (!current.has(id)) {
          objects.remove(group);
          disposeGroup(group);
        } else if (previous.get(id) !== current.get(id))
          replaced.set(id, group);
      }
      const existing = new Set(
        objects.children.map((group) => group.userData.objectId),
      );
      const choreograph =
        !first &&
        props.choreograph !== false &&
        !reduced.matches &&
        !props.paused;
      for (const o of props.world.objects) {
        const old = replaced.get(o.id);
        if (existing.has(o.id) && !old) continue;
        const job = {
          object: o,
          group: createObject(o),
          old,
          reason: props.reasons?.[o.id],
        };
        if (choreograph) buildQueue.push(job);
        else place(job, !old && !reduced.matches && !props.paused);
      }
      buildTotal = buildQueue.length;
      buildDone = workTime = 0;
      lastWorld = props.world;
      reportBuild();
    }
    if (resetDragged) {
      const o = props.world.objects.find((a) => a.id === resetDragged);
      const group = objects.children.find(
        (g) => g.userData.objectId === resetDragged,
      );
      if (o && group) group.position.set(o.x, 0, o.z);
      resetDragged = null;
    }
    objects.children.forEach(lampGlow);
    disposeGroup(overlay);
    const selected = props.world.objects.find((o) => o.id === props.selectedId);
    if (selected) {
      ring(selected, "#ff4f00");
      beside(selected, restTarget);
    } else restTarget.set(2.8, 0, 2.5);
    if (props.preview)
      for (const o of props.preview.objects) {
        const before = props.world.objects.find((a) => a.id === o.id);
        if (!before || JSON.stringify(before) !== JSON.stringify(o))
          overlay.add(createObject(o, true));
        if (props.issueIds.includes(o.id)) ring(o, "#c93527", true);
      }
  }
  function setView(view: ViewMode) {
    currentView = view;
    keys.clear();
    controls.enabled = view !== "walk";
    controls.enablePan = view !== "walk";
    controls.enableZoom = view !== "walk";
    if (view === "top") {
      camera.position.set(0, 22, 0.01);
      controls.target.set(0, 0, 0);
      controls.maxPolarAngle = 0.03;
    } else if (view === "walk") {
      camera.position.set(3.8, 1.65, 4.1);
      controls.target.set(0, 1.65, -1);
      controls.maxPolarAngle = Math.PI * 0.8;
      controls.minDistance = 0.5;
    } else {
      camera.position.set(14.8, 12, 16);
      controls.target.set(0, 0.6, 0);
      controls.maxPolarAngle = Math.PI / 2 - 0.04;
      controls.minDistance = 2;
    }
    controls.update();
  }
  const direction = new THREE.Vector3(),
    right = new THREE.Vector3(),
    delta = new THREE.Vector3();
  function render(time: number) {
    frame = requestAnimationFrame(render);
    const dt = Math.min((time - lastTime) / 1000, 0.04);
    lastTime = time;
    if (!visible || document.hidden) return;
    if (currentView === "walk" && keys.size) {
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      right.crossVectors(direction, camera.up).normalize();
      delta.set(0, 0, 0);
      if (keys.has("w") || keys.has("arrowup")) delta.add(direction);
      if (keys.has("s") || keys.has("arrowdown")) delta.sub(direction);
      if (keys.has("d") || keys.has("arrowright")) delta.add(right);
      if (keys.has("a") || keys.has("arrowleft")) delta.sub(right);
      delta.normalize().multiplyScalar(dt * 3);
      const old = camera.position.clone();
      camera.position.add(delta);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -5.6, 5.6);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -4.6, 4.6);
      controls.target.add(camera.position.clone().sub(old));
    }
    controls.update();
    if (buildQueue.length && (reduced.matches || props.paused)) flushBuild();
    const job = buildQueue[0];
    if (job) beside(job.object, target);
    else target.copy(restTarget);
    const distance = robot.position.distanceTo(target);
    const moving = distance > 0.05;
    let working = false;
    if (reduced.matches) robot.position.copy(target);
    else if (!props.paused && job) {
      // Walk at a steady pace between build sites; long queues hurry up.
      const step = dt * Math.min(9, 3.5 + buildQueue.length * 0.4);
      if (distance > step)
        robot.position.add(
          delta.subVectors(target, robot.position).setLength(step),
        );
      else {
        robot.position.copy(target);
        working = true;
        workTime += dt;
        // Pause long enough to read the reason before moving on.
        if (workTime > (job.reason ? 1.1 : 0.35)) {
          place(job, true);
          buildQueue.shift();
          buildDone += 1;
          workTime = 0;
          if (!buildQueue.length && job.reason) bubbleLinger = 1.8;
          reportBuild();
        }
      }
    } else if (!props.paused)
      robot.position.lerp(target, Math.min(1, dt * 1.8));
    if (!reduced.matches && !props.paused) {
      if (working)
        robot.rotation.y = Math.atan2(
          job!.object.x - robot.position.x,
          job!.object.z - robot.position.z,
        );
      else if (moving)
        robot.rotation.y = Math.atan2(
          target.x - robot.position.x,
          target.z - robot.position.z,
        );
      else robot.rotation.y += (0.3 - robot.rotation.y) * dt * 2;
      const t = time / 1000;
      legs.forEach((leg, i) => {
        leg.rotation.x = moving ? Math.sin(t * 9 + i * Math.PI) * 0.3 : 0;
      });
      arms.forEach((arm, i) => {
        arm.rotation.x = working
          ? -1.1 + Math.sin(t * 14 + i * Math.PI) * 0.35
          : props.busy
            ? -0.6 + Math.sin(t * 3 + i) * 0.15
            : moving
              ? Math.sin(t * 9 + i * Math.PI) * -0.22
              : 0;
      });
      head.position.y = 1.4 + Math.sin(t * 2) * 0.012;
      body.position.y = 0.88 + Math.sin(t * 2) * 0.007;
    }
    playDay(dt);
    const speaking = buildQueue[0]?.reason;
    if (speaking) speak(speaking);
    else if (bubbleLinger > 0) bubbleLinger -= dt;
    else speak("");
    placeBubble();
    for (const object of objects.children)
      if (object.userData.targetScale) {
        const next =
          reduced.matches || props.paused
            ? object.userData.targetScale
            : THREE.MathUtils.lerp(
                object.scale.x,
                object.userData.targetScale,
                Math.min(1, dt * 9),
              );
        object.scale.setScalar(next);
        if (Math.abs(next - object.userData.targetScale) < 0.001) {
          object.scale.setScalar(object.userData.targetScale);
          delete object.userData.targetScale;
        }
      }
    renderer.render(scene, camera);
  }
  sync(initial);
  frame = requestAnimationFrame(render);
  return {
    sync,
    setView,
    dispose() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      controls.dispose();
      host.removeEventListener("pointerdown", grab, { capture: true });
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", click);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerEnd);
      renderer.domElement.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      renderer.domElement.removeEventListener("blur", blur);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      [objects, overlay, dragOverlay, crowd, room, robot].forEach(disposeGroup);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      bubble.remove();
    },
  };
}
export default function Viewport(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null),
    latest = useRef(props);
  const [error, setError] = useState(false);
  latest.current = props;
  useEffect(() => {
    if (!host.current) return;
    try {
      engine.current = createEngine(host.current, latest.current, () =>
        setError(true),
      );
    } catch {
      setError(true);
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.sync(props);
  }, [
    props.world,
    props.selectedId,
    props.preview,
    props.busy,
    props.paused,
    props.issueIds,
    props.day,
  ]);
  useEffect(() => {
    engine.current?.setView(props.view);
  }, [props.view]);
  return (
    <div className="ws-render-host" ref={host}>
      {error && (
        <div className="ws-canvas-error" role="alert">
          <strong>3D rendering is unavailable.</strong>
          <p>
            Enable WebGL or try another browser. Your scene is still editable
            using the object list and inspector, and can be exported.
          </p>
          <button onClick={() => location.reload()}>Reload studio</button>
        </div>
      )}
    </div>
  );
}

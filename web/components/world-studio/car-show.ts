// Two live "shows" for the car viewport, kept out of the main viewport file:
// 1. Assembly: the avatar builds the active car subsystem by subsystem and
//    says what each piece is, using lines generated from the design's numbers.
// 2. Test drive: the active car drives an oval route (city, highway, climb,
//    descent, garage) while its battery drains per the precomputed trip.
import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { CarConfig, CarDocument } from "@/lib/studio/car";
import { createEVAssembly } from "@/lib/studio/ev-model";
import { assemblySteps } from "@/lib/studio/car-assembly";
import {
  GARAGE,
  TRIP,
  TRIP_KM,
  batteryAt,
  legAt,
  type DriveResult,
} from "@/lib/studio/test-drive";
import { disposeCarGroup } from "@/lib/studio/car-model";

export type DriveTick = {
  km: number;
  battery: number;
  leg: string;
  done: boolean;
};
export type ShowProps = {
  car: CarConfig | null;
  bays: CarDocument["bays"];
  activeBayId: string | null;
  assemblyMode: string;
  paused: boolean;
  /** Increment to play the assembly of the active car. */
  assembleKey?: number;
  /** A new object starts a test drive; null ends it. */
  drive?: DriveResult | null;
  onDriveTick?: (tick: DriveTick) => void;
  onAssembling?: (line: string | null) => void;
};
type Env = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  carRoot: THREE.Group;
  avatar: THREE.Group;
  arm: THREE.Group;
  host: HTMLElement;
  renderer: THREE.WebGLRenderer;
  reduced: MediaQueryList;
};

const RX = 16,
  RZ = 10,
  CLIMB_HEIGHT = 2.2,
  DRIVE_SECONDS = 26,
  FINISH = 0.93, // fraction of the loop where the trip ends
  GATE = 0.965; // garage gate position on the loop
const LEG_COLORS: Record<string, string> = {
  city: "#9aa0a3",
  highway: "#5f676b",
  climb: "#9b7b5a",
  descent: "#9b8a6a",
};

export function createCarShow(env: Env) {
  const { scene, camera, controls, carRoot, avatar, arm, host } = env;
  let props: ShowProps | null = null;
  const bubble = document.createElement("div");
  bubble.className = "ws-bubble";
  bubble.setAttribute("aria-hidden", "true");
  host.appendChild(bubble);
  const anchor = new THREE.Vector3(),
    projected = new THREE.Vector3();
  let bubbleTarget: THREE.Object3D | null = null,
    bubbleHeight = 2;
  function say(text: string, target: THREE.Object3D | null, height = 2) {
    bubble.textContent = text;
    bubble.classList.toggle("is-visible", Boolean(text));
    bubbleTarget = text ? target : null;
    bubbleHeight = height;
  }
  function placeBubble() {
    if (!bubbleTarget) return;
    bubbleTarget.getWorldPosition(anchor);
    projected
      .copy(anchor)
      .setY(anchor.y + bubbleHeight)
      .project(camera);
    const rect = env.renderer.domElement.getBoundingClientRect();
    // Keep the bubble below the stage toolbar so its text is never covered.
    const toolbar = document
      .querySelector(".car-assembly-toolbar")
      ?.getBoundingClientRect();
    const minBottom =
      (toolbar ? toolbar.bottom - rect.top + 10 : 0) + bubble.offsetHeight;
    const x = Math.min(
      Math.max(
        ((projected.x + 1) / 2) * rect.width,
        bubble.offsetWidth / 2 + 8,
      ),
      rect.width - bubble.offsetWidth / 2 - 8,
    );
    const y = Math.max(((1 - projected.y) / 2) * rect.height, minBottom);
    bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    bubble.style.visibility = projected.z > 1 ? "hidden" : "";
  }
  function activeGroup(): THREE.Group | undefined {
    if (!props) return;
    return (carRoot.children as THREE.Group[]).find(
      (g) =>
        g.userData.bayId === props!.activeBayId ||
        (!props!.bays.length && g.userData.bayId === "initial"),
    );
  }
  function bayOrigin() {
    const bay = props?.bays.find((b) => b.id === props?.activeBayId);
    return new THREE.Vector3(bay?.x || 0, 0, bay?.z || 0);
  }

  // ----- Assembly -----
  type Stage = { objects: THREE.Object3D[]; line: string; at: THREE.Vector3 };
  let stages: Stage[] = [],
    stageIndex = -1,
    stageTime = 0,
    temporary: THREE.Object3D | null = null,
    lastAssembleKey = 0;
  const dropping: { object: THREE.Object3D; y: number }[] = [];
  function endAssembly() {
    for (const s of stages.slice(Math.max(stageIndex, 0)))
      s.objects.forEach((o) => (o.visible = true));
    for (const d of dropping) d.object.position.y = d.y;
    dropping.length = 0;
    if (temporary) {
      temporary.removeFromParent();
      disposeCarGroup(temporary as THREE.Group);
      temporary = null;
    }
    stages = [];
    stageIndex = -1;
    const o = bayOrigin();
    avatar.position.set(o.x - 3.4, 0, o.z + 2);
    avatar.rotation.y = 0.65;
    say("", null);
    props?.onAssembling?.(null);
  }
  function startAssembly() {
    endAssembly();
    const group = activeGroup(),
      car = props?.car;
    if (!group || !car) return;
    // The EV internals are only drawn in chassis/exploded views; add a
    // temporary copy so they can be built even when the body view is active.
    let internals = group.children.find((c) => c.getObjectByName("Chassis"));
    if (!internals) {
      internals = createEVAssembly(car, "chassis");
      temporary = internals;
      group.add(internals);
    }
    const shell = group.children.find((c) =>
      c.children.some((k) => k.userData.subsystem === "wheels"),
    );
    const parts = new Map<string, THREE.Object3D>();
    group.traverse((o) => {
      if (o.userData.generatedPartId) parts.set(o.userData.generatedPartId, o);
    });
    group.updateMatrixWorld(true);
    const half = car.length / 2,
      side = car.width / 2 + 0.85;
    const steps = assemblySteps(car);
    stages = steps
      .map((step, i) => {
        let objects: THREE.Object3D[] = [];
        if (step.key === "wheels")
          objects = shell
            ? shell.children.filter((k) => k.userData.subsystem === "wheels")
            : [];
        else if (step.key === "body")
          objects = shell
            ? shell.children.filter(
                (k) => k.userData.subsystem !== "wheels" && k.visible,
              )
            : [];
        else if (step.key.startsWith("part:")) {
          const part = parts.get(step.key.slice(5));
          if (part?.visible) objects = [part];
        } else {
          const g = internals!.getObjectByName(step.key);
          if (g) objects = [g];
        }
        const x = -half + (car.length * (i + 0.5)) / steps.length;
        const at = new THREE.Vector3(x, 0, i % 2 ? -side : side).applyMatrix4(
          group.matrixWorld,
        );
        return { objects, line: step.line, at };
      })
      .filter((s) => s.objects.length);
    if (!stages.length || env.reduced.matches) return endAssembly();
    for (const s of stages) s.objects.forEach((o) => (o.visible = false));
    stageIndex = 0;
    stageTime = 0;
    props?.onAssembling?.(stages[0].line);
  }
  function updateAssembly(dt: number, time: number) {
    for (let k = dropping.length - 1; k >= 0; k--) {
      const d = dropping[k];
      d.object.position.y += (d.y - d.object.position.y) * Math.min(1, dt * 7);
      if (Math.abs(d.object.position.y - d.y) < 0.002) {
        d.object.position.y = d.y;
        dropping.splice(k, 1);
      }
    }
    if (stageIndex < 0) return;
    const stage = stages[stageIndex];
    if (!stage) {
      // Linger on the last line briefly, then hand the scene back.
      stageTime += dt;
      if (stageTime > 1.6) endAssembly();
      return;
    }
    const to = stage.at,
      gap = avatar.position.distanceTo(to);
    if (gap > 0.05) {
      const step = Math.min(gap, dt * 4.5);
      avatar.position.add(to.clone().sub(avatar.position).setLength(step));
      avatar.rotation.y = Math.atan2(
        to.x - avatar.position.x,
        to.z - avatar.position.z,
      );
      return;
    }
    const center = new THREE.Vector3();
    activeGroup()?.getWorldPosition(center);
    avatar.rotation.y = Math.atan2(
      center.x - avatar.position.x,
      center.z - avatar.position.z,
    );
    if (stageTime === 0) {
      for (const o of stage.objects) {
        o.visible = true;
        dropping.push({ object: o, y: o.position.y });
        o.position.y += 0.9;
      }
      say(stage.line, avatar, 1.95);
      props?.onAssembling?.(stage.line);
    }
    arm.rotation.x = -1.1 + Math.sin(time / 90) * 0.3;
    stageTime += dt;
    if (stageTime > 1.9) {
      stageIndex += 1;
      stageTime = stages[stageIndex] ? 0 : 0.0001;
    }
  }

  // ----- Test drive -----
  let drive: DriveResult | null = null,
    driveClock = 0,
    driveDone = false,
    lastTick = "";
  const track = new THREE.Group();
  scene.add(track);
  let gateBeam: THREE.Mesh | null = null;
  const saved = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const loopPoint = (s: number, origin: THREE.Vector3) => {
    const a = s * Math.PI * 2;
    return new THREE.Vector3(
      origin.x + Math.cos(a) * RX,
      heightAt(s),
      origin.z + Math.sin(a) * RZ,
    );
  };
  // Fractions of the loop where each leg starts and ends.
  const legSpan = (id: string) => {
    let start = 0;
    for (const leg of TRIP) {
      const span = (leg.km / TRIP_KM) * FINISH;
      if (leg.id === id) return [start, start + span];
      start += span;
    }
    return [0, 0];
  };
  function heightAt(s: number) {
    const [c0, c1] = legSpan("climb"),
      [d0, d1] = legSpan("descent");
    if (s >= c0 && s <= c1)
      return (
        CLIMB_HEIGHT * (0.5 - 0.5 * Math.cos(((s - c0) / (c1 - c0)) * Math.PI))
      );
    if (s > d0 && s <= d1)
      return (
        CLIMB_HEIGHT * (0.5 + 0.5 * Math.cos(((s - d0) / (d1 - d0)) * Math.PI))
      );
    return 0;
  }
  function buildTrack() {
    disposeCarGroup(track);
    const origin = bayOrigin();
    const N = 240,
      width = 3.2;
    const material = (color: string) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    for (let k = 0; k < N; k++) {
      const s0 = k / N,
        s1 = (k + 1) / N;
      const p0 = loopPoint(s0, origin),
        p1 = loopPoint(s1, origin);
      const dir = p1.clone().sub(p0),
        length = dir.length();
      const km = (s0 / FINISH) * TRIP_KM;
      const color = s0 > FINISH ? "#c9b48f" : LEG_COLORS[legAt(km).id];
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(length + 0.05, 0.05, width),
        material(color),
      );
      slab.position.copy(p0.clone().add(p1).multiplyScalar(0.5));
      slab.position.y += 0.01;
      slab.rotation.order = "YZX";
      slab.rotation.y = Math.atan2(-dir.z, dir.x);
      slab.rotation.z = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
      slab.receiveShadow = true;
      track.add(slab);
    }
    // Garage gate: two posts and a beam at the clearance height.
    const g = loopPoint(GATE, origin),
      g2 = loopPoint(GATE + 0.004, origin);
    const across = new THREE.Vector3(-(g2.z - g.z), 0, g2.x - g.x).normalize();
    const post = material("#3a4246");
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, GARAGE.heightM + 0.4, 0.18),
        post,
      );
      p.position
        .copy(g)
        .addScaledVector(across, (side * GARAGE.widthM) / 2 + side * 0.09);
      p.position.y = (GARAGE.heightM + 0.4) / 2;
      track.add(p);
    }
    gateBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, GARAGE.widthM + 0.36),
      material("#ffb21f"),
    );
    gateBeam.position.copy(g);
    gateBeam.position.y = GARAGE.heightM + 0.08;
    gateBeam.rotation.y = Math.atan2(across.x, across.z);
    track.add(gateBeam);
  }
  function startDrive(next: DriveResult | null) {
    const wasDriving = Boolean(drive);
    drive = next;
    driveClock = 0;
    driveDone = false;
    lastTick = "";
    const group = activeGroup(),
      origin = bayOrigin();
    if (!next) {
      disposeCarGroup(track);
      gateBeam = null;
      if (group) {
        group.position.copy(origin);
        group.rotation.set(0, 0, 0);
      }
      if (wasDriving) {
        camera.position.copy(saved.position);
        controls.target.copy(saved.target);
      }
      say("", null);
      return;
    }
    endAssembly();
    if (!wasDriving) {
      saved.position.copy(camera.position);
      saved.target.copy(controls.target);
    }
    buildTrack();
    camera.position.set(origin.x + 6, 26, origin.z + 30);
    controls.target.copy(origin);
    if (env.reduced.matches) driveClock = DRIVE_SECONDS;
  }
  function updateDrive(dt: number) {
    if (!drive || !props) return;
    const group = activeGroup();
    if (!group) return;
    if (!props.paused && !driveDone) driveClock += dt;
    const finishKm = drive.reachedKm;
    const km = Math.min((driveClock / DRIVE_SECONDS) * TRIP_KM, finishKm);
    let s = (km / TRIP_KM) * FINISH;
    // After a complete trip, roll on to (or into) the garage gate.
    if (drive.arrived && km >= TRIP_KM) {
      const extra = driveClock - DRIVE_SECONDS;
      const stopAt = drive.parked ? GATE + 0.02 : GATE - 0.012;
      s = Math.min(FINISH + Math.max(0, extra) * 0.02, stopAt);
      if (s >= stopAt) driveDone = true;
    } else if (km >= finishKm) driveDone = true;
    const origin = bayOrigin();
    const p = loopPoint(s, origin),
      ahead = loopPoint(s + 0.002, origin);
    group.position.copy(p);
    group.rotation.order = "YZX";
    group.rotation.y = Math.atan2(-(ahead.z - p.z), ahead.x - p.x);
    group.rotation.z = Math.atan2(
      ahead.y - p.y,
      Math.hypot(ahead.x - p.x, ahead.z - p.z),
    );
    controls.target.lerp(p, Math.min(1, dt * 1.5));
    if (gateBeam && driveDone && drive.arrived && !drive.parked)
      (gateBeam.material as THREE.MeshStandardMaterial).color.set("#d2392b");
    const battery = batteryAt(drive, km);
    const leg = km >= TRIP_KM ? "Garage" : legAt(km).name;
    say(`${Math.round(battery * 100)}% · ${leg}`, group, 2.2);
    const tick = `${Math.round(km)}|${Math.round(battery * 100)}|${leg}|${driveDone}`;
    if (tick !== lastTick) {
      lastTick = tick;
      props.onDriveTick?.({ km, battery, leg, done: driveDone });
    }
  }

  return {
    /** Call after the viewport has rebuilt the scene for these props. */
    sync(next: ShowProps, rebuilt: boolean) {
      const previous = props;
      props = next;
      if (rebuilt && stageIndex >= 0) endAssembly();
      if (next.drive !== previous?.drive) startDrive(next.drive || null);
      else if (rebuilt && drive) buildTrack();
      if ((next.assembleKey || 0) !== lastAssembleKey) {
        lastAssembleKey = next.assembleKey || 0;
        if (lastAssembleKey && !drive) startAssembly();
      }
    },
    /** True while a show controls the avatar. */
    update(dt: number, time: number) {
      updateAssembly(dt, time);
      updateDrive(dt);
      placeBubble();
      return stageIndex >= 0;
    },
    dispose() {
      endAssembly();
      disposeCarGroup(track);
      track.removeFromParent();
      bubble.remove();
    },
  };
}

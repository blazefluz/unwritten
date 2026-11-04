import * as THREE from "three";
import type { CarConfig } from "./car";
import { MODULE, packEnvelope } from "./ev";
export type AssemblyMode = "body" | "chassis" | "exploded";
export function createEVAssembly(
  car: CarConfig,
  mode: AssemblyMode,
  selected: string | null = null,
) {
  const root = new THREE.Group(),
    ev = car.ev,
    pack = packEnvelope(ev),
    split = mode === "exploded";
  const metal = new THREE.MeshStandardMaterial({
    color: "#8c9b9d",
    metalness: 0.75,
    roughness: 0.35,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#303b40",
    metalness: 0.4,
    roughness: 0.5,
  });
  const battery = new THREE.MeshStandardMaterial({
    color: "#617f87",
    metalness: 0.5,
    roughness: 0.4,
  });
  const copper = new THREE.MeshStandardMaterial({
    color: "#c7783d",
    metalness: 0.75,
    roughness: 0.35,
  });
  const blue = new THREE.MeshStandardMaterial({
    color: "#4d9cbd",
    metalness: 0.2,
    roughness: 0.45,
  });
  const orange = new THREE.MeshStandardMaterial({
    color: "#e87932",
    roughness: 0.45,
  });
  function subsystem(name: string, offset = 0) {
    const g = new THREE.Group();
    g.name = name;
    g.position.y = offset;
    root.add(g);
    return g;
  }
  const chassis = subsystem("Chassis"),
    batteries = subsystem("Battery modules", split ? 0.7 : 0),
    motors = subsystem("Drive units", split ? 0.25 : 0),
    cooling = subsystem("Cooling loop", split ? 1.3 : 0),
    electronics = subsystem("Power electronics", split ? 0.8 : 0);
  function box(
    g: THREE.Group,
    size: [number, number, number],
    pos: [number, number, number],
    mat: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  }
  function cyl(
    g: THREE.Group,
    r: number,
    length: number,
    pos: [number, number, number],
    mat: THREE.Material,
  ) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, length, 32), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(...pos);
    m.castShadow = true;
    g.add(m);
    return m;
  }
  function tube(
    g: THREE.Group,
    points: [number, number, number][],
    mat: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        24,
        0.018,
        8,
        false,
      ),
      mat,
    );
    g.add(mesh);
    return mesh;
  }
  for (const z of [-car.width / 2 + 0.22, car.width / 2 - 0.22])
    box(chassis, [car.wheelbase + 0.4, 0.12, 0.09], [0, 0.26, z], dark);
  for (const x of [-car.wheelbase / 2, 0, car.wheelbase / 2])
    box(chassis, [0.1, 0.1, car.width - 0.35], [x, 0.27, 0], metal);
  box(batteries, [pack.length, 0.04, pack.width], [0, 0.23, 0], metal);
  for (let i = 0; i < ev.moduleCount; i++) {
    const row = Math.floor(i / ev.batteryColumns),
      col = i % ev.batteryColumns;
    const x = (row - (pack.rows - 1) / 2) * (MODULE.length + MODULE.gap),
      z = (col - (ev.batteryColumns - 1) / 2) * (MODULE.width + MODULE.gap);
    const module = box(
      batteries,
      [MODULE.length, MODULE.height, MODULE.width],
      [x, 0.325, z],
      battery,
    );
    module.userData.partId = `module-${i + 1}`;
    for (const offset of [-0.09, 0.09])
      box(batteries, [0.04, 0.025, 0.05], [x + offset, 0.41, z + 0.12], copper);
  }
  const axleXs =
    ev.motorCount === 2
      ? [-car.wheelbase / 2, car.wheelbase / 2]
      : [-car.wheelbase / 2];
  for (const x of axleXs) {
    const motor = new THREE.Group();
    motor.name = "Electric motor";
    motor.position.set(x, car.wheelRadius, 0);
    motors.add(motor);
    const housingMat = new THREE.MeshStandardMaterial({
      color: "#879a9c",
      metalness: 0.65,
      roughness: 0.3,
      transparent: split,
      opacity: split ? 0.25 : 1,
      depthWrite: !split,
    });
    cyl(motor, ev.motorDiameter / 2, ev.motorLength, [0, 0, 0], housingMat);
    const rotor = new THREE.Group();
    rotor.name = "Rotor";
    rotor.userData.rotor = true;
    rotor.position.z = split ? 0.65 : 0;
    motor.add(rotor);
    cyl(
      rotor,
      ev.motorDiameter * 0.23,
      ev.motorLength * 0.85,
      [0, 0, 0],
      metal,
    );
    cyl(rotor, 0.025, ev.motorLength + 0.18, [0, 0, 0], dark);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const winding = new THREE.Mesh(
        new THREE.TorusGeometry(ev.motorDiameter * 0.12, 0.015, 8, 16),
        copper,
      );
      winding.position.set(
        Math.cos(a) * ev.motorDiameter * 0.34,
        Math.sin(a) * ev.motorDiameter * 0.34,
        split ? -0.4 : 0,
      );
      winding.scale.z = ev.motorLength / 0.1;
      motor.add(winding);
    }
    box(
      motor,
      [ev.motorDiameter * 0.8, ev.motorDiameter * 0.8, 0.18],
      [0, 0, -ev.motorLength / 2 - 0.1],
      dark,
    );
    for (const side of [-1, 1])
      cyl(
        motors,
        0.025,
        (car.width - ev.motorLength) / 2,
        [
          x,
          car.wheelRadius,
          side * (ev.motorLength / 2 + (car.width - ev.motorLength) / 4),
        ],
        metal,
      );
    const inverter = box(
      electronics,
      [0.35, 0.16, 0.38],
      [x + 0.28, car.wheelRadius + 0.24, 0],
      metal,
    );
    inverter.name = "Inverter";
    for (let f = 0; f < 8; f++)
      box(
        electronics,
        [0.33, 0.035, 0.012],
        [x + 0.28, car.wheelRadius + 0.34, -0.16 + f * 0.045],
        dark,
      );
    tube(
      electronics,
      [
        [0, 0.42, pack.width / 2],
        [x + 0.4, 0.44, pack.width / 2],
        [x + 0.28, car.wheelRadius + 0.32, 0.2],
      ],
      orange,
    );
  }
  const radiatorX = car.length / 2 - 0.25;
  box(cooling, [0.09, 0.48, car.width * 0.55], [radiatorX, 0.58, 0], dark);
  for (let i = 0; i < 16; i++)
    box(
      cooling,
      [0.035, 0.44, 0.012],
      [
        radiatorX + 0.055,
        0.58,
        -car.width * 0.25 + i * ((car.width * 0.5) / 15),
      ],
      metal,
    );
  for (const side of [-1, 1])
    tube(
      cooling,
      [
        [radiatorX, 0.4, side * car.width * 0.22],
        [car.wheelbase / 2 - 0.2, 0.25, side * (pack.width / 2 + 0.07)],
        [-car.wheelbase / 2, 0.25, side * (pack.width / 2 + 0.07)],
        [-car.wheelbase / 2, car.wheelRadius, side * 0.1],
      ],
      blue,
    );
  box(cooling, [pack.length, 0.025, pack.width], [0, 0.205, 0], blue);
  if (selected) {
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        let parent: THREE.Object3D | null = child;
        let match = false;
        while (parent) {
          if (parent.name === selected) match = true;
          parent = parent.parent;
        }
        if (match) {
          child.material = (
            child.material as THREE.MeshStandardMaterial
          ).clone();
          (child.material as THREE.MeshStandardMaterial).emissive =
            new THREE.Color("#614119");
          (child.material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.25;
        }
      }
    });
  }
  return root;
}

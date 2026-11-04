"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createCarModel, disposeCarGroup } from "@/lib/studio/car-model";
import type { CarConfig, CarDocument } from "@/lib/studio/car";
import { createEVAssembly, type AssemblyMode } from "@/lib/studio/ev-model";
import { createGeneratedPart } from "@/lib/studio/part-model";
export type CarView = "perspective" | "side" | "front" | "top" | "world";
type Props = {
  car: CarConfig | null;
  bays: CarDocument["bays"];
  activeBayId: string | null;
  assemblyMode: AssemblyMode;
  selectedPart: string | null;
  runDrive: boolean;
  dimensions: boolean;
  view: CarView;
  busy: boolean;
  paused: boolean;
};
export default function CarViewport(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  const engine = useRef<{
    sync: (p: Props) => void;
    view: (v: CarView) => void;
    dispose: () => void;
  } | null>(null);
  const [error, setError] = useState(false);
  latest.current = props;
  useEffect(() => {
    if (!host.current) return;
    let dispose: (() => void) | undefined;
    try {
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute(
        "aria-label",
        "Concept car in a 3D design studio. Drag to orbit and scroll to zoom. Dimensions can be edited in the controls.",
      );
      renderer.domElement.tabIndex = 0;
      host.current.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#e9eae6");
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2000);
      camera.position.set(8, 5.4, 8);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0.6, 0);
      controls.enableDamping = true;
      controls.minDistance = 3;
      controls.maxDistance = 500;
      controls.maxPolarAngle = Math.PI / 2 - 0.02;
      controls.update();
      scene.add(new THREE.HemisphereLight("#fff9ed", "#68737c", 2.4));
      const sun = new THREE.DirectionalLight("#fff5e6", 4);
      sun.position.set(2, 9, 5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, {
        left: -7,
        right: 7,
        top: 7,
        bottom: -7,
      });
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias = -0.0004;
      scene.add(sun);
      scene.add(sun.target);
      const rim = new THREE.DirectionalLight("#bdd4f3", 2);
      rim.position.set(-5, 4, -4);
      scene.add(rim);
      const floor = new THREE.Group();
      scene.add(floor);
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1200, 1200),
        new THREE.MeshStandardMaterial({ color: "#dadcd5", roughness: 0.9 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.02;
      ground.receiveShadow = true;
      floor.add(ground);
      const grid = new THREE.GridHelper(200, 200, "#aab5a4", "#c0c8ba");
      grid.position.y = 0.002;
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.4;
      scene.add(grid);
      const carRoot = new THREE.Group(),
        dimensions = new THREE.Group();
      scene.add(carRoot, dimensions);
      const avatar = new THREE.Group();
      avatar.position.set(-3.4, 0, 2);
      avatar.rotation.y = 0.65;
      scene.add(avatar);
      const white = new THREE.MeshStandardMaterial({
          color: "#f4f0e8",
          roughness: 0.6,
        }),
        dark = new THREE.MeshStandardMaterial({ color: "#273c38" }),
        accent = new THREE.MeshStandardMaterial({ color: "#ff682b" });
      function cube(
        parent: THREE.Group,
        sx: number,
        sy: number,
        sz: number,
        x: number,
        y: number,
        z: number,
        material: THREE.Material,
      ) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(sx, sy, sz),
          material,
        );
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        parent.add(mesh);
        return mesh;
      }
      cube(avatar, 0.4, 0.5, 0.3, 0, 0.85, 0, white);
      const head = cube(avatar, 0.5, 0.36, 0.36, 0, 1.33, 0, white);
      cube(avatar, 0.4, 0.21, 0.025, 0, 1.33, 0.195, dark);
      const eye = new THREE.MeshStandardMaterial({
        color: "#c6efd6",
        emissive: "#8fd3ad",
        emissiveIntensity: 0.7,
      });
      for (const x of [-0.09, 0.09])
        cube(avatar, 0.055, 0.055, 0.02, x, 1.35, 0.215, eye);
      cube(avatar, 0.14, 0.055, 0.02, 0, 0.92, 0.16, accent);
      cube(avatar, 0.025, 0.15, 0.025, 0, 1.58, 0, dark);
      cube(avatar, 0.065, 0.065, 0.065, 0, 1.68, 0, accent);
      for (const x of [-0.12, 0.12]) {
        cube(avatar, 0.12, 0.36, 0.14, x, 0.4, 0, dark);
        cube(avatar, 0.17, 0.12, 0.25, x, 0.16, 0.04, white);
      }
      const arm = new THREE.Group();
      arm.position.set(0.29, 1, 0);
      avatar.add(arm);
      cube(arm, 0.12, 0.4, 0.13, 0, -0.13, 0, white);
      cube(avatar, 0.12, 0.4, 0.13, -0.29, 0.84, 0, white);
      function label(text: string, position: THREE.Vector3) {
        const canvas = document.createElement("canvas");
        canvas.width = 384;
        canvas.height = 80;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#f5f6f1";
        ctx.fillRect(0, 0, 384, 80);
        ctx.font = "500 30px Helvetica, Arial, sans-serif";
        ctx.fillStyle = "#3c4934";
        ctx.textAlign = "center";
        ctx.fillText(text, 192, 51);
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(canvas),
            depthTest: false,
          }),
        );
        sprite.position.copy(position);
        sprite.scale.set(1.65, 0.34, 1);
        dimensions.add(sprite);
      }
      function dimension(
        a: THREE.Vector3,
        b: THREE.Vector3,
        text: string,
        offset: THREE.Vector3,
      ) {
        const points = [a, b];
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: "#697a5d" }),
        );
        dimensions.add(line);
        for (const p of points) {
          const axis =
            Math.abs(b.x - a.x) > 0.1
              ? new THREE.Vector3(0, 0, 0.09)
              : new THREE.Vector3(0.09, 0, 0);
          dimensions.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([
                p.clone().sub(axis),
                p.clone().add(axis),
              ]),
              new THREE.LineBasicMaterial({ color: "#697a5d" }),
            ),
          );
        }
        label(text, a.clone().add(b).multiplyScalar(0.5).add(offset));
      }
      let current = latest.current,
        previousCar = "",
        showDimensions = false;
      function sync(next: Props) {
        const changedBay = current.activeBayId !== next.activeBayId;
        current = next;
        const active = next.bays.find((b) => b.id === next.activeBayId);
        const ax = active?.x || 0,
          az = active?.z || 0;
        const key = JSON.stringify([
          next.car,
          next.bays,
          next.assemblyMode,
          next.selectedPart,
        ]);
        if (key !== previousCar) {
          disposeCarGroup(carRoot);
          const bays = next.bays.length
            ? next.bays
            : [
                {
                  id: "initial",
                  name: "Design bay",
                  x: 0,
                  z: 0,
                  car: next.car,
                },
              ];
          for (const bay of bays) {
            const isActive = bay.id === next.activeBayId || !next.bays.length;
            const c = isActive ? next.car : bay.car;
            const group = new THREE.Group();
            group.position.set(bay.x, 0, bay.z);
            group.userData.bayId = bay.id;
            carRoot.add(group);
            const bayLine = new THREE.LineSegments(
              new THREE.EdgesGeometry(new THREE.BoxGeometry(8, 0.01, 8)),
              new THREE.LineBasicMaterial({
                color: isActive ? "#b66f43" : "#a8b19e",
              }),
            );
            bayLine.position.y = 0.006;
            group.add(bayLine);
            if (!c) continue;
            const mode = isActive ? next.assemblyMode : "body";
            const shell = createCarModel(c);
            for (const child of shell.children)
              if (child.userData.subsystem !== "wheels") {
                if (mode === "chassis" || c.shellMode === "generated")
                  child.visible = false;
                else if (mode === "exploded") child.position.y += 1.7;
              }
            group.add(shell);
            if (mode !== "body")
              group.add(
                createEVAssembly(c, mode, isActive ? next.selectedPart : null),
              );
            for (const part of c.parts) {
              const mesh = createGeneratedPart(part);
              if (mode === "chassis" && part.group === "body")
                mesh.visible = false;
              if (mode === "exploded" && part.group === "body")
                mesh.position.y += 1.7;
              if (part.id === next.selectedPart && isActive)
                (mesh.material as THREE.MeshStandardMaterial).emissive.set(
                  "#6f421b",
                );
              group.add(mesh);
            }
          }
          previousCar = key;
        }
        dimensions.position.set(ax, 0, az);
        avatar.position.set(ax - 3.4, 0, az + 2);
        sun.position.set(ax + 2, 9, az + 5);
        sun.target.position.set(ax, 0, az);
        if (changedBay) view(next.view);
        if (
          key !== dimensions.userData.car ||
          showDimensions !== next.dimensions
        ) {
          disposeCarGroup(dimensions);
          dimensions.userData.car = key;
          showDimensions = next.dimensions;
          if (next.car && next.dimensions) {
            const c = next.car;
            dimension(
              new THREE.Vector3(-c.length / 2, 0.04, c.width / 2 + 0.5),
              new THREE.Vector3(c.length / 2, 0.04, c.width / 2 + 0.5),
              `${c.length.toFixed(2)} m length`,
              new THREE.Vector3(0, 0.1, 0.25),
            );
            dimension(
              new THREE.Vector3(c.length / 2 + 0.5, 0.04, -c.width / 2),
              new THREE.Vector3(c.length / 2 + 0.5, 0.04, c.width / 2),
              `${c.width.toFixed(2)} m width`,
              new THREE.Vector3(0.1, 0.25, 0),
            );
            dimension(
              new THREE.Vector3(-c.length / 2 - 0.35, 0.04, -c.width / 2),
              new THREE.Vector3(-c.length / 2 - 0.35, c.height, -c.width / 2),
              `${c.height.toFixed(2)} m height`,
              new THREE.Vector3(0, 0.15, 0),
            );
          }
        }
      }
      function view(value: CarView) {
        const active = current.bays.find((b) => b.id === current.activeBayId);
        const x = active?.x || 0,
          z = active?.z || 0;
        controls.maxPolarAngle = Math.PI / 2 - 0.02;
        if (value === "world") {
          const bays = current.bays;
          const maxX = Math.max(0, ...bays.map((b) => b.x)),
            maxZ = Math.max(0, ...bays.map((b) => b.z));
          controls.target.set(maxX / 2, 0, maxZ / 2);
          camera.position.set(
            maxX / 2 + Math.max(18, maxX * 0.8),
            Math.max(22, maxX, maxZ),
            maxZ / 2 + Math.max(18, maxZ * 0.8),
          );
        } else {
          controls.target.set(
            x,
            current.assemblyMode === "exploded" ? 1.2 : 0.6,
            z,
          );
          if (value === "side") camera.position.set(x, 1.1, z + 10);
          else if (value === "front") camera.position.set(x + 10, 1.1, z);
          else if (value === "top") {
            camera.position.set(x, 13, z + 0.01);
            controls.maxPolarAngle = 0.02;
          } else camera.position.set(x + 8, 6, z + 8);
        }
        controls.update();
      }
      const resize = new ResizeObserver(() => {
        if (!host.current) return;
        const { width, height } = host.current.getBoundingClientRect();
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      });
      resize.observe(host.current);
      let visible = true,
        frame = 0;
      const visibility = new IntersectionObserver((e) => {
        visible = e[0].isIntersecting;
      });
      visibility.observe(host.current);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      const lost = (e: Event) => {
        e.preventDefault();
        setError(true);
      };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      function render(time: number) {
        frame = requestAnimationFrame(render);
        if (!visible || document.hidden) return;
        controls.update();
        if (!reduced.matches && !current.paused) {
          head.position.y = 1.33 + Math.sin(time / 600) * 0.01;
          arm.rotation.x = current.busy
            ? -0.8 + Math.sin(time / 400) * 0.15
            : 0;
        }
        if (current.runDrive && !current.paused && !reduced.matches)
          carRoot.traverse((child) => {
            if (child.userData.rotor) child.rotation.z = time * 0.002;
          });
        grid.position.x = Math.round(controls.target.x / 20) * 20;
        grid.position.z = Math.round(controls.target.z / 20) * 20;
        ground.position.x = controls.target.x;
        ground.position.z = controls.target.z;
        renderer.render(scene, camera);
      }
      sync(latest.current);
      view(latest.current.view);
      frame = requestAnimationFrame(render);
      dispose = () => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        visibility.disconnect();
        controls.dispose();
        [carRoot, dimensions, avatar, floor].forEach(disposeCarGroup);
        grid.geometry.dispose();
        (grid.material as THREE.Material).dispose();
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        renderer.dispose();
        renderer.domElement.remove();
      };
      engine.current = { sync, view, dispose };
    } catch {
      dispose?.();
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
    props.car,
    props.bays,
    props.activeBayId,
    props.assemblyMode,
    props.selectedPart,
    props.dimensions,
    props.busy,
    props.paused,
    props.runDrive,
  ]);
  useEffect(() => {
    engine.current?.view(props.view);
  }, [props.view]);
  return (
    <div ref={host} className="ws-render-host">
      {error && (
        <div className="ws-canvas-error" role="alert">
          <strong>3D rendering is unavailable.</strong>
          <p>
            Enable WebGL or use another browser. The dimension controls and JSON
            export remain available.
          </p>
          <button onClick={() => location.reload()}>Reload studio</button>
        </div>
      )}
    </div>
  );
}

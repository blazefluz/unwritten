// A day of simulated shoppers in the market. Deterministic for a given scene
// and seed: shoppers path around furniture footprints on a floor grid, browse
// merchandise, buy, pay at a reachable counter and leave. This measures floor
// access in the layout; it is not a model of real customer behaviour.
import {
  CATALOG,
  ROOM,
  footprint,
  type SceneObject,
  type World,
} from "./scene";

export const CELL = 0.25;
const NX = Math.round(ROOM.width / CELL);
const NZ = Math.round(ROOM.depth / CELL);
const CLEARANCE = 0.22; // half a shopper's shoulder width, in metres
export const ENTRANCE = { x: 0, z: ROOM.depth / 2 - 0.15 };
export const WALK_SPEED = 1.3; // metres per simulated second
const MERCHANDISE = new Set<SceneObject["kind"]>(["shelf", "crate", "table"]);

export type Keyframe = { t: number; x: number; z: number; note?: string };
export type ShopperPlan = {
  id: number;
  color: string;
  keyframes: Keyframe[];
  /** Simulated second at which the purchase is paid for, if any. */
  paidAt: number | null;
  /** Simulated second at which the shopper picks an item up. */
  pickedAt: number | null;
  outcome: "bought" | "browsed" | "no-checkout" | "gave-up";
  blocked: string[];
};
export type DayResult = {
  shoppers: ShopperPlan[];
  duration: number;
  stats: {
    visitors: number;
    bought: number;
    browsedOnly: number;
    noCheckout: number;
    gaveUp: number;
    averageWalk: number;
    blocked: { label: string; count: number }[];
    neverVisited: string[];
    busiest: string | null;
    hasCounter: boolean;
    merchandise: number;
  };
};

type Cell = number; // index = i + j * NX
const cellX = (i: number) => -ROOM.width / 2 + (i + 0.5) * CELL;
const cellZ = (j: number) => -ROOM.depth / 2 + (j + 0.5) * CELL;
function cellAt(x: number, z: number): Cell {
  const i = Math.min(
    NX - 1,
    Math.max(0, Math.floor((x + ROOM.width / 2) / CELL)),
  );
  const j = Math.min(
    NZ - 1,
    Math.max(0, Math.floor((z + ROOM.depth / 2) / CELL)),
  );
  return i + j * NX;
}
function rectDistance(o: SceneObject, x: number, z: number) {
  const f = footprint(o);
  const dx = Math.max(Math.abs(x - o.x) - f.w / 2, 0);
  const dz = Math.max(Math.abs(z - o.z) - f.d / 2, 0);
  return Math.hypot(dx, dz);
}

/** Cells a shopper can stand in: clear of walls and of non-rug footprints. */
export function walkableGrid(world: World): Uint8Array {
  const free = new Uint8Array(NX * NZ);
  const solid = world.objects.filter((o) => o.kind !== "rug");
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const x = cellX(i),
        z = cellZ(j);
      const nearWall =
        Math.abs(x) > ROOM.width / 2 - CLEARANCE ||
        z < -ROOM.depth / 2 + CLEARANCE;
      if (nearWall) continue;
      if (solid.some((o) => rectDistance(o, x, z) < CLEARANCE)) continue;
      free[i + j * NX] = 1;
    }
  return free;
}

function neighbours(c: Cell, free: Uint8Array) {
  const i = c % NX,
    j = (c - i) / NX;
  const out: [Cell, number][] = [];
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di,
        nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = ni + nj * NX;
      if (!free[n]) continue;
      // No squeezing diagonally between two blocked cells.
      if (di && dj && (!free[i + di + j * NX] || !free[i + (j + dj) * NX]))
        continue;
      out.push([n, di && dj ? Math.SQRT2 : 1]);
    }
  return out;
}

/** Shortest walking distances (in cells) from one cell to every other. */
function distanceField(start: Cell, free: Uint8Array) {
  const dist = new Float64Array(NX * NZ).fill(Infinity);
  const from = new Int32Array(NX * NZ).fill(-1);
  if (!free[start]) return { dist, from };
  dist[start] = 0;
  // Grid is small (48 × 40): a simple binary heap keeps this fast.
  const heap: [number, Cell][] = [[0, start]];
  const push = (item: [number, Cell]) => {
    heap.push(item);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1,
          r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, c] = pop();
    if (d > dist[c]) continue;
    for (const [n, w] of neighbours(c, free))
      if (d + w < dist[n]) {
        dist[n] = d + w;
        from[n] = c;
        push([d + w, n]);
      }
  }
  return { dist, from };
}

/** Walkable path between two points, simplified to its turning points. */
export function findPath(
  world: World,
  a: { x: number; z: number },
  b: { x: number; z: number },
  free = walkableGrid(world),
): { x: number; z: number }[] | null {
  const start = cellAt(a.x, a.z),
    goal = cellAt(b.x, b.z);
  const { dist, from } = distanceField(goal, free);
  if (!Number.isFinite(dist[start])) return null;
  const cells: Cell[] = [start];
  while (cells[cells.length - 1] !== goal)
    cells.push(from[cells[cells.length - 1]]);
  const points = cells.map((c) => ({
    x: cellX(c % NX),
    z: cellZ(Math.floor(c / NX)),
  }));
  return points.filter((p, k) => {
    if (k === 0 || k === points.length - 1) return true;
    const prev = points[k - 1],
      next = points[k + 1];
    return (
      Math.sign(p.x - prev.x) !== Math.sign(next.x - p.x) ||
      Math.sign(p.z - prev.z) !== Math.sign(next.z - p.z)
    );
  });
}

/** Where a shopper stands to use an object, if they can get there at all. */
function accessPoint(
  o: SceneObject,
  free: Uint8Array,
  reachable: Float64Array,
): { x: number; z: number } | null {
  let best: { x: number; z: number; score: number } | null = null;
  for (let c = 0; c < free.length; c++) {
    if (!free[c] || !Number.isFinite(reachable[c])) continue;
    const x = cellX(c % NX),
      z = cellZ(Math.floor(c / NX));
    const gap = rectDistance(o, x, z);
    if (gap > 0.75) continue;
    const score = gap * 10 + reachable[c] * CELL * 0.02;
    if (!best || score < best.score) best = { x, z, score };
  }
  return best && { x: best.x, z: best.z };
}

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
const COATS = [
  "#5d7d99",
  "#c56743",
  "#687b64",
  "#8a6fa8",
  "#d1a03f",
  "#3f6f73",
];

export function simulateDay(world: World, count = 12, seed = 7): DayResult {
  const random = seeded(seed);
  const free = walkableGrid(world);
  const fromEntrance = distanceField(cellAt(ENTRANCE.x, ENTRANCE.z), free).dist;
  const merchandise = world.objects.filter((o) => MERCHANDISE.has(o.kind));
  const counters = world.objects.filter((o) => o.kind === "counter");
  const access = new Map(
    world.objects.map((o) => [o.id, accessPoint(o, free, fromEntrance)]),
  );
  const checkout = counters
    .map((o) => ({ o, at: access.get(o.id) }))
    .find((c) => c.at);
  const visits = new Map<string, number>(),
    blocked = new Map<string, number>();
  const shoppers: ShopperPlan[] = [];
  let walked = 0;

  for (let id = 0; id < count; id++) {
    let t = id * 2.6 + random() * 0.8;
    let here = { ...ENTRANCE };
    const keyframes: Keyframe[] = [{ t, ...here, note: "arrives" }];
    const plan: ShopperPlan = {
      id,
      color: COATS[id % COATS.length],
      keyframes,
      paidAt: null,
      pickedAt: null,
      outcome: "gave-up",
      blocked: [],
    };
    const walk = (to: { x: number; z: number }) => {
      const path = findPath(world, here, to, free);
      if (!path) return false;
      for (const p of path.slice(1)) {
        const d = Math.hypot(p.x - here.x, p.z - here.z);
        walked += d;
        t += d / WALK_SPEED;
        here = p;
        keyframes.push({ t, ...p });
      }
      return true;
    };
    const wait = (seconds: number, note: string) => {
      t += seconds;
      keyframes.push({ t, ...here, note });
    };

    const wanted = [...merchandise]
      .sort(() => random() - 0.5)
      .slice(0, 1 + Math.floor(random() * Math.min(3, merchandise.length)));
    let reached = 0,
      basket = false;
    for (const o of wanted) {
      const at = access.get(o.id);
      if (!at || !walk(at)) {
        plan.blocked.push(o.label);
        blocked.set(o.label, (blocked.get(o.label) || 0) + 1);
        continue;
      }
      reached += 1;
      visits.set(o.id, (visits.get(o.id) || 0) + 1);
      wait(1.5 + random() * 2, `browsing ${o.label}`);
      if (!basket && random() < 0.6) {
        basket = true;
        plan.pickedAt = t;
      }
    }
    if (basket) {
      if (checkout && walk(checkout.at!)) {
        visits.set(checkout.o.id, (visits.get(checkout.o.id) || 0) + 1);
        wait(2.5, "paying");
        plan.paidAt = t;
        plan.outcome = "bought";
      } else plan.outcome = "no-checkout";
    } else plan.outcome = reached ? "browsed" : "gave-up";
    walk(ENTRANCE);
    keyframes.push({ t: t + 0.01, ...here, note: "leaves" });
    shoppers.push(plan);
  }

  const by = (o: (typeof shoppers)[number]["outcome"]) =>
    shoppers.filter((s) => s.outcome === o).length;
  const busiest = [...visits.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    shoppers,
    duration: Math.max(...shoppers.map((s) => s.keyframes.at(-1)!.t), 0),
    stats: {
      visitors: shoppers.length,
      bought: by("bought"),
      browsedOnly: by("browsed"),
      noCheckout: by("no-checkout"),
      gaveUp: by("gave-up"),
      averageWalk: shoppers.length ? walked / shoppers.length : 0,
      blocked: [...blocked.entries()]
        .map(([label, n]) => ({ label, count: n }))
        .sort((a, b) => b.count - a.count),
      neverVisited: merchandise
        .filter((o) => !visits.get(o.id))
        .map((o) => o.label),
      busiest: busiest
        ? world.objects.find((o) => o.id === busiest[0])?.label || null
        : null,
      hasCounter: counters.length > 0,
      merchandise: merchandise.length,
    },
  };
}

/** Where a shopper is at simulated time t, and what they're doing. */
export function shopperAt(plan: ShopperPlan, t: number) {
  const k = plan.keyframes;
  if (t < k[0].t || t > k[k.length - 1].t) return null;
  let n = 1;
  while (n < k.length - 1 && k[n].t < t) n++;
  const a = k[n - 1],
    b = k[n];
  const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
  return {
    x: a.x + (b.x - a.x) * u,
    z: a.z + (b.z - a.z) * u,
    heading: Math.atan2(b.x - a.x, b.z - a.z),
    moving: b.x !== a.x || b.z !== a.z,
    carrying: plan.pickedAt !== null && t >= plan.pickedAt,
  };
}

/** A plain-language summary Muse can act on, and that people can read. */
export function describeDay(result: DayResult): string {
  const s = result.stats;
  if (!s.merchandise)
    return "Nobody could buy anything: there are no shelves, crates or tables to sell from.";
  const parts = [
    `${s.visitors} shoppers visited; ${s.bought} bought something.`,
  ];
  if (!s.hasCounter)
    parts.push("There is no display counter, so nobody could pay.");
  else if (s.noCheckout)
    parts.push(`${s.noCheckout} wanted to pay but couldn't reach the counter.`);
  if (s.gaveUp) parts.push(`${s.gaveUp} gave up without reaching anything.`);
  for (const b of s.blocked.slice(0, 3))
    parts.push(
      `${b.label} was unreachable for ${b.count} ${b.count === 1 ? "shopper" : "shoppers"}.`,
    );
  if (s.neverVisited.length)
    parts.push(`Nobody reached: ${s.neverVisited.join(", ")}.`);
  parts.push(`Average walk ${s.averageWalk.toFixed(1)} m.`);
  return parts.join(" ");
}

export const SHOPPER_KIND_NAMES = [...MERCHANDISE].map((k) => CATALOG[k].name);

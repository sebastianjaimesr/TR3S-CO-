"use client";
/**
 * TR3S concept sneaker — an ORIGINAL procedural silhouette built from code.
 * It is a brand object used for DEMO products and art direction; it does not
 * represent (and must never be used to represent) any commercial reference.
 *
 * The upper is a deformed superellipsoid: length runs along X (toe at +X),
 * its top follows a hand-tuned side profile and its width follows the
 * footprint. Overlays are patches of the same surface, slightly inflated, so
 * they hug the shape: three stacked side layers (one per founder), toe cap,
 * heel counter and eyestays. The midsole carries three clear cushioning
 * capsules ("TR3S pods"), the outsole has lugs, and materials use procedural
 * knit / suede bump textures (no downloaded assets).
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ParametricGeometry } from "three/examples/jsm/geometries/ParametricGeometry.js";
import type { ConceptColorway } from "@/types/domain";

const SOLE_Y = 0.3;
const L = 1.5;

const spow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Half-width of the footprint at x. */
function halfWidth(x: number) {
  const t = THREE.MathUtils.clamp((x + L) / (2 * L), 0, 1); // 0 heel → 1 toe
  const base = 0.35 - 0.05 * Math.sin(Math.PI * Math.min(t / 0.55, 1)) + 0.11 * smooth(0.42, 0.7, t);
  const toe = Math.sqrt(Math.max(0.0, 1 - 0.97 * Math.pow(smooth(0.76, 1.0, t), 2)));
  const heel = Math.sqrt(Math.max(0, 1 - 0.75 * Math.pow(1 - smooth(0.0, 0.12, t), 2)));
  return base * toe * heel;
}

/** Top contour of the upper (side profile), sampled from a smooth curve. */
const TOP = new THREE.SplineCurve(
  [
    [-1.5, 0.98],
    [-1.43, 1.16],
    [-1.25, 1.12],
    [-1.0, 1.04],
    [-0.78, 1.1],
    [-0.6, 1.24],
    [-0.46, 1.16],
    [-0.1, 1.0],
    [0.35, 0.83],
    [0.8, 0.7],
    [1.15, 0.63],
    [1.38, 0.56],
    [1.5, 0.44],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
);
const TOP_SAMPLES = TOP.getSpacedPoints(400);
function rawTop(x: number) {
  if (x <= TOP_SAMPLES[0].x) return TOP_SAMPLES[0].y;
  for (let i = 1; i < TOP_SAMPLES.length; i++) {
    const a = TOP_SAMPLES[i - 1];
    const b = TOP_SAMPLES[i];
    if (x <= b.x) return THREE.MathUtils.lerp(a.y, b.y, (x - a.x) / (b.x - a.x || 1));
  }
  return TOP_SAMPLES[TOP_SAMPLES.length - 1].y;
}
/** Upper a bit taller than the raw profile: closer to real sneaker proportions. */
const UPPER_GAIN = 1.14;
function topHeight(x: number) {
  return SOLE_Y + (rawTop(x) - SOLE_Y) * UPPER_GAIN;
}

/**
 * Global shaping applied to every part after it is built: a heel-to-toe drop
 * (thicker stack under the heel) and toe spring (the toe lifts off the floor).
 */
const SOLE_TOP = 0.26;
function lift(x: number, y: number) {
  const t = THREE.MathUtils.clamp((x + L) / (2 * L), 0, 1); // 0 heel → 1 toe
  const drop = 0.11 * Math.pow(1 - t, 1.2) * THREE.MathUtils.clamp(y / SOLE_TOP, 0, 1);
  const spring = 0.16 * Math.pow(smooth(0.68, 1, t), 2);
  return drop + spring;
}
function shape<T extends THREE.BufferGeometry>(g: T): T {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + lift(pos.getX(i), pos.getY(i)));
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
/** y of a point placed by hand, after shaping. */
const Y = (x: number, y: number) => y + lift(x, y);

/** Surface point for u∈[0,1] (toe→heel) and θ (around the foot). */
function upperPoint(u: number, theta: number, target: THREE.Vector3, inflate = 1) {
  const phi = u * Math.PI;
  const x = L * spow(Math.cos(phi), 0.32);
  const r = Math.pow(Math.max(Math.sin(phi), 0), 0.32);
  const py = r * spow(Math.sin(theta), 0.55);
  const pz = r * spow(Math.cos(theta), 0.55);
  const h = topHeight(x) - SOLE_Y;
  const y = py >= 0 ? SOLE_Y + h * py * inflate : SOLE_Y + 0.06 * py;
  const taper = 1 - 0.4 * Math.pow(Math.max(py, 0), 2.2);
  const z = pz * halfWidth(x) * taper * inflate * 1.04;
  target.set(x * (inflate > 1 ? 1 + (inflate - 1) * 0.5 : 1), y, z);
}

function upperGeometry(u0 = 0, u1 = 1, t0 = 0, t1 = Math.PI * 2, inflate = 1, segU = 160, segV = 96) {
  const g = new ParametricGeometry(
    // θ runs backwards so triangle winding (and normals) face outward
    (u, v, target) => upperPoint(u0 + (u1 - u0) * u, t1 - (t1 - t0) * v, target, inflate),
    segU,
    segV,
  );
  g.computeVertexNormals();
  return g;
}


function footprintGeometry(thickness: number, scale: number, bevel: number) {
  const N = 80;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= N; i++) {
    const x = -L + (2 * L * i) / N;
    pts.push(new THREE.Vector2(x * scale, halfWidth(x) * scale + 0.015));
  }
  for (let i = N; i >= 0; i--) {
    const x = -L + (2 * L * i) / N;
    pts.push(new THREE.Vector2(x * scale, -halfWidth(x) * scale - 0.015));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 12,
  });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/**
 * Surface patch whose θ range varies along u, so overlay edges can be cut at
 * an angle instead of following straight contour lines. side=1 lateral (z+),
 * side=-1 medial (mirrored).
 */
function panelGeometry(u0: number, u1: number, tLo: (u: number) => number, tHi: (u: number) => number, inflate: number, side: 1 | -1, segU = 96, segV = 20) {
  const g = new ParametricGeometry(
    (a, b, target) => {
      const u = u0 + (u1 - u0) * a;
      const lo = tLo(u);
      const hi = tHi(u);
      // θ always decreases with b so the winding (and normals) face outward on both sides
      const t = side === 1 ? hi - (hi - lo) * b : Math.PI - lo - (hi - lo) * b;
      upperPoint(u, t, target, inflate);
    },
    segU,
    segV,
  );
  g.computeVertexNormals();
  return g;
}

/** Three stacked side layers: each one shorter, higher-cut at the heel and slightly further out. */
const LAYERS = [0, 1, 2].map((k) => ({
  u0: 0.19 + k * 0.07,
  u1: 0.985 - k * 0.02,
  lo: () => -0.14,
  // angular top edge: low at the toe, rising toward the collar, with a kick at the end
  hi: (u: number) => 0.42 - k * 0.13 + 0.5 * smooth(0.2, 0.95, u) - 0.12 * smooth(0.9, 1, u),
  inflate: 1.022 + k * 0.012,
}));

export function useConceptGeometries(quality: "high" | "low" = "high") {
  return useMemo(() => {
    const seg = quality === "high" ? 1 : 0.6;
    const S = (n: number) => Math.max(8, Math.round(n * seg));
    const outsole = footprintGeometry(0.06, 1.012, 0.022);
    const midsole = footprintGeometry(0.17, 1.0, 0.035);
    midsole.translate(0, 0.07, 0);
    // rounded, slightly flared sidewall: widen the lower half of the midsole
    {
      const p = midsole.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const f = 1 + 0.05 * Math.sin(THREE.MathUtils.clamp((y - 0.04) / 0.24, 0, 1) * Math.PI);
        p.setZ(i, p.getZ(i) * f);
      }
    }
    // red welt line where the upper meets the midsole
    const stripe = footprintGeometry(0.014, 1.03, 0.012);
    stripe.translate(0, 0.236, 0);
    // dark parting groove that separates the cushioning band from the outsole
    const groove = footprintGeometry(0.01, 1.06, 0.006);
    groove.translate(0, 0.085, 0);
    const upper = upperGeometry(0, 1, 0, Math.PI * 2, 1, S(170), S(110));
    const hp = Math.PI / 2;
    const layers = LAYERS.flatMap((l) => [
      panelGeometry(l.u0, l.u1, l.lo, l.hi, l.inflate, 1, S(110), S(18)),
      panelGeometry(l.u0, l.u1, l.lo, l.hi, l.inflate, -1, S(110), S(18)),
    ]);
    // toe cap wraps the front; heel counter wraps the back
    const toe = upperGeometry(0, 0.17, -0.25, Math.PI + 0.25, 1.014, S(40), S(40));
    const heelA = upperGeometry(0.8, 1, -0.2, 0.95, 1.048, S(40), S(20));
    const heelB = upperGeometry(0.8, 1, Math.PI - 0.95, Math.PI + 0.2, 1.048, S(40), S(20));
    const eyeA = upperGeometry(0.3, 0.66, hp - 0.82, hp - 0.4, 1.03, S(48), S(12));
    const eyeB = upperGeometry(0.3, 0.66, hp + 0.4, hp + 0.82, 1.03, S(48), S(12));
    const tongue = upperGeometry(0.26, 0.7, hp - 0.38, hp + 0.38, 1.004, S(40), S(16));
    const all = { outsole, midsole, stripe, groove, upper, layers, toe, heel: [heelA, heelB], eye: [eyeA, eyeB], tongue };
    [outsole, midsole, stripe, groove, upper, toe, heelA, heelB, eyeA, eyeB, tongue, ...layers].forEach(shape);
    return all;
  }, [quality]);
}

const LACES = Array.from({ length: 7 }, (_, i) => {
  const t = i / 6;
  const x = THREE.MathUtils.lerp(-0.44, 0.3, t);
  const y = Y(x, topHeight(x) + 0.006);
  const slope = (Y(x + 0.01, topHeight(x + 0.01)) - Y(x - 0.01, topHeight(x - 0.01))) / 0.02;
  return { x, y, w: halfWidth(x) * 0.6, tilt: Math.atan(slope) };
});

/** Cushioning capsules: x centre, length, height. Heel is the biggest. */
const PODS = [
  { x: -1.05, len: 0.42, h: 0.068 },
  { x: -0.3, len: 0.3, h: 0.058 },
  { x: 0.6, len: 0.3, h: 0.052 },
];

const LUGS = (() => {
  const out: { x: number; z: number; r: number }[] = [];
  for (let x = -L + 0.08; x < L - 0.06; x += 0.085) {
    const w = halfWidth(x) - 0.04;
    for (let z = -w; z <= w; z += 0.085) out.push({ x, z, r: ((x * 7 + z * 11) % 1) * 0.6 });
  }
  return out;
})();

// ─── procedural textures (client only, created once) ─────────────────────────
let texCache: { knit: THREE.CanvasTexture; suede: THREE.CanvasTexture } | null = null;
function textures() {
  if (texCache) return texCache;
  const make = (draw: (ctx: CanvasRenderingContext2D, n: number) => void, repeat: [number, number]) => {
    const n = 256;
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, n, n);
    draw(ctx, n);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    t.anisotropy = 4;
    return t;
  };
  // engineered mesh: rows of small rounded cells
  const knit = make((ctx, n) => {
    const step = 16;
    for (let y = 0; y < n; y += step)
      for (let x = 0; x < n; x += step) {
        const ox = (y / step) % 2 ? step / 2 : 0;
        const g = ctx.createRadialGradient(x + ox, y, 1, x + ox, y, step * 0.6);
        g.addColorStop(0, "#d8d8d8");
        g.addColorStop(1, "#3a3a3a");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x + ox, y, step * 0.42, step * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
  }, [34, 16]);
  // fine noise for suede / synthetic overlays
  const suede = make((ctx, n) => {
    const img = ctx.getImageData(0, 0, n, n);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.random() * 40;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }, [10, 4]);
  texCache = { knit, suede };
  return texCache;
}

function tone(hex: string, amount: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  // dark colours step lighter, light colours step darker: tonal layering
  const l = hsl.l < 0.5 ? Math.min(1, hsl.l + amount) : Math.max(0, hsl.l - amount);
  return new THREE.Color().setHSL(hsl.h, hsl.s, l);
}

export function ConceptSneaker({ colorway, castShadow = true, quality = "high" }: { colorway: ConceptColorway; castShadow?: boolean; quality?: "high" | "low" }) {
  const g = useConceptGeometries(quality);
  const lacePaths = useMemo(
    () =>
      LACES.map((l) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.004, -l.w),
          new THREE.Vector3(0, 0.02, -l.w * 0.4),
          new THREE.Vector3(0, 0.026, 0),
          new THREE.Vector3(0, 0.02, l.w * 0.4),
          new THREE.Vector3(0, -0.004, l.w),
        ]);
        return new THREE.TubeGeometry(curve, 16, 0.0135, 6, false);
      }),
    [],
  );
  const m = useMemo(() => {
    const tx = textures();
    const hi = quality === "high";
    return {
      upper: new THREE.MeshPhysicalMaterial({
        color: colorway.upper,
        roughness: 0.92,
        bumpMap: tx.knit,
        bumpScale: 3,
        sheen: 0.35,
        sheenRoughness: 0.6,
        sheenColor: tone(colorway.upper, 0.18),
      }),
      layer: [0.02, 0.045, 0.07].map(
        (a) =>
          new THREE.MeshPhysicalMaterial({
            color: tone(colorway.upper, a),
            roughness: 0.62,
            bumpMap: tx.suede,
            bumpScale: 1.5,
            clearcoat: 0.25,
            clearcoatRoughness: 0.5,
            side: THREE.DoubleSide,
          }),
      ),
      accent: new THREE.MeshPhysicalMaterial({ color: colorway.accent, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, side: THREE.DoubleSide }),
      midsole: new THREE.MeshPhysicalMaterial({ color: colorway.midsole, roughness: 0.6, clearcoat: 0.15, bumpMap: tx.suede, bumpScale: 0.25 }),
      sole: new THREE.MeshStandardMaterial({ color: colorway.sole, roughness: 0.95 }),
      laces: new THREE.MeshStandardMaterial({ color: colorway.laces, roughness: 0.75 }),
      inner: new THREE.MeshStandardMaterial({ color: "#070707", roughness: 1, side: THREE.DoubleSide }),
      metal: new THREE.MeshStandardMaterial({ color: "#a8adb5", roughness: 0.25, metalness: 1 }),
      pod: hi
        ? new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.04, transmission: 1, thickness: 0.15, ior: 1.45, clearcoat: 1, attenuationColor: new THREE.Color(colorway.accent), attenuationDistance: 0.6 })
        : new THREE.MeshPhysicalMaterial({ color: "#d9dde3", roughness: 0.08, transparent: true, opacity: 0.45, clearcoat: 1 }),
      podCore: new THREE.MeshStandardMaterial({ color: new THREE.Color(colorway.sole).lerp(new THREE.Color(colorway.accent), 0.25), roughness: 0.35, metalness: 0.2 }),
    };
  }, [colorway, quality]);

  // outsole lugs: one instanced draw call instead of hundreds of meshes
  const lugs = useMemo(() => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.02, 0.03), m.sole, LUGS.length);
    const o = new THREE.Object3D();
    LUGS.forEach((l, i) => {
      o.position.set(l.x, lift(l.x, 0) - 0.018, l.z);
      o.rotation.set(0, l.r, 0);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [m.sole]);
  useEffect(() => () => lugs.geometry.dispose(), [lugs]);

  const collarY = Y(-1.02, topHeight(-1.02) - 0.02);
  return (
    <group position={[0, -0.62, 0]}>
      {/* sole unit */}
      <mesh geometry={g.outsole} material={m.sole} castShadow={castShadow} />
      <mesh geometry={g.midsole} material={m.midsole} castShadow={castShadow} />
      <mesh geometry={g.stripe} material={m.accent} />
      <mesh geometry={g.groove} material={m.sole} />
      {/* TR3S pods: clear capsule windows on both sidewalls over a dark cushioning core */}
      {PODS.map((p) =>
        [1, -1].map((sd) => {
          const z = sd * (halfWidth(p.x) * 1.05 + 0.045);
          return (
            <group key={`${p.x}${sd}`} position={[p.x, Y(p.x, 0.158), z]} rotation={[0, 0, Math.PI / 2]}>
              <mesh scale={[0.86, 0.92, 0.35]} material={m.podCore}>
                <capsuleGeometry args={[p.h, p.len - 2 * p.h, 6, 20]} />
              </mesh>
              <mesh scale={[1, 1, 0.55]} material={m.pod}>
                <capsuleGeometry args={[p.h, p.len - 2 * p.h, 10, 28]} />
              </mesh>
            </group>
          );
        }),
      )}
      {quality === "high" && <primitive object={lugs} />}

      {/* upper */}
      <mesh geometry={g.upper} material={m.upper} castShadow={castShadow} />
      <mesh geometry={g.tongue} material={m.layer[0]} />
      {g.layers.map((geo, i) => (
        <mesh key={`l${i}`} geometry={geo} material={m.layer[Math.floor(i / 2)]} castShadow={castShadow && i < 2} />
      ))}
      <mesh geometry={g.toe} material={m.layer[1]} />
      {g.heel.map((geo, i) => <mesh key={`h${i}`} geometry={geo} material={m.accent} />)}
      {g.eye.map((geo, i) => <mesh key={`e${i}`} geometry={geo} material={m.layer[2]} />)}

      {/* collar: dark lining + padded rim */}
      <mesh position={[-1.02, collarY + 0.004, 0]} scale={[0.33, 0.03, 0.19]} material={m.inner}>
        <sphereGeometry args={[1, 32, 12]} />
      </mesh>
      <mesh position={[-1.02, collarY + 0.018, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.35, 0.215, 0.55]} material={m.layer[0]}>
        <torusGeometry args={[1, 0.085, 10, 48]} />
      </mesh>
      {/* tongue top */}
      <mesh position={[-0.6, Y(-0.6, topHeight(-0.6) + 0.035), 0]} rotation={[0, 0, 0.55]} material={m.layer[0]}>
        <boxGeometry args={[0.05, 0.16, 0.22]} />
      </mesh>
      {/* heel pull tab */}
      <mesh position={[-1.5, Y(-1.5, topHeight(-1.47) - 0.04), 0]} rotation={[0, 0, 0.32]} material={m.accent}>
        <boxGeometry args={[0.03, 0.2, 0.075]} />
      </mesh>

      {/* laces with metal eyelets */}
      {LACES.map((l, i) => (
        <group key={i} position={[l.x, l.y, 0]} rotation={[0, 0, l.tilt]}>
          <mesh geometry={lacePaths[i]} material={m.laces} />
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[0, -0.006, sd * (l.w + 0.012)]} rotation={[Math.PI / 2, 0, 0]} material={m.metal}>
              <torusGeometry args={[0.016, 0.006, 6, 16]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

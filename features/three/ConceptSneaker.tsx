"use client";
/**
 * TR3S concept sneaker — an ORIGINAL procedural silhouette built from code.
 * It is a brand object used for DEMO products and art direction; it does not
 * represent (and must never be used to represent) any commercial reference.
 *
 * The upper is a deformed superellipsoid: length runs along X (toe at +X),
 * its top follows a hand-tuned side profile and its width follows the
 * footprint. Accent panels are patches of the same surface, slightly inflated.
 */
import { useMemo } from "react";
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
function topHeight(x: number) {
  if (x <= TOP_SAMPLES[0].x) return TOP_SAMPLES[0].y;
  for (let i = 1; i < TOP_SAMPLES.length; i++) {
    const a = TOP_SAMPLES[i - 1];
    const b = TOP_SAMPLES[i];
    if (x <= b.x) return THREE.MathUtils.lerp(a.y, b.y, (x - a.x) / (b.x - a.x || 1));
  }
  return TOP_SAMPLES[TOP_SAMPLES.length - 1].y;
}

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
  const N = 64;
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
    bevelSegments: 5,
    curveSegments: 12,
  });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

export function useConceptGeometries() {
  return useMemo(() => {
    const outsole = footprintGeometry(0.06, 1.01, 0.02);
    const midsole = footprintGeometry(0.17, 1.0, 0.03);
    midsole.translate(0, 0.07, 0);
    const stripe = footprintGeometry(0.014, 1.0, 0.036);
    stripe.translate(0, 0.165, 0);
    const upper = upperGeometry();
    const hp = Math.PI / 2;
    // heel counter: back third, lower sides
    const heelA = upperGeometry(0.72, 1, -0.2, 0.85, 1.025, 48, 24);
    const heelB = upperGeometry(0.72, 1, Math.PI - 0.85, Math.PI + 0.2, 1.025, 48, 24);
    // eyestays along the lacing
    const eyeA = upperGeometry(0.32, 0.64, hp - 0.85, hp - 0.42, 1.02, 48, 16);
    const eyeB = upperGeometry(0.32, 0.64, hp + 0.42, hp + 0.85, 1.02, 48, 16);
    return { outsole, midsole, stripe, upper, heel: [heelA, heelB], eye: [eyeA, eyeB] };
  }, []);
}

const LACES = Array.from({ length: 6 }, (_, i) => {
  const t = i / 5;
  const x = THREE.MathUtils.lerp(-0.42, 0.3, t);
  const y = topHeight(x) - 0.004;
  const slope = (topHeight(x + 0.01) - topHeight(x - 0.01)) / 0.02;
  return { x, y, w: halfWidth(x) * 0.62, tilt: Math.atan(slope) };
});

export function ConceptSneaker({ colorway, castShadow = true }: { colorway: ConceptColorway; castShadow?: boolean }) {
  const g = useConceptGeometries();
  const m = useMemo(
    () => ({
      upper: new THREE.MeshPhysicalMaterial({
        color: colorway.upper,
        roughness: 0.7,
        sheen: 0.8,
        sheenRoughness: 0.45,
        sheenColor: new THREE.Color(colorway.upper).lerp(new THREE.Color("#ffffff"), 0.3),
      }),
      accent: new THREE.MeshPhysicalMaterial({ color: colorway.accent, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2, side: THREE.DoubleSide }),
      midsole: new THREE.MeshPhysicalMaterial({ color: colorway.midsole, roughness: 0.5, clearcoat: 0.2, side: THREE.DoubleSide }),
      sole: new THREE.MeshStandardMaterial({ color: colorway.sole, roughness: 0.95 }),
      laces: new THREE.MeshStandardMaterial({ color: colorway.laces, roughness: 0.8 }),
      inner: new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 1 }),
    }),
    [colorway],
  );

  return (
    <group position={[0, -0.62, 0]}>
      <mesh geometry={g.outsole} material={m.sole} castShadow={castShadow} />
      <mesh geometry={g.midsole} material={m.midsole} castShadow={castShadow} />
      <mesh geometry={g.stripe} material={m.accent} />
      <mesh geometry={g.upper} material={m.upper} castShadow={castShadow} />
      {g.heel.map((geo, i) => <mesh key={`h${i}`} geometry={geo} material={m.accent} />)}
      {g.eye.map((geo, i) => <mesh key={`e${i}`} geometry={geo} material={m.accent} />)}
      {/* collar opening */}
      <mesh position={[-1.02, topHeight(-1.02) - 0.01, 0]} scale={[0.34, 0.035, 0.2]} material={m.inner}>
        <sphereGeometry args={[1, 32, 12]} />
      </mesh>
      {/* heel pull tab */}
      <mesh position={[-1.43, topHeight(-1.43) - 0.02, 0]} rotation={[0, 0, 0.3]} material={m.accent}>
        <boxGeometry args={[0.045, 0.18, 0.1]} />
      </mesh>
      {LACES.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, 0]} rotation={[0, 0, l.tilt]} material={m.laces}>
          <boxGeometry args={[0.045, 0.022, l.w]} />
        </mesh>
      ))}
    </group>
  );
}

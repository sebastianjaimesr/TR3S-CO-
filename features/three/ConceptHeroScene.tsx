"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, ContactShadows, Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import type { ConceptColorway } from "@/types/domain";
import { ConceptSneaker } from "@/features/three/ConceptSneaker";

const RED = "#d50025";

interface Props {
  colorway: ConceptColorway;
  reducedMotion: boolean;
  lowPower: boolean;
  /** 0..1 progress of the hero leaving the viewport, written by GSAP ScrollTrigger. */
  progress: React.MutableRefObject<number>;
  onReady?: () => void;
}

/**
 * Home hero stage for the TR3S CONCEPT sneaker (an original procedural design,
 * never a product for sale). Floating motion, cinematic three-point lighting,
 * drift particles, drag / touch rotation and a scroll-driven turn.
 */
export default function ConceptHeroScene({ colorway, reducedMotion, lowPower, progress, onReady }: Props) {
  const [dpr, setDpr] = useState<[number, number]>(lowPower ? [1, 1.25] : [1, 1.75]);
  return (
    <Canvas
      dpr={dpr}
      shadows={!lowPower}
      camera={{ position: [0, 0.4, 6.4], fov: 30 }}
      gl={{ antialias: !lowPower, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        onReady?.();
      }}
      style={{ touchAction: "pan-y" }}
      aria-hidden
    >
      <PerformanceMonitor onDecline={() => setDpr([1, 1])} />
      <AdaptiveDpr pixelated={false} />
      <Lights lowPower={lowPower} />
      <Halo reducedMotion={reducedMotion} progress={progress} />
      <Particles count={lowPower ? 180 : 520} reducedMotion={reducedMotion} />
      <Suspense fallback={null}>
        <Sneaker colorway={colorway} reducedMotion={reducedMotion} lowPower={lowPower} progress={progress} />
      </Suspense>
      {!lowPower && <ContactShadows position={[0, -1.2, 0]} opacity={0.6} scale={10} blur={2.8} far={3.2} resolution={512} color="#000000" />}
    </Canvas>
  );
}

function Lights({ lowPower }: { lowPower: boolean }) {
  return (
    <>
      <ambientLight intensity={0.18} />
      {/* key */}
      <spotLight position={[3.5, 6, 4]} angle={0.38} penumbra={0.9} intensity={70} castShadow={!lowPower} shadow-mapSize={[1024, 1024]} />
      {/* red rim from behind: the brand light */}
      <pointLight position={[-3.5, 1.2, -3]} intensity={30} color={RED} />
      <pointLight position={[3.5, -0.2, -2.5]} intensity={10} color="#a8adb5" />
      <Environment resolution={lowPower ? 64 : 256} frames={1}>
        <Lightformer form="rect" intensity={2.4} position={[0, 4, 2]} scale={[8, 1.4, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.1} position={[-5, 1, 1]} scale={[3, 4, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.1} position={[5, 1, 1]} scale={[3, 4, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" color={RED} intensity={2} position={[0, 1, -6]} scale={3} />
      </Environment>
    </>
  );
}

function usePointer() {
  const p = useRef({ x: 0, y: 0, dragging: false, lastX: 0, vel: 0, offset: 0 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      p.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      p.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (p.current.dragging) {
        const dx = e.clientX - p.current.lastX;
        p.current.lastX = e.clientX;
        p.current.vel = dx * 0.012;
        p.current.offset += dx * 0.012;
      }
    };
    const up = () => (p.current.dragging = false);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
  return p;
}

function Sneaker({ colorway, reducedMotion, lowPower, progress }: { colorway: ConceptColorway; reducedMotion: boolean; lowPower: boolean; progress: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const pointer = usePointer();
  const t = useRef(0);
  const pop = useRef(0);
  const { viewport, size } = useThree();
  const fit = Math.min(1.15, viewport.width / 3.9) * (size.width < 640 ? 0.92 : 1);

  // A small "pop" every time the colorway changes, so the swap reads as an event.
  useEffect(() => {
    pop.current = 1;
  }, [colorway]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const d = Math.min(delta, 1 / 30);
    t.current += d;
    const p = reducedMotion ? 0 : progress.current;
    const ptr = pointer.current;
    if (!ptr.dragging) {
      ptr.vel *= 0.92;
      ptr.offset += ptr.vel * 0.25;
    }
    pop.current = Math.max(0, pop.current - d * 2.2);

    const idle = reducedMotion ? 0 : t.current * 0.22;
    const targetY = -0.6 + idle + ptr.offset + p * Math.PI * 1.1 + (reducedMotion ? 0 : ptr.x * 0.25);
    const targetX = 0.14 + (reducedMotion ? 0 : ptr.y * 0.1) + p * 0.35;
    const k = 1 - Math.pow(0.008, d);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetY, k);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetX, k);
    g.rotation.z = reducedMotion ? 0.05 : 0.05 + Math.sin(t.current * 0.7) * 0.035;

    const float = reducedMotion ? 0 : Math.sin(t.current * 1.15) * 0.09;
    g.position.y = 0.08 + float + p * 0.9;
    const s = fit * (1 + p * 0.18) * (1 + Math.sin(pop.current * Math.PI) * 0.06);
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x || 0.001, s, 1 - Math.pow(0.002, d)));

    if (!reducedMotion) {
      const cam = state.camera;
      cam.position.x = THREE.MathUtils.lerp(cam.position.x, ptr.x * 0.4, 0.04);
      cam.position.y = THREE.MathUtils.lerp(cam.position.y, 0.4 - ptr.y * 0.22, 0.04);
      cam.position.z = THREE.MathUtils.lerp(cam.position.z, 6.4 - p * 1.2, 0.08);
      cam.lookAt(0, p * 0.5, 0);
    }
  });

  return (
    <group
      ref={group}
      scale={0.001}
      onPointerDown={(e) => {
        e.stopPropagation();
        pointer.current.dragging = true;
        pointer.current.lastX = e.nativeEvent.clientX;
      }}
    >
      <ConceptSneaker colorway={colorway} castShadow={!lowPower} quality={lowPower ? "low" : "high"} />
    </group>
  );
}

/** Thin red ring behind the shoe: depth cue that tightens as you scroll. */
function Halo({ reducedMotion, progress }: { reducedMotion: boolean; progress: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    const m = ref.current;
    if (!m) return;
    if (!reducedMotion) m.rotation.z += delta * 0.08;
    const s = 1 - progress.current * 0.35;
    m.scale.setScalar(s);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - progress.current * 0.8);
  });
  return (
    <mesh ref={ref} position={[0, 0.1, -2.2]}>
      <torusGeometry args={[1.85, 0.012, 8, 160]} />
      <meshBasicMaterial color={RED} transparent opacity={0.55} toneMapped={false} />
    </mesh>
  );
}

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Subtle dust: mostly white, some brand red, drifting upwards. */
function Particles({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const points = useRef<THREE.Points>(null);
  const { geometry, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    const red = new THREE.Color(RED);
    const white = new THREE.Color("#ffffff");
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 7;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
      const c = Math.random() < 0.28 ? red : white;
      col.set([c.r, c.g, c.b], i * 3);
      spd[i] = 0.05 + Math.random() * 0.18;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return { geometry: g, speeds: spd };
  }, [count]);
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.05,
        map: dotTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    [],
  );
  useEffect(() => () => {
    geometry.dispose();
    material.map?.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((state, delta) => {
    if (reducedMotion || !points.current) return;
    const attr = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const d = Math.min(delta, 1 / 30);
    for (let i = 0; i < speeds.length; i++) {
      let y = arr[i * 3 + 1] + speeds[i] * d;
      if (y > 3.6) y = -3.6;
      arr[i * 3 + 1] = y;
    }
    attr.needsUpdate = true;
    points.current.rotation.y = state.pointer.x * 0.06;
  });
  return <points ref={points} geometry={geometry} material={material} />;
}

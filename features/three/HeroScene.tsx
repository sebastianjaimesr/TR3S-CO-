"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, PerformanceMonitor, AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";
import type { ConceptColorway } from "@/types/domain";
import { ConceptSneaker } from "@/features/three/ConceptSneaker";
import { ProductModel } from "@/features/three/ProductModel";

export interface StageItem {
  key: string;
  modelUrl: string | null;
  colorway: ConceptColorway | null;
}

interface Props {
  item: StageItem;
  reducedMotion: boolean;
  lowPower: boolean;
  /** 0..1 scroll progress of the hero section, drives the storytelling turn. */
  scrollProgress?: React.MutableRefObject<number>;
  onReady?: () => void;
}

/**
 * Hero stage: the selected sneaker floats, turns slowly, follows the cursor
 * and can be dragged (mouse or touch). Swapping products plays an
 * out → in transition instead of a hard cut.
 */
export default function HeroScene({ item, reducedMotion, lowPower, scrollProgress, onReady }: Props) {
  const [dpr, setDpr] = useState<[number, number]>(lowPower ? [1, 1.25] : [1, 1.75]);
  return (
    <Canvas
      dpr={dpr}
      shadows={!lowPower}
      camera={{ position: [0, 0.35, 6.2], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        onReady?.();
      }}
      style={{ touchAction: "pan-y" }}
      aria-hidden
    >
      <PerformanceMonitor onDecline={() => setDpr([1, 1])} />
      <AdaptiveDpr pixelated={false} />
      <StudioLights lowPower={lowPower} />
      <Stage item={item} reducedMotion={reducedMotion} scrollProgress={scrollProgress} />
      {!lowPower && <ContactShadows position={[0, -1.15, 0]} opacity={0.55} scale={9} blur={2.6} far={3} resolution={512} color="#000000" />}
    </Canvas>
  );
}

function StudioLights({ lowPower }: { lowPower: boolean }) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <spotLight position={[3, 6, 4]} angle={0.4} penumbra={0.8} intensity={60} castShadow={!lowPower} shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-4, 1.5, -3]} intensity={18} color="#d50025" />
      <pointLight position={[4, 0.5, -2]} intensity={6} color="#f5f3ef" />
      {/* Studio reflections without downloading an HDRI */}
      <Environment resolution={lowPower ? 64 : 256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 2]} scale={[8, 1.5, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.2} position={[-5, 1, 1]} scale={[3, 4, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.2} position={[5, 1, 1]} scale={[3, 4, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" color="#d50025" intensity={1.5} position={[0, 1, -6]} scale={3} />
      </Environment>
    </>
  );
}

function Stage({ item, reducedMotion, scrollProgress }: { item: StageItem; reducedMotion: boolean; scrollProgress?: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const [shown, setShown] = useState(item);
  const phase = useRef<"in" | "out" | "idle">("in");
  const t = useRef(0);
  const drag = useRef({ active: false, x: 0, vel: 0, offset: 0 });
  const { size, viewport } = useThree();
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (item.key !== shown.key) phase.current = "out";
  }, [item, shown.key]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (drag.current.active) {
        const dx = e.clientX - drag.current.x;
        drag.current.x = e.clientX;
        drag.current.vel = dx * 0.01;
        drag.current.offset += dx * 0.01;
      }
    };
    const onUp = () => (drag.current.active = false);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // Responsive scale: smaller on narrow screens
  const fit = Math.min(1, viewport.width / 4.6) * (size.width < 768 ? 0.95 : 1);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const d = Math.min(delta, 1 / 30);
    t.current += d;

    // transitions
    if (phase.current === "out") {
      g.scale.lerp(new THREE.Vector3(0.001, 0.001, 0.001), reducedMotion ? 1 : 1 - Math.pow(0.0005, d));
      g.position.x = THREE.MathUtils.lerp(g.position.x, reducedMotion ? 0 : -1.2, 1 - Math.pow(0.001, d));
      if (g.scale.x < 0.06) {
        setShown(item);
        phase.current = "in";
        g.position.x = reducedMotion ? 0 : 1.2;
        drag.current.offset = 0;
      }
    } else {
      const target = fit;
      g.scale.lerp(new THREE.Vector3(target, target, target), 1 - Math.pow(0.002, d));
      g.position.x = THREE.MathUtils.lerp(g.position.x, 0, 1 - Math.pow(0.002, d));
      if (phase.current === "in" && Math.abs(g.scale.x - target) < 0.01) phase.current = "idle";
    }

    // motion
    const scroll = scrollProgress?.current ?? 0;
    const idleSpin = reducedMotion ? 0 : t.current * 0.18;
    if (!drag.current.active) {
      drag.current.vel *= 0.92;
      drag.current.offset += drag.current.vel * 0.2;
    }
    const baseY = -0.55 + idleSpin + drag.current.offset + scroll * Math.PI * 0.9;
    const tiltX = reducedMotion ? 0 : pointer.current.y * 0.12;
    const tiltY = reducedMotion ? 0 : pointer.current.x * 0.25;
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, baseY + tiltY, 1 - Math.pow(0.01, d));
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0.12 + tiltX + scroll * 0.25, 1 - Math.pow(0.01, d));
    g.rotation.z = reducedMotion ? 0.06 : 0.06 + Math.sin(t.current * 0.6) * 0.03;
    g.position.y = reducedMotion ? 0.05 : 0.05 + Math.sin(t.current * 1.1) * 0.08;

    // camera drifts with pointer for depth
    if (!reducedMotion) {
      state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, pointer.current.x * 0.35, 0.03);
      state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, 0.35 - pointer.current.y * 0.2, 0.03);
      state.camera.lookAt(0, 0, 0);
    }
  });

  return (
    <group
      ref={group}
      scale={0.001}
      onPointerDown={(e) => {
        e.stopPropagation();
        drag.current.active = true;
        drag.current.x = e.nativeEvent.clientX;
      }}
    >
      <Suspense fallback={null}>
        {shown.modelUrl ? <ProductModel url={shown.modelUrl} /> : shown.colorway ? <ConceptSneaker colorway={shown.colorway} /> : null}
      </Suspense>
    </group>
  );
}

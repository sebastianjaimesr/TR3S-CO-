"use client";
import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ConceptColorway } from "@/types/domain";
import { ConceptSneaker } from "@/features/three/ConceptSneaker";
import { ProductModel } from "@/features/three/ProductModel";

export interface BoutiqueItem {
  id: string;
  name: string;
  modelUrl: string | null;
  colorway: ConceptColorway | null;
}

/**
 * THE TR3S EXPERIENCE — a minimal architectural boutique. Plinths carry the
 * featured sneakers; selecting one surfaces its commercial info (in the DOM,
 * outside the canvas). Orbit is constrained so it never feels like a game.
 */
export default function BoutiqueScene({
  items,
  selected,
  onSelect,
  lowPower,
}: {
  items: BoutiqueItem[];
  selected: string | null;
  onSelect: (id: string) => void;
  lowPower: boolean;
}) {
  const shown = items.filter((i) => i.modelUrl || i.colorway).slice(0, 5);
  return (
    <Canvas
      dpr={lowPower ? [1, 1.25] : [1, 1.6]}
      shadows={!lowPower}
      camera={{ position: [0, 2.2, 9], fov: 40 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
      style={{ touchAction: "pan-y" }}
    >
      <color attach="background" args={["#0b0b0b"]} />
      <fog attach="fog" args={["#0b0b0b", 10, 22]} />
      <ambientLight intensity={0.25} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 5, 0]} scale={[10, 0.4, 1]} rotation-x={Math.PI / 2} />
      </Environment>
      <Room lowPower={lowPower} />
      {shown.map((it, i) => {
        const x = (i - (shown.length - 1) / 2) * 2.4;
        return (
          <Plinth key={it.id} x={x} item={it} active={selected === it.id} onSelect={() => onSelect(it.id)} castShadow={!lowPower} />
        );
      })}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 2.8}
        maxPolarAngle={Math.PI / 2.1}
        minAzimuthAngle={-Math.PI / 6}
        maxAzimuthAngle={Math.PI / 6}
        target={[0, 1.2, 0]}
      />
    </Canvas>
  );
}

function Room({ lowPower }: { lowPower: boolean }) {
  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color="#121212" roughness={0.35} metalness={0.2} />
      </mesh>
      {/* back wall with shelves */}
      <mesh position={[0, 4, -4]} receiveShadow>
        <planeGeometry args={[40, 8]} />
        <meshStandardMaterial color="#161616" roughness={0.9} />
      </mesh>
      {[-6, -3, 3, 6].map((x) =>
        [1.6, 2.8, 4].map((y) => (
          <mesh key={`${x}-${y}`} position={[x, y, -3.75]} castShadow={!lowPower} receiveShadow>
            <boxGeometry args={[2.2, 0.06, 0.5]} />
            <meshStandardMaterial color="#242424" roughness={0.6} />
          </mesh>
        )),
      )}
      {/* architectural light strips */}
      {[-7.5, 7.5].map((x) => (
        <mesh key={x} position={[x, 3, -3.9]}>
          <boxGeometry args={[0.06, 6, 0.06]} />
          <meshBasicMaterial color="#f5f3ef" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 6.2, -3.9]}>
        <boxGeometry args={[15, 0.05, 0.05]} />
        <meshBasicMaterial color="#a52632" toneMapped={false} />
      </mesh>
      <spotLight position={[0, 7, 4]} angle={0.7} penumbra={0.9} intensity={70} castShadow={!lowPower} shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 3, -3]} color="#a52632" intensity={8} />
    </group>
  );
}

function Plinth({ x, item, active, onSelect, castShadow }: { x: number; item: BoutiqueItem; active: boolean; onSelect: () => void; castShadow: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useFrame((_, d) => {
    if (!ref.current) return;
    ref.current.rotation.y += d * (active ? 0.6 : 0.15);
    const target = active ? 1.75 : hover ? 1.6 : 1.5;
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, target, 0.08);
  });
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[1.5, 1, 1.5]} />
        <meshStandardMaterial color={active ? "#2a2a2a" : "#1c1c1c"} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.005, 0]}>
        <boxGeometry args={[1.52, 0.01, 1.52]} />
        <meshBasicMaterial color={active ? "#a52632" : "#2f2f2f"} toneMapped={false} />
      </mesh>
      <group
        ref={ref}
        position={[0, 1.5, 0]}
        scale={0.42}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => {
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <Suspense fallback={null}>
          {item.modelUrl ? <ProductModel url={item.modelUrl} /> : item.colorway ? <ConceptSneaker colorway={item.colorway} castShadow={castShadow} /> : null}
        </Suspense>
      </group>
      {/* interactive hotspot */}
      <Html position={[0, 2.45, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Ver ${item.name}`}
          className={`grid h-7 w-7 place-items-center rounded-full border text-[11px] ${active ? "border-crimson bg-crimson text-white" : "border-white/50 bg-black/50 text-white"}`}
        >
          +
        </button>
      </Html>
    </group>
  );
}

"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { ConceptColorway } from "@/types/domain";
import { ConceptSneaker } from "@/features/three/ConceptSneaker";
import { ProductModel } from "@/features/three/ProductModel";

/** 360° product viewer: drag to rotate, pinch/scroll to zoom. */
export default function ProductViewer({ modelUrl, colorway, lowPower }: { modelUrl: string | null; colorway: ConceptColorway | null; lowPower: boolean }) {
  return (
    <Canvas
      dpr={lowPower ? [1, 1.25] : [1, 1.75]}
      shadows={!lowPower}
      camera={{ position: [0, 0.6, 5.6], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <ambientLight intensity={0.3} />
      <spotLight position={[3, 6, 4]} angle={0.45} penumbra={0.8} intensity={55} castShadow={!lowPower} />
      <pointLight position={[-4, 1.5, -3]} intensity={12} color="#a52632" />
      <Environment resolution={lowPower ? 64 : 256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 2]} scale={[8, 1.5, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.2} position={[-5, 1, 1]} scale={[3, 4, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.2} position={[5, 1, 1]} scale={[3, 4, 1]} rotation-y={-Math.PI / 2} />
      </Environment>
      <Suspense fallback={null}>
        <group rotation={[0, -0.5, 0]}>{modelUrl ? <ProductModel url={modelUrl} /> : colorway ? <ConceptSneaker colorway={colorway} /> : null}</group>
      </Suspense>
      {!lowPower && <ContactShadows position={[0, -0.63, 0]} opacity={0.5} scale={8} blur={2.4} far={2} />}
      <OrbitControls enablePan={false} minDistance={3} maxDistance={8} autoRotate autoRotateSpeed={0.6} target={[0, -0.1, 0]} />
    </Canvas>
  );
}

"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { AccumulativeShadows, ContactShadows, Environment, Lightformer, OrbitControls, RandomizedLight } from "@react-three/drei";
import * as THREE from "three";
import type { ConceptColorway } from "@/types/domain";
import { ConceptSneaker } from "@/features/three/ConceptSneaker";
import { ProductModel } from "@/features/three/ProductModel";

/**
 * 360° viewer for an authorized GLB (PBR: albedo, normal, roughness/metalness
 * and AO maps are used as authored). Neutral photo-studio lighting built from
 * softboxes, physically soft accumulated floor shadow, AgX tone mapping for
 * natural highlights. Drag to rotate, scroll / pinch to zoom.
 */
export default function ProductViewer({ modelUrl, colorway, lowPower }: { modelUrl: string | null; colorway: ConceptColorway | null; lowPower: boolean }) {
  return (
    <Canvas
      dpr={lowPower ? [1, 1.5] : [1, 2]}
      shadows
      camera={{ position: [0, 0.9, 5.4], fov: 32 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.AgXToneMapping;
        gl.toneMappingExposure = 1.15;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <ambientLight intensity={0.15} />
      <directionalLight position={[3, 6, 4]} intensity={1.6} castShadow={!lowPower} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      {/* photo-studio environment: big top softbox, two strip lights, a fill card */}
      <Environment resolution={lowPower ? 128 : 512} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={2} position={[-5, 2, 1]} rotation-y={Math.PI / 2} scale={[2, 6, 1]} />
        <Lightformer form="rect" intensity={2} position={[5, 2, 1]} rotation-y={-Math.PI / 2} scale={[2, 6, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[0, 1, 6]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#dfe3e8" position={[0, 1, -6]} rotation-y={Math.PI} scale={[8, 4, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <group rotation={[0, -0.5, 0]}>{modelUrl ? <ProductModel url={modelUrl} /> : colorway ? <ConceptSneaker colorway={colorway} /> : null}</group>
        {lowPower ? (
          <ContactShadows position={[0, -0.6, 0]} opacity={0.55} scale={8} blur={2.4} far={2} />
        ) : (
          <AccumulativeShadows position={[0, -0.6, 0]} frames={60} temporal alphaTest={0.75} scale={10} opacity={0.75} color="#000000">
            <RandomizedLight amount={6} radius={4} ambient={0.5} intensity={1.2} position={[3, 6, 3]} bias={0.001} />
          </AccumulativeShadows>
        )}
      </Suspense>
      <OrbitControls enablePan={false} enableDamping minDistance={2.6} maxDistance={8} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2.05} autoRotate autoRotateSpeed={0.5} target={[0, -0.1, 0]} />
    </Canvas>
  );
}

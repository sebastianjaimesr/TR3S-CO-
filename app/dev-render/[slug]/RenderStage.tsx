"use client";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { useEffect } from "react";
import type { ConceptColorway } from "@/types/domain";
import { ConceptSneaker } from "@/features/three/ConceptSneaker";

export function RenderStage({ colorway, view }: { colorway: ConceptColorway; view: "side" | "top" }) {
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "transparent" }}>
      <Canvas
        id="render"
        dpr={2}
        shadows
        camera={{ position: view === "top" ? [2.6, 3.4, 4.2] : [0, 0.25, 6.4], fov: 30 }}
        gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          camera.lookAt(0, -0.1, 0);
          document.body.dataset.ready = "1";
        }}
      >
        <ambientLight intensity={0.35} />
        <spotLight position={[3, 6, 4]} angle={0.45} penumbra={0.8} intensity={60} castShadow />
        <pointLight position={[-4, 1.5, -3]} intensity={14} color="#a52632" />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.2} position={[0, 4, 2]} scale={[8, 1.5, 1]} rotation-x={Math.PI / 2} />
          <Lightformer form="rect" intensity={1.2} position={[-5, 1, 1]} scale={[3, 4, 1]} rotation-y={Math.PI / 2} />
          <Lightformer form="rect" intensity={1.2} position={[5, 1, 1]} scale={[3, 4, 1]} rotation-y={-Math.PI / 2} />
        </Environment>
        <group rotation={view === "top" ? [0, -0.5, 0] : [0.08, -0.35, 0.05]}>
          <ConceptSneaker colorway={colorway} />
        </group>
        <ContactShadows position={[0, -0.62, 0]} opacity={0.5} scale={7} blur={2.4} far={2} />
      </Canvas>
    </div>
  );
}

"use client";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Loads an AUTHORIZED GLB for a specific product and normalizes it to the
 * stage size (3 units long, resting on the floor). Draco/Meshopt-compressed
 * files are supported via drei's decoders.
 */
export function ProductModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, true, true);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const s = 3 / longest;
    const center = box.getCenter(new THREE.Vector3());
    clone.position.set(-center.x * s, -box.min.y * s - 0.6, -center.z * s);
    clone.scale.setScalar(s);
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  return <primitive object={object} />;
}

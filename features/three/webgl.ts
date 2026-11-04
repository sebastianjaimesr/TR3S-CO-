"use client";

export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Heuristic for phones / low-end devices: fewer pixels, no shadows. */
export function isLowPowerDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const lowMem = nav.deviceMemory != null && nav.deviceMemory <= 4;
  const lowCpu = (navigator.hardwareConcurrency ?? 8) <= 4;
  return coarse || lowMem || lowCpu || window.innerWidth < 768;
}

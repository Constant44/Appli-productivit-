/**
 * Trois mises en page : téléphone, iPad, Mac, choisies automatiquement selon l'appareil
 * (taille d'écran + écran tactile ou souris).
 */
import { useEffect, useState } from "react";

export type Device = "phone" | "tablet" | "desktop";

export function detectDevice(w = window.innerWidth, coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false): Device {
  if (w < 600) return "phone";
  if (coarse || w < 1100) return "tablet";
  return "desktop";
}

export function useDevice(): Device {
  const [device, setDevice] = useState<Device>(() => detectDevice());
  useEffect(() => {
    const f = () => setDevice(detectDevice());
    window.addEventListener("resize", f);
    window.addEventListener("orientationchange", f);
    return () => {
      window.removeEventListener("resize", f);
      window.removeEventListener("orientationchange", f);
    };
  }, []);
  return device;
}

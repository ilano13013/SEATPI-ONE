import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export interface CameraFocus {
  target: [number, number, number];
  /** Distance caméra–cible souhaitée. */
  distance: number;
  /** Change à chaque demande, pour pouvoir recentrer sur la même cible. */
  key: number;
}

/** Direction isométrique de la caméra (depuis l'avant-droite, en hauteur). */
const ISO_DIRECTION = new Vector3(0.55, 0.68, 0.62).normalize();

/**
 * Anime en douceur la caméra et la cible des OrbitControls vers une pièce.
 * Toute interaction utilisateur (rotation, zoom) interrompt l'animation.
 */
export function CameraRig({ focus, animate }: { focus: CameraFocus; animate: boolean }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef<{ target: Vector3; position: Vector3 } | null>(null);

  useEffect(() => {
    const target = new Vector3(...focus.target);
    goal.current = { target, position: target.clone().addScaledVector(ISO_DIRECTION, focus.distance) };
  }, [focus]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      goal.current = null;
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = animate ? 1 - Math.exp(-Math.min(dt, 0.1) * 4) : 1;
    controls.target.lerp(g.target, k);
    camera.position.lerp(g.position, k);
    controls.update();
    if (camera.position.distanceTo(g.position) < 0.01 && controls.target.distanceTo(g.target) < 0.01) {
      goal.current = null;
    }
  });

  return null;
}

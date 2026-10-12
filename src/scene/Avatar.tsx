import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import type { Agent } from '../types';
import { statusColors } from '../lib/status';
import { formatDuration } from '../lib/format';

interface Props {
  agent: Agent;
  position: [number, number, number];
  rotation?: number;
  seated?: boolean;
  animate: boolean;
  onClick?: (agent: Agent) => void;
}

/**
 * Avatar stylisé. Sa couleur traduit un état de travail : il ne représente
 * pas la position physique réelle d'une personne.
 */
export function Avatar({ agent, position, rotation = 0, seated = true, animate, onClick }: Props) {
  const ref = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const color = statusColors[agent.status];
  const phase = Number(agent.id.replace(/\D/g, '')) * 1.7;
  const baseY = seated ? 0.12 : 0;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const amplitude = animate && agent.status === 'En appel' ? 0.015 : 0;
    ref.current.position.y = baseY + Math.sin(t * 3 + phase) * amplitude;
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.22, 24]} />
        <meshBasicMaterial color={color} transparent opacity={hover ? 1 : 0.75} />
      </mesh>
      <group
        ref={ref}
        onClick={(e) => {
          if (!onClick) return;
          e.stopPropagation();
          onClick(agent);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <mesh position={[0, 0.32, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.2, 4, 10]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.6, 0]} castShadow>
          <sphereGeometry args={[0.1, 16, 12]} />
          <meshStandardMaterial color="#f1d6bd" roughness={0.7} />
        </mesh>
        {agent.status === 'En appel' && (
          <mesh position={[0, 0.62, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.105, 0.015, 6, 16, Math.PI]} />
            <meshStandardMaterial color="#1f2f47" />
          </mesh>
        )}
      </group>
      {hover && (
        <Html position={[0, 0.95, 0]} center className="scene-tip" zIndexRange={[20, 10]}>
          <b>{agent.name}</b>
          <span>
            {agent.status} · {formatDuration(agent.statusSinceSec)}
          </span>
        </Html>
      )}
    </group>
  );
}

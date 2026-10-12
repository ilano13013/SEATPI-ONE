import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import type { Group } from 'three';
import { RoomContents, type RoomContentProps } from './RoomContents';

const WALL_H = 1.1;
const GLASS = '#a9c6df';

interface Props extends RoomContentProps {
  selected: boolean;
  hovered: boolean;
  badge?: string;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}

function GlassWall({ position, args }: { position: [number, number, number]; args: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={args} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.28} depthWrite={false} roughness={0.1} />
      </mesh>
      <mesh position={[0, args[1] / 2, 0]}>
        <boxGeometry args={[args[0] + 0.02, 0.04, args[2] + 0.02]} />
        <meshStandardMaterial color="#62778f" />
      </mesh>
    </group>
  );
}

export function RoomMesh({ selected, hovered, badge, onSelect, onHover, ...content }: Props) {
  const { room, animate } = content;
  const lift = useRef<Group>(null);
  const { width: w, depth: d } = room;
  // Un pôle sélectionné porte son propre contour : le plateau reste discret.
  const outlined = selected && !content.selectedPole;

  useFrame((_, dt) => {
    if (!lift.current) return;
    const goal = hovered || selected ? 0.06 : 0;
    const k = animate ? 1 - Math.exp(-dt * 10) : 1;
    lift.current.position.y += (goal - lift.current.position.y) * k;
  });

  return (
    <group position={[room.x, 0, room.z]}>
      <group
        ref={lift}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
        }}
        onPointerOut={() => onHover(false)}
      >
        <RoundedBox args={[w, 0.16, d]} radius={0.06} position={[0, 0.02, 0]} receiveShadow>
          <meshStandardMaterial color={room.outdoor ? (room.ground ?? '#7d8794') : room.color} roughness={0.9} />
        </RoundedBox>
        <group position={[0, 0.1, 0]}>
          {!room.outdoor && (
            <>
              <GlassWall position={[-w / 2 + 0.03, WALL_H / 2, 0]} args={[0.05, WALL_H, d]} />
              <GlassWall position={[0, WALL_H / 2, -d / 2 + 0.03]} args={[w, WALL_H, 0.05]} />
            </>
          )}
          <RoomContents {...content} />
        </group>
        {(outlined || hovered) && <Outline w={w} d={d} color={outlined ? '#2563eb' : '#60a5fa'} />}
      </group>
      <Html position={room.labelAt ? [0, room.labelAt[0], room.labelAt[1]] : [0, WALL_H + 0.45, room.outdoor ? 0 : -d / 2 + 0.2]} center className={`room-label${selected ? ' selected' : ''}`} zIndexRange={[10, 0]}>
        <span>{room.label}</span>
        {badge && (hovered || selected) && <em>{badge}</em>}
      </Html>
    </group>
  );
}

function Outline({ w, d, color }: { w: number; d: number; color: string }) {
  const t = 0.05;
  const y = 0.12;
  const bars: [number, number, number, number][] = [
    [0, -d / 2, w + t, t],
    [0, d / 2, w + t, t],
    [-w / 2, 0, t, d + t],
    [w / 2, 0, t, d + t],
  ];
  return (
    <>
      {bars.map(([x, z, bw, bd]) => (
        <mesh key={`${x}${z}`} position={[x, y, z]}>
          <boxGeometry args={[bw, 0.03, bd]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </>
  );
}

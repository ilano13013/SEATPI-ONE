import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import type { Agent, DemoState, FloorId, RoomId } from '../types';
import { roomById, roomsOnFloor } from '../data/layout';
import { CameraRig, type CameraFocus } from './CameraRig';
import { RoomMesh } from './RoomMesh';

export interface SceneProps {
  floor: FloorId;
  selected: RoomId | null;
  /** Incrémenté pour demander un recentrage de la caméra. */
  focusKey: number;
  /** Vue d'ensemble de l'étage plutôt que focus sur la pièce. */
  overview: boolean;
  state: DemoState;
  badges: Partial<Record<RoomId, string>>;
  reducedMotion: boolean;
  onSelect: (id: RoomId) => void;
  onAgentClick: (agent: Agent) => void;
}

const OVERVIEW_DISTANCE = 19;

/** Fait « monter » l'étage affiché lors d'un changement d'étage. */
function FloorTransition({ animate, children }: { animate: boolean; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = animate ? 1 - Math.exp(-Math.min(dt, 0.1) * 6) : 1;
    g.position.y += (0 - g.position.y) * k;
  });
  return (
    <group ref={ref} position={[0, animate ? -1.2 : 0, 0]}>
      {children}
    </group>
  );
}

export default function Scene({ floor, selected, focusKey, overview, state, badges, reducedMotion, onSelect, onAgentClick }: SceneProps) {
  const [hovered, setHovered] = useState<RoomId | null>(null);
  const animate = !reducedMotion;
  const floorRooms = roomsOnFloor(floor);

  const focus = useMemo<CameraFocus>(() => {
    const room = selected ? roomById(selected) : null;
    if (overview || !room || room.floor !== floor) return { target: [0, 0, 0], distance: OVERVIEW_DISTANCE, key: focusKey };
    const distance = Math.max(room.width, room.depth) * 1.4 + 7.5;
    return { target: [room.x, 0.3, room.z], distance, key: focusKey };
  }, [selected, overview, floor, focusKey]);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [10.5, 13, 11.8], fov: 38 }}
      onPointerMissed={() => setHovered(null)}
      aria-label="Bâtiment 3D de l'entreprise virtuelle"
    >
      <color attach="background" args={['#eaf0f8']} />
      <fog attach="fog" args={['#eaf0f8', 30, 60]} />
      <hemisphereLight args={['#ffffff', '#c9d6e6', 1.1]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[9, 16, 7]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <circleGeometry args={[30, 48]} />
        <meshStandardMaterial color="#e3eaf3" />
      </mesh>
      <gridHelper args={[40, 40, '#cfdbe8', '#dde5ef']} position={[0, -0.07, 0]} />

      <FloorTransition key={floor} animate={animate}>
        {/* Dalle de l'étage */}
        <mesh position={[0, -0.04, 0]} receiveShadow>
          <boxGeometry args={[11.4, 0.06, floor === 'rdc' ? 8.4 : 7.9]} />
          <meshStandardMaterial color={floor === 'rdc' ? '#f4f6f9' : '#eef2f8'} />
        </mesh>
        {floorRooms.map((room) => (
          <RoomMesh
            key={room.id}
            room={room}
            selected={selected === room.id}
            hovered={hovered === room.id}
            badge={badges[room.id]}
            onSelect={() => onSelect(room.id)}
            onHover={(h) => setHovered((cur) => (h ? room.id : cur === room.id ? null : cur))}
            agents={state.agents}
            vehicles={state.vehicles}
            inventory={state.inventory}
            animate={animate}
            onAgentClick={onAgentClick}
          />
        ))}
      </FloorTransition>

      <OrbitControls
        makeDefault
        enablePan
        enableDamping
        minDistance={5}
        maxDistance={32}
        maxPolarAngle={Math.PI / 2.3}
      />
      <CameraRig focus={focus} animate={animate} />
    </Canvas>
  );
}

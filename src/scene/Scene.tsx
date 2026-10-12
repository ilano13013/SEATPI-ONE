import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import type { Agent, DemoState, FloorId, RoomId, SiteId } from '../types';
import { poleByClient, roomById, roomsOnFloor } from '../data/layout';
import { CameraRig, type CameraFocus } from './CameraRig';
import { RoomMesh } from './RoomMesh';
import type { SiteSceneData } from './ExternalSite';
import type { ServicesSceneData } from './ServiceRooms';
import { CsmTravel, type CsmTripView } from './CsmTravel';
import type { Trip } from '../external/trips';

export interface SceneProps {
  floor: FloorId;
  selected: RoomId | null;
  /** Incrémenté pour demander un recentrage de la caméra. */
  focusKey: number;
  /** Vue d'ensemble de l'étage plutôt que focus sur la pièce. */
  overview: boolean;
  state: DemoState;
  badges: Partial<Record<RoomId, string>>;
  /** Pôle client sélectionné sur le plateau Helpdesk. */
  selectedPole: string | null;
  poleBadges: Partial<Record<string, string>>;
  onSelectPole: (clientId: string, site?: SiteId) => void;
  sites: Record<string, SiteSceneData>;
  services: ServicesSceneData;
  onTeamClick: (clientId: string, teamId: string) => void;
  onTechClick: (clientId: string, techId: string) => void;
  /** Déplacements des managers CSM affichés sur la carte des sites. */
  csmTrips: CsmTripView[];
  onTripClick: (trip: Trip) => void;
  reducedMotion: boolean;
  onPersonClick: (personId: string) => void;
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

export default function Scene(props: SceneProps) {
  const { floor, selected, focusKey, overview, state, badges, selectedPole, poleBadges, onSelectPole, sites, services, csmTrips, onTeamClick, onTechClick, onTripClick, onPersonClick, reducedMotion, onSelect, onAgentClick } = props;
  const [hovered, setHovered] = useState<RoomId | null>(null);
  const [hoveredPole, setHoveredPole] = useState<string | null>(null);
  const animate = !reducedMotion;
  const floorRooms = roomsOnFloor(floor);
  // Dalle de l'étage : emprise des espaces + marge (l'étage des sites inclut les routes des CSM).
  const slab = useMemo(() => {
    const minX = Math.min(...floorRooms.map((r) => r.x - r.width / 2)) - 0.4;
    const maxX = Math.max(...floorRooms.map((r) => r.x + r.width / 2)) + 0.4;
    const minZ = Math.min(...floorRooms.map((r) => r.z - r.depth / 2)) - 0.4;
    const maxZ = Math.max(...floorRooms.map((r) => r.z + r.depth / 2)) + (floor === 'sites' ? 3.3 : 0.4);
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ };
  }, [floorRooms, floor]);
  const isOutdoor = floor === 'sites' || floor === 'carte';

  const focus = useMemo<CameraFocus>(() => {
    const room = selected ? roomById(selected) : null;
    // L'étage des sites inclut le siège SEATPI et les routes des CSM : vue recentrée vers l'avant.
    if (overview || !room || room.floor !== floor)
      return { target: [slab.x, 0, slab.z], distance: Math.max(OVERVIEW_DISTANCE, Math.max(slab.w, slab.d) * 1.65), key: focusKey };
    const pole = room.kind === 'helpdesk' && selectedPole ? poleByClient(selectedPole, room.location === 'laciotat' || room.location === 'montpellier' || room.location === 'paris' ? room.location : null) : undefined;
    if (pole) {
      const distance = Math.max(pole.width, pole.depth) * 1.4 + 6.5;
      return { target: [room.x + pole.x, 0.3, room.z + pole.z], distance, key: focusKey };
    }
    const distance = Math.max(room.width, room.depth) * 1.4 + 7.5;
    return { target: [room.x, 0.3, room.z], distance, key: focusKey };
  }, [selected, selectedPole, overview, floor, focusKey, slab]);

  useEffect(() => {
    document.body.style.cursor = hovered || hoveredPole ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered, hoveredPole]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [10.5, 13, 11.8], fov: 38 }}
      onPointerMissed={() => {
        setHovered(null);
        setHoveredPole(null);
      }}
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
        <mesh position={[slab.x, -0.04, slab.z]} receiveShadow>
          <boxGeometry args={[slab.w, 0.06, slab.d]} />
          <meshStandardMaterial color={isOutdoor ? '#e6efe2' : '#eef2f8'} />
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
            selectedPole={room.kind === 'helpdesk' && selected === room.id ? selectedPole : null}
            hoveredPole={hoveredPole}
            poleBadges={poleBadges}
            onSelectPole={onSelectPole}
            sites={sites}
            services={services}
            onTeamClick={onTeamClick}
            onTechClick={onTechClick}
            onPersonClick={onPersonClick}
            onHoverPole={(id, h) => setHoveredPole((cur) => (h ? id : cur === id ? null : cur))}
          />
        ))}
        {floor === 'sites' && <CsmTravel trips={csmTrips} siteXs={floorRooms.map((r) => r.x)} onSelect={onTripClick} />}
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

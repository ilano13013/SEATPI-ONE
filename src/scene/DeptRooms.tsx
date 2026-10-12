// Aménagement des espaces des départements, bâtiments de la carte et encadrement.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group, Mesh } from 'three';
import type { Room, RoomKind } from '../types';
import type { OrgPerson } from '../org/people';
import { Cabinet, Chair, Desk, Plant, Rack, RoundTable, Shelf, WallScreen } from './furniture';

/** Personne de l'encadrement : silhouette distincte (couronne dorée), cliquable. */
export function Person({ person, position, rotation = Math.PI, onClick }: { person: OrgPerson; position: [number, number, number]; rotation?: number; onClick?: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  const color = person.role === 'pdg' ? '#111827' : person.role === 'responsable-helpdesk' ? '#be123c' : '#334155';
  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(person.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.19, 0.27, 28]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <capsuleGeometry args={[0.13, 0.26, 4, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.115, 16, 12]} />
        <meshStandardMaterial color="#f1d6bd" />
      </mesh>
      <Html position={[0, 1.08, 0]} center zIndexRange={[18, 0]}>
        <button className={`person-chip ${person.role}${hover ? ' hover' : ''}`} onClick={() => onClick?.(person.id)} title={person.title}>
          {person.name}
        </button>
      </Html>
    </group>
  );
}

function ClassRoom() {
  const rows = [-0.3, 0.6, 1.5];
  return (
    <>
      <WallScreen position={[0, 0, -1.65]} color="#0ea5e9" />
      <Desk position={[0, 0, -1.05]} rotation={Math.PI} />
      {rows.flatMap((z) =>
        [-1.6, -0.55, 0.55, 1.6].map((x) => (
          <group key={`${x}${z}`}>
            <Desk position={[x, 0, z]} screen={false} />
            <Chair position={[x, 0, z + 0.4]} color="#38bdf8" />
          </group>
        )),
      )}
    </>
  );
}

function MeetingRoom({ color = '#94a3b8' }: { color?: string }) {
  return (
    <>
      <WallScreen position={[0, 0, -1.65]} color="#475569" />
      <mesh position={[0, 0.42, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.06, 1]} />
        <meshStandardMaterial color="#d6c3a5" />
      </mesh>
      {[-0.8, 0, 0.8].flatMap((x) => [
        <Chair key={`a${x}`} position={[x, 0, -0.62]} color={color} />,
        <Chair key={`b${x}`} position={[x, 0, 0.82]} rotation={Math.PI} color={color} />,
      ])}
      <Plant position={[-1.5, 0, 1.3]} />
    </>
  );
}

function OfficeRows({ chair, screen = '#2f6fe4', extra }: { chair: string; screen?: string; extra?: 'cabinets' | 'racks' | 'table' | 'map' | 'shelves' }) {
  return (
    <>
      <WallScreen position={[0, 0, -1.65]} color={screen} />
      {[-1.4, 0, 1.4].flatMap((x) => [-0.7, 0.7].map((z) => (
        <group key={`${x}${z}`}>
          <Desk position={[x, 0, z]} />
          <Chair position={[x, 0, z + 0.42]} color={chair} />
        </group>
      )))}
      {extra === 'cabinets' && [-1.9, -1.2].map((x) => <Cabinet key={x} position={[x, 0, -1.45]} />)}
      {extra === 'racks' && [1.4, 1.95].map((x) => <Rack key={x} position={[x, 0, -1.4]} />)}
      {extra === 'table' && <RoundTable position={[1.6, 0, 1.4]} radius={0.35} />}
      {extra === 'shelves' && <Shelf position={[1.5, 0, -1.4]} fill={0.6} />}
      {extra === 'map' && (
        <mesh position={[-1.5, 0.75, -1.62]}>
          <planeGeometry args={[0.9, 0.6]} />
          <meshStandardMaterial color="#bbf7d0" />
        </mesh>
      )}
      <Plant position={[2.1, 0, 1.4]} scale={0.8} />
    </>
  );
}

/** Aménagement générique selon la nature de l'espace. */
export function DeptRoom({ kind }: { kind: RoomKind }) {
  switch (kind) {
    case 'formation':
      return <ClassRoom />;
    case 'reunion':
      return <MeetingRoom />;
    case 'mco':
      return <OfficeRows chair="#2563eb" screen="#1d4ed8" extra="racks" />;
    case 'finance':
      return <OfficeRows chair="#ca8a04" screen="#eab308" extra="cabinets" />;
    case 'commercial':
      return <OfficeRows chair="#e11d48" screen="#f43f5e" extra="table" />;
    case 'recrutement':
      return <OfficeRows chair="#7c3aed" screen="#8b5cf6" extra="table" />;
    case 'moyens':
      return <OfficeRows chair="#65a30d" screen="#84cc16" extra="shelves" />;
    case 'deplacements':
      return <OfficeRows chair="#db2777" screen="#ec4899" extra="map" />;
    default:
      return null;
  }
}

/** Bâtiment d'un site interne sur la carte d'ensemble (un niveau par étage). */
export function SiteBuilding({ levels, color, main }: { levels: number; color: string; main: boolean }) {
  const h = 0.55;
  return (
    <group position={[0, 0, -0.2]}>
      {Array.from({ length: levels }, (_, i) => (
        <group key={i} position={[0, i * h, 0]}>
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.6, h - 0.04, 2.1]} />
            <meshStandardMaterial color="#f3f6fb" />
          </mesh>
          <mesh position={[0, h / 2, 1.055]}>
            <planeGeometry args={[2.3, 0.22]} />
            <meshStandardMaterial color="#9cc3e6" emissive="#4a7fb3" emissiveIntensity={0.15} />
          </mesh>
          <mesh position={[1.305, h / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[1.8, 0.22]} />
            <meshStandardMaterial color="#9cc3e6" emissive="#4a7fb3" emissiveIntensity={0.15} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, levels * h + 0.03, 0]}>
        <boxGeometry args={[2.66, 0.07, 2.16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {main && (
        <mesh position={[0.9, levels * h + 0.4, 0.6]}>
          <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      )}
    </group>
  );
}

const HEALTH_COLOR = { vert: '#22a06b', orange: '#f59e0b', rouge: '#dc2626', gris: '#94a3b8' } as const;

/** Site client externe en miniature sur la carte, avec son voyant d'état. */
export function ClientMiniSite({ accent, health, animate }: { accent: string; health: keyof typeof HEALTH_COLOR; animate: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = animate && (health === 'rouge' || health === 'orange') ? (Math.sin(clock.getElapsedTime() * 3) + 1) / 2 : 0;
    ref.current.scale.setScalar(1 + pulse * 0.2);
  });
  const color = HEALTH_COLOR[health];
  return (
    <group position={[0, 0, -0.2]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 1, 1.4]} />
        <meshStandardMaterial color="#f3f5f8" />
      </mesh>
      <mesh position={[0, 1.03, 0]}>
        <boxGeometry args={[1.96, 0.07, 1.46]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh ref={ref} position={[0.7, 1.4, 0.4]}>
        <sphereGeometry args={[0.15, 18, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

export type { Group };

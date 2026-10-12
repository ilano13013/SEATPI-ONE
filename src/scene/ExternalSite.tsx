import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Mesh } from 'three';
import type { Agent } from '../types';
import { Avatar } from './Avatar';
import { Chair, Desk, Plant, Tree } from './furniture';

export type SiteHealth = 'vert' | 'orange' | 'rouge';

export interface SiteTech {
  id: string;
  name: string;
  /** occupé : au moins un ticket en cours ; congé : absent du poste. */
  state: 'occupé' | 'disponible' | 'congé';
  tooltip: string;
}

export interface SiteTeam {
  id: string;
  name: string;
  level: 'ok' | 'tension' | 'surcharge';
  techs: SiteTech[];
}

export interface SiteSceneData {
  clientId: string;
  name: string;
  accent: string;
  health: SiteHealth;
  teams: SiteTeam[];
}

const HEALTH_COLOR: Record<SiteHealth, string> = { vert: '#22a06b', orange: '#f59e0b', rouge: '#dc2626' };
const LEVEL_COLOR = { ok: '#9fb7a0', tension: '#f59e0b', surcharge: '#dc2626' };

/** Voyant d'état sur le toit ; pulsation discrète en cas d'alerte importante. */
function Beacon({ health, animate }: { health: SiteHealth; animate: boolean }) {
  const ref = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const pulse = animate && health !== 'vert' ? (Math.sin(clock.getElapsedTime() * (health === 'rouge' ? 4 : 2.2)) + 1) / 2 : 0;
    if (ref.current) ref.current.scale.setScalar(1 + pulse * 0.15);
    if (halo.current) {
      halo.current.scale.setScalar(1 + pulse * 0.9);
      (halo.current.material as { opacity: number }).opacity = health === 'vert' ? 0 : 0.35 * (1 - pulse);
    }
  });
  const color = HEALTH_COLOR[health];
  return (
    <group position={[0.9, 2.1, -2.1]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />
        <meshStandardMaterial color="#5b6779" />
      </mesh>
      <mesh ref={ref} position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.18, 20, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <mesh ref={halo} position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Building({ accent }: { accent: string }) {
  const windows = [0.45, 0.95, 1.45];
  return (
    <group position={[0, 0, -2.1]}>
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 2, 2.4]} />
        <meshStandardMaterial color="#f3f5f8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.03, 0]}>
        <boxGeometry args={[2.86, 0.08, 2.46]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {windows.map((y) =>
        [-0.9, -0.3, 0.3, 0.9].map((x) => (
          <mesh key={`${x}${y}`} position={[x, y, 1.205]}>
            <planeGeometry args={[0.4, 0.28]} />
            <meshStandardMaterial color="#9cc3e6" emissive="#4a7fb3" emissiveIntensity={0.15} />
          </mesh>
        )),
      )}
      {windows.map((y) =>
        [-0.7, 0, 0.7].map((z) => (
          <mesh key={`s${z}${y}`} position={[1.405, y, z]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.4, 0.28]} />
            <meshStandardMaterial color="#9cc3e6" emissive="#4a7fb3" emissiveIntensity={0.15} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.22, 1.21]}>
        <planeGeometry args={[0.5, 0.42]} />
        <meshStandardMaterial color="#3b4a5f" />
      </mesh>
    </group>
  );
}

interface Props {
  site: SiteSceneData;
  animate: boolean;
  onTeamClick?: (teamId: string) => void;
  onTechClick?: (techId: string) => void;
}

const PADS_WIDTH = 3.3;
const DESK_ROWS = [-0.55, 0.6];

/** Postes d'une équipe : 3 colonnes si la zone est large, 2 sinon. */
function desksFor(width: number): [number, number][] {
  const cols = width >= 3 ? [-1.05, 0, 1.05] : [-0.38, 0.38];
  return DESK_ROWS.flatMap((z) => cols.map((x) => [x, z] as [number, number]));
}

export function ExternalSite({ site, animate, onTeamClick, onTechClick }: Props) {
  return (
    <>
      <Building accent={site.accent} />
      <Beacon health={site.health} animate={animate} />
      {site.teams.slice(0, 2).map((team, ti, teams) => {
        const width = PADS_WIDTH / teams.length - (teams.length > 1 ? 0.1 : 0);
        const x = teams.length === 1 ? 0 : ti === 0 ? -PADS_WIDTH / 4 : PADS_WIDTH / 4;
        const desks = desksFor(width);
        const shown = team.techs.slice(0, desks.length);
        return (
          <group
            key={team.id}
            position={[x, 0, 1.75]}
            onClick={(e) => {
              e.stopPropagation();
              onTeamClick?.(team.id);
            }}
          >
            <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[width, 2.9]} />
              <meshStandardMaterial color="#f4f1ea" />
            </mesh>
            {[
              [0, -1.45, width, 0.04],
              [0, 1.45, width, 0.04],
              [-width / 2, 0, 0.04, 2.9],
              [width / 2, 0, 0.04, 2.9],
            ].map(([bx, bz, bw, bd]) => (
              <mesh key={`${bx}${bz}`} position={[bx, 0.012, bz]}>
                <boxGeometry args={[bw, 0.02, bd]} />
                <meshBasicMaterial color={LEVEL_COLOR[team.level]} />
              </mesh>
            ))}
            {desks.map(([dx, dz], i) => {
              const tech = shown[i];
              const agent: Agent | null =
                tech && tech.state !== 'congé'
                  ? { id: tech.id, name: tech.name, clientId: site.clientId, status: tech.state === 'occupé' ? 'En appel' : 'Disponible', statusSinceSec: 0, desk: i }
                  : null;
              return (
                <group key={i}>
                  <Desk position={[dx, 0, dz]} rotation={0} />
                  <Chair position={[dx, 0, dz + 0.42]} color={agent ? '#47608f' : '#9aa7b8'} />
                  {agent && (
                    <Avatar
                      agent={agent}
                      position={[dx, 0, dz + 0.4]}
                      rotation={Math.PI}
                      animate={animate}
                      tooltip={tech!.tooltip}
                      onClick={() => onTechClick?.(tech!.id)}
                    />
                  )}
                </group>
              );
            })}
            <Html position={[0, 0.95, -1.25]} center className={`pole-label team-${team.level}`} zIndexRange={[12, 0]}>
              <span>{team.name}</span>
            </Html>
          </group>
        );
      })}
      <Tree position={[-1.45, 0, -0.35]} />
      <Plant position={[1.5, 0, -0.4]} />
    </>
  );
}

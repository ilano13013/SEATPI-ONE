import { Html } from '@react-three/drei';
import type { Agent } from '../types';
import { polesOf, poleDesks, type HelpdeskPole } from '../data/layout';
import type { SiteId } from '../types';
import { OFF_FLOOR_STATUSES } from '../services/simulation';
import { Avatar } from './Avatar';
import { Chair, Desk } from './furniture';

export interface PoleProps {
  selectedPole: string | null;
  hoveredPole: string | null;
  poleBadges: Partial<Record<string, string>>;
  onSelectPole: (clientId: string, site?: SiteId) => void;
  onHoverPole: (clientId: string, hovered: boolean) => void;
}

const GAP = 0.08;
const PARTITION_H = 0.42;

/** Cloison basse vitrée entre deux pôles. */
function Partition({ position, length, alongX }: { position: [number, number, number]; length: number; alongX: boolean }) {
  const args: [number, number, number] = alongX ? [length, PARTITION_H, 0.04] : [0.04, PARTITION_H, length];
  return (
    <mesh position={[position[0], PARTITION_H / 2, position[2]]}>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#9fbad3" transparent opacity={0.35} depthWrite={false} />
    </mesh>
  );
}

function Pole({ pole, agents, animate, onAgentClick, selected, hovered, badge, onSelect, onHover }: {
  pole: HelpdeskPole;
  agents: Agent[];
  animate: boolean;
  onAgentClick?: (agent: Agent) => void;
  selected: boolean;
  hovered: boolean;
  badge?: string;
  onSelect: () => void;
  onHover: (h: boolean) => void;
}) {
  const w = pole.width - GAP * 2;
  const d = pole.depth - GAP * 2;
  const active = selected || hovered;
  return (
    <group
      position={[pole.x, 0, pole.z]}
      onClick={(e) => {
        // Empêche la sélection du plateau entier derrière le pôle.
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => onHover(true)}
      onPointerOut={() => onHover(false)}
    >
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={pole.color} emissive={active ? pole.color : '#000000'} emissiveIntensity={active ? 0.35 : 0} roughness={0.95} />
      </mesh>
      {active && <PoleOutline w={w} d={d} color={selected ? '#2563eb' : '#60a5fa'} />}
      {poleDesks(pole).map(([x, z], i) => {
        const agent = agents.find((a) => a.clientId === pole.clientId && a.site === pole.site && a.desk === i);
        const present = agent && !OFF_FLOOR_STATUSES.includes(agent.status);
        return (
          <group key={i}>
            <Desk position={[x, 0, z]} />
            <Chair position={[x, 0, z + 0.42]} color={present ? '#47608f' : '#9aa7b8'} />
            {present && <Avatar agent={agent} position={[x, 0, z + 0.4]} rotation={Math.PI} animate={animate} onClick={onAgentClick} />}
          </group>
        );
      })}
      {/* Étiquette posée au sol, au bord avant du pôle : ne recouvre ni les postes ni l’étiquette du plateau. */}
      <Html position={[0, 0.12, d / 2 - 0.25]} center className={`pole-label${selected ? " selected" : ""}`} zIndexRange={[12, 0]}>
        <span>{pole.label}</span>
        {badge && active && <em>{badge}</em>}
      </Html>
    </group>
  );
}

function PoleOutline({ w, d, color }: { w: number; d: number; color: string }) {
  const t = 0.04;
  const bars: [number, number, number, number][] = [
    [0, -d / 2, w, t],
    [0, d / 2, w, t],
    [-w / 2, 0, t, d],
    [w / 2, 0, t, d],
  ];
  return (
    <>
      {bars.map(([x, z, bw, bd]) => (
        <mesh key={`${x}${z}`} position={[x, 0.012, z]}>
          <boxGeometry args={[bw, 0.02, bd]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </>
  );
}

export function HelpdeskPoles({ agents, site, animate, onAgentClick, selectedPole, hoveredPole, poleBadges, onSelectPole, onHoverPole }: PoleProps & {
  site: SiteId;
  agents: Agent[];
  animate: boolean;
  onAgentClick?: (agent: Agent) => void;
}) {
  const poles = polesOf(site);
  // Rangées de pôles (fond, milieu, avant) : cloisons entre rangées et entre pôles voisins.
  const rows = [poles.filter((p) => p.z < 0), poles.filter((p) => p.z === 0), poles.filter((p) => p.z > 0)].filter((r) => r.length);
  return (
    <>
      {poles.map((pole) => (
        <Pole
          key={pole.id}
          pole={pole}
          agents={agents}
          animate={animate}
          onAgentClick={onAgentClick}
          selected={selectedPole === pole.clientId}
          hovered={hoveredPole === pole.clientId}
          badge={poleBadges[pole.id]}
          onSelect={() => onSelectPole(pole.clientId, pole.site)}
          onHover={(h) => onHoverPole(pole.clientId, h)}
        />
      ))}
      {rows.length > 1 && <Partition position={[0, 0, 0]} length={6.7} alongX />}
      {rows.flatMap((row) =>
        row.slice(1).map((pole) => (
          <Partition key={pole.id} position={[pole.x - pole.width / 2, 0, pole.z]} length={pole.depth - 0.3} alongX={false} />
        )),
      )}
    </>
  );
}

// Salles des services internes Exploitation et CSM (étage 2).
import { Html } from '@react-three/drei';
import type { Agent } from '../types';
import { Avatar } from './Avatar';
import { Chair, Desk, Plant, Rack, RoundTable, WallScreen } from './furniture';

export interface ServicePerson {
  id: string;
  name: string;
  state: 'occupé' | 'disponible' | 'absent';
  tooltip: string;
  /** Couleur du client suivi (CSM). */
  accent?: string;
  label?: string;
}

export interface ServicesSceneData {
  exploitation: ServicePerson[];
  csm: ServicePerson[];
}

function toAgent(p: ServicePerson, desk: number): Agent {
  return { id: p.id, name: p.name, clientId: '', status: p.state === 'occupé' ? 'En appel' : 'Disponible', statusSinceSec: 0, desk };
}

const EXPLOIT_DESKS: [number, number][] = [-1.2, 0.6].flatMap((z) => [-0.6, 0.6, 1.8].map((x) => [x, z] as [number, number]));

export function ExploitationRoom({ people, animate, onPerson }: { people: ServicePerson[]; animate: boolean; onPerson?: (id: string) => void }) {
  return (
    <>
      {[-1.6, 0, 1.6].map((x, i) => (
        <WallScreen key={x} position={[x, 0, -3.5]} color={i === 1 ? '#16a34a' : '#2f6fe4'} />
      ))}
      {[-2.6, -1.9, -1.2, -0.5].map((z) => (
        <Rack key={z} position={[-2.25, 0, z]} rotation={Math.PI / 2} />
      ))}
      {EXPLOIT_DESKS.map(([x, z], i) => {
        const p = people[i];
        const present = p && p.state !== 'absent';
        return (
          <group key={i}>
            <Desk position={[x, 0, z]} />
            <Chair position={[x, 0, z + 0.42]} color={present ? '#47608f' : '#9aa7b8'} />
            {present && <Avatar agent={toAgent(p, i)} position={[x, 0, z + 0.4]} rotation={Math.PI} animate={animate} tooltip={p.tooltip} onClick={() => onPerson?.(p.id)} />}
          </group>
        );
      })}
      <Plant position={[-2.2, 0, 3.1]} />
      <Plant position={[2.3, 0, 3.1]} scale={0.8} />
    </>
  );
}

export function CsmRoom({ people, animate, onPerson }: { people: ServicePerson[]; animate: boolean; onPerson?: (id: string) => void }) {
  return (
    <>
      {[-1.6, 0, 1.6].map((x, i) => {
        const p = people[i];
        return (
          <group key={x}>
            <Desk position={[x, 0, -2.2]} />
            <Chair position={[x, 0, -1.78]} color="#a0527a" />
            {p && (
              <>
                <mesh position={[x, 0.55, -2.46]}>
                  <boxGeometry args={[0.7, 0.22, 0.03]} />
                  <meshStandardMaterial color={p.accent ?? '#888'} />
                </mesh>
                {p.state !== 'absent' && <Avatar agent={toAgent(p, i)} position={[x, 0, -1.8]} rotation={Math.PI} animate={animate} tooltip={p.tooltip} onClick={() => onPerson?.(p.id)} />}
                <Html position={[x, 1.15, -2.3]} center className="pole-label" zIndexRange={[12, 0]}>
                  <span>{p.label}</span>
                </Html>
              </>
            )}
          </group>
        );
      })}
      <RoundTable position={[0, 0, 1.3]} radius={0.65} color="#e8d7c3" />
      {[0, 1.25, 2.5, 3.75, 5].map((a) => (
        <Chair key={a} position={[Math.cos(a) * 1.05, 0, 1.3 + Math.sin(a) * 1.05]} rotation={-a - Math.PI / 2} color="#c48aa8" />
      ))}
      <WallScreen position={[0, 0, -3.5]} color="#be185d" />
      <Plant position={[-2.2, 0, 3.1]} />
      <Plant position={[2.3, 0, 3.1]} />
    </>
  );
}

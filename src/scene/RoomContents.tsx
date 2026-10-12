import type { Agent, InventoryItem, Room, Vehicle } from '../types';
import { BREAK_STATUSES } from '../services/simulation';
import { Avatar } from './Avatar';
import { HelpdeskPoles, type PoleProps } from './HelpdeskPoles';
import { Cabinet, Car, Chair, CoffeeMachine, Counter, Desk, Plant, RoundTable, Shelf, Sofa, Tree, WallScreen } from './furniture';

export interface RoomContentProps extends PoleProps {
  room: Room;
  agents: Agent[];
  vehicles: Vehicle[];
  inventory: InventoryItem[];
  animate: boolean;
  onAgentClick?: (agent: Agent) => void;
}

const vehicleColors: Record<Vehicle['status'], string> = {
  Disponible: '#22a06b',
  Réservé: '#2f6fe4',
  Entretien: '#f59e0b',
};

/** Places assises de la salle de pause (position, orientation). */
const pauseSeats: [number, number, number][] = [
  [-0.95, 0.55, Math.PI],
  [-0.45, 0.55, Math.PI],
  [0.35, -0.2, Math.PI / 2],
  [0.35, 0.45, Math.PI / 2],
  [-0.95, -0.55, 0],
  [-0.45, -0.55, 0],
  [1.1, 1.1, Math.PI],
  [0.6, 1.1, Math.PI],
];

export function RoomContents({ room, agents, vehicles, inventory, animate, onAgentClick, ...poles }: RoomContentProps) {
  switch (room.id) {
    case 'helpdesk':
      return (
        <>
          <HelpdeskPoles agents={agents} animate={animate} onAgentClick={onAgentClick} {...poles} />
          <WallScreen position={[0, 0, -3.52]} />
        </>
      );
    case 'pause': {
      const onBreak = agents.filter((a) => BREAK_STATUSES.includes(a.status));
      return (
        <>
          <RoundTable position={[-0.7, 0, 0]} radius={0.5} />
          <Sofa position={[1.1, 0, 1.25]} rotation={Math.PI} />
          <Counter position={[0.6, 0, -1.45]} width={1.8} />
          <CoffeeMachine position={[1.1, 0, -1.45]} />
          <Plant position={[-1.35, 0, 1.4]} />
          {onBreak.slice(0, pauseSeats.length).map((agent, i) => {
            const [x, z, r] = pauseSeats[i];
            return <Avatar key={agent.id} agent={agent} position={[x, 0, z]} rotation={r} seated={false} animate={animate} onClick={onAgentClick} />;
          })}
        </>
      );
    }
    case 'accueil':
      return (
        <>
          <Counter position={[0, 0, -0.5]} width={1.8} />
          <WallScreen position={[0, 0, -1.65]} color="#3176e9" />
          {[-1.1, -0.6, 0.6, 1.1].map((x) => (
            <Chair key={x} position={[x, 0, 1.2]} rotation={Math.PI} color="#7b93b8" />
          ))}
          <RoundTable position={[0, 0, 1.25]} radius={0.22} color="#e8ecf2" />
          <Plant position={[-1.4, 0, -1.4]} scale={1.2} />
          <Plant position={[1.4, 0, 1.4]} />
        </>
      );
    case 'stock': {
      const fill = (i: number) => {
        const item = inventory[i];
        if (!item) return 0.5;
        return Math.min(1, item.inStock / (item.alertThreshold * 2.5));
      };
      return (
        <>
          <Shelf position={[-0.8, 0, -1.4]} fill={fill(0)} />
          <Shelf position={[0.8, 0, -1.4]} fill={fill(2)} />
          <Shelf position={[-1.4, 0, 0.3]} rotation={Math.PI / 2} fill={fill(4)} />
          <Desk position={[0.6, 0, 0.6]} />
          <Chair position={[0.6, 0, 1.02]} />
          <Cabinet position={[1.3, 0, 1.4]} rotation={Math.PI} />
        </>
      );
    }
    case 'rh':
      return (
        <>
          <Desk position={[-0.7, 0, -0.9]} />
          <Chair position={[-0.7, 0, -0.48]} />
          <Desk position={[0.7, 0, -0.9]} />
          <Chair position={[0.7, 0, -0.48]} />
          <RoundTable position={[0.3, 0, 0.9]} radius={0.4} />
          {[[-0.25, 0.9], [0.85, 0.9], [0.3, 1.45]].map(([x, z]) => (
            <Chair key={`${x}${z}`} position={[x, 0, z]} rotation={Math.PI} color="#9a6fc2" />
          ))}
          <Cabinet position={[-1.35, 0, 0.6]} rotation={Math.PI / 2} />
          <Plant position={[-1.35, 0, 1.4]} />
        </>
      );
    case 'direction':
      return (
        <>
          <Desk position={[-0.6, 0, -1]} />
          <Chair position={[-0.6, 0, -0.58]} color="#33415a" />
          <Counter position={[0.55, 0, 0.75]} width={1.6} />
          {[-0.05, 0.55, 1.15].map((x) => (
            <Chair key={x} position={[x, 0, 1.25]} rotation={Math.PI} color="#b48a2c" />
          ))}
          <WallScreen position={[0.6, 0, -1.65]} color="#e3a72f" />
          <Plant position={[1.4, 0, -1.3]} />
        </>
      );
    case 'parking':
      return (
        <>
          {[-3.6, -1.8, 0, 1.8, 3.6].map((x) => (
            <mesh key={x} position={[x - 0.9, 0.005, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.05, 1.9]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
          {vehicles.slice(0, 5).map((v, i) => (
            <Car key={v.id} position={[-3.6 + i * 1.8, 0, -0.2]} color={vehicleColors[v.status]} />
          ))}
          {[-4.9, 4.9].map((x) => (
            <Tree key={x} position={[x, 0, 1.2]} />
          ))}
          <Tree position={[-2.5, 0, 1.3]} />
          <Tree position={[2.5, 0, 1.3]} />
        </>
      );
  }
}

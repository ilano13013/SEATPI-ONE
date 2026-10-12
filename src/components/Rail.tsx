import { Briefcase, Building2, Car, Coffee, DoorOpen, Headphones, Package, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { RoomId } from '../types';
import { roomById } from '../data/layout';

const items: [RoomId, LucideIcon][] = [
  ['helpdesk', Headphones],
  ['pause', Coffee],
  ['accueil', DoorOpen],
  ['rh', Users],
  ['stock', Package],
  ['parking', Car],
  ['direction', Wallet],
];

export function Rail({
  selected,
  externalActive,
  onSelect,
  onOverview,
  onExternal,
}: {
  selected: RoomId | null;
  externalActive: boolean;
  onSelect: (id: RoomId) => void;
  onOverview: () => void;
  onExternal: () => void;
}) {
  return (
    <nav className="rail" aria-label="Modules">
      <div className="brand" aria-hidden>
        S<span>1</span>
      </div>
      <button title="Vue d'ensemble" aria-label="Vue d'ensemble" onClick={onOverview}>
        <Building2 size={20} />
      </button>
      {items.map(([id, Icon]) => {
        const label = roomById(id).label;
        return (
          <button key={id} title={label} aria-label={label} aria-current={selected === id} className={selected === id ? 'active' : ''} onClick={() => onSelect(id)}>
            <Icon size={20} />
          </button>
        );
      })}
      <button title="Clients externes" aria-label="Clients externes" aria-current={externalActive} className={externalActive ? 'active' : ''} onClick={onExternal}>
        <Briefcase size={20} />
      </button>
    </nav>
  );
}

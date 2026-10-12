import { useState } from 'react';
import {
  BookUser,
  Briefcase,
  CalendarCheck,
  ChevronsLeft,
  ChevronsRight,
  Headphones,
  Landmark,
  Lock,
  Map as MapIcon,
  PhoneCall,
  PiggyBank,
  Plane,
  Plug,
  Server,
  Settings,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { VIEW_LABEL, viewAccess, type AppView, type ModuleView } from '../auth/access';
import type { Role } from '../auth/roles';

export type { AppView };

const GROUPS: { label: string; items: { view: ModuleView; Icon: LucideIcon }[] }[] = [
  {
    label: 'Opérations',
    items: [
      { view: 'helpdesk', Icon: Headphones },
      { view: 'externes', Icon: Briefcase },
      { view: 'telephonie', Icon: PhoneCall },
      { view: 'mco', Icon: Wrench },
      { view: 'exploitation', Icon: Server },
      { view: 'itsm', Icon: Plug },
    ],
  },
  {
    label: 'Management',
    items: [
      { view: 'management', Icon: CalendarCheck },
      { view: 'moyens', Icon: Plane },
      { view: 'crm', Icon: BookUser },
    ],
  },
  {
    label: 'Finance',
    items: [
      { view: 'finance', Icon: PiggyBank },
      { view: 'pdg', Icon: Landmark },
    ],
  },
  {
    label: 'Administration',
    items: [
      { view: 'production', Icon: ShieldCheck },
      { view: 'admin', Icon: Settings },
    ],
  },
];

const KEY = 'seatpi-rail-expanded';
const readExpanded = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? window.innerWidth >= 900 : v === '1';
  } catch {
    return window.innerWidth >= 900;
  }
};

/** Menu latéral repliable : mêmes règles d'accès que la carte des sites (vue verrouillée = droit manquant). */
export function Rail({ view, role, onOpen, onCarte }: { view: AppView; role: Role; onOpen: (v: ModuleView) => void; onCarte: () => void }) {
  const [expanded, setExpanded] = useState(readExpanded);
  const toggle = () =>
    setExpanded((e) => {
      try {
        localStorage.setItem(KEY, e ? '0' : '1');
      } catch {
        /* préférence non mémorisée */
      }
      return !e;
    });
  return (
    <nav className={`rail ${expanded ? 'expanded' : ''}`} aria-label="Modules">
      <div className="brand" aria-hidden>
        S<span>1</span>
        {expanded && <small>SEATPI ONE</small>}
      </div>
      <button className="rail-toggle" onClick={toggle} aria-expanded={expanded} aria-label={expanded ? 'Replier le menu' : 'Déplier le menu'} title={expanded ? 'Replier le menu' : 'Déplier le menu'}>
        {expanded ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
      </button>
      <button title="Carte des sites" aria-label="Carte des sites" aria-current={view === 'jumeau' ? 'page' : undefined} className={view === 'jumeau' ? 'active' : ''} onClick={onCarte}>
        <MapIcon size={20} aria-hidden />
        {expanded && <span>Carte des sites</span>}
      </button>
      {GROUPS.map((g) => (
        <div className="rail-group" key={g.label} role="group" aria-label={g.label}>
          {expanded ? <h2 className="rail-title">{g.label}</h2> : <i className="rail-sep" aria-hidden />}
          {g.items.map(({ view: v, Icon }) => {
            const label = VIEW_LABEL[v];
            const access = viewAccess(role, v);
            const title = access.ok ? label : `${label} — ${access.message}`;
            return (
              <button key={v} title={title} aria-label={access.ok ? label : `${label} (accès refusé)`} aria-current={view === v ? 'page' : undefined} className={`${view === v ? 'active' : ''} ${access.ok ? '' : 'locked'}`} onClick={() => onOpen(v)}>
                <Icon size={20} aria-hidden />
                {expanded && <span>{label}</span>}
                {!access.ok && <Lock size={11} className="rail-lock" aria-hidden />}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

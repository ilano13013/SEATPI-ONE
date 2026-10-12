import { PhoneCall, Plane, Server, Wrench, Briefcase, CalendarCheck, Headphones, Landmark, Map as MapIcon, PiggyBank, Plug, ShieldCheck, type LucideIcon } from 'lucide-react';

/** Vues principales de l'application, accessibles sans passer par la 3D. */
export type AppView = 'admin' | 'jumeau' | 'externes' | 'itsm' | 'helpdesk' | 'management' | 'mco' | 'exploitation' | 'moyens' | 'telephonie' | 'finance' | 'pdg' | 'production';

const MODULES: { view: AppView; label: string; Icon: LucideIcon }[] = [
  { view: 'helpdesk', label: 'Cockpit Helpdesk consolidé', Icon: Headphones },
  { view: 'externes', label: 'Clients externes', Icon: Briefcase },
  { view: 'telephonie', label: 'SLA décroché (QlikView)', Icon: PhoneCall },
  { view: 'management', label: 'Management : congés, CRA, objectifs', Icon: CalendarCheck },
  { view: 'mco', label: 'Cockpit MCO / Support N2', Icon: Wrench },
  { view: 'exploitation', label: 'Cockpit Exploitation', Icon: Server },
  { view: 'moyens', label: 'Moyens généraux : déplacements', Icon: Plane },
  { view: 'finance', label: 'Budget & Rentabilité Helpdesk', Icon: PiggyBank },
  { view: 'pdg', label: 'Cockpit PDG', Icon: Landmark },
  { view: 'itsm', label: 'Connecteurs ITSM', Icon: Plug },
  { view: 'production', label: 'Préparation à la production', Icon: ShieldCheck },
];

export function Rail({ view, available, onOpen, onCarte }: { view: AppView; available: Set<AppView>; onOpen: (v: AppView) => void; onCarte: () => void }) {
  return (
    <nav className="rail" aria-label="Modules">
      <div className="brand" aria-hidden>
        S<span>1</span>
      </div>
      <button title="Carte des sites (3D)" aria-label="Carte des sites" aria-current={view === 'jumeau'} className={view === 'jumeau' ? 'active' : ''} onClick={onCarte}>
        <MapIcon size={20} />
      </button>
      <i className="rail-sep" aria-hidden />
      {MODULES.filter((m) => available.has(m.view)).map(({ view: v, label, Icon }) => (
        <button key={v} title={label} aria-label={label} aria-current={view === v} className={view === v ? 'active' : ''} onClick={() => onOpen(v)}>
          <Icon size={20} />
        </button>
      ))}
    </nav>
  );
}

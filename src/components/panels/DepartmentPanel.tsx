import type { Room, SiteId } from '../../types';
import { departments, hasDepartment, siteById, type DepartmentId } from '../../data/sites';
import { peopleIn } from '../../org/people';

const KIND_TO_DEPARTMENT: Partial<Record<Room['kind'], DepartmentId>> = {
  helpdesk: 'helpdesk',
  mco: 'mco',
  exploitation: 'exploitation',
  formation: 'formation',
  csm: 'csm',
  rh: 'rh',
  finance: 'finance',
  commercial: 'commercial',
  direction: 'direction',
  recrutement: 'recrutement',
  moyens: 'moyens',
  stock: 'stock',
};

/** Modules applicatifs accessibles depuis un espace. */
export type ModuleLink = 'helpdesk' | 'management' | 'finance' | 'moyens' | 'deplacements' | 'recrutement' | 'pdg' | 'mco' | 'exploitation' | 'production';

const LINKS: Partial<Record<Room['kind'], { module: ModuleLink; label: string }[]>> = {
  helpdesk: [{ module: 'helpdesk', label: 'Cockpit Helpdesk consolidé' }, { module: 'management', label: 'Management : congés, CRA, objectifs' }],
  mco: [{ module: 'mco', label: 'Cockpit MCO / Support N2' }],
  exploitation: [{ module: 'exploitation', label: 'Cockpit Exploitation' }],
  moyens: [{ module: 'moyens', label: 'Moyens généraux : déplacements professionnels' }],
  finance: [{ module: 'finance', label: 'Budget & Rentabilité du Helpdesk' }, { module: 'deplacements', label: 'Enveloppe déplacements Helpdesk' }],
  recrutement: [{ module: 'recrutement', label: 'Budget recrutement' }],
  direction: [{ module: 'pdg', label: 'Cockpit PDG' }],
  rh: [{ module: 'management', label: 'Congés et CRA' }],
};

export function moduleLinksFor(kind: Room['kind']) {
  return LINKS[kind] ?? [];
}

/** Panneau d'un département : rattachement au site, encadrement et accès aux modules. */
export function DepartmentPanel({ room, site, onOpenModule, available }: { room: Room; site: SiteId; onOpenModule?: (m: ModuleLink) => void; available: Set<ModuleLink> }) {
  const dep = KIND_TO_DEPARTMENT[room.kind];
  const department = dep ? departments.find((d) => d.id === dep) : undefined;
  const people = peopleIn(site, room.kind);
  const links = moduleLinksFor(room.kind).filter((l) => available.has(l.module));
  return (
    <>
      <div className="kv">
        <span>Site</span>
        <b>
          {siteById(site).name}
          {siteById(site).main ? ' (site principal)' : ''}
        </b>
      </div>
      {department && (
        <>
          <div className="kv">
            <span>Département</span>
            <b>{department.label}</b>
          </div>
          <div className="kv">
            <span>Implantations</span>
            <b>{department.sites.map((s) => siteById(s).name).join(', ')}</b>
          </div>
          <p className="hint">{department.description}</p>
        </>
      )}
      {people.length > 0 && (
        <>
          <h3>Encadrement</h3>
          {people.map((p) => (
            <div className="kv" key={p.id}>
              <span>
                <b>{p.name}</b> <small>{p.title}</small>
              </span>
            </div>
          ))}
        </>
      )}
      {links.map((l) => (
        <button key={l.module} className="action primary" onClick={() => onOpenModule?.(l.module)}>
          Ouvrir : {l.label}
        </button>
      ))}
      {dep && !hasDepartment(site, dep) && <p className="hint">Ce département n’est pas implanté sur ce site.</p>}
      <p className="hint">Implantation de démonstration, configurable dans src/data/sites.ts.</p>
    </>
  );
}

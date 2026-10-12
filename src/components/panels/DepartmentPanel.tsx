import type { Room, SiteId } from '../../types';
import { departments, hasDepartment, siteById, type DepartmentId } from '../../data/sites';
import { peopleIn } from '../../org/people';
import { Lock } from 'lucide-react';
import { comingFeature, MODULE_VIEW, moduleLinksFor, viewAccess, type ModuleLink } from '../../auth/access';
import type { Role } from '../../auth/roles';
import { AccessNotice } from '../ui';

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

export type { ModuleLink };

/** Liens d'un espace vers ses modules : mêmes règles que le menu (droit manquant expliqué). */
export function ModuleLinks({ room, role, onOpenModule }: { room: Room; role: Role; onOpenModule?: (m: ModuleLink) => void }) {
  const links = moduleLinksFor(room.kind);
  const coming = comingFeature(room);
  return (
    <>
      {links.map((l) => {
        const access = viewAccess(role, MODULE_VIEW[l.module]);
        return access.ok ? (
          <button key={l.module} className="action primary" onClick={() => onOpenModule?.(l.module)}>
            Ouvrir : {l.label}
          </button>
        ) : (
          <div key={l.module} className="link-refused">
            <button className="action" disabled aria-describedby={`why-${room.id}-${l.module}`}>
              <Lock size={12} aria-hidden /> {l.label}
            </button>
            <small id={`why-${room.id}-${l.module}`}>{access.message}</small>
          </div>
        );
      })}
      {coming && !coming.ok && <AccessNotice access={coming} />}
    </>
  );
}

/** Panneau d'un département : rattachement au site, encadrement et accès aux modules. */
export function DepartmentPanel({ room, site, role, onOpenModule }: { room: Room; site: SiteId; role: Role; onOpenModule?: (m: ModuleLink) => void }) {
  const dep = KIND_TO_DEPARTMENT[room.kind];
  const department = dep ? departments.find((d) => d.id === dep) : undefined;
  const people = peopleIn(site, room.kind);
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
      <ModuleLinks room={room} role={role} onOpenModule={onOpenModule} />
      {dep && !hasDepartment(site, dep) && <p className="hint">Ce département n’est pas implanté sur ce site.</p>}
      <p className="hint">Implantation de démonstration, modifiable dans le référentiel des sites.</p>
    </>
  );
}

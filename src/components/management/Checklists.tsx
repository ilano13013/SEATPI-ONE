// Checklists de suivi managérial : CRA et congés.
// Une coche « Traité » est un suivi interne à SEATPI ONE, PAS une validation officielle
// dans l'outil RH / CRA tant qu'aucune intégration réelle n'existe.
import { useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import type { ManagementStore } from '../../management/useManagement';
import { craChecklist, FOLLOW_STATUSES, leaveChecklist, NO_FILTERS, type ChecklistFilters, type FollowStatus } from '../../management/checklists';
import { personById } from '../../org/people';
import { orgPeople } from '../../org/people';
import { internalSites } from '../../data/sites';

interface Common {
  store: ManagementStore;
  /** Collaborateurs du périmètre (null = tout le département). */
  scope: Set<string> | null;
  user: string;
  canFollow: boolean;
  /** Adresse de l'outil officiel (CRA ou RH) ; absente = « URL de l'outil à renseigner ». */
  toolUrl?: string;
}

const fmtD = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
export const OFFICIAL_NOTE = 'Suivi interne à SEATPI ONE : le statut « Traité » signifie seulement que le manager a fait le nécessaire ; ce n’est pas une validation officielle dans l’outil RH ou CRA et cela ne modifie ni l’état RH ni les effectifs prévus.';

/** Lien vers l'outil officiel, uniquement si son adresse est configurée (jamais inventée). */
function ToolLink({ url, label }: { url?: string; label: string }) {
  return url ? (
    <a className="ghost ck-tool" href={url} target="_blank" rel="noopener noreferrer">
      Ouvrir l’{label}
    </a>
  ) : (
    <span className="ck-tool nr" title="À renseigner dans Administration → Paramètres SLA et tableaux de bord">
      {label.charAt(0).toUpperCase() + label.slice(1)} : URL de l’outil à renseigner
    </span>
  );
}

function Filters({ store, scope, value, onChange, withWeek }: { store: ManagementStore; scope: Set<string> | null; value: ChecklistFilters; onChange: (f: ChecklistFilters) => void; withWeek: boolean }) {
  const people = store.state.collaborators.filter((c) => (!scope || scope.has(c.id)) && (c.population === 'Agent N1' || c.population === 'Technicien N2'));
  const teams = [...new Map(people.map((c) => [c.teamId, c.teamLabel])).entries()];
  const managers = [...new Set(people.map((c) => c.managerId).filter(Boolean))] as string[];
  const weeks = [...new Set(store.state.cra.map((s) => s.weekStart))].sort().reverse();
  return (
    <div className="xc-toolbar">
      <select aria-label="Équipe" value={value.team} onChange={(e) => onChange({ ...value, team: e.target.value })}>
        <option value="">Toutes les équipes</option>
        {teams.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <select aria-label="Site" value={value.site ?? ''} onChange={(e) => onChange({ ...value, site: e.target.value })}>
        <option value="">Tous les sites</option>
        {internalSites.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <select aria-label="Manager" value={value.manager} onChange={(e) => onChange({ ...value, manager: e.target.value })}>
        <option value="">Tous les managers</option>
        {managers.map((m) => (
          <option key={m} value={m}>
            {personById(m)?.name ?? orgPeople.find((p) => p.id === m)?.name ?? m}
          </option>
        ))}
      </select>
      {withWeek && (
        <select aria-label="Période" value={value.week} onChange={(e) => onChange({ ...value, week: e.target.value })}>
          <option value="">Toutes les semaines</option>
          {weeks.map((w) => (
            <option key={w} value={w}>
              Semaine du {fmtD(w)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

const lastFollow = (store: ManagementStore, key: string) => {
  const h = store.state.followUps[key]?.history ?? [];
  return h[h.length - 1];
};

/** Contrôle unique du suivi interne : À traiter / Relancé / Traité, avec le dernier suivi visible. */
function FollowControl({ status, label, disabled, onChange, last }: { status: FollowStatus; label: string; disabled: boolean; onChange: (s: FollowStatus) => void; last?: { at: number; by: string; to: FollowStatus } }) {
  return (
    <span className="ck-follow">
      <select aria-label={`Suivi : ${label}`} disabled={disabled} value={status} onChange={(e) => onChange(e.target.value as FollowStatus)} title={disabled ? 'Suivi réservé aux profils disposant du droit « Modification » sur le Management' : undefined}>
        {FOLLOW_STATUSES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {last && (
        <small className="hint">
          {last.to} le {new Date(last.at).toLocaleDateString('fr-FR')} · {last.by}
        </small>
      )}
    </span>
  );
}

export function CraChecklistWidget({ store, scope, user, canFollow, toolUrl }: Common) {
  const weeks = useMemo(() => [...new Set(store.state.cra.map((s) => s.weekStart))].sort(), [store.state.cra]);
  const [f, setF] = useState<ChecklistFilters>({ ...NO_FILTERS, week: weeks[weeks.length - 1] ?? '' });
  const k = craChecklist(store.state.cra, store.state.collaborators, store.state.followUps, f, scope);
  const row = (i: (typeof k.missingItems)[number]) => (
    <li key={i.key} className={i.follow === 'Traité' ? 'done' : ''}>
      <span>
        <b>{i.person.name}</b> · {i.person.teamLabel} · semaine du {fmtD(i.sheet.weekStart)}
        {i.sheet.status === 'À corriger' ? ' · renvoyé pour correction' : ''}
      </span>
      <FollowControl status={i.follow} label={`CRA ${i.person.name} ${i.sheet.weekStart}`} disabled={!canFollow} last={lastFollow(store, i.key)} onChange={(s) => store.setFollowUp(i.key, s, user)} />
    </li>
  );
  return (
    <section className="ck" aria-label="Checklist CRA">
      <div className="ck-head">
        <h3>Checklist CRA</h3>
        <ToolLink url={toolUrl} label="outil CRA" />
      </div>
      <Filters store={store} scope={scope} value={f} onChange={setF} withWeek />
      <div className="xc-kpis">
        <div className="xc-kpi">
          <small>CRA attendus</small>
          <strong>{k.expected}</strong>
        </div>
        <div className="xc-kpi ok">
          <small>CRA reçus</small>
          <strong>{k.received}</strong>
        </div>
        <div className={`xc-kpi ${k.missing ? 'warn' : 'ok'}`}>
          <small>CRA manquants</small>
          <strong>{k.missing}</strong>
        </div>
        <div className={`xc-kpi ${k.pendingValidation ? 'warn' : 'ok'}`}>
          <small>En attente de validation</small>
          <strong>{k.pendingValidation}</strong>
        </div>
        <div className={`xc-kpi ${k.remaining ? 'warn' : 'ok'}`} aria-label="CRA restant à traiter">
          <small>Restant à traiter</small>
          <strong>{k.remaining}</strong>
        </div>
      </div>
      <div className="ck-cols">
        <div>
          <h4>Agents n’ayant pas envoyé leur CRA ({k.missingItems.filter((i) => i.follow !== 'Traité').length} à traiter)</h4>
          <ul className="ck-list">{k.missingItems.length ? k.missingItems.map(row) : <li className="hint">Aucun CRA manquant.</li>}</ul>
        </div>
        <div>
          <h4>CRA restant à valider ({k.pendingItems.filter((i) => i.follow !== 'Traité').length} à traiter)</h4>
          <ul className="ck-list">{k.pendingItems.length ? k.pendingItems.map(row) : <li className="hint">Aucun CRA en attente.</li>}</ul>
        </div>
      </div>
      <p className="hint">{OFFICIAL_NOTE} La validation des CRA se fait dans l’outil CRA de l’entreprise.</p>
    </section>
  );
}

export function LeaveChecklistWidget({ store, scope, user, canFollow, toolUrl }: Common) {
  const [f, setF] = useState<ChecklistFilters>(NO_FILTERS);
  const k = leaveChecklist(store.state.leaves, store.state.collaborators, store.state.followUps, store.state.rules, f, scope);
  return (
    <section className="ck" aria-label="Checklist congés">
      <div className="ck-head">
        <h3>Checklist congés</h3>
        <ToolLink url={toolUrl} label="outil RH" />
      </div>
      <Filters store={store} scope={scope} value={f} onChange={setF} withWeek={false} />
      <div className="xc-kpis">
        <div className={`xc-kpi ${k.pending ? 'warn' : 'ok'}`}>
          <small>Demandes en attente</small>
          <strong>{k.pending}</strong>
        </div>
        <div className={`xc-kpi ${k.remaining ? 'warn' : 'ok'}`} aria-label="Congés restant à traiter">
          <small>Restant à traiter</small>
          <strong>{k.remaining}</strong>
        </div>
      </div>
      <table className="xc-table compact">
        <thead>
          <tr>
            <th>Collaborateur</th>
            <th>Dates demandées</th>
            <th>Manager responsable</th>
            <th>Point d’attention</th>
            <th>Statut de suivi</th>
          </tr>
        </thead>
        <tbody>
          {k.items.map((i) => (
            <tr key={i.key} className={i.follow === 'Traité' ? 'done' : ''}>
              <td>
                {i.person.name}
                <br />
                <small className="hint">{i.person.teamLabel}</small>
              </td>
              <td>
                {i.leave.type} · {fmtD(i.leave.start)} → {fmtD(i.leave.end)} ({i.days} j)
              </td>
              <td>{personById(i.managerId ?? '')?.name ?? '—'}</td>
              <td>{i.conflicts.length ? <span className="xc-warn">Effectif réduit le {i.conflicts.map(fmtD).join(', ')}</span> : '—'}</td>
              <td>
                <FollowControl status={i.follow} label={`congé ${i.person.name} ${i.leave.start}`} disabled={!canFollow} last={lastFollow(store, i.key)} onChange={(s) => store.setFollowUp(i.key, s, user)} />
              </td>
            </tr>
          ))}
          {k.items.length === 0 && (
            <tr>
              <td colSpan={5} className="hint">
                Aucune demande en attente.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="hint">{OFFICIAL_NOTE} Pas de calcul de soldes ni de validation RH dans SEATPI ONE.</p>
    </section>
  );
}

/** Synthèse compacte (bureau 3D du manager, cockpit de la responsable Helpdesk). */
export function ChecklistSummary({ store, scope, onOpen }: { store: ManagementStore; scope: Set<string> | null; onOpen?: (tab: 'cra' | 'conges') => void }) {
  const weeks = [...new Set(store.state.cra.map((s) => s.weekStart))].sort();
  const cra = craChecklist(store.state.cra, store.state.collaborators, store.state.followUps, { ...NO_FILTERS, week: weeks[weeks.length - 1] ?? '' }, scope);
  const leave = leaveChecklist(store.state.leaves, store.state.collaborators, store.state.followUps, store.state.rules, NO_FILTERS, scope);
  const alert = cra.remaining + leave.remaining;
  return (
    <div className="ck-summary" aria-label="Checklists de suivi">
      <b>
        {alert > 0 && <Bell size={12} className="ck-bell" aria-hidden />} Checklists de suivi {alert > 0 ? `· ${alert} élément(s) en attente` : '· à jour'}
      </b>
      <button className="kv as-button" onClick={() => onOpen?.('cra')}>
        <span>CRA : {cra.missing} manquant(s), {cra.pendingValidation} à valider</span>
        <span className={`badge ${cra.remaining ? 'warn' : 'ok'}`}>{cra.remaining} à traiter</span>
      </button>
      <button className="kv as-button" onClick={() => onOpen?.('conges')}>
        <span>Congés : {leave.pending} demande(s) en attente</span>
        <span className={`badge ${leave.remaining ? 'warn' : 'ok'}`}>{leave.remaining} à traiter</span>
      </button>
    </div>
  );
}

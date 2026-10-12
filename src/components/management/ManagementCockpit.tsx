// Cockpit Management : équipe et effectifs prévisionnels, checklists de suivi des CRA et des
// congés, objectifs (volume / qualité) et historique du suivi — environnement simulé.
// SEATPI ONE ne remplace ni l'outil de congés ni l'outil CRA : il n'en fait que le suivi.
import { useMemo } from 'react';
import { AccessNotice } from '../ui';
import { missingRight } from '../../auth/access';
import { ArrowLeft } from 'lucide-react';
import type { ManagementStore } from '../../management/useManagement';
import { DEFAULT_N1_OBJECTIVES } from '../../management/useManagement';
import { leaveDays } from '../../management/rules';
import { teamOf, type Collaborator } from '../../org/collaborators';
import { orgPeople, personById } from '../../org/people';
import type { ObjectiveConfig } from '../../external/config';
import { computeObjectives, type ObjectiveRow } from '../../external/objectives';
import type { ExternalClient, Ticket } from '../../external/types';
import { dateKey } from '../../external/calendar';
import { clientRecord } from '../../config/itsm';
import { can, roleLabels, type Role } from '../../auth/roles';
import { Tabs } from '../ui';
import { fmtDateTime } from '../external/common';
import { InlineEdit } from '../InlineEdit';
import { CraChecklistWidget, LeaveChecklistWidget } from './Checklists';

export type MgmtTab = 'equipe' | 'cra' | 'conges' | 'objectifs' | 'historique';

export const MANAGER_IDS = ['resp-helpdesk', 'mgr-hd-lc', 'mgr-hd-mtp', 'mgr-mco', 'mgr-exp'];

export interface ObjectiveScope {
  client: ExternalClient;
  tickets: Ticket[];
  cfg: ObjectiveConfig;
  /** Équipe interne N1 (objectifs modifiables ici) ou client N2 (objectifs du cockpit client). */
  internal: boolean;
}

interface Props {
  store: ManagementStore;
  role: Role;
  persona: string;
  onPersona: (id: string) => void;
  tab: MgmtTab;
  onTab: (t: MgmtTab) => void;
  objectiveScopes: ObjectiveScope[];
  onExternalObjective: (clientId: string, key: keyof ObjectiveConfig, value: number) => void;
  now: number;
  onBack: () => void;
}

/** Périmètre d'un manager : collaborateurs placés sous sa responsabilité (directs et indirects). */
export function managerScope(persona: string, store: ManagementStore['state']): Collaborator[] {
  return teamOf(persona, store.collaborators);
}

export function ManagementCockpit({ store, role, persona, onPersona, tab, onTab, objectiveScopes, onExternalObjective, now, onBack }: Props) {
  const { state } = store;
  const me = personById(persona)!;
  const people = useMemo(() => managerScope(persona, state), [persona, state]);
  const scope = useMemo(() => new Set(people.map((p) => p.id)), [people]);
  const user = `${roleLabels[role]} (démonstration)`;
  const canFollow = can(role, 'management', 'edit');
  const canEditPeople = can(role, 'collaborateurs', 'edit');
  const today = dateKey(now);
  const onLeaveToday = new Set(state.leaves.filter((l) => l.status === 'Validée' && leaveDays(l.start, l.end).includes(today)).map((l) => l.personId));
  const teams = [...new Map(people.filter((p) => p.population === 'Agent N1' || p.population === 'Technicien N2').map((p) => [p.teamId, p.teamLabel])).entries()];
  const managerOptions = orgPeople.filter((p) => p.role !== 'pdg').map((p) => ({ value: p.id, label: p.name }));

  if (!can(role, 'management'))
    return (
      <section className="xc mg" aria-label="Cockpit Management">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <AccessNotice access={missingRight(role, ['management'])} />
      </section>
    );

  return (
    <section className="xc mg" aria-label="Cockpit Management">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <div>
          <b>Management — {me.title}</b>
          <span>{people.length} collaborateur(s) dans le périmètre · suivi managérial (CRA et congés gérés dans les outils RH)</span>
        </div>
        <label className="xc-inline">
          Agir en tant que
          <select value={persona} onChange={(e) => onPersona(e.target.value)}>
            {MANAGER_IDS.map((id) => (
              <option key={id} value={id}>
                {personById(id)?.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="xc-tabs">
        <Tabs
          value={tab}
          onChange={onTab}
          tabs={[
            { id: 'equipe', label: 'Équipe et effectifs' },
            { id: 'cra', label: 'Checklist CRA' },
            { id: 'conges', label: 'Checklist congés' },
            { id: 'objectifs', label: 'Objectifs' },
            { id: 'historique', label: 'Historique du suivi' },
          ]}
        />
      </div>

      {tab === 'equipe' && (
        <>
          <h3>Effectifs prévisionnels par équipe</h3>
          <div className="xc-tablewrap">
            <table className="xc-table compact">
              <thead>
                <tr>
                  <th>Équipe</th>
                  <th>Effectif actuel</th>
                  <th>Effectif prévisionnel</th>
                  <th>Écart</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(([id, label]) => {
                  const current = state.collaborators.filter((c) => c.teamId === id).length;
                  const forecast = state.forecastHeadcount[id] ?? current;
                  return (
                    <tr key={id}>
                      <td>{label}</td>
                      <td>{current}</td>
                      <td>
                        <InlineEdit value={forecast} field={`Effectif prévisionnel ${label}`} module="Management" canEdit={canFollow} type="number" min={0} max={500} step={1} onSave={(v) => store.setForecast(id, v)} />
                      </td>
                      <td className={forecast !== current ? 'xc-warn' : ''}>{forecast - current > 0 ? `+${forecast - current}` : forecast - current}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3>Collaborateurs</h3>
          <div className="xc-tablewrap">
            <table className="xc-table compact">
              <thead>
                <tr>
                  <th>Collaborateur</th>
                  <th>Population</th>
                  <th>Équipe</th>
                  <th>Manager direct</th>
                  <th>ETP</th>
                  <th>Aujourd’hui</th>
                </tr>
              </thead>
              <tbody>
                {people.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <InlineEdit value={c.name} field={`Nom ${c.id}`} module="Collaborateurs" canEdit={canEditPeople} onSave={(v) => store.updateCollaborator(c.id, { name: v })} />
                    </td>
                    <td>{c.population}</td>
                    <td>{c.teamLabel}</td>
                    <td>
                      <InlineEdit value={c.managerId ?? ''} field={`Manager de ${c.name}`} module="Collaborateurs" canEdit={canEditPeople} sensitive options={managerOptions} format={(v) => personById(v)?.name ?? '—'} onSave={(v) => store.updateCollaborator(c.id, { managerId: v })} />
                    </td>
                    <td>
                      <InlineEdit value={c.etp} field={`ETP de ${c.name}`} module="Collaborateurs" canEdit={canEditPeople} type="number" min={0.1} max={1} step={0.1} onSave={(v) => store.updateCollaborator(c.id, { etp: v })} />
                    </td>
                    <td>{onLeaveToday.has(c.id) ? <span className="badge warn">En congé</span> : <span className="badge ok">Présent</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'cra' && <CraChecklistWidget store={store} scope={scope} user={user} canFollow={canFollow} />}
      {tab === 'conges' && <LeaveChecklistWidget store={store} scope={scope} user={user} canFollow={canFollow} />}

      {tab === 'objectifs' && (
        <Objectives
          scopes={objectiveScopes.filter((o) => (persona === 'mgr-mco' ? !o.internal : persona === 'resp-helpdesk' ? true : o.internal))}
          canEdit={(o) => can(role, 'objectifs', 'edit', { pole: o.internal ? (clientRecord(o.client.id)?.pole ?? undefined) : 'n2' })}
          now={now}
          onChange={(o, key, v) => (o.internal ? store.setInternalObjective(o.client.id, key, v) : onExternalObjective(o.client.id, key, v))}
        />
      )}

      {tab === 'historique' && (
        <ol className="xc-history mg-history">
          {Object.entries(state.followUps)
            .flatMap(([key, f]) => f.history.map((h) => ({ ...h, key })))
            .sort((a, b) => b.at - a.at)
            .map((h, i) => {
              const [kind, id] = h.key.split(':');
              const label =
                kind === 'cra'
                  ? `CRA ${state.collaborators.find((c) => id.endsWith(`-${c.id}`))?.name ?? id}`
                  : `Congé ${state.collaborators.find((c) => c.id === state.leaves.find((l) => l.id === id)?.personId)?.name ?? id}`;
              return (
                <li key={i}>
                  <time>{fmtDateTime(h.at)}</time> <b>{label}</b> : {h.from} → {h.to} · {h.by}
                </li>
              );
            })}
          {Object.keys(state.followUps).length === 0 && <li className="hint">Aucun suivi enregistré depuis le chargement.</li>}
        </ol>
      )}
    </section>
  );
}

function Objectives({ scopes, canEdit, now, onChange }: { scopes: ObjectiveScope[]; canEdit: (o: ObjectiveScope) => boolean; now: number; onChange: (o: ObjectiveScope, key: keyof ObjectiveConfig, v: number) => void }) {
  const fmt = (r: ObjectiveRow) => (r.actual === null ? '—' : `${r.actual.toLocaleString('fr-FR')} ${r.unit}`);
  return (
    <>
      <p className="hint">Objectifs de volume et de qualité séparés. Cliquez sur un objectif pour le modifier (selon vos droits) ; le réalisé est calculé et reste en lecture seule.</p>
      {scopes.map((o) => {
        const rows = computeObjectives(o.tickets, o.client, o.cfg, now);
        const editable = canEdit(o);
        return (
          <div key={`${o.internal ? 'n1' : 'n2'}-${o.client.id}`} className="mg-obj">
            <h4>
              {o.client.name} — {o.internal ? 'Équipe interne N1' : 'Site client N2'} {o.client.tool ? `· ${o.client.tool}` : ''}
            </h4>
            <div className="mg-obj-grid">
              {(['volume', 'qualité'] as const).map((kind) => (
                <table key={kind} className="xc-table compact">
                  <thead>
                    <tr>
                      <th>{kind === 'volume' ? 'Volume' : 'Qualité'}</th>
                      <th>Objectif</th>
                      <th>Réalisé</th>
                      <th>État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .filter((r) => r.kind === kind)
                      .map((r) => (
                        <tr key={r.key}>
                          <td>{r.label}</td>
                          <td>
                            <InlineEdit value={r.target} field={`${o.client.name} — ${r.label}`} module="Objectifs" canEdit={editable} type="number" min={0} format={(v) => `${v} ${r.unit}`} onSave={(v) => onChange(o, r.key, v)} />
                          </td>
                          <td>{fmt(r)}</td>
                          <td>
                            <span className={`badge ${r.status === 'atteint' || r.status === 'en bonne voie' ? 'ok' : r.status === 'à risque' ? 'warn' : 'bad'}`}>{r.status}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

export { DEFAULT_N1_OBJECTIVES };

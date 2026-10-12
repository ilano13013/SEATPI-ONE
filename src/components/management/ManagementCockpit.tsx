// Cockpit Management : équipe, congés (calendrier, conflits, validation), CRA,
// objectifs (volume / qualité), délégations et historique — environnement simulé.
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ManagementStore, MgmtResult } from '../../management/useManagement';
import { craActivities, DEFAULT_N1_OBJECTIVES } from '../../management/useManagement';
import { craCounters, craGap, declaredHours, expectedHours, leaveConflicts, leaveDays, teamPresence, weekKey, WORK_CALENDAR, type CraLine, type CraSheet, type LeaveType } from '../../management/rules';
import { teamOf, type Collaborator } from '../../org/collaborators';
import { orgPeople, personById } from '../../org/people';
import type { ObjectiveConfig } from '../../external/config';
import { computeObjectives, type ObjectiveRow } from '../../external/objectives';
import type { ExternalClient, Ticket } from '../../external/types';
import { addDays, dateKey, isBusinessDay } from '../../external/calendar';
import { can, type Role } from '../../auth/roles';
import { Tabs } from '../ui';
import { Modal, Toast, fmtDateTime } from '../external/common';

type Tab = 'equipe' | 'conges' | 'calendrier' | 'cra' | 'objectifs' | 'delegations' | 'historique';

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
  objectiveScopes: ObjectiveScope[];
  onExternalObjective: (clientId: string, key: keyof ObjectiveConfig, value: number) => void;
  now: number;
  onBack: () => void;
}

const DAY = 86_400_000;
const fmtD = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });

/** Périmètre d'un manager : son équipe et celles qui lui sont déléguées aujourd'hui. */
export function managerScope(persona: string, store: ManagementStore['state'], now: number): { people: Collaborator[]; delegatedFrom: string[] } {
  const day = dateKey(now);
  const delegatedFrom = store.delegations.filter((d) => d.toManagerId === persona && d.start <= day && d.end >= day).map((d) => d.fromManagerId);
  const ids = new Set<string>();
  const people: Collaborator[] = [];
  for (const m of [persona, ...delegatedFrom]) for (const c of teamOf(m, store.collaborators)) if (!ids.has(c.id)) (ids.add(c.id), people.push(c));
  return { people, delegatedFrom };
}

export function ManagementCockpit({ store, role, persona, onPersona, objectiveScopes, onExternalObjective, now, onBack }: Props) {
  const { state } = store;
  const [tab, setTab] = useState<Tab>('equipe');
  const [toast, setToast] = useState<MgmtResult | null>(null);
  const [leaveFilter, setLeaveFilter] = useState<'Soumise' | 'Validée' | 'Refusée' | 'toutes'>('Soumise');
  const [craFilter, setCraFilter] = useState<string | null>(null);
  const [craWeek, setCraWeek] = useState(() => [...new Set(state.cra.map((s) => s.weekStart))].sort().pop() ?? weekKey(now));
  const [editing, setEditing] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [force, setForce] = useState<Record<string, boolean>>({});
  const me = personById(persona)!;
  const { people, delegatedFrom } = useMemo(() => managerScope(persona, state, now), [persona, state, now]);
  const ids = useMemo(() => new Set(people.map((p) => p.id)), [people]);
  const byId = (id: string) => state.collaborators.find((c) => c.id === id);
  const manages = can(role, 'supervision', 'edit');
  const run = (r: MgmtResult) => (setToast(r.warnings?.length ? { ...r, message: `${r.message} ${r.warnings.join(' ')}` } : r), r);

  const leaves = state.leaves.filter((l) => ids.has(l.personId));
  const pending = leaves.filter((l) => l.status === 'Soumise');
  const sheets = state.cra.filter((s) => ids.has(s.personId) && s.weekStart === craWeek);
  const k = craCounters(sheets);
  const weeks = [...new Set(state.cra.map((s) => s.weekStart))].sort().reverse();
  const today = dateKey(now);
  const onLeaveToday = new Set(state.leaves.filter((l) => l.status === 'Validée' && leaveDays(l.start, l.end).includes(today)).map((l) => l.personId));

  return (
    <section className="xc mg" aria-label="Cockpit Management">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte 3D
        </button>
        <div>
          <b>Management — {me.title}</b>
          <span>
            {people.length} collaborateur(s) dans le périmètre{delegatedFrom.length ? ` · délégation reçue de ${delegatedFrom.map((d) => personById(d)?.name).join(', ')}` : ''} · règles RH de démonstration
          </span>
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
      {!manages && <p className="restricted">Votre rôle permet la consultation uniquement : validations, refus et délégations sont réservés à l’encadrement (maquette, pas une mesure de sécurité).</p>}

      <div className="xc-tabs">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'equipe', label: 'Équipe' },
            { id: 'conges', label: `Congés (${pending.length} à traiter)` },
            { id: 'calendrier', label: 'Calendrier et effectifs' },
            { id: 'cra', label: 'CRA' },
            { id: 'objectifs', label: 'Objectifs' },
            { id: 'delegations', label: 'Délégations' },
            { id: 'historique', label: 'Historique' },
          ]}
        />
      </div>

      {tab === 'equipe' && (
        <div className="xc-tablewrap">
          <table className="xc-table compact">
            <thead>
              <tr>
                <th>Collaborateur</th>
                <th>Population</th>
                <th>Équipe</th>
                <th>Manager direct</th>
                <th>Aujourd’hui</th>
                <th>Congés en attente</th>
                <th>CRA semaine</th>
              </tr>
            </thead>
            <tbody>
              {people.map((c) => {
                const sheet = state.cra.find((s) => s.personId === c.id && s.weekStart === weekKey(now));
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.population}</td>
                    <td>{c.teamLabel}</td>
                    <td>{personById(c.managerId ?? '')?.name ?? '—'}</td>
                    <td>{onLeaveToday.has(c.id) ? <span className="badge warn">En congé</span> : <span className="badge ok">Présent</span>}</td>
                    <td>{state.leaves.filter((l) => l.personId === c.id && l.status === 'Soumise').length || '—'}</td>
                    <td>{sheet ? sheet.status : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'conges' && (
        <>
          <div className="xc-periodbar">
            {(['Soumise', 'Validée', 'Refusée', 'toutes'] as const).map((f) => (
              <button key={f} className={leaveFilter === f ? 'active' : ''} onClick={() => setLeaveFilter(f)}>
                {f === 'toutes' ? 'Toutes' : f === 'Soumise' ? 'À traiter' : `${f}s`} ({f === 'toutes' ? leaves.length : leaves.filter((l) => l.status === f).length})
              </button>
            ))}
          </div>
          <LeaveForm people={people} onSubmit={(pid, type, s, e) => run(store.submitLeave(pid, type, s, e, byId(pid)?.name ?? pid))} />
          <div className="mg-leaves">
            {leaves
              .filter((l) => leaveFilter === 'toutes' || l.status === leaveFilter)
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((l) => {
                const c = byId(l.personId)!;
                const conflicts = l.status === 'Soumise' ? leaveConflicts(l, state.collaborators, state.leaves, state.rules) : [];
                return (
                  <article key={l.id} className={`mg-leave ${l.status === 'Soumise' ? 'pending' : l.status === 'Validée' ? 'ok' : 'bad'}`}>
                    <header>
                      <b>
                        {l.id} · {c.name}
                      </b>
                      <span className={`badge ${l.status === 'Validée' ? 'ok' : l.status === 'Refusée' ? 'bad' : 'info'}`}>{l.status}</span>
                    </header>
                    <p>
                      {l.type} du {fmtD(l.start)} au {fmtD(l.end)} · {leaveDays(l.start, l.end).length} jour(s) ouvré(s) · {c.teamLabel} · soumise le {fmtDateTime(l.submittedAt)}
                    </p>
                    {conflicts.length > 0 && (
                      <p className="xc-warn">
                        Conflit d’effectif : présence de l’équipe sous {Math.round(state.rules.minTeamPresence * 100)} % le(s) {conflicts.map(fmtD).join(', ')}.
                      </p>
                    )}
                    {l.comments.map((cm, i) => (
                      <p key={i} className="hint">
                        💬 {cm.by} : {cm.text}
                      </p>
                    ))}
                    {l.status === 'Soumise' && (
                      <div className="mg-actions">
                        <input aria-label={`Commentaire ${l.id}`} placeholder="Commentaire (obligatoire pour un refus)" value={comments[l.id] ?? ''} onChange={(e) => setComments({ ...comments, [l.id]: e.target.value })} />
                        {conflicts.length > 0 && (
                          <label className="xc-inline">
                            <input type="checkbox" checked={!!force[l.id]} onChange={(e) => setForce({ ...force, [l.id]: e.target.checked })} /> Valider malgré le conflit
                          </label>
                        )}
                        <button className="action" disabled={!manages} onClick={() => run(store.decideLeave(l.id, 'Validée', persona, role, comments[l.id] ?? '', !!force[l.id]))}>
                          Valider
                        </button>
                        <button className="ghost danger" disabled={!manages} onClick={() => run(store.decideLeave(l.id, 'Refusée', persona, role, comments[l.id] ?? ''))}>
                          Refuser
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
          </div>
        </>
      )}

      {tab === 'calendrier' && <LeaveCalendar people={people} store={store} now={now} />}

      {tab === 'cra' && (
        <>
          <div className="xc-toolbar">
            <label className="xc-inline">
              Semaine du
              <select value={craWeek} onChange={(e) => setCraWeek(e.target.value)}>
                {weeks.map((w) => (
                  <option key={w} value={w}>
                    {fmtD(w)}
                  </option>
                ))}
              </select>
            </label>
            <span className="hint">Les CRA déclarent le temps passé ; ils ne génèrent aucun revenu.</span>
          </div>
          <div className="xc-kpis">
            {(
              [
                ['Attendus', k.expected, null],
                ['Soumis', k.submitted, 'Soumis'],
                ['Validés', k.validated, 'Validé'],
                ['Manquants', k.missing, 'manquant'],
                ['À corriger', k.toFix, 'À corriger'],
                ['Heures déclarées', k.declaredHours, null],
                ['Heures validées', k.validatedHours, 'Validé'],
              ] as const
            ).map(([label, value, f]) => (
              <button key={label} className={`xc-kpi${craFilter === f && f ? ' active' : ''}`} onClick={() => setCraFilter(f)}>
                <small>{label}</small>
                <strong>{value.toLocaleString('fr-FR')}</strong>
                <em>{f ? 'filtrer la liste' : 'tout afficher'}</em>
              </button>
            ))}
          </div>
          <div className="xc-tablewrap">
            <table className="xc-table compact">
              <thead>
                <tr>
                  <th>Collaborateur</th>
                  <th>Statut</th>
                  <th>Affectations</th>
                  <th>Déclaré</th>
                  <th>Attendu</th>
                  <th>Écart</th>
                </tr>
              </thead>
              <tbody>
                {sheets
                  .filter((s) => !craFilter || (craFilter === 'manquant' ? s.status === 'À saisir' || s.status === 'Brouillon' : s.status === craFilter))
                  .map((s) => {
                    const c = byId(s.personId)!;
                    const gap = craGap(s, c, state.leaves);
                    return (
                      <tr key={s.id} tabIndex={0} onClick={() => setEditing(s.id)} onKeyDown={(e) => e.key === 'Enter' && setEditing(s.id)}>
                        <td>{c.name}</td>
                        <td>
                          <span className={`badge ${s.status === 'Validé' ? 'ok' : s.status === 'À corriger' ? 'bad' : s.status === 'Soumis' ? 'info' : 'muted'}`}>{s.status}</span>
                        </td>
                        <td>{s.lines.map((l) => l.activity).join(', ')}</td>
                        <td>{declaredHours(s)} h</td>
                        <td>{expectedHours(c, s.weekStart, state.leaves)} h</td>
                        <td className={Math.abs(gap) > 1 && s.status !== 'À saisir' ? 'xc-warn' : ''}>{gap > 0 ? `+${gap}` : gap} h</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'objectifs' && (
        <Objectives scopes={objectiveScopes.filter((o) => (persona === 'mgr-mco' ? !o.internal : persona === 'resp-helpdesk' ? true : o.internal))} editable={can(role, 'externes', 'configure') || manages} now={now} onChange={(o, key, v) => (o.internal ? store.setInternalObjective(o.client.id, key, v) : onExternalObjective(o.client.id, key, v))} />
      )}

      {tab === 'delegations' && <Delegations store={store} persona={persona} role={role} run={run} />}

      {tab === 'historique' && (
        <ol className="xc-history mg-history">
          {[
            ...leaves.flatMap((l) => l.history.map((h) => ({ ...h, what: `${l.id} (${l.type}, ${byId(l.personId)?.name})` }))),
            ...state.cra.filter((s) => ids.has(s.personId)).flatMap((s) => s.history.map((h) => ({ ...h, what: `CRA ${fmtD(s.weekStart)} (${byId(s.personId)?.name})` }))),
          ]
            .sort((a, b) => b.at - a.at)
            .slice(0, 120)
            .map((h, i) => (
              <li key={i}>
                <time>{fmtDateTime(h.at)}</time> <b>{h.action}</b> — {h.what} · par {h.by}
                {h.note ? ` · « ${h.note} »` : ''}
              </li>
            ))}
        </ol>
      )}

      {editing && (
        <CraEditor
          sheet={state.cra.find((s) => s.id === editing)!}
          person={byId(state.cra.find((s) => s.id === editing)!.personId)!}
          expected={expectedHours(byId(state.cra.find((s) => s.id === editing)!.personId)!, state.cra.find((s) => s.id === editing)!.weekStart, state.leaves)}
          manages={manages}
          onClose={() => setEditing(null)}
          onAction={(lines, next, comment) => {
            const sheet = state.cra.find((s) => s.id === editing)!;
            const actor = next === 'Validé' || next === 'À corriger' ? persona : sheet.personId;
            const r = run(store.updateCra(editing, lines, next, actor, role, comment));
            if (r.ok && next !== 'Brouillon') setEditing(null);
          }}
        />
      )}
      {toast && <Toast message={toast.message} ok={toast.ok} onDone={() => setToast(null)} />}
    </section>
  );
}

function LeaveForm({ people, onSubmit }: { people: Collaborator[]; onSubmit: (personId: string, type: LeaveType, start: string, end: string) => MgmtResult }) {
  const [open, setOpen] = useState(false);
  const [pid, setPid] = useState(people[0]?.id ?? '');
  const [type, setType] = useState<LeaveType>('Congés payés');
  const tomorrow = dateKey(Date.now() + 14 * DAY);
  const [start, setStart] = useState(tomorrow);
  const [end, setEnd] = useState(tomorrow);
  if (!open)
    return (
      <button className="ghost" onClick={() => setOpen(true)}>
        + Saisir une demande pour un collaborateur (simulation de la soumission salarié)
      </button>
    );
  return (
    <div className="mg-form">
      <select aria-label="Collaborateur" value={pid} onChange={(e) => setPid(e.target.value)}>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.teamLabel}
          </option>
        ))}
      </select>
      <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
        <option>Congés payés</option>
        <option>RTT</option>
        <option>Formation</option>
      </select>
      <input aria-label="Début" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      <input aria-label="Fin" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      <button className="action" onClick={() => onSubmit(pid, type, start, end).ok && setOpen(false)}>
        Soumettre
      </button>
      <button className="ghost" onClick={() => setOpen(false)}>
        Annuler
      </button>
    </div>
  );
}

function LeaveCalendar({ people, store, now }: { people: Collaborator[]; store: ManagementStore; now: number }) {
  const teams = [...new Set(people.filter((p) => p.population !== 'Encadrement').map((p) => p.teamId))];
  const [team, setTeam] = useState(teams[0] ?? '');
  const days: string[] = [];
  for (let t = now; days.length < 15; t = addDays(t, 1)) if (isBusinessDay(t, WORK_CALENDAR)) days.push(dateKey(t));
  const members = store.state.collaborators.filter((c) => c.teamId === team);
  const { leaves, rules, collaborators } = store.state;
  const cell = (pid: string, d: string) => leaves.find((l) => l.personId === pid && l.status !== 'Refusée' && leaveDays(l.start, l.end).includes(d));
  return (
    <>
      <label className="xc-inline">
        Équipe
        <select value={team} onChange={(e) => setTeam(e.target.value)}>
          {teams.map((t) => (
            <option key={t} value={t}>
              {collaborators.find((c) => c.teamId === t)?.teamLabel ?? t}
            </option>
          ))}
        </select>
      </label>
      <div className="xc-tablewrap">
        <table className="xc-table compact mg-cal">
          <thead>
            <tr>
              <th>Collaborateur</th>
              {days.map((d) => (
                <th key={d}>{fmtD(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                {days.map((d) => {
                  const l = cell(m.id, d);
                  return <td key={d} className={l ? (l.status === 'Validée' ? 'off' : 'asked') : ''} title={l ? `${l.type} · ${l.status}` : 'Présent'}>{l ? (l.status === 'Validée' ? 'C' : '?') : ''}</td>;
                })}
              </tr>
            ))}
            <tr className="total">
              <td>Présence (validés)</td>
              {days.map((d) => {
                const p = teamPresence(team, d, collaborators, leaves);
                return (
                  <td key={d} className={p.ratio < rules.minTeamPresence ? 'xc-warn' : ''}>
                    {p.present}/{p.size}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hint">C = congé validé · ? = demande en attente · seuil de présence de démonstration : {Math.round(rules.minTeamPresence * 100)} % de l’équipe.</p>
    </>
  );
}

function CraEditor({ sheet, person, expected, manages, onClose, onAction }: { sheet: CraSheet; person: Collaborator; expected: number; manages: boolean; onClose: () => void; onAction: (lines: CraLine[], next: 'Brouillon' | 'Soumis' | 'Validé' | 'À corriger', comment: string) => void }) {
  const [lines, setLines] = useState<CraLine[]>(sheet.lines.map((l) => ({ ...l, hours: [...l.hours] })));
  const [comment, setComment] = useState('');
  const locked = sheet.status === 'Soumis' || sheet.status === 'Validé';
  const total = lines.reduce((s, l) => s + l.hours.reduce((a, b) => a + b, 0), 0);
  const options = craActivities(person).filter((a) => !lines.some((l) => l.activity === a));
  const days = Array.from({ length: 5 }, (_, i) => fmtD(dateKey(addDays(new Date(`${sheet.weekStart}T12:00:00`).getTime(), i))));
  return (
    <Modal wide title={`CRA — ${person.name} — semaine du ${fmtD(sheet.weekStart)}`} onClose={onClose}>
      <p className="hint">
        Statut : <b>{sheet.status}</b> · attendu {expected} h (contrat {person.contractHoursWeek} h, congés validés déduits) · déclaré {Math.round(total * 10) / 10} h · écart {Math.round((total - expected) * 10) / 10} h
        {sheet.comment ? ` · motif : « ${sheet.comment} »` : ''}
      </p>
      <table className="xc-table compact">
        <thead>
          <tr>
            <th>Client / activité</th>
            {days.map((d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, li) => (
            <tr key={li}>
              <td>{l.activity}</td>
              {l.hours.map((h, di) => (
                <td key={di}>
                  <input
                    aria-label={`${l.activity} ${days[di]}`}
                    className="mg-hour"
                    type="number"
                    min={0}
                    max={12}
                    step={0.5}
                    value={h}
                    disabled={locked}
                    onChange={(e) => setLines(lines.map((x, i) => (i === li ? { ...x, hours: x.hours.map((v, j) => (j === di ? Number(e.target.value) : v)) } : x)))}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!locked && options.length > 0 && (
        <select aria-label="Ajouter une affectation" value="" onChange={(e) => e.target.value && setLines([...lines, { activity: e.target.value, hours: [0, 0, 0, 0, 0] }])}>
          <option value="">+ Ajouter une affectation (client ou activité)</option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )}
      <div className="mg-actions">
        {!locked && (
          <>
            <button className="ghost" onClick={() => onAction(lines, 'Brouillon', '')}>
              Enregistrer le brouillon
            </button>
            <button className="action" onClick={() => onAction(lines, 'Soumis', '')}>
              {sheet.status === 'À corriger' ? 'Corriger et soumettre' : 'Soumettre'}
            </button>
          </>
        )}
        {sheet.status === 'Soumis' && (
          <>
            <input aria-label="Motif" placeholder="Motif de rejet / commentaire" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button className="action" disabled={!manages} onClick={() => onAction(lines, 'Validé', comment)}>
              Valider
            </button>
            <button className="ghost danger" disabled={!manages} onClick={() => onAction(lines, 'À corriger', comment)}>
              Rejeter (à corriger)
            </button>
          </>
        )}
      </div>
      <h4>Historique</h4>
      <ol className="xc-history">
        {sheet.history.length === 0 && <li className="hint">Aucun évènement.</li>}
        {sheet.history.map((h, i) => (
          <li key={i}>
            <time>{fmtDateTime(h.at)}</time> {h.action} — {h.by}
            {h.note ? ` · « ${h.note} »` : ''}
          </li>
        ))}
      </ol>
    </Modal>
  );
}

function Objectives({ scopes, editable, now, onChange }: { scopes: ObjectiveScope[]; editable: boolean; now: number; onChange: (o: ObjectiveScope, key: keyof ObjectiveConfig, v: number) => void }) {
  const rowsOf = (o: ObjectiveScope) => computeObjectives(o.tickets, o.client, o.cfg, now);
  const fmt = (r: ObjectiveRow) => (r.actual === null ? '—' : `${r.actual.toLocaleString('fr-FR')} ${r.unit}`);
  return (
    <>
      <p className="hint">Objectifs de volume et de qualité séparés. Valeurs de démonstration modifiables ; recalcul immédiat. Les objectifs N1 sont définis par équipe interne, ceux des sites clients N2 par contrat.</p>
      {scopes.map((o) => {
        const rows = rowsOf(o);
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
                            <input className="mg-hour" type="number" aria-label={`${o.client.name} ${r.label}`} disabled={!editable} value={r.target} onChange={(e) => onChange(o, r.key, Number(e.target.value))} /> {r.unit}
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

function Delegations({ store, persona, role, run }: { store: ManagementStore; persona: string; role: Role; run: (r: MgmtResult) => MgmtResult }) {
  const managers = orgPeople.filter((p) => MANAGER_IDS.includes(p.id) && p.id !== persona);
  const [to, setTo] = useState(managers[0].id);
  const [start, setStart] = useState(dateKey(Date.now()));
  const [end, setEnd] = useState(dateKey(Date.now() + 7 * DAY));
  return (
    <>
      <p className="hint">Une délégation permet à un autre manager de valider congés et CRA de votre périmètre pendant la période indiquée. Chaque décision mentionne la délégation dans l’historique.</p>
      <div className="mg-form">
        <span>De {personById(persona)?.name} à</span>
        <select aria-label="Délégataire" value={to} onChange={(e) => setTo(e.target.value)}>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input aria-label="Début délégation" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <input aria-label="Fin délégation" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <button className="action" onClick={() => run(store.addDelegation(persona, to, start, end, role))}>
          Déléguer
        </button>
      </div>
      <ul className="xc-mini">
        {store.state.delegations.map((d) => (
          <li key={d.id}>
            {d.id} : {personById(d.fromManagerId)?.name} → {personById(d.toManagerId)?.name}, du {fmtD(d.start)} au {fmtD(d.end)}{' '}
            {d.fromManagerId === persona && (
              <button className="link" onClick={() => store.removeDelegation(d.id)}>
                Retirer
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export { DEFAULT_N1_OBJECTIVES };

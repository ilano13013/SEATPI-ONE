// Cockpit Helpdesk consolidé : équipes internes (N1) et sites clients INVIVO, PRIMAGAZ, MONEXT (N2).
// Les compteurs, le tableau et le Kanban reposent sur le même jeu filtré.
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import type { Agent } from '../../types';
import type { Priority, Service, Technician, TicketStatus } from '../../external/types';
import type { ActionResult, NewTicketInput } from '../../external/useExternal';
import { ALL_PRIORITIES, ALL_STATUSES } from '../../external/itsm/adapters';
import { applyFilters, counters, COUNTER_LABELS, EMPTY_FILTERS, managerLabel, staffing, teamObjectives, weeklyEvolution, type CounterKey, type HdFilters, type HdTicket } from '../../helpdesk/consolidation';
import { ticketTeams } from '../../helpdesk/teams';
import { dateKey } from '../../external/calendar';
import { clientRecord, ITSM_NOT_SET, itsmOf, n1Clients, POLE_GROUP_LABEL } from '../../config/itsm';
import { externalClients } from '../../external/config';
import { orgPeople } from '../../org/people';
import { can, type Role } from '../../auth/roles';
import { Tabs } from '../ui';
import { Modal, PriorityBadge, SlaBadge, StatusBadge, Toast, fmtDateTime } from '../external/common';
import { TicketDetail } from '../external/TicketDetail';

type Tab = 'synthese' | 'tickets' | 'kanban' | 'effectifs';

interface Props {
  tickets: HdTicket[];
  agents: Agent[];
  /** Techniciens N2 des sites clients. */
  techsN2: Technician[];
  /** Agents N1 vus comme techniciens des clients internes. */
  techsN1: Technician[];
  leaveDates: Map<string, string[]>;
  targets: Record<string, number>;
  now: number;
  role: Role;
  onMove: (t: HdTicket, to: TicketStatus, escalateTo?: Service) => ActionResult;
  onAssign: (t: HdTicket, techId: string) => ActionResult;
  onCreate: (level: 'N1' | 'N2', clientId: string, input: NewTicketInput) => ActionResult;
  onBack: () => void;
  /** Synthèse des checklists CRA / congés (cockpit de la responsable Helpdesk). */
  checklists?: ReactNode;
  /** Seuil du backlog (heures), paramétrable dans l'administration. */
  backlogHours?: number;
}

/** Clients du périmètre : clients traités en N1 sur les plateaux + sites clients N2. */
const SCOPE_CLIENTS = [...new Set([...n1Clients.map((c) => c.clientId), ...externalClients.map((c) => c.id)])];
/** Cibles de création : un même client peut être traité en N1 (Pôle Multi) et en N2 (INVIVO). */
const CREATE_TARGETS: { value: string; label: string }[] = [
  ...n1Clients.map((c) => ({ value: `N1:${c.clientId}`, label: `${clientRecord(c.clientId)?.name ?? c.clientId} — N1 ${POLE_GROUP_LABEL[clientRecord(c.clientId)?.pole ?? 'dedie']} — ${itsmOf(c.clientId) ?? 'ITSM non renseigné'}` })),
  ...externalClients.map((c) => ({ value: `N2:${c.id}`, label: `${c.name} — N2 chez le client — ${c.tool ?? 'ITSM non renseigné'}` })),
];
const TOOLS = ['EasyVista', 'Jira', 'GLPI', 'ISILOG', 'Zendesk', 'ServiceNow'] as const;
const KANBAN: TicketStatus[] = ['Nouveau', 'Affecté', 'En cours', 'En attente', 'Bloqué', 'Escaladé', 'Réouvert', 'Résolu'];
const PAGE = 40;

const today = (now: number) => dateKey(now);

export function HelpdeskCockpit(props: Props) {
  const { tickets, agents, techsN1, techsN2, leaveDates, targets, now, role } = props;
  const [tab, setTab] = useState<Tab>('synthese');
  const [filters, setFilters] = useState<HdFilters>(EMPTY_FILTERS);
  const [drill, setDrill] = useState<{ label: string; ids: string[] } | null>(null);
  const [people, setPeople] = useState<{ label: string; ids: string[] } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<ActionResult | null>(null);
  const individual = can(role, 'supervision', 'individual');
  const editable = can(role, 'supervision', 'edit');

  const filtered = useMemo(() => applyFilters(tickets, filters, now), [tickets, filters, now]);
  const shown = useMemo(() => (drill ? filtered.filter((t) => drill.ids.includes(t.id)) : filtered), [filtered, drill]);
  const k = useMemo(() => counters(filtered, now, props.backlogHours), [filtered, now, props.backlogHours]);
  const busy = useMemo(() => new Set(tickets.filter((t) => t.scope === 'externe' && t.status === 'En cours' && t.assigneeId).map((t) => t.assigneeId!)), [tickets]);
  const staff = useMemo(() => staffing(agents, techsN2, leaveDates, today(now), busy), [agents, techsN2, leaveDates, now, busy]);
  const objectives = useMemo(() => teamObjectives(tickets, targets, now), [tickets, targets, now]);
  const evolution = useMemo(() => weeklyEvolution(filtered, now), [filtered, now]);
  const opened = openId ? tickets.find((t) => t.id === openId) : undefined;

  const set = (patch: Partial<HdFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };
  const drillTo = (key: CounterKey) => {
    setDrill({ label: COUNTER_LABELS[key], ids: k[key] });
    setTab('tickets');
    setPage(0);
  };
  const who = (t: HdTicket) => (t.assigneeId ? (individual ? (t.assigneeName ?? t.assigneeId) : 'Affecté') : 'Non affecté');
  const personName = (id: string) => agents.find((a) => a.id === id)?.name ?? techsN2.find((t) => t.id === id)?.name ?? id;
  const run = (r: ActionResult) => {
    setToast(r);
    return r;
  };

  const sumTargets = objectives.reduce((s, o) => s + o.target, 0);
  const sumDone = objectives.reduce((s, o) => s + o.done, 0);
  const maxEvo = Math.max(1, ...evolution.flatMap((e) => [e.created, e.resolved]));

  return (
    <section className="xc hd" aria-label="Cockpit Helpdesk consolidé">
      <div className="xc-head">
        <button className="ghost" onClick={props.onBack}>
          <ArrowLeft size={14} /> Carte 3D
        </button>
        <div>
          <b>Helpdesk — cockpit consolidé</b>
          <span>Équipes internes N1 (3 sites) + sites clients INVIVO, PRIMAGAZ, MONEXT (N2) · données de démonstration · actualisé {fmtDateTime(now)}</span>
        </div>
        <button className="action" disabled={!editable} onClick={() => setCreating(true)} title={editable ? undefined : 'Réservé à l’encadrement (maquette)'}>
          <Plus size={14} /> Nouveau ticket
        </button>
      </div>

      <div className="xc-toolbar hd-filters" role="group" aria-label="Filtres">
        <select aria-label="Pôle" value={filters.pole} onChange={(e) => set({ pole: e.target.value as HdFilters['pole'], client: '' })}>
          <option value="">Tous les pôles</option>
          <option value="multi">Pôle Multi (N1)</option>
          <option value="dedie">Pôle Dédié (N1)</option>
          <option value="n2">MCO N2 — sites clients</option>
        </select>
        <select aria-label="Client" value={filters.client} onChange={(e) => set({ client: e.target.value })}>
          <option value="">Tous les clients</option>
          {SCOPE_CLIENTS.filter((c) => !filters.pole || (filters.pole === 'n2' ? externalClients.some((x) => x.id === c) : clientRecord(c)?.pole === filters.pole)).map((c) => (
            <option key={c} value={c}>
              {clientRecord(c)?.name ?? c} {itsmOf(c) ? `· ${itsmOf(c)}` : '· ITSM non renseigné'}
            </option>
          ))}
        </select>
        <select aria-label="Équipe" value={filters.team} onChange={(e) => set({ team: e.target.value })}>
          <option value="">Toutes les équipes</option>
          {ticketTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {clientRecord(t.clientId)?.name ?? t.clientId} ({t.service})
            </option>
          ))}
        </select>
        <select aria-label="Manager" value={filters.manager} onChange={(e) => set({ manager: e.target.value })}>
          <option value="">Tous les managers</option>
          {orgPeople
            .filter((p) => p.role === 'manager-helpdesk' || p.role === 'manager-mco')
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.title}
              </option>
            ))}
        </select>
        {individual && (
          <select aria-label="Technicien" value={filters.tech} onChange={(e) => set({ tech: e.target.value })}>
            <option value="">Tous les techniciens</option>
            {[...new Map([...techsN1, ...techsN2].map((t) => [t.id, t])).values()].map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <select aria-label="Priorité" value={filters.priority} onChange={(e) => set({ priority: e.target.value as Priority | '' })}>
          <option value="">Toutes priorités</option>
          {ALL_PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select aria-label="Statut" value={filters.status} onChange={(e) => set({ status: e.target.value as TicketStatus | '' })}>
          <option value="">Tous statuts</option>
          {ALL_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Période" value={filters.period} onChange={(e) => set({ period: e.target.value as HdFilters['period'] })}>
          <option value="tout">Toute période</option>
          <option value="today">Aujourd’hui</option>
          <option value="week">Semaine en cours</option>
          <option value="prevWeek">Semaine précédente</option>
        </select>
        <select aria-label="Outil ITSM" value={filters.tool} onChange={(e) => set({ tool: e.target.value as HdFilters['tool'] })}>
          <option value="">Tous les outils</option>
          {TOOLS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) && (
          <button className="ghost" onClick={() => set(EMPTY_FILTERS)}>
            Réinitialiser les filtres
          </button>
        )}
      </div>
      {filters.client === 'primagaz' && <p className="itsm-missing">PRIMAGAZ : {ITSM_NOT_SET}. Aucun ticket n’est affiché tant que l’outil n’est pas renseigné.</p>}

      <div className="xc-tabs">
        <Tabs
          value={tab}
          onChange={(t) => setTab(t)}
          tabs={[
            { id: 'synthese', label: 'Synthèse' },
            { id: 'tickets', label: `Tableau (${shown.length})` },
            { id: 'kanban', label: `Kanban (${shown.length})` },
            { id: 'effectifs', label: 'Effectifs' },
          ]}
        />
      </div>

      {drill && (tab === 'tickets' || tab === 'kanban') && (
        <div className="xc-filterchip">
          {drill.label} · {shown.length} ticket(s)
          <button aria-label="Retirer le filtre" onClick={() => setDrill(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {tab === 'synthese' && (
        <>
          {props.checklists}
          <h3>Effectifs (aujourd’hui)</h3>
          <div className="xc-kpis">
            {(
              [
                ['Agents prévus', staff.planned],
                ['Présents', staff.present],
                ['Disponibles', staff.available],
                ['En communication', staff.onCall],
              ] as const
            ).map(([label, ids]) => (
              <button key={label} className="xc-kpi" onClick={() => (setPeople({ label, ids: [...ids] }), setTab('effectifs'))}>
                <small>{label}</small>
                <strong>{ids.length}</strong>
                <em>N1 + N2 · voir la liste</em>
              </button>
            ))}
          </div>
          <h3>Tickets</h3>
          <div className="xc-kpis">
            {(Object.keys(COUNTER_LABELS) as CounterKey[]).map((key) => (
              <button key={key} className={`xc-kpi ${key === 'horsSla' || key === 'critiques' || key === 'bloques' ? (k[key].length ? 'bad' : 'ok') : key === 'procheSla' || key === 'sansAffectation' ? (k[key].length ? 'warn' : 'ok') : ''}`} onClick={() => drillTo(key)}>
                <small>{COUNTER_LABELS[key]}</small>
                <strong>{k[key].length}</strong>
                <em>voir les tickets</em>
              </button>
            ))}
          </div>
          <h3>Objectifs de la semaine (volume)</h3>
          <div className="xc-kpis">
            <div className="xc-kpi">
              <small>Objectif</small>
              <strong>{sumTargets}</strong>
            </div>
            <div className="xc-kpi">
              <small>Réalisé</small>
              <strong>{sumDone}</strong>
            </div>
            <div className="xc-kpi">
              <small>Reste</small>
              <strong>{Math.max(0, sumTargets - sumDone)}</strong>
            </div>
          </div>
          <div className="xc-tablewrap">
            <table className="xc-table compact">
              <thead>
                <tr>
                  <th>Équipe</th>
                  <th>Périmètre</th>
                  <th>Objectif</th>
                  <th>Réalisé</th>
                  <th>Reste</th>
                </tr>
              </thead>
              <tbody>
                {objectives.map((o) => (
                  <tr key={o.teamId} tabIndex={0} onClick={() => (set({ ...EMPTY_FILTERS, team: o.teamId }), setTab('tickets'))}>
                    <td>{o.label}</td>
                    <td>{o.scope === 'interne' ? 'Interne N1' : 'Client N2'}</td>
                    <td>{o.target}</td>
                    <td>{o.done}</td>
                    <td>{o.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">Objectifs de qualité (SLA, réouvertures, délais) : voir le cockpit Management. Les indicateurs individuels ne produisent aucun classement disciplinaire.</p>
          <h3>Évolution hebdomadaire (périmètre filtré)</h3>
          <div className="hd-evo" role="img" aria-label="Tickets créés et résolus par semaine">
            {evolution.map((e) => (
              <div key={e.label}>
                <div className="bars">
                  <i className="c" style={{ height: `${(e.created / maxEvo) * 100}%` }} title={`${e.created} créés`} />
                  <i className="r" style={{ height: `${(e.resolved / maxEvo) * 100}%` }} title={`${e.resolved} résolus`} />
                </div>
                <small>{e.label}</small>
                <small>
                  {e.created} / {e.resolved}
                </small>
              </div>
            ))}
          </div>
          <p className="hint">
            <i className="dot c" /> créés · <i className="dot r" /> résolus (semaine commençant le lundi indiqué)
          </p>
        </>
      )}

      {tab === 'tickets' && (
        <>
          <div className="xc-tablewrap">
            <table className="xc-table">
              <thead>
                <tr>
                  <th>N° SEATPI</th>
                  <th>Source</th>
                  <th>Pôle</th>
                  <th>Client</th>
                  <th>Équipe</th>
                  <th>Titre</th>
                  <th>Priorité</th>
                  <th>Statut</th>
                  <th>Statut source</th>
                  <th>SLA</th>
                  <th>Affecté à</th>
                  <th>Manager</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(page * PAGE, (page + 1) * PAGE).map((t) => (
                  <tr key={t.id} tabIndex={0} onClick={() => setOpenId(t.id)} onKeyDown={(e) => e.key === 'Enter' && setOpenId(t.id)}>
                    <td>
                      <b>{t.id}</b>
                    </td>
                    <td>
                      {t.source.tool} <code>{t.source.id}</code>
                    </td>
                    <td>{t.pole ? POLE_GROUP_LABEL[t.pole] : 'MCO N2'}</td>
                    <td>{t.clientName}</td>
                    <td>{t.teamLabel}</td>
                    <td>{t.title}</td>
                    <td>
                      <PriorityBadge p={t.priority} />
                    </td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <code>{t.sourceStatus}</code>
                    </td>
                    <td>
                      <SlaBadge state={t.sla.state} paused={t.sla.paused} />
                    </td>
                    <td>{who(t)}</td>
                    <td>{managerLabel(t.managerId)}</td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={12} className="hint">
                      Aucun ticket pour ces critères.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {shown.length > PAGE && (
            <div className="xc-pager">
              <button className="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </button>
              <span>
                {page * PAGE + 1}–{Math.min(shown.length, (page + 1) * PAGE)} sur {shown.length}
              </span>
              <button className="ghost" disabled={(page + 1) * PAGE >= shown.length} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'kanban' && (
        <div className="xc-board hd-board">
          {KANBAN.map((s) => {
            const col = shown.filter((t) => t.status === s || (s === 'Résolu' && t.status === 'Clôturé'));
            return (
              <div key={s} className="xc-col" aria-label={`Colonne ${s}`}>
                <h4>
                  {s} <span className="tabcount">{col.length}</span>
                </h4>
                <div className="xc-cards">
                  {col.slice(0, 30).map((t) => (
                    <button key={t.id} className="xc-card hd-card" onClick={() => setOpenId(t.id)}>
                      <span className="xc-card-top">
                        <b>{t.id}</b>
                        <PriorityBadge p={t.priority} />
                      </span>
                      <span className="xc-card-title">{t.title}</span>
                      <small>
                        {t.clientName} · {t.source.tool} · {who(t)}
                      </small>
                      {t.sla.state !== 'respecté' && <SlaBadge state={t.sla.state} />}
                    </button>
                  ))}
                  {col.length > 30 && <small className="hint">+ {col.length - 30} autre(s) — voir le tableau</small>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'effectifs' && (
        <>
          <div className="xc-scopes">
            {(
              [
                ['Agents prévus', staff.planned],
                ['Présents', staff.present],
                ['Disponibles', staff.available],
                ['En communication', staff.onCall],
              ] as const
            ).map(([label, ids]) => (
              <button key={label} className={people?.label === label ? 'active' : ''} onClick={() => setPeople({ label, ids: [...ids] })}>
                {label} <small>{ids.length}</small>
              </button>
            ))}
          </div>
          <div className="xc-tablewrap">
            <table className="xc-table compact">
              <thead>
                <tr>
                  <th>Collaborateur</th>
                  <th>Niveau</th>
                  <th>Affectation</th>
                  <th>État</th>
                  <th>Tickets ouverts affectés</th>
                </tr>
              </thead>
              <tbody>
                {(people?.ids ?? staff.planned).map((id) => {
                  const a = agents.find((x) => x.id === id);
                  const t = techsN2.find((x) => x.id === id);
                  const open = tickets.filter((x) => x.assigneeId === id && x.status !== 'Résolu' && x.status !== 'Clôturé');
                  return (
                    <tr key={id} tabIndex={0} onClick={() => individual && (set({ ...EMPTY_FILTERS, tech: id }), setTab('tickets'))}>
                      <td>{individual ? personName(id) : a ? 'Agent N1' : 'Technicien N2'}</td>
                      <td>{a ? 'N1 (plateau)' : 'N2 (site client)'}</td>
                      <td>{a ? `Pôle ${a.clientId.toUpperCase()} · ${a.site}` : (clientRecord(t?.clientId ?? '')?.name ?? '')}</td>
                      <td>{a ? a.status : busy.has(id) ? 'Occupé' : 'Disponible'}</td>
                      <td>{open.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">« En communication » ne concerne que le N1 (téléphonie du plateau simulée). Les congés validés dans le cockpit Management retirent la personne des effectifs prévus.</p>
        </>
      )}

      {opened && (
        <TicketDetail
          ticket={opened}
          techs={opened.scope === 'interne' ? techsN1.filter((t) => t.clientId === opened.clientId) : techsN2}
          role={role}
          onClose={() => setOpenId(null)}
          onMove={(to, esc) => run(props.onMove(opened, to, esc))}
          onAssign={(id) => run(props.onAssign(opened, id))}
        />
      )}
      {creating && <NewTicket onClose={() => setCreating(false)} onCreate={(l, c, i) => {
        const r = run(props.onCreate(l, c, i));
        if (r.ok) setCreating(false);
        return r;
      }} />}
      {toast && <Toast message={toast.message} ok={toast.ok} onDone={() => setToast(null)} />}
    </section>
  );
}

function NewTicket({ onClose, onCreate }: { onClose: () => void; onCreate: (level: 'N1' | 'N2', clientId: string, input: NewTicketInput) => ActionResult }) {
  const [target, setTarget] = useState('N1:thelem');
  const [level, clientId] = target.split(':') as ['N1' | 'N2', string];
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('P3');
  const [error, setError] = useState<string | null>(null);
  const tool = itsmOf(clientId);
  return (
    <Modal title="Nouveau ticket (démonstration)" onClose={onClose}>
      <p className="hint">Le ticket est créé dans la source simulée de l’outil ITSM du client, puis synchronisé. Aucun envoi vers un système réel.</p>
      <div className="form-grid">
        <label>
          Client
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {CREATE_TARGETS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Titre
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Priorité
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {ALL_PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      {!tool && <p className="itsm-missing">{ITSM_NOT_SET}</p>}
      {error && <p className="xc-result bad">{error}</p>}
      <button
        className="action"
        disabled={!tool}
        onClick={() => {
          const r = onCreate(level, clientId, { title, description: '', category: '', priority, site: '' });
          if (!r.ok) setError(r.message);
        }}
      >
        Créer dans {tool ?? '—'} (simulation)
      </button>
    </Modal>
  );
}

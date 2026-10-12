// Cockpit Helpdesk consolidé : équipes internes (N1) et sites clients INVIVO, PRIMAGAZ, MONEXT (N2).
// Les compteurs, le tableau et le Kanban reposent sur le même jeu filtré.
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Maximize2, Minimize2, X } from 'lucide-react';
import type { Agent } from '../../types';
import type { Priority, Service, Technician, TicketStatus } from '../../external/types';
import type { ActionResult } from '../../external/useExternal';
import { ALL_PRIORITIES, ALL_STATUSES } from '../../external/itsm/adapters';
import { applyFilters, BACKLOG_AGE_H, counters, COUNTER_LABELS, EMPTY_FILTERS, managerLabel, staffing, teamObjectives, weeklyEvolution, type CounterKey, type HdFilters, type HdTicket } from '../../helpdesk/consolidation';
import { ticketTeams } from '../../helpdesk/teams';
import { dateKey } from '../../external/calendar';
import { clientRecord, ITSM_NOT_SET, itsmOf, n1Clients, POLE_GROUP_LABEL } from '../../config/itsm';
import { externalClients } from '../../external/config';
import { poleByClient } from '../../data/layout';
import { siteById } from '../../data/sites';
import { orgPeople } from '../../org/people';
import { can, type Role } from '../../auth/roles';
import { Tabs } from '../ui';
import { PriorityBadge, SlaBadge, StatusBadge, Toast, fmtDateTime } from '../external/common';
import { TicketDetail } from '../external/TicketDetail';

export type HdTab = 'synthese' | 'tickets' | 'kanban' | 'effectifs';
type Tab = HdTab;

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
  onBack: () => void;
  /** Synthèse des checklists CRA / congés (cockpit de la responsable Helpdesk). */
  checklists?: ReactNode;
  /** Seuil du backlog (heures), paramétrable dans l'administration. */
  backlogHours?: number;
  /** Navigation contrôlée (URL dédiée, Précédent / Suivant) : onglet, filtres et ticket ouvert. */
  nav?: { tab: HdTab; filters: HdFilters; ticketId: string | null };
  onNav?: (nav: { tab: HdTab; filters: HdFilters; ticketId: string | null }) => void;
}

type Col = 'source' | 'pole' | 'client' | 'equipe' | 'titre' | 'priorite' | 'statut' | 'statutSource' | 'sla' | 'affecte' | 'manager';
const COLUMNS: { id: Col; label: string }[] = [
  { id: 'source', label: 'Source' },
  { id: 'pole', label: 'Pôle' },
  { id: 'client', label: 'Client' },
  { id: 'equipe', label: 'Équipe' },
  { id: 'titre', label: 'Titre' },
  { id: 'priorite', label: 'Priorité' },
  { id: 'statut', label: 'Statut' },
  { id: 'statutSource', label: 'Statut source' },
  { id: 'sla', label: 'SLA' },
  { id: 'affecte', label: 'Affecté à' },
  { id: 'manager', label: 'Manager' },
];
const ARCHIVED: TicketStatus[] = ['Résolu', 'Clôturé'];

/** Clients du périmètre : clients traités en N1 sur les plateaux + sites clients N2. */
const SCOPE_CLIENTS = [...new Set([...n1Clients.map((c) => c.clientId), ...externalClients.map((c) => c.id)])];
const TOOLS = ['EasyVista', 'Jira', 'GLPI', 'ISILOG', 'Zendesk', 'ServiceNow'] as const;
const KANBAN: TicketStatus[] = ['Nouveau', 'Affecté', 'En cours', 'En attente', 'Bloqué', 'Escaladé', 'Réouvert', 'Résolu'];
const PAGE = 40;

const today = (now: number) => dateKey(now);

export function HelpdeskCockpit(props: Props) {
  const { tickets, agents, techsN1, techsN2, leaveDates, targets, now, role } = props;
  const [tabL, setTabL] = useState<Tab>('synthese');
  const [filtersL, setFiltersL] = useState<HdFilters>(EMPTY_FILTERS);
  const [openIdL, setOpenIdL] = useState<string | null>(null);
  const tab = props.nav?.tab ?? tabL;
  const filters = props.nav?.filters ?? filtersL;
  const openId = props.nav?.ticketId ?? (props.nav ? null : openIdL);
  const nav = { tab, filters, ticketId: openId };
  const setTab = (t: Tab) => (props.onNav ? props.onNav({ ...nav, tab: t }) : setTabL(t));
  const setFilters = (fn: (f: HdFilters) => HdFilters) => (props.onNav ? props.onNav({ ...nav, filters: fn(filters) }) : setFiltersL(fn));
  const setOpenId = (id: string | null) => (props.onNav ? props.onNav({ ...nav, ticketId: id }) : setOpenIdL(id));
  const [showArchives, setShowArchives] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [cols, setCols] = useState<Set<Col>>(() => new Set(COLUMNS.map((c) => c.id)));
  const [drill, setDrill] = useState<{ label: string; ids: string[] } | null>(null);
  const [people, setPeople] = useState<{ label: string; ids: string[] } | null>(null);
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState<ActionResult | null>(null);
  const individual = can(role, 'supervision', 'individual');

  const filtered = useMemo(() => applyFilters(tickets, filters, now), [tickets, filters, now]);
  const shown = useMemo(() => (drill ? filtered.filter((t) => drill.ids.includes(t.id)) : filtered), [filtered, drill]);
  const k = useMemo(() => counters(filtered, now, props.backlogHours), [filtered, now, props.backlogHours]);
  const busy = useMemo(() => new Set(tickets.filter((t) => t.scope === 'externe' && t.status === 'En cours' && t.assigneeId).map((t) => t.assigneeId!)), [tickets]);
  // Effectifs du périmètre filtré (pôle, client) : mêmes filtres que les tickets.
  const staffAgents = useMemo(
    () =>
      agents.filter((a) => {
        const group = poleByClient(a.clientId)?.group;
        if (filters.pole === 'n2') return false;
        if (filters.pole && group !== filters.pole) return false;
        if (filters.client) return a.clientId === filters.client || (group === 'multi' && clientRecord(filters.client)?.pole === 'multi');
        return true;
      }),
    [agents, filters.pole, filters.client],
  );
  const staffTechs = useMemo(() => techsN2.filter((t) => (!filters.pole || filters.pole === 'n2') && (!filters.client || t.clientId === filters.client)), [techsN2, filters.pole, filters.client]);
  const staff = useMemo(() => staffing(staffAgents, staffTechs, leaveDates, today(now), busy), [staffAgents, staffTechs, leaveDates, now, busy]);
  const staffSites = [...new Set(staffAgents.map((a) => siteById(a.site).name))];
  const staffScope = `${filters.pole ? (filters.pole === 'n2' ? 'MCO N2 (sites clients)' : `Pôle ${POLE_GROUP_LABEL[filters.pole]}`) : 'Tous les pôles'}${filters.client ? ` · ${clientRecord(filters.client)?.name ?? filters.client}` : ''} · N1 : ${staffSites.length ? staffSites.join(', ') : 'aucun site'} · N2 : ${staffTechs.length} technicien(s) chez les clients · aujourd’hui`;
  const objectives = useMemo(() => teamObjectives(tickets, targets, now), [tickets, targets, now]);
  const evolution = useMemo(() => weeklyEvolution(filtered, now), [filtered, now]);
  const opened = openId ? tickets.find((t) => t.id === openId) : undefined;

  const set = (patch: Partial<HdFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };
  const drillTo = (key: CounterKey) => {
    setDrill({ label: COUNTER_LABELS[key], ids: k[key] });
    // Un compteur d'archives (résolus) s'ouvre sur le tableau, qui montre tout le périmètre.
    setTab('tickets');
    setPage(0);
  };
  const kanbanList = showArchives ? shown : shown.filter((t) => !ARCHIVED.includes(t.status));
  const activeChips = activeFilterChips(filters, { techName: (id) => personName(id) });
  const who = (t: HdTicket) => (t.assigneeId ? (individual ? (t.assigneeName ?? t.assigneeId) : 'Affecté') : 'Non affecté');
  const personName = (id: string) => agents.find((a) => a.id === id)?.name ?? techsN2.find((t) => t.id === id)?.name ?? id;
  const run = (r: ActionResult) => {
    setToast(r);
    return r;
  };

  const sumTargets = objectives.reduce((s, o) => s + o.target, 0);
  const sumDone = objectives.reduce((s, o) => s + o.done, 0);
  const maxEvo = Math.max(1, ...evolution.flatMap((e) => [e.created, e.resolved]));

  const cell = (c: Col, t: HdTicket) => {
    switch (c) {
      case 'source':
        return (
          <>
            {t.source.tool} <code>{t.source.id}</code>
          </>
        );
      case 'pole':
        return t.pole ? POLE_GROUP_LABEL[t.pole] : 'MCO N2';
      case 'client':
        return t.clientName;
      case 'equipe':
        return t.teamLabel;
      case 'titre':
        return t.title;
      case 'priorite':
        return <PriorityBadge p={t.priority} />;
      case 'statut':
        return <StatusBadge status={t.status} />;
      case 'statutSource':
        return <code>{t.sourceStatus}</code>;
      case 'sla':
        return <SlaBadge state={t.sla.state} paused={t.sla.paused} />;
      case 'affecte':
        return who(t);
      case 'manager':
        return managerLabel(t.managerId);
    }
  };
  const visible = COLUMNS.filter((c) => cols.has(c.id));
  const renderTable = () => (
    <>
      <div className="xc-tablewrap">
        <table className="xc-table">
          <thead>
            <tr>
              <th>N° SEATPI</th>
              {visible.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.slice(page * PAGE, (page + 1) * PAGE).map((t) => (
              <tr key={t.id} tabIndex={0} onClick={() => setOpenId(t.id)} onKeyDown={(e) => e.key === 'Enter' && setOpenId(t.id)} aria-label={`Ticket ${t.id} : ${t.title}`}>
                <td>
                  <b>{t.id}</b>
                </td>
                {visible.map((c) => (
                  <td key={c.id} className={c.id === 'titre' ? 'title' : undefined}>
                    {cell(c.id, t)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={visible.length + 1} className="hint">
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
  );
  const renderKanban = () => (
    <div className="xc-board hd-board">
      {KANBAN.filter((s) => showArchives || !ARCHIVED.includes(s)).map((s) => {
        const col = kanbanList.filter((t) => t.status === s || (s === 'Résolu' && t.status === 'Clôturé'));
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
  );

  return (
    <section className="xc hd" aria-label="Cockpit Helpdesk consolidé">
      <div className="xc-head">
        <button className="ghost" onClick={props.onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <div>
          <b>Helpdesk — cockpit consolidé</b>
          <span>Équipes internes N1 (3 sites) + sites clients INVIVO, PRIMAGAZ, MONEXT (N2) · données de démonstration · actualisé {fmtDateTime(now)}</span>
        </div>
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
        <input type="search" aria-label="Rechercher un ticket (numéro ou titre)" placeholder="N° ou titre…" value={filters.q} onChange={(e) => set({ q: e.target.value })} />
      </div>
      {(activeChips.length > 0 || drill) && (
        <div className="hd-chips" role="group" aria-label="Filtres actifs">
          {activeChips.map((c) => (
            <span key={c.key} className="xc-filterchip">
              {c.label}
              <button aria-label={`Retirer le filtre ${c.label}`} onClick={() => set({ [c.key]: EMPTY_FILTERS[c.key] } as Partial<HdFilters>)}>
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            className="ghost"
            onClick={() => {
              set(EMPTY_FILTERS);
              setDrill(null);
            }}
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}
      {filters.client === 'primagaz' && <p className="itsm-missing">PRIMAGAZ : {ITSM_NOT_SET}. Aucun ticket n’est affiché tant que l’outil n’est pas renseigné.</p>}

      <div className="xc-tabs">
        <Tabs
          value={tab}
          onChange={(t) => setTab(t)}
          tabs={[
            { id: 'synthese', label: 'Synthèse' },
            { id: 'tickets', label: `Tableau (${shown.length})` },
            { id: 'kanban', label: `Kanban (${kanbanList.length})` },
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
          <p className="hint">Périmètre : {staffScope}.</p>
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
          <details className="defs">
            <summary>Définitions des effectifs</summary>
            <ul>
              <li><b>Agents prévus</b> : collaborateurs du périmètre, hors congés validés dans l’outil RH (simulé) pour aujourd’hui.</li>
              <li><b>Présents</b> : prévus et connectés (N1 non « Hors ligne ») ; les techniciens N2 prévus sont comptés présents chez le client.</li>
              <li><b>Disponibles</b> : présents sans appel en cours (N1) ou sans ticket « En cours » (N2).</li>
              <li><b>En communication</b> : agents N1 en appel (téléphonie du plateau simulée).</li>
            </ul>
          </details>
          <h3>Tickets</h3>
          <p className="hint">Périmètre : tickets N1 des plateaux (3 sites) et tickets N2 des sites clients, selon les filtres actifs. La carte des sites n’affiche que les files du plateau sélectionné.</p>
          <div className="xc-kpis">
            {(Object.keys(COUNTER_LABELS) as CounterKey[]).map((key) => (
              <button key={key} className={`xc-kpi ${key === 'horsSla' || key === 'critiques' || key === 'bloques' ? (k[key].length ? 'bad' : 'ok') : key === 'procheSla' || key === 'sansAffectation' ? (k[key].length ? 'warn' : 'ok') : ''}`} onClick={() => drillTo(key)}>
                <small>{key === 'backlog' ? `Backlog (ouverts depuis plus de ${props.backlogHours ?? BACKLOG_AGE_H} h)` : COUNTER_LABELS[key]}</small>
                <strong>{k[key].length}</strong>
                <em>voir les tickets</em>
              </button>
            ))}
          </div>
          <details className="defs">
            <summary>Définitions des compteurs de tickets</summary>
            <ul>
              <li><b>Tickets ouverts</b> : tous les tickets non résolus et non clôturés.</li>
              <li><b>Backlog</b> : tickets ouverts depuis plus de {props.backlogHours ?? BACKLOG_AGE_H} h (seuil paramétrable dans Administration → Paramètres).</li>
              <li><b>Reste à traiter (objectifs)</b> : objectif de volume de la semaine moins les tickets résolus ; ce n’est pas le backlog.</li>
            </ul>
          </details>
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
              <small>Reste à traiter (objectif)</small>
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

      {(tab === 'tickets' || tab === 'kanban') && (
        <div className="hd-viewbar">
          {tab === 'kanban' && (
            <label className="ck-check">
              <input type="checkbox" checked={showArchives} onChange={(e) => setShowArchives(e.target.checked)} /> Afficher les archives (résolus et clôturés)
            </label>
          )}
          {tab === 'tickets' && (
            <details className="col-picker">
              <summary>Colonnes</summary>
              {COLUMNS.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={cols.has(c.id)}
                    onChange={() =>
                      setCols((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      })
                    }
                  />{' '}
                  {c.label}
                </label>
              ))}
            </details>
          )}
          <button className="ghost" onClick={() => setFullscreen(true)} aria-label="Afficher en plein écran">
            <Maximize2 size={13} aria-hidden /> Plein écran
          </button>
        </div>
      )}
      {fullscreen && (tab === 'tickets' || tab === 'kanban') && (
        <div className="fs-backdrop" role="dialog" aria-modal="true" aria-label={tab === 'tickets' ? 'Tableau des tickets en plein écran' : 'Kanban en plein écran'} onKeyDown={(e) => e.key === 'Escape' && setFullscreen(false)}>
          <div className="fs-bar">
            <b>{tab === 'tickets' ? `Tableau · ${shown.length} ticket(s)` : `Kanban · ${kanbanList.length} ticket(s)`}</b>
            <button className="ghost" autoFocus onClick={() => setFullscreen(false)}>
              <Minimize2 size={13} aria-hidden /> Quitter le plein écran
            </button>
          </div>
          {tab === 'tickets' ? renderTable() : renderKanban()}
        </div>
      )}
      {tab === 'tickets' && !fullscreen && renderTable()}
      {tab === 'kanban' && !fullscreen && renderKanban()}
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
                      <td>{a ? `${poleByClient(a.clientId)?.label ?? clientRecord(a.clientId)?.name ?? 'Plateau'} · ${siteById(a.site).name}` : (clientRecord(t?.clientId ?? '')?.name ?? '')}</td>
                      <td>{a ? a.status : busy.has(id) ? 'Occupé' : 'Disponible'}</td>
                      <td>{open.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">Périmètre : {staffScope}. « En communication » ne concerne que le N1 (téléphonie du plateau simulée). Seuls les congés validés dans l’outil RH (simulé) retirent une personne des effectifs prévus ; le suivi des checklists ne modifie jamais ces effectifs.</p>
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
      {toast && <Toast message={toast.message} ok={toast.ok} onDone={() => setToast(null)} />}
    </section>
  );
}

const PERIOD_LABEL: Record<HdFilters['period'], string> = { tout: 'Toute période', today: 'Aujourd’hui', week: 'Semaine en cours', prevWeek: 'Semaine précédente' };

/** Filtres actifs lisibles (libellés métier, jamais d'identifiants techniques). */
function activeFilterChips(f: HdFilters, o: { techName: (id: string) => string }): { key: keyof HdFilters; label: string }[] {
  const chips: { key: keyof HdFilters; label: string }[] = [];
  if (f.pole) chips.push({ key: 'pole', label: f.pole === 'n2' ? 'MCO N2 — sites clients' : `Pôle ${POLE_GROUP_LABEL[f.pole]}` });
  if (f.client) chips.push({ key: 'client', label: `Client : ${clientRecord(f.client)?.name ?? f.client}` });
  if (f.team) chips.push({ key: 'team', label: `Équipe : ${ticketTeams.find((t) => t.id === f.team)?.name ?? f.team}` });
  if (f.manager) chips.push({ key: 'manager', label: `Manager : ${orgPeople.find((p) => p.id === f.manager)?.name ?? f.manager}` });
  if (f.tech) chips.push({ key: 'tech', label: `Technicien : ${o.techName(f.tech)}` });
  if (f.priority) chips.push({ key: 'priority', label: `Priorité ${f.priority}` });
  if (f.status) chips.push({ key: 'status', label: `Statut : ${f.status}` });
  if (f.period !== 'tout') chips.push({ key: 'period', label: PERIOD_LABEL[f.period] });
  if (f.tool) chips.push({ key: 'tool', label: `Outil : ${f.tool}` });
  if (f.q.trim()) chips.push({ key: 'q', label: `Recherche : « ${f.q.trim()} »` });
  return chips;
}

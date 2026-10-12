import { useEffect, useMemo, useState } from 'react';
import type { AgentStatus, DemoState, TicketPriority } from '../../types';
import { can, clientScope, type Role } from '../../auth/roles';
import { formatDuration, formatMinutes, slaTone } from '../../lib/format';
import { allStatuses, statusColors } from '../../lib/status';
import { clientSummary } from '../../services/simulation';
import { POLE_CLIENTS, POLE_GROUP_LABEL, clientRecord, itsmOf, poleGroupOfZone } from '../../config/itsm';
import { Badge, Chips, Detail, Empty, Row, Tabs } from '../ui';

type Tab = 'files' | 'agents' | 'tickets';
const PRIORITIES = ['Toutes', 'P1', 'P2', 'P3', 'P4'] as const;
const STATUS_FILTERS = ['Tous', ...allStatuses] as const;

interface Props {
  state: DemoState;
  role: Role;
  /** Pôle client sélectionné (dans la scène ou ici) ; null = plateau entier. */
  selectedPole: string | null;
  onSelectPole: (clientId: string | null) => void;
  focusAgentId: string | null;
  onFocusAgent: (id: string | null) => void;
}

export function HelpdeskPanel({ state, role, selectedPole, onSelectPole, focusAgentId, onFocusAgent }: Props) {
  const scope = clientScope(role);
  const individual = can(role, 'supervision', 'individual');
  const [tab, setTab] = useState<Tab>(focusAgentId ? 'agents' : 'files');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('Tous');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('Toutes');
  const [openId, setOpenId] = useState<string | null>(null);

  // Un clic sur un avatar dans la scène ouvre directement sa fiche.
  useEffect(() => {
    if (focusAgentId) setTab('agents');
  }, [focusAgentId]);

  const clientId = scope ?? selectedPole;
  const inClient = (id: string) => !clientId || id === clientId;
  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? id;
  const agentName = (id: string | null) => (id ? (state.agents.find((a) => a.id === id)?.name ?? '—') : 'Non assigné');

  const queues = state.queues.filter((q) => inClient(q.clientId));
  const agents = state.agents.filter((a) => inClient(a.clientId));
  const tickets = state.tickets
    .filter((t) => inClient(t.clientId) && (priority === 'Toutes' || t.priority === priority))
    .sort((a, b) => a.priority.localeCompare(b.priority) || b.ageMin - a.ageMin);

  const statusCounts = useMemo(() => {
    const counts = new Map<AgentStatus, number>();
    for (const a of agents) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
    return counts;
  }, [agents]);

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <>
      <label className="field block">
        <span>Pôle client</span>
        <select value={clientId ?? 'all'} disabled={!!scope} onChange={(e) => onSelectPole(e.target.value === 'all' ? null : e.target.value)}>
          {!scope && <option value="all">Tout le plateau</option>}
          {(['dedie', 'multi'] as const).map((g) => {
            const list = state.clients.filter((c) => (!scope || c.id === scope) && poleGroupOfZone(c.id) === g);
            return list.length ? (
              <optgroup key={g} label={POLE_GROUP_LABEL[g]}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {g === 'dedie' ? `Pôle Dédié · ${c.name}` : `Pôle ${c.name}`}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>
      {scope && <p className="hint">Rôle Agent : périmètre limité à votre pôle ({clientName(scope)}).</p>}
      {clientId && <PoleSummary state={state} clientId={clientId} />}
      <PoleItsm poleIds={clientId ? [clientId] : state.clients.map((c) => c.id)} />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'files', label: `Files (${queues.length})` },
          { id: 'agents', label: `Agents (${agents.length})` },
          { id: 'tickets', label: `Tickets (${tickets.filter((t) => t.status !== 'Résolu').length})` },
        ]}
      />

      {tab === 'files' && (
        <div className="list">
          {queues.length === 0 && <Empty>Aucune file pour ce filtre.</Empty>}
          {queues.map((q) => {
            const tone = slaTone(q.sla, q.slaTarget);
            const assigned = state.agents.filter((a) => a.clientId === q.clientId && a.status !== 'Hors ligne');
            return (
              <Row
                key={q.id}
                open={openId === q.id}
                onToggle={() => toggle(q.id)}
                title={`${clientName(q.clientId)} · ${q.name}`}
                meta={`${q.waiting} en attente · plus longue ${formatDuration(q.longestWaitSec)}`}
                aside={<Badge tone={tone}>SLA {q.sla.toLocaleString('fr-FR')} %</Badge>}
              >
                <Detail
                  items={[
                    ['Objectif SLA', `${q.slaTarget} %`],
                    ['Traités aujourd’hui', q.handledToday],
                    ['Abandons', q.abandonedToday],
                    ['Agents connectés (client)', assigned.length],
                    ['Tickets ouverts (client)', state.tickets.filter((t) => t.clientId === q.clientId && t.status !== 'Résolu').length],
                  ]}
                />
              </Row>
            );
          })}
        </div>
      )}

      {tab === 'agents' && (
        <>
          {individual ? (
            <>
              <Chips label="Filtrer par statut" options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
              <div className="list">
                {agents
                  .filter((a) => statusFilter === 'Tous' || a.status === statusFilter)
                  .map((a) => (
                    <Row
                      key={a.id}
                      open={focusAgentId === a.id}
                      onToggle={() => onFocusAgent(focusAgentId === a.id ? null : a.id)}
                      title={
                        <>
                          <i className="dot" style={{ background: statusColors[a.status] }} /> {a.name}
                        </>
                      }
                      meta={`${a.status} · ${clientName(a.clientId)}`}
                      aside={<time>{formatDuration(a.statusSinceSec)}</time>}
                    >
                      <Detail
                        items={[
                          ['Client', clientName(a.clientId)],
                          ['État', a.status],
                          ['Depuis', formatDuration(a.statusSinceSec)],
                          ['Poste', `Pôle ${clientName(a.clientId)} · n° ${a.desk + 1}`],
                          ['Tickets assignés', state.tickets.filter((t) => t.assigneeId === a.id && t.status !== 'Résolu').length],
                        ]}
                      />
                    </Row>
                  ))}
              </div>
            </>
          ) : (
            <>
              <p className="hint">Vue agrégée : ce rôle ne consulte pas les données individuelles.</p>
              <div className="list">
                {allStatuses.map((s) => (
                  <div className="kv" key={s}>
                    <span>
                      <i className="dot" style={{ background: statusColors[s] }} /> {s}
                    </span>
                    <b>{statusCounts.get(s) ?? 0}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'tickets' && (
        <>
          <Chips label="Filtrer par priorité" options={PRIORITIES} value={priority} onChange={setPriority} />
          <div className="list">
            {tickets.length === 0 && <Empty>Aucun ticket pour ce filtre.</Empty>}
            {tickets.map((t) => (
              <Row
                key={t.id}
                open={openId === t.id}
                onToggle={() => toggle(t.id)}
                title={`${t.id} · ${t.title}`}
                meta={`${clientName(t.clientId)} · ${t.status} · ${formatMinutes(t.ageMin)}`}
                aside={<Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>}
              >
                <Detail
                  items={[
                    ['Client', clientName(t.clientId)],
                    ['Statut', t.status],
                    ['Ancienneté', formatMinutes(t.ageMin)],
                    ['Assigné à', individual ? agentName(t.assigneeId) : t.assigneeId ? 'Assigné' : 'Non assigné'],
                  ]}
                />
              </Row>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Outils ITSM des clients traités par les pôles (cartographie de référence). */
function PoleItsm({ poleIds }: { poleIds: string[] }) {
  const rows = poleIds.flatMap((pole) => (POLE_CLIENTS[pole] ?? []).map((id) => ({ pole, rec: clientRecord(id)!, tool: itsmOf(id) })));
  return (
    <details className="pole-itsm" open={poleIds.length === 1}>
      <summary>Clients et outils ITSM ({rows.length})</summary>
      {rows.map(({ rec, tool }) => (
        <div className="kv" key={rec.id}>
          <span>
            {rec.name}
            {rec.allocationToConfirm && <small> · rattachement à confirmer</small>}
          </span>
          {tool ? <span className="badge info">{tool}</span> : <span className="badge nr-badge">ITSM non renseigné</span>}
        </div>
      ))}
    </details>
  );
}

function PoleSummary({ state, clientId }: { state: DemoState; clientId: string }) {
  const s = clientSummary(state, clientId);
  return (
    <div className="kpis">
      <div>
        <small>En attente</small>
        <strong>{s.waiting}</strong>
      </div>
      <div>
        <small>SLA / objectif</small>
        <strong className={`tone-${slaTone(s.sla, s.slaTarget)}`}>{s.sla.toLocaleString('fr-FR')} %</strong>
        <small>Objectif {s.slaTarget.toLocaleString('fr-FR')} %</small>
      </div>
      <div>
        <small>Agents connectés</small>
        <strong>{s.agentsConnected}</strong>
      </div>
      <div>
        <small>Tickets ouverts</small>
        <strong>{s.openTickets}</strong>
      </div>
    </div>
  );
}

function priorityTone(p: TicketPriority) {
  return p === 'P1' ? 'bad' : p === 'P2' ? 'warn' : p === 'P3' ? 'info' : 'muted';
}

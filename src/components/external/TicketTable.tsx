import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, X } from 'lucide-react';
import type { Priority, SlaState, Technician, Ticket, TicketStatus } from '../../external/types';
import type { ClientView } from '../../external/derive';
import { contractById } from '../../external/config';
import { ALL_PRIORITIES, ALL_STATUSES } from '../../external/itsm/adapters';
import { isOpen } from '../../external/metrics';
import { PriorityBadge, SlaBadge, StatusBadge, downloadText, fmtDateTime, fmtHours } from './common';

type SortKey = 'id' | 'site' | 'title' | 'category' | 'priority' | 'status' | 'tech' | 'team' | 'createdAt' | 'updatedAt' | 'due' | 'timeSpent' | 'resolvedAt';
type GroupBy = 'aucun' | 'technicien' | 'priorité' | 'statut';

interface Props {
  view: ClientView;
  individual: boolean;
  filter?: { label: string; ids: string[] };
  onClearFilter: () => void;
  onOpen: (ticketId: string) => void;
}

const PAGE = 40;

export function TicketTable({ view, individual, filter, onClearFilter, onOpen }: Props) {
  const { tickets, techs, teams, client } = view;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'tous' | 'ouverts' | TicketStatus>('tous');
  const [priority, setPriority] = useState<'toutes' | Priority>('toutes');
  const [tech, setTech] = useState('tous');
  const [team, setTeam] = useState('toutes');
  const [category, setCategory] = useState('toutes');
  const [sla, setSla] = useState<'tous' | SlaState>('tous');
  const [site, setSite] = useState('tous');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [groupBy, setGroupBy] = useState<GroupBy>('aucun');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const techName = (id: string | null) => (id ? (individual ? (techs.find((t) => t.id === id)?.name ?? '?') : 'Affecté') : 'Non affecté');
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  const categories = useMemo(() => [...new Set(tickets.map((t) => t.category))].sort(), [tickets]);

  const rows = useMemo(() => {
    const idSet = filter ? new Set(filter.ids) : null;
    const needle = q.trim().toLowerCase();
    const list = tickets.filter((t) => {
      if (idSet && !idSet.has(t.id)) return false;
      if (status === 'ouverts' ? !isOpen(t) : status !== 'tous' && t.status !== status) return false;
      if (priority !== 'toutes' && t.priority !== priority) return false;
      if (tech === 'aucun' ? t.assigneeId !== null : tech !== 'tous' && t.assigneeId !== tech) return false;
      if (team !== 'toutes' && t.teamId !== team) return false;
      if (category !== 'toutes' && t.category !== category) return false;
      if (sla !== 'tous' && t.sla.state !== sla) return false;
      if (site !== 'tous' && t.site !== site) return false;
      if (needle && !`${t.id} ${t.source.id} ${t.title} ${t.description} ${t.site} ${t.category}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const val = (t: Ticket): string | number => {
      switch (sort.key) {
        case 'id': return t.id;
        case 'site': return t.site;
        case 'title': return t.title;
        case 'category': return t.category;
        case 'priority': return t.priority;
        case 'status': return ALL_STATUSES.indexOf(t.status);
        case 'tech': return techName(t.assigneeId);
        case 'team': return teamName(t.teamId);
        case 'createdAt': return t.createdAt;
        case 'updatedAt': return t.updatedAt;
        case 'due': return t.sla.dueAt ?? Infinity;
        case 'timeSpent': return t.timeSpentMin;
        case 'resolvedAt': return t.resolvedAt ?? 0;
      }
    };
    return list.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, filter, q, status, priority, tech, team, category, sla, site, sort, individual]);

  const groups = useMemo(() => {
    if (groupBy === 'aucun') return null;
    const key = (t: Ticket) => (groupBy === 'technicien' ? techName(t.assigneeId) : groupBy === 'priorité' ? t.priority : t.status);
    const map = new Map<string, Ticket[]>();
    for (const t of rows) map.set(key(t), [...(map.get(key(t)) ?? []), t]);
    const order = groupBy === 'statut' ? ALL_STATUSES : groupBy === 'priorité' ? ALL_PRIORITIES : null;
    return [...map.entries()].sort(([a], [b]) => (order ? order.indexOf(a as never) - order.indexOf(b as never) : a.localeCompare(b, 'fr')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupBy, individual]);

  const setSortKey = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));
  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  const exportCsv = () => {
    const header = ['N° interne', 'Outil', 'N° source', 'Client', 'Site', 'Contrat', 'Titre', 'Catégorie', 'Priorité', 'Statut', 'Technicien', 'Groupe', 'Création', 'Mise à jour', 'Échéance SLA', 'État SLA', 'Temps passé (min)', 'Résolution'];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = rows.map((t) =>
      [t.id, t.source.tool, t.source.id, client.name, t.site, t.contractId, t.title, t.category, t.priority, t.status, techName(t.assigneeId), teamName(t.teamId), fmtDateTime(t.createdAt), fmtDateTime(t.updatedAt), fmtDateTime(t.sla.dueAt), t.sla.state, t.timeSpentMin, fmtDateTime(t.resolvedAt)].map(esc).join(';'),
    );
    downloadText(`tickets-${client.id}.csv`, [header.map(esc).join(';'), ...lines].join('\n'), 'text/csv');
  };

  const Th = ({ k, children }: { k: SortKey; children: string }) => (
    <th aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSortKey(k)}>
        {children}
        {sort.key === k && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );

  const Row = ({ t }: { t: Ticket }) => (
    <tr onClick={() => onOpen(t.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(t.id)}>
      <td>
        <b>{t.id}</b>
        <small>
          {t.source.tool} {t.source.id}
        </small>
      </td>
      <td>{client.name}</td>
      <td>{t.site}</td>
      <td title={contractById(t.contractId).label}>{t.contractId}</td>
      <td className="title" title={t.description}>
        {t.title}
      </td>
      <td>{t.category}</td>
      <td>
        <PriorityBadge p={t.priority} />
      </td>
      <td>
        <StatusBadge status={t.status} />
      </td>
      <td>{techName(t.assigneeId)}</td>
      <td>{teamName(t.teamId)}</td>
      <td>{fmtDateTime(t.createdAt)}</td>
      <td>{fmtDateTime(t.updatedAt)}</td>
      <td>
        {t.sla.dueAt ? fmtDateTime(t.sla.dueAt) : 'suspendu'} <SlaBadge state={t.sla.state} paused={t.sla.paused && isOpen(t)} />
      </td>
      <td>{fmtHours(t.timeSpentMin)}</td>
      <td>{fmtDateTime(t.resolvedAt)}</td>
    </tr>
  );

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  return (
    <div className="xc-tickets">
      {filter && (
        <div className="xc-filterchip">
          Filtre : <b>{filter.label}</b> ({filter.ids.length})
          <button onClick={onClearFilter} aria-label="Retirer le filtre">
            <X size={13} />
          </button>
        </div>
      )}
      <div className="xc-toolbar">
        <input type="search" placeholder="Rechercher (n°, titre, description, site…)" value={q} onChange={(e) => reset(() => setQ(e.target.value))} aria-label="Rechercher un ticket" />
        <select aria-label="Statut" value={status} onChange={(e) => reset(() => setStatus(e.target.value as typeof status))}>
          <option value="tous">Tous statuts</option>
          <option value="ouverts">Ouverts</option>
          {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Priorité" value={priority} onChange={(e) => reset(() => setPriority(e.target.value as typeof priority))}>
          <option value="toutes">Toutes priorités</option>
          {ALL_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        {individual && (
          <select aria-label="Technicien" value={tech} onChange={(e) => reset(() => setTech(e.target.value))}>
            <option value="tous">Tous techniciens</option>
            <option value="aucun">Non affecté</option>
            {techs.map((t: Technician) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <select aria-label="Groupe de traitement" value={team} onChange={(e) => reset(() => setTeam(e.target.value))}>
          <option value="toutes">Tous groupes</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select aria-label="Catégorie" value={category} onChange={(e) => reset(() => setCategory(e.target.value))}>
          <option value="toutes">Toutes catégories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="État SLA" value={sla} onChange={(e) => reset(() => setSla(e.target.value as typeof sla))}>
          <option value="tous">Tous SLA</option>
          <option value="respecté">Respecté</option>
          <option value="à risque">À risque</option>
          <option value="dépassé">Dépassé</option>
        </select>
        <select aria-label="Site" value={site} onChange={(e) => reset(() => setSite(e.target.value))}>
          <option value="tous">Tous sites</option>
          {client.sites.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Regrouper par" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
          <option value="aucun">Sans regroupement</option>
          {individual && <option value="technicien">Par technicien</option>}
          <option value="priorité">Par priorité</option>
          <option value="statut">Par statut</option>
        </select>
        <button className="ghost" onClick={exportCsv}>
          <Download size={13} /> CSV
        </button>
      </div>
      <p className="hint">
        {rows.length} ticket(s) · cliquez sur une ligne pour le détail et l’historique · colonnes triables
      </p>
      <div className="xc-tablewrap">
        <table className="xc-table">
          <thead>
            <tr>
              <Th k="id">N°</Th>
              <th>Client</th>
              <Th k="site">Site</Th>
              <th>Contrat</th>
              <Th k="title">Titre</Th>
              <Th k="category">Catégorie</Th>
              <Th k="priority">Priorité</Th>
              <Th k="status">Statut</Th>
              <Th k="tech">Technicien</Th>
              <Th k="team">Groupe</Th>
              <Th k="createdAt">Création</Th>
              <Th k="updatedAt">Mise à jour</Th>
              <Th k="due">Échéance SLA</Th>
              <Th k="timeSpent">Temps passé</Th>
              <Th k="resolvedAt">Résolution</Th>
            </tr>
          </thead>
          <tbody>
            {groups
              ? groups.map(([label, list]) => {
                  const open = expanded[label];
                  const shown = open ? list : list.slice(0, 15);
                  return [
                    <tr key={`g-${label}`} className="group">
                      <td colSpan={15}>
                        <b>{label}</b> · {list.length} ticket(s)
                        {list.length > 15 && (
                          <button className="link" onClick={() => setExpanded((e) => ({ ...e, [label]: !open }))}>
                            {open ? 'réduire' : `afficher les ${list.length}`}
                          </button>
                        )}
                      </td>
                    </tr>,
                    ...shown.map((t) => <Row key={t.id} t={t} />),
                  ];
                })
              : pageRows.map((t) => <Row key={t.id} t={t} />)}
            {rows.length === 0 && (
              <tr>
                <td colSpan={15} className="empty">
                  Aucun ticket ne correspond aux filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!groups && pages > 1 && (
        <div className="xc-pager">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Précédent
          </button>
          <span>
            Page {page + 1} / {pages}
          </span>
          <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

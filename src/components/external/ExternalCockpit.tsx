import { useMemo } from 'react';
import { AccessNotice } from '../ui';
import { missingRight } from '../../auth/access';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import type { ExternalClientId } from '../../external/types';
import type { ExternalStore } from '../../external/useExternal';
import { externalClients } from '../../external/config';
import { globalRow, totalRow, type ClientView, type GlobalRow } from '../../external/derive';
import { can, type Role } from '../../auth/roles';

import { HealthDot, fmtDateTime, type ClientTab, type ExternalNav } from './common';
import { GlobalCockpit } from './GlobalCockpit';
import { ClientDashboard } from './ClientDashboard';
import { TicketTable } from './TicketTable';
import { TicketDetail } from './TicketDetail';
import { Kanban } from './Kanban';
import { Technicians, TechnicianSheet } from './Technicians';
import { Objectives } from './Objectives';
import { Escalations } from './Escalations';
import { Integration } from './Integration';
import { WeeklyReport } from './WeeklyReport';
import { CsmTripsTable } from './Trips';

const TABS: { id: ClientTab; label: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'kanban', label: 'Backlog (Kanban)' },
  { id: 'techs', label: 'Techniciens' },
  { id: 'objectives', label: 'Objectifs' },
  { id: 'escalations', label: 'Escalades' },
  { id: 'integration', label: 'Intégration ITSM' },
  { id: 'report', label: 'Rapport hebdo' },
];

interface Props {
  store: ExternalStore;
  views: Record<ExternalClientId, ClientView>;
  internalRow: GlobalRow;
  role: Role;
  nav: ExternalNav;
  onNavigate: (nav: ExternalNav) => void;
  onBack: () => void;
  onOpenInternal: () => void;
}

export function ExternalCockpit({ store, views, internalRow, role, nav, onNavigate, onBack, onOpenInternal }: Props) {
  const { state } = store;
  const individual = can(role, 'externes', 'individual');
  const editable = can(role, 'externes', 'edit');
  const showFinance = can(role, 'finance');
  const viewList = externalClients.map((c) => views[c.id]);
  const rows = useMemo(() => viewList.map((v) => globalRow(v, state.now)), [views, state.now]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = useMemo(() => totalRow(rows, viewList, state.now), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can(role, 'externes')) {
    return (
      <section className="xc">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <AccessNotice access={missingRight(role, ['externes'])} />
      </section>
    );
  }

  const view = nav.scope === 'global' ? null : views[nav.scope];
  const allTickets = viewList.flatMap((v) => v.tickets);
  const openTicket = nav.ticketId ? allTickets.find((t) => t.id === nav.ticketId) : undefined;
  const openTech = nav.techId && individual ? state.techs.find((t) => t.id === nav.techId) : undefined;
  const go = (patch: Partial<ExternalNav>) => onNavigate({ ...nav, ...patch });
  const filterTo = (label: string, ids: string[]) => go({ tab: 'tickets', filter: { label, ids } });

  return (
    <section className="xc" aria-label="Supervision des clients externes">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <div>
          <b>Clients externes — supervision opérationnelle</b>
          <span>Collaborateurs SEATPI affectés chez les clients · données fictives</span>
        </div>
        <button className="ghost" onClick={() => store.syncNow()} disabled={!can(role, 'integrations', 'configure')} title="Synchroniser tous les connecteurs">
          <RefreshCw size={13} /> Simulation : synchroniser
        </button>
      </div>

      <nav className="xc-scopes" aria-label="Clients">
        <button className={nav.scope === 'global' ? 'active' : ''} aria-current={nav.scope === 'global'} onClick={() => onNavigate({ scope: 'global', tab: 'dashboard' })}>
          Vue globale
        </button>
        {viewList.map((v) => (
          <button key={v.client.id} className={nav.scope === v.client.id ? 'active' : ''} aria-current={nav.scope === v.client.id} onClick={() => onNavigate({ scope: v.client.id, tab: 'dashboard' })}>
            <HealthDot health={v.health} /> {v.client.name}
            <small>{v.client.tool ?? 'ITSM non renseigné'}</small>
          </button>
        ))}
      </nav>

      {view ? (
        <>
          <div className="tabs xc-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={nav.tab === t.id} className={nav.tab === t.id ? 'active' : ''} onClick={() => go({ tab: t.id, filter: t.id === 'tickets' ? nav.filter : undefined })}>
                {t.label}
                {t.id === 'integration' && view.connector.status !== 'connecté' && <i className={`hdot ${view.connector.status === 'erreur' ? 'rouge' : 'orange'}`} />}
              </button>
            ))}
          </div>
          {view.connector.status === 'erreur' && (
            <div className="restricted">
              Simulation en erreur pour {view.client.tool} : données de la dernière synchronisation simulée réussie ({fmtDateTime(view.connector.lastSuccessAt)}). Connexion réelle : non configurée.
            </div>
          )}
          {nav.tab === 'dashboard' && <ClientDashboard view={view} now={state.now} onFilter={filterTo} />}
          {nav.tab === 'tickets' && <TicketTable key={view.client.id} view={view} individual={individual} filter={nav.filter} onClearFilter={() => go({ filter: undefined })} onOpen={(id) => go({ ticketId: id })} />}
          {nav.tab === 'kanban' && (
            <Kanban
              view={view}
              now={state.now}
              individual={individual}
              editable={editable}
              settings={state.alertSettings}
              onStaleHours={store.setStaleHours}
              onMove={(id, to) => store.moveTicket(id, to, role)}
              onOpen={(id) => go({ ticketId: id })}
              onFilter={filterTo}
            />
          )}
          {nav.tab === 'techs' && <Technicians view={view} now={state.now} individual={individual} onOpenTech={(id) => go({ techId: id })} onFilter={filterTo} />}
          {nav.tab === 'objectives' && (
            <Objectives
              view={view}
              now={state.now}
              configurable={can(role, 'externes', 'configure')}
              onChange={(key, value) => store.setObjective(view.client.id, key, value)}
              onReset={() => store.resetObjectives(view.client.id)}
              onFilter={filterTo}
            />
          )}
          {nav.tab === 'escalations' && <Escalations view={view} onOpen={(id) => go({ ticketId: id })} />}
          {nav.tab === 'integration' && <Integration view={view} writes={state.writes} canSync={can(role, 'integrations', 'configure')} onSync={() => store.syncNow([view.client.id])} />}
          {nav.tab === 'report' && <WeeklyReport views={viewList} state={state} showFinance={showFinance} clientId={view.client.id} />}
        </>
      ) : (
        <>
          <div className="tabs xc-tabs" role="tablist">
            <button role="tab" aria-selected={nav.tab !== 'globalReport'} className={nav.tab !== 'globalReport' ? 'active' : ''} onClick={() => go({ tab: 'dashboard' })}>
              Cockpit global
            </button>
            <button role="tab" aria-selected={nav.tab === 'globalReport'} className={nav.tab === 'globalReport' ? 'active' : ''} onClick={() => go({ tab: 'globalReport' })}>
              Rapport département
            </button>
          </div>
          {nav.tab === 'globalReport' ? (
            <WeeklyReport views={viewList} state={state} showFinance={showFinance} />
          ) : (
            <>
            <GlobalCockpit
              rows={[...rows, internalRow]}
              total={total}
              views={viewList}
              showFinance={showFinance}
              onOpenClient={(id) => onNavigate({ scope: id, tab: 'dashboard' })}
              onOpenInternal={onOpenInternal}
              onAlert={(id, label, ids) => onNavigate({ scope: id, tab: 'tickets', filter: { label, ids } })}
            />
            <h3>Déplacements des managers CSM</h3>
            <CsmTripsTable trips={state.trips} individual={can(role, 'csm', 'individual')} onOpenClient={(id) => onNavigate({ scope: id, tab: 'dashboard' })} />
            </>
          )}
        </>
      )}

      {openTicket && (
        <TicketDetail
          ticket={openTicket}
          techs={state.techs.filter((t) => t.clientId === openTicket.clientId)}
          role={role}
          onClose={() => go({ ticketId: undefined })}
          onMove={(to, escalateTo) => store.moveTicket(openTicket.id, to, role, escalateTo)}
          onAssign={(techId) => store.assignTicket(openTicket.id, techId, role)}
        />
      )}
      {openTech && (
        <TechnicianSheet tech={openTech} view={views[openTech.clientId]} now={state.now} onClose={() => go({ techId: undefined })} onOpenTicket={(id) => go({ techId: undefined, ticketId: id })} />
      )}
      {nav.techId && !individual && (
        <div className="restricted">Fiche technicien non accessible avec ce rôle : seules des données agrégées sont affichées.</div>
      )}
    </section>
  );
}

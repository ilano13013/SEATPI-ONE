import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Agent, FloorId, RoomId } from './types';
import { can, type Role } from './auth/roles';
import { entryFloor, helpdeskPoles, plateauOf, poleByClient, polesOf, roomById, rooms } from './data/layout';
import { internalSites } from './data/sites';
import { personById } from './org/people';
import { clientSummary } from './services/simulation';
import { useDemoSimulation } from './services/useDemoSimulation';
import { hasWebGL, isNarrowScreen, prefersReducedMotion } from './lib/env';
import { Header } from './components/Header';
import { MetricsBar } from './components/MetricsBar';
import { Rail, type AppView } from './components/Rail';
import { ItsmRegistry } from './components/itsm/ItsmRegistry';
import { SidePanel } from './components/SidePanel';
import { Workspace } from './components/Workspace';
import { ExternalCockpit } from './components/external/ExternalCockpit';
import type { ExternalNav } from './components/external/common';
import { useExternal } from './external/useExternal';
import { deriveAll, type GlobalRow } from './external/derive';
import { isOpen, periods, slaRate } from './external/metrics';
import { isOnLeave } from './external/workload';
import type { ExternalClientId } from './external/types';
import type { SiteSceneData } from './scene/ExternalSite';
import type { ServicesSceneData } from './scene/ServiceRooms';
import { clientById } from './external/config';
import { csmTeam, exploitationTeam, serviceSummary } from './external/services';
import { activeTripOf, isTripActive, type Trip } from './external/trips';
import type { CsmTripView } from './scene/CsmTravel';
import { useInternalTickets } from './helpdesk/useInternalTickets';
import { internalTeams } from './helpdesk/teams';
import { internalClientById } from './helpdesk/internalClients';
import { consolidate, type HdTicket } from './helpdesk/consolidation';
import { useManagement, DEFAULT_N1_OBJECTIVES } from './management/useManagement';
import { declaredHours } from './management/rules';
import { HelpdeskCockpit } from './components/helpdesk/HelpdeskCockpit';
import { MANAGER_IDS, ManagementCockpit, managerScope, type MgmtTab, type ObjectiveScope } from './components/management/ManagementCockpit';
import { ChecklistSummary } from './components/management/Checklists';
import { ExploitationCockpit, McoCockpit } from './components/management/ServiceCockpits';
import type { ModuleLink } from './components/panels/DepartmentPanel';
import type { ExternalState } from './external/useExternal';
import { externalClients, externalTeams } from './external/config';
import type { Technician } from './external/types';
import { useFinance } from './finance/useFinance';
import { FinanceCockpit, type FinanceTab } from './components/finance/FinanceCockpit';
import { PdgCockpit } from './components/pdg/PdgCockpit';
import { useMoyens } from './moyens/useMoyens';
import { MoyensCockpit } from './components/moyens/MoyensCockpit';
import { INITIAL_READINESS, ProductionCockpit } from './components/production/ProductionCockpit';
import type { ReadinessItem } from './production/readiness';
import { activeData } from './data/provider';
import { useAdmin } from './admin/useAdmin';
import { AdminCenter, type AdminTab } from './components/admin/AdminCenter';
import { AuditContext, useAuditLog } from './audit/audit';
import { DEFAULT_RULES, roleLabels, setPermissionRules, type PermissionRule } from './auth/roles';
import { Toast } from './components/external/common';

/** Modules disponibles dans cette version (les autres arrivent par phases). */
const AVAILABLE_VIEWS = new Set<AppView>(['helpdesk', 'externes', 'management', 'mco', 'exploitation', 'moyens', 'finance', 'pdg', 'itsm', 'production', 'admin']);

/** Lien d'un espace 3D vers un module applicatif. */
const MODULE_VIEW: Record<ModuleLink, AppView> = {
  helpdesk: 'helpdesk',
  management: 'management',
  mco: 'mco',
  exploitation: 'exploitation',
  finance: 'finance',
  moyens: 'moyens',
  deplacements: 'finance',
  recrutement: 'finance',
  pdg: 'pdg',
  production: 'production',
};
const AVAILABLE_LINKS = new Set((Object.keys(MODULE_VIEW) as ModuleLink[]).filter((m) => AVAILABLE_VIEWS.has(MODULE_VIEW[m])));

/** Cockpit ouvert par un clic sur une personne de l'encadrement. */
const PERSON_VIEW: Record<string, AppView> = {
  'resp-helpdesk': 'helpdesk',
  'mgr-hd-lc': 'management',
  'mgr-hd-mtp': 'management',
  'mgr-mco': 'mco',
  'mgr-exp': 'exploitation',
  pdg: 'pdg',
};

export function App() {
  const sim = useDemoSimulation();
  const { state, metrics } = sim;
  const [webgl] = useState(hasWebGL);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [mode3d, setMode3d] = useState(webgl);
  const [role, setRole] = useState<Role>('teamLeader');
  // Règles de permissions modifiables par l'administrateur (appliquées avant le rendu des modules).
  const [permRules, setPermRules] = useState<PermissionRule[]>(DEFAULT_RULES);
  setPermissionRules(permRules);
  const audit = useAuditLog();
  const admin = useAdmin();
  const [adminTab, setAdminTab] = useState<AdminTab>('connexions');
  // Arrivée sur la carte des trois sites SEATPI et des sites clients externes.
  const [floor, setFloor] = useState<FloorId>('carte');
  const [selected, setSelected] = useState<RoomId | null>('helpdesk');
  const [overview, setOverview] = useState(true);
  const [focusKey, setFocusKey] = useState(0);
  // Sur mobile, le panneau recouvre la scène : il s'ouvre au premier clic.
  const [panelOpen, setPanelOpen] = useState(() => !isNarrowScreen());
  const [focusAgentId, setFocusAgentId] = useState<string | null>(null);
  const [selectedPole, setSelectedPole] = useState<string | null>(null);
  const [focusPersonId, setFocusPersonId] = useState<string | null>(null);
  // Vue principale : jumeau numérique 3D ou module applicatif.
  const [appView, setAppView] = useState<AppView>('jumeau');
  const [extNav, setExtNav] = useState<ExternalNav>({ scope: 'global', tab: 'dashboard' });
  const ext = useExternal(sim.running);
  const internal = useInternalTickets(sim.running);
  const mgmt = useManagement(state.agents, ext.state.techs);
  const [persona, setPersona] = useState('resp-helpdesk');
  const [mgmtTab, setMgmtTab] = useState<MgmtTab>('cra');
  const fin = useFinance(mgmt.state.collaborators, state.agents, ext.state.trips);
  const [finTab, setFinTab] = useState<FinanceTab>('global');
  const moyens = useMoyens(fin.state.travel);
  const { syncTrips } = fin;
  // Chaque déplacement CSM planifié est soumis à l'enveloppe déplacements (blocage si plafond atteint).
  useEffect(() => syncTrips(ext.state.trips), [ext.state.trips, syncTrips]);
  const [readiness, setReadiness] = useState<ReadinessItem[]>(INITIAL_READINESS);
  const [resetDone, setResetDone] = useState(false);

  // Les décisions du management (congés, CRA) se répercutent sur les techniciens N2 des sites clients.
  const extState = useMemo<ExternalState>(() => {
    // Dernier CRA hebdomadaire de chaque technicien (semaine échue la plus récente).
    const week = mgmt.state.cra.reduce((w, c) => (c.weekStart > w ? c.weekStart : w), '');
    const techs: Technician[] = ext.state.techs.map((t) => {
      const sheet = mgmt.state.cra.find((c) => c.personId === t.id && c.weekStart === week);
      return {
        ...t,
        leaveDates: mgmt.leaveDatesOf.get(t.id) ?? [],
        pendingLeaveRequests: mgmt.state.leaves.filter((l) => l.personId === t.id && l.status === 'Soumise').length,
        cra: sheet ? { status: sheet.status === 'Validé' ? 'Validé' : sheet.status === 'Soumis' ? 'Soumis' : 'À saisir', hours: declaredHours(sheet) } : t.cra,
      };
    });
    return { ...ext.state, techs };
  }, [ext.state, mgmt.state, mgmt.leaveDatesOf]);
  const views = useMemo(() => deriveAll(extState), [extState]);

  // Référentiel Helpdesk consolidé (interne N1 + clients N2).
  const hdTickets = useMemo<HdTicket[]>(
    () => consolidate(Object.values(internal.state.tickets).flat(), Object.values(ext.state.tickets).flat(), mgmt.state.collaborators, [...internal.state.techs, ...ext.state.techs]),
    [internal.state.tickets, internal.state.techs, ext.state.tickets, ext.state.techs, mgmt.state.collaborators],
  );
  const hdTargets = useMemo(() => {
    const t: Record<string, number> = {};
    for (const team of internalTeams) t[team.id] = (mgmt.state.internalObjectives[team.clientId] ?? DEFAULT_N1_OBJECTIVES).ticketsToResolve;
    for (const team of externalTeams) if (clientById(team.clientId).tool) t[team.id] = ext.state.objectives[team.clientId].ticketsToResolve;
    return t;
  }, [mgmt.state.internalObjectives, ext.state.objectives]);
  const objectiveScopes = useMemo<ObjectiveScope[]>(
    () => [
      ...internalTeams.map((team) => ({
        client: internalClientById(team.clientId)!,
        tickets: internal.state.tickets[team.clientId] ?? [],
        cfg: mgmt.state.internalObjectives[team.clientId] ?? DEFAULT_N1_OBJECTIVES,
        internal: true,
      })),
      ...externalClients.filter((c) => c.tool).map((c) => ({ client: c, tickets: ext.state.tickets[c.id] ?? [], cfg: ext.state.objectives[c.id], internal: false })),
    ],
    [internal.state.tickets, ext.state.tickets, ext.state.objectives, mgmt.state.internalObjectives],
  );

  const openExternal = useCallback((nav: ExternalNav) => {
    setExtNav(nav);
    setAppView('externes');
  }, []);

  const selectRoom = useCallback(
    (id: RoomId) => {
      const target = roomById(id);
      // Bâtiment de la carte : on entre dans le site, à l'étage du plateau Helpdesk.
      if (target.kind === 'building' && target.targetSite) {
        setFloor(entryFloor(target.targetSite));
        setOverview(true);
        setFocusKey((k) => k + 1);
        return;
      }
      setSelected(id);
      setSelectedPole(null);
      setFloor(target.floor);
      setOverview(false);
      setFocusKey((k) => k + 1);
      // Le bâtiment d'un client externe ouvre directement son cockpit.
      if (target.externalClientId) openExternal({ scope: target.externalClientId, tab: 'dashboard' });
      else setPanelOpen(true);
    },
    [openExternal],
  );

  const openTeam = useCallback(
    (clientId: string, teamId: string) => {
      const v = views[clientId as ExternalClientId];
      const load = v.loads.find((l) => l.team.id === teamId);
      openExternal({ scope: v.client.id, tab: 'tickets', filter: { label: `${load?.team.name ?? teamId} — tickets ouverts`, ids: load?.openIds ?? [] } });
    },
    [views, openExternal],
  );

  // Un déplacement CSM ouvre la vue globale, qui détaille tous les déplacements.
  const openTrip = useCallback((_trip: Trip) => openExternal({ scope: 'global', tab: 'dashboard' }), [openExternal]);

  /** Ouvre le cockpit d'une personne de l'encadrement (managers : persona du cockpit Management). */
  const openPersonCockpit = useCallback((personId: string) => {
    const v = PERSON_VIEW[personId];
    if (!v || !AVAILABLE_VIEWS.has(v)) return;
    if (v === 'management') setPersona(personId);
    setAppView(v);
  }, []);

  /** RÉINITIALISER LA DÉMONSTRATION : tous les modules repartent de leurs données fictives initiales. */
  const resetAll = () => {
    sim.reset();
    const fresh = ext.reset();
    internal.reset();
    mgmt.reset();
    const freshFin = fin.reset(mgmt.state.collaborators, state.agents, fresh.trips);
    moyens.reset(freshFin.travel);
    setReadiness(INITIAL_READINESS);
    admin.reset();
    audit.reset();
    setPermRules(DEFAULT_RULES);
    setPersona('resp-helpdesk');
    setFinTab('global');
    setFocusPersonId(null);
    setSelectedPole(null);
    setAppView('jumeau');
    setFloor('carte');
    setOverview(true);
    setFocusKey((k) => k + 1);
    setResetDone(true);
  };

  const backToMap = useCallback(() => {
    setAppView('jumeau');
    setOverview(true);
    setFocusKey((k) => k + 1);
  }, []);

  /** Clic sur une personne de l'encadrement : ouvre l'espace où elle travaille. */
  const openPerson = useCallback(
    (personId: string) => {
      const person = personById(personId);
      if (!person) return;
      const room = rooms.find((r) => r.location === person.site && r.kind === person.roomKind);
      if (room) selectRoom(room.id);
      setFocusPersonId(personId);
    },
    [selectRoom],
  );

  const openTech = useCallback(
    (clientId: string, techId: string) => openExternal({ scope: clientId as ExternalClientId, tab: 'techs', techId }),
    [openExternal],
  );

  /** Sélectionne un pôle client du plateau Helpdesk (null = plateau entier). */
  const selectPole = useCallback(
    (clientId: string | null) => {
      const site = (clientId && poleByClient(clientId)?.site) || (selected ? roomById(selected).location : 'laciotat');
      selectRoom(plateauOf(site === 'montpellier' || site === 'paris' ? site : 'laciotat').id);
      setSelectedPole(clientId);
    },
    [selectRoom, selected],
  );

  const showOverview = useCallback(() => {
    setOverview(true);
    setFocusKey((k) => k + 1);
  }, []);

  const changeFloor = useCallback((f: FloorId) => {
    setFloor(f);
    setOverview(true);
    setFocusKey((k) => k + 1);
  }, []);

  const focusAgent = useCallback(
    (agent: Agent) => {
      selectPole(agent.clientId);
      setFocusAgentId(agent.id);
    },
    [selectPole],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    // (les fenêtres du cockpit interceptent Échap avant ce gestionnaire)
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const badges = useMemo<Partial<Record<RoomId, string>>>(() => {
    const lowStock = state.inventory.filter((i) => i.inStock <= i.alertThreshold).length;
    const available = state.vehicles.filter((v) => v.status === 'Disponible').length;
    const spent = state.budgets.reduce((s, b) => s + b.spent, 0);
    const allocated = state.budgets.reduce((s, b) => s + b.allocated, 0);
    return {
      helpdesk: `${metrics.waitingTotal} en attente · SLA ${metrics.slaGlobal.toLocaleString('fr-FR')} %`,
      pause: `${metrics.onBreak} en pause / repas`,
      accueil: `${state.reception.length} évènements aujourd'hui`,
      stock: `${lowStock} alerte${lowStock > 1 ? 's' : ''} de stock`,
      parking: `${available} véhicule${available > 1 ? 's' : ''} disponible${available > 1 ? 's' : ''}`,
      rh: `${mgmt.state.leaves.filter((l) => l.status === "Soumise").length} demandes de congé en attente (suivi)`,
      direction: `${Math.round((spent / allocated) * 100)} % du budget consommé`,
      exploitation: `${serviceSummary(Object.values(views), 'Exploitation', ext.state.now).open.length} escalade(s) en cours`,
      csm: `${serviceSummary(Object.values(views), 'CSM', ext.state.now).open.length} escalade(s) contractuelle(s)`,
      ...Object.fromEntries(
        Object.values(views).flatMap((v) => {
          const sla = slaRate(v.tickets, periods(ext.state.now).week).rate;
          const text = `${v.tickets.filter(isOpen).length} ouverts · SLA ${sla ?? '—'} % · ${v.health}`;
          return [[`ext-${v.client.id}`, text], [`carte-ext-${v.client.id}`, text]];
        }),
      ),
      // Badges par site : plateaux Helpdesk, pause et bâtiments de la carte.
      ...Object.fromEntries(
        internalSites.flatMap((s) => {
          const poles = new Set(polesOf(s.id).map((p) => p.clientId));
          const waiting = state.queues.filter((q) => poles.has(q.clientId)).reduce((n, q) => n + q.waiting, 0);
          const agents = state.agents.filter((a) => a.site === s.id);
          const onBreak = agents.filter((a) => a.status === 'Pause' || a.status === 'Repas').length;
          const plateau = plateauOf(s.id).id;
          const pause = rooms.find((r) => r.location === s.id && r.kind === 'pause')!.id;
          return [
            [plateau, `${waiting} en attente · ${agents.filter((a) => a.status !== 'Hors ligne').length} agents connectés`],
            [pause, `${onBreak} en pause / repas`],
            [`site-${s.id}`, `${agents.length} agents Helpdesk · ${rooms.filter((r) => r.location === s.id).length} espaces`],
          ];
        }),
      ),
    };
  }, [state, metrics, views, ext.state.now, mgmt.state.leaves]);

  // Données 3D des sites clients : état opérationnel, équipes et techniciens.
  const sites = useMemo<Record<string, SiteSceneData>>(() => {
    const individual = can(role, 'externes', 'individual');
    return Object.fromEntries(
      Object.values(views).map((v) => [
        v.client.id,
        {
          clientId: v.client.id,
          name: v.client.name,
          accent: v.client.accent,
          health: v.health,
          teams: v.loads.map((l) => ({
            id: l.team.id,
            name: l.team.name,
            level: l.level,
            techs: l.techs.map((t) => {
              const inProgress = v.tickets.filter((x) => x.assigneeId === t.id && x.status === 'En cours').length;
              return {
                id: t.id,
                name: individual ? t.name : 'Technicien',
                state: isOnLeave(t, ext.state.now) ? 'congé' : inProgress ? 'occupé' : 'disponible',
                tooltip: individual ? `${inProgress} ticket(s) en cours` : 'Détail réservé (rôle)',
              };
            }),
          })),
        },
      ]),
    );
  }, [views, role, ext.state.now]);

  // Personnel des services internes Exploitation et CSM, occupé selon les escalades reçues.
  const services = useMemo<ServicesSceneData>(() => {
    const individual = (m: 'exploitation' | 'csm') => can(role, m, 'individual');
    const list = Object.values(views);
    const exp = serviceSummary(list, 'Exploitation', ext.state.now);
    const csm = serviceSummary(list, 'CSM', ext.state.now);
    return {
      exploitation: exploitationTeam.map((m) => {
        const mine = exp.open.filter((r) => r.ownerId === m.id);
        return {
          id: m.id,
          site: m.site,
          name: individual('exploitation') ? m.name : 'Exploitation',
          state: !m.present ? 'absent' : mine.length ? 'occupé' : 'disponible',
          tooltip: mine.length ? `Escalade ${mine[0].clientName} · ${mine[0].ticket.id}` : m.onCall ? 'Disponible · astreinte' : 'Disponible',
        };
      }),
      csm: csmTeam.map((m) => {
        const client = clientById(m.clientId!);
        const mine = csm.open.filter((r) => r.ownerId === m.id);
        // Un CSM en déplacement n'est pas à son bureau.
        const away = activeTripOf(ext.state.trips, m.id, ext.state.now);
        return {
          id: m.id,
          site: m.site,
          name: individual('csm') ? m.name : 'CSM',
          state: away ? 'absent' : mine.length ? 'occupé' : 'disponible',
          tooltip: mine.length ? `${mine.length} escalade(s) ${client.name} en cours` : `Compte ${client.name}`,
          accent: client.accent,
          label: `CSM ${client.name}`,
        };
      }),
    };
  }, [views, role, ext.state.now]);

  // Déplacements CSM affichés sur la carte des sites clients.
  const csmTrips = useMemo<CsmTripView[]>(
    () =>
      ext.state.trips
        .filter((t) => isTripActive(t, ext.state.now))
        .map((t) => ({
          trip: t,
          memberLabel: can(role, 'csm', 'individual') ? (csmTeam.find((m) => m.id === t.memberId)?.name ?? 'CSM') : 'Manager CSM',
          clientName: clientById(t.clientId).name,
          x: roomById(`ext-${t.clientId}` as RoomId).x,
        })),
    [ext.state.trips, ext.state.now, role],
  );

  // Ligne « interne » de la vue consolidée, issue de la simulation du plateau.
  const internalRow = useMemo<GlobalRow>(
    () => ({
      id: 'interne',
      label: 'Plateau Helpdesk (interne)',
      internal: true,
      health: null,
      headcount: state.agents.length,
      open: state.tickets.filter((t) => t.status !== 'Résolu').length,
      inProgress: state.tickets.filter((t) => t.status === 'En cours').length,
      resolved: state.tickets.filter((t) => t.status === 'Résolu').length,
      backlog: state.queues.reduce((s, q) => s + q.waiting, 0),
      sla: metrics.slaGlobal,
      weeklyTarget: null,
      done: null,
      remaining: null,
      loadRatio: null,
      craPending: null,
      leavePending: mgmt.state.leaves.filter((l) => l.status === 'Soumise' && state.agents.some((a) => a.id === l.personId)).length,
      finance: null,
    }),
    [state, metrics, mgmt.state.leaves],
  );

  const poleBadges = useMemo(() => {
    const entries = helpdeskPoles.map((p) => {
      const s = clientSummary(state, p.clientId);
      return [p.clientId, `${s.waiting} en attente · SLA ${s.sla.toLocaleString('fr-FR')} %`] as const;
    });
    return Object.fromEntries(entries) as Partial<Record<string, string>>;
  }, [state]);

  const room = selected ? roomById(selected) : null;

  return (
    <AuditContext.Provider value={{ user: `${roleLabels[role]} (démonstration)`, record: audit.record }}>
    <div className="app">
      <Rail
        view={appView}
        available={AVAILABLE_VIEWS}
        onCarte={() => {
          setAppView('jumeau');
          setFloor('carte');
          setOverview(true);
          setFocusKey((k) => k + 1);
        }}
        onOpen={(v) => (v === 'externes' ? openExternal({ scope: 'global', tab: 'dashboard' }) : setAppView(v))}
      />
      <main>
        <Header role={role} onRole={setRole} sim={sim} mode3d={mode3d} webgl={webgl} onToggleMode={() => setMode3d((m) => !m)} onResetAll={resetAll} onAdmin={() => setAppView('admin')} adminActive={appView === 'admin'} />
        {activeData.warning && <div className="notice">{activeData.warning}</div>}
        {resetDone && <Toast ok message="Démonstration réinitialisée : toutes les données fictives ont été régénérées (aucun système réel concerné)." onDone={() => setResetDone(false)} />}
        {!webgl && <div className="notice">WebGL n'est pas disponible sur ce poste : la vue 2D donne accès aux mêmes modules.</div>}
        {appView === 'externes' && (
          <ExternalCockpit
            store={ext}
            views={views}
            internalRow={internalRow}
            role={role}
            nav={extNav}
            onNavigate={setExtNav}
            onBack={() => {
              setAppView('jumeau');
              setFloor('sites');
              setOverview(true);
              setFocusKey((k) => k + 1);
            }}
            onOpenInternal={() => {
              setAppView('jumeau');
              selectRoom('helpdesk');
            }}
          />
        )}
        {appView === 'itsm' && <ItsmRegistry connectors={ext.state.connectors} />}
        {appView === 'helpdesk' && (
          <HelpdeskCockpit
            checklists={
              can(role, 'management') ? (
                <ChecklistSummary
                  store={mgmt}
                  scope={null}
                  onOpen={(t) => {
                    setPersona('resp-helpdesk');
                    setMgmtTab(t);
                    setAppView('management');
                  }}
                />
              ) : undefined
            }
            tickets={hdTickets}
            agents={state.agents}
            techsN2={extState.techs}
            techsN1={internal.state.techs}
            leaveDates={mgmt.leaveDatesOf}
            targets={hdTargets}
            now={Math.max(ext.state.now, internal.state.now)}
            role={role}
            onMove={(t, to, esc) => (t.scope === 'interne' ? internal.moveTicket(t.id, to, role, esc) : ext.moveTicket(t.id, to, role, esc))}
            onAssign={(t, id) => (t.scope === 'interne' ? internal.assignTicket(t.id, id, role) : ext.assignTicket(t.id, id, role))}
            onCreate={(level, clientId, input) => (level === 'N1' ? internal.createTicket(clientId, input, role) : ext.createTicket(clientId as ExternalClientId, input, role))}
            onBack={backToMap}
          />
        )}
        {appView === 'management' && (
          <ManagementCockpit
            tab={mgmtTab}
            onTab={setMgmtTab}
            store={mgmt}
            role={role}
            persona={persona}
            onPersona={setPersona}
            objectiveScopes={objectiveScopes}
            onExternalObjective={(id, key, v) => ext.setObjective(id as ExternalClientId, key, v)}
            now={ext.state.now}
            onBack={backToMap}
          />
        )}
        {appView === 'finance' && <FinanceCockpit store={fin} role={role} tab={finTab} onTab={setFinTab} onBack={backToMap} />}
        {appView === 'moyens' && (
          <MoyensCockpit
            moyens={moyens}
            fin={fin}
            role={role}
            onBack={backToMap}
            onOpenBudget={() => {
              setFinTab('deplacements');
              setAppView('finance');
            }}
          />
        )}
        {appView === 'pdg' && (
          <PdgCockpit
            sim={state}
            views={Object.values(views)}
            tickets={hdTickets}
            mgmt={mgmt.state}
            fin={fin.state}
            now={ext.state.now}
            role={role}
            onBack={backToMap}
            onOpen={(v, sub) => {
              if (v === 'finance' && sub) setFinTab(sub as FinanceTab);
              if (v === 'externes') openExternal({ scope: 'global', tab: 'dashboard' });
              else setAppView(v);
            }}
          />
        )}
        {appView === 'admin' && (
          <AdminCenter
            admin={admin}
            fin={fin}
            role={role}
            tab={adminTab}
            onTab={setAdminTab}
            rules={permRules}
            onRules={(next) => {
              audit.record({ user: `${roleLabels[role]} (démonstration)`, module: 'Rôles & permissions', field: 'Règles de permissions', oldValue: `${permRules.length} règle(s)`, newValue: `${next.length} règle(s)` });
              setPermRules(next);
            }}
            audit={audit.entries}
            onOpenProduction={() => setAppView('production')}
            onBack={backToMap}
          />
        )}
        {appView === 'production' && <ProductionCockpit role={role} items={readiness} onItems={setReadiness} onBack={backToMap} />}
        {appView === 'mco' && <McoCockpit views={Object.values(views)} role={role} now={ext.state.now} onBack={backToMap} onOpen={openExternal} />}
        {appView === 'exploitation' && (
          <ExploitationCockpit views={Object.values(views)} role={role} now={ext.state.now} onBack={backToMap} onOpenTicket={(clientId, ticketId) => openExternal({ scope: clientId, tab: 'escalations', ticketId })} />
        )}
        {appView === 'jumeau' && <MetricsBar metrics={metrics} clientsCount={state.clients.length} />}
        <Workspace
          hidden={appView !== 'jumeau'}
          sites={sites}
          services={services}
          onTeamClick={openTeam}
          onTechClick={openTech}
          csmTrips={csmTrips}
          tripsIndividual={can(role, 'csm', 'individual')}
          onTripClick={openTrip}
          onPersonClick={openPerson}
          mode3d={mode3d}
          floor={floor}
          selected={selected}
          focusKey={focusKey}
          overview={overview}
          state={state}
          badges={badges}
          selectedPole={selectedPole}
          poleBadges={poleBadges}
          onSelectPole={selectPole}
          reducedMotion={reducedMotion}
          onFloor={changeFloor}
          onOverview={showOverview}
          onSelect={selectRoom}
          onAgentClick={focusAgent}
        />
      </main>
      {appView === 'jumeau' && panelOpen && room && !room.externalClientId && (
        <SidePanel
          room={room}
          state={state}
          role={role}
          selectedPole={selectedPole}
          onSelectPole={selectPole}
          focusAgentId={focusAgentId}
          onFocusAgent={setFocusAgentId}
          onClose={() => setPanelOpen(false)}
          views={Object.values(views)}
          trips={ext.state.trips}
          focusPersonId={focusPersonId}
          onOpenPerson={openPersonCockpit}
          personExtras={(id) =>
            MANAGER_IDS.includes(id) && can(role, 'management') ? (
              <ChecklistSummary
                store={mgmt}
                scope={new Set(managerScope(id, mgmt.state).map((c) => c.id))}
                onOpen={(t) => {
                  setPersona(id);
                  setMgmtTab(t);
                  setAppView('management');
                }}
              />
            ) : null
          }
          availableModules={AVAILABLE_LINKS}
          onOpenModule={(m) => {
            if (m === 'deplacements' || m === 'recrutement' || m === 'finance') setFinTab(m === 'finance' ? 'global' : m);
            setAppView(MODULE_VIEW[m]);
          }}
          now={ext.state.now}
          onOpenTicket={(clientId, ticketId) => openExternal({ scope: clientId, tab: 'escalations', ticketId })}
          onOpenClient={(clientId) => openExternal({ scope: clientId, tab: 'dashboard' })}
        />
      )}
    </div>
    </AuditContext.Provider>
  );
}

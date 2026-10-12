import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Agent, FloorId, RoomId } from './types';
import type { Role } from './auth/roles';
import { helpdeskPoles, roomById } from './data/layout';
import { clientSummary } from './services/simulation';
import { useDemoSimulation } from './services/useDemoSimulation';
import { hasWebGL, isNarrowScreen, prefersReducedMotion } from './lib/env';
import { Header } from './components/Header';
import { MetricsBar } from './components/MetricsBar';
import { Rail } from './components/Rail';
import { SidePanel } from './components/SidePanel';
import { Workspace } from './components/Workspace';

export function App() {
  const sim = useDemoSimulation();
  const { state, metrics } = sim;
  const [webgl] = useState(hasWebGL);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [mode3d, setMode3d] = useState(webgl);
  const [role, setRole] = useState<Role>('teamLeader');
  const [floor, setFloor] = useState<FloorId>('etage1');
  const [selected, setSelected] = useState<RoomId | null>('helpdesk');
  const [overview, setOverview] = useState(true);
  const [focusKey, setFocusKey] = useState(0);
  // Sur mobile, le panneau recouvre la scène : il s'ouvre au premier clic.
  const [panelOpen, setPanelOpen] = useState(() => !isNarrowScreen());
  const [focusAgentId, setFocusAgentId] = useState<string | null>(null);
  const [selectedPole, setSelectedPole] = useState<string | null>(null);

  const selectRoom = useCallback((id: RoomId) => {
    setSelected(id);
    setSelectedPole(null);
    setFloor(roomById(id).floor);
    setOverview(false);
    setFocusKey((k) => k + 1);
    setPanelOpen(true);
  }, []);

  /** Sélectionne un pôle client du plateau Helpdesk (null = plateau entier). */
  const selectPole = useCallback(
    (clientId: string | null) => {
      selectRoom('helpdesk');
      setSelectedPole(clientId);
    },
    [selectRoom],
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
      rh: `${state.hr.pendingLeaves} congés à valider`,
      direction: `${Math.round((spent / allocated) * 100)} % du budget consommé`,
    };
  }, [state, metrics]);

  const poleBadges = useMemo(() => {
    const entries = helpdeskPoles.map((p) => {
      const s = clientSummary(state, p.clientId);
      return [p.clientId, `${s.waiting} en attente · SLA ${s.sla.toLocaleString('fr-FR')} %`] as const;
    });
    return Object.fromEntries(entries) as Partial<Record<string, string>>;
  }, [state]);

  const room = selected ? roomById(selected) : null;

  return (
    <div className="app">
      <Rail selected={selected} onSelect={selectRoom} onOverview={showOverview} />
      <main>
        <Header role={role} onRole={setRole} sim={sim} mode3d={mode3d} webgl={webgl} onToggleMode={() => setMode3d((m) => !m)} />
        {!webgl && <div className="notice">WebGL n'est pas disponible sur ce poste : la vue 2D donne accès aux mêmes modules.</div>}
        <MetricsBar metrics={metrics} clientsCount={state.clients.length} />
        <Workspace
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
      {panelOpen && room && (
        <SidePanel
          room={room}
          state={state}
          role={role}
          selectedPole={selectedPole}
          onSelectPole={selectPole}
          focusAgentId={focusAgentId}
          onFocusAgent={setFocusAgentId}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}

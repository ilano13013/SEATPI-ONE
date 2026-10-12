import { Pause, Play, RefreshCw, RotateCcw } from 'lucide-react';
import { roleLabels, type Role } from '../auth/roles';
import { formatTime } from '../lib/format';
import { REFRESH_OPTIONS, type DemoSimulation, type RefreshInterval } from '../services/useDemoSimulation';

interface Props {
  role: Role;
  onRole: (role: Role) => void;
  sim: DemoSimulation;
  mode3d: boolean;
  webgl: boolean;
  onToggleMode: () => void;
}

export function Header({ role, onRole, sim, mode3d, webgl, onToggleMode }: Props) {
  return (
    <header className="header">
      <div>
        <div className="eyebrow">SEATPI / DIGITAL TWIN</div>
        <h1>
          SEATPI <span>ONE</span>
        </h1>
        <p>Centre de commande de l'entreprise · Environnement de démonstration</p>
      </div>
      <div className="topright">
        <span className="pill" title="Données 100 % fictives, aucune connexion aux systèmes SEATPI">
          <i /> MODE DÉMO
        </span>
        <label className="field">
          <span>Rôle simulé</span>
          <select value={role} onChange={(e) => onRole(e.target.value as Role)}>
            {(Object.keys(roleLabels) as Role[]).map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
        </label>
        <div className="simctl" role="group" aria-label="Simulation des données">
          <button className="icon" onClick={() => sim.setRunning(!sim.running)} aria-label={sim.running ? 'Suspendre la simulation' : 'Reprendre la simulation'} title={sim.running ? 'Suspendre' : 'Reprendre'}>
            {sim.running ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <select aria-label="Intervalle de rafraîchissement" value={sim.interval} onChange={(e) => sim.setInterval(Number(e.target.value) as RefreshInterval)}>
            {REFRESH_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </select>
          <button className="icon" onClick={sim.refresh} aria-label="Rafraîchir maintenant" title="Rafraîchir maintenant">
            <RefreshCw size={15} />
          </button>
          <button className="icon" onClick={sim.reset} aria-label="Réinitialiser la démo" title="Réinitialiser la démo">
            <RotateCcw size={15} />
          </button>
          <span className="fresh" aria-live="polite">
            {sim.running ? 'Simulation' : 'En pause'} · {formatTime(sim.state.updatedAt)}
          </span>
        </div>
        <button className="outline" onClick={onToggleMode} disabled={!webgl && !mode3d} title={webgl ? undefined : 'WebGL indisponible : mode 2D uniquement'}>
          {mode3d ? 'Vue 2D' : 'Vue 3D'}
        </button>
      </div>
    </header>
  );
}

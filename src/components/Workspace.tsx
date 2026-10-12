import { lazy, Suspense } from 'react';
import { ChevronRight, Maximize2 } from 'lucide-react';
import type { Agent, DemoState, FloorId, RoomId } from '../types';
import { floors, rooms, roomsOnFloor } from '../data/layout';
import { allStatuses, statusColors } from '../lib/status';

const Scene = lazy(() => import('../scene/Scene'));

interface Props {
  mode3d: boolean;
  floor: FloorId;
  selected: RoomId | null;
  focusKey: number;
  overview: boolean;
  state: DemoState;
  badges: Partial<Record<RoomId, string>>;
  reducedMotion: boolean;
  onFloor: (floor: FloorId) => void;
  onOverview: () => void;
  onSelect: (id: RoomId) => void;
  onAgentClick: (agent: Agent) => void;
}

export function Workspace(props: Props) {
  const { mode3d, floor, selected, badges, onFloor, onOverview, onSelect } = props;
  return (
    <section className="workspace" aria-label="Entreprise virtuelle">
      <div className="scenehead">
        <div>
          <b>Entreprise virtuelle</b>
          <span>{mode3d ? 'Choisissez une pièce pour ouvrir son module' : 'Vue 2D accessible — mêmes modules que la 3D'}</span>
        </div>
        {mode3d && (
          <div className="floorbar">
            <div className="segmented" role="radiogroup" aria-label="Étage">
              {floors.map((f) => (
                <button key={f.id} role="radio" aria-checked={floor === f.id} className={floor === f.id ? 'active' : ''} onClick={() => onFloor(f.id)} title={f.label}>
                  {f.label}
                </button>
              ))}
            </div>
            <button className="ghost" onClick={onOverview} title="Recentrer sur l'étage">
              <Maximize2 size={14} /> Vue d'ensemble
            </button>
          </div>
        )}
      </div>

      {mode3d ? (
        <Suspense fallback={<div className="loading">Chargement de la scène 3D…</div>}>
          <Scene {...props} />
        </Suspense>
      ) : (
        <div className="twod">
          {floors.map((f) => (
            <div key={f.id} className="twod-floor">
              <h3>{f.label}</h3>
              <div className="twod-grid">
                {roomsOnFloor(f.id).map((r) => (
                  <button key={r.id} className={selected === r.id ? 'active' : ''} aria-pressed={selected === r.id} onClick={() => onSelect(r.id)} style={{ borderLeftColor: r.color }}>
                    <span>
                      <b>{r.label}</b>
                      <small>{badges[r.id] ?? r.description}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode3d && (
        <div className="legend" aria-label="Légende des états">
          {allStatuses.map((s) => (
            <span key={s}>
              <i style={{ background: statusColors[s] }} />
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="scenefooter">
        {(mode3d ? roomsOnFloor(floor) : rooms).map((r) => (
          <button className={selected === r.id ? 'active' : ''} key={r.id} onClick={() => onSelect(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
    </section>
  );
}

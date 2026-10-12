import { lazy, Suspense } from 'react';
import { ChevronRight, Maximize2 } from 'lucide-react';
import type { Agent, DemoState, FloorId, RoomId } from '../types';
import type { SiteSceneData } from '../scene/ExternalSite';
import type { ServicesSceneData } from '../scene/ServiceRooms';
import type { CsmTripView } from '../scene/CsmTravel';
import type { Trip } from '../external/trips';
import { CsmTripsOverlay } from './external/Trips';
import { floors, helpdeskPoles, rooms, roomsOnFloor } from '../data/layout';
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
  selectedPole: string | null;
  poleBadges: Partial<Record<string, string>>;
  onSelectPole: (clientId: string) => void;
  sites: Record<string, SiteSceneData>;
  services: ServicesSceneData;
  onTeamClick: (clientId: string, teamId: string) => void;
  onTechClick: (clientId: string, techId: string) => void;
  csmTrips: CsmTripView[];
  /** Noms des managers CSM visibles selon le rôle. */
  tripsIndividual: boolean;
  onTripClick: (trip: Trip) => void;
  /** Masque l'espace sans démonter la scène 3D. */
  hidden?: boolean;
  reducedMotion: boolean;
  onFloor: (floor: FloorId) => void;
  onOverview: () => void;
  onSelect: (id: RoomId) => void;
  onAgentClick: (agent: Agent) => void;
}

export function Workspace(props: Props) {
  const { mode3d, floor, selected, badges, selectedPole, poleBadges, onFloor, onOverview, onSelect, onSelectPole } = props;
  const poleActive = (id: string) => selected === 'helpdesk' && selectedPole === id;
  return (
    <section className="workspace" aria-label="Entreprise virtuelle" hidden={props.hidden}>
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
              {f.id === 'etage1' && (
                <>
                  <h4>Plateau Helpdesk — pôles clients</h4>
                  <div className="twod-grid poles">
                    {helpdeskPoles.map((p) => (
                      <button key={p.clientId} className={poleActive(p.clientId) ? 'active' : ''} aria-pressed={poleActive(p.clientId)} onClick={() => onSelectPole(p.clientId)} style={{ borderLeftColor: p.color }}>
                        <span>
                          <b>{p.label}</b>
                          <small>{poleBadges[p.clientId]}</small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {mode3d && floor === 'sites' && <CsmTripsOverlay trips={props.csmTrips.map((v) => v.trip)} individual={props.tripsIndividual} onSelect={props.onTripClick} />}

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
          <button className={selected === r.id && !(r.id === 'helpdesk' && selectedPole) ? 'active' : ''} key={r.id} onClick={() => onSelect(r.id)}>
            {r.label}
          </button>
        ))}
        {selected === 'helpdesk' &&
          helpdeskPoles.map((p) => (
            <button className={`pole${poleActive(p.clientId) ? ' active' : ''}`} key={p.clientId} onClick={() => onSelectPole(p.clientId)}>
              {p.label}
            </button>
          ))}
      </div>
    </section>
  );
}

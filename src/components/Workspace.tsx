import { lazy, Suspense } from 'react';
import { ChevronRight, Maximize2 } from 'lucide-react';
import type { Agent, DemoState, FloorId, RoomId } from '../types';
import type { SiteSceneData } from '../scene/ExternalSite';
import type { ServicesSceneData } from '../scene/ServiceRooms';
import type { CsmTripView } from '../scene/CsmTravel';
import type { Trip } from '../external/trips';
import { CsmTripsOverlay } from './external/Trips';
import { entryFloor, floorById, floorsOf, polesOf, roomById, rooms, roomsOnFloor } from '../data/layout';
import { internalSites } from '../data/sites';
import type { Location } from '../types';
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
  onPersonClick: (personId: string) => void;
  onFloor: (floor: FloorId) => void;
  onOverview: () => void;
  onSelect: (id: RoomId) => void;
  onAgentClick: (agent: Agent) => void;
}

const LOCATIONS: { id: Location; label: string }[] = [
  { id: 'carte', label: 'Carte des sites' },
  ...internalSites.map((s) => ({ id: s.id as Location, label: s.main ? `${s.name} ★` : s.name })),
  { id: 'externes', label: 'Sites clients externes' },
];

const firstFloorOf = (loc: Location): FloorId => (loc === 'carte' ? 'carte' : loc === 'externes' ? 'sites' : entryFloor(loc));

export function Workspace(props: Props) {
  const { mode3d, floor, selected, badges, selectedPole, poleBadges, onFloor, onOverview, onSelect, onSelectPole } = props;
  const location = floorById(floor).location;
  const selectedRoom = selected ? roomById(selected) : null;
  const plateauSite = selectedRoom?.kind === 'helpdesk' && (selectedRoom.location === 'laciotat' || selectedRoom.location === 'montpellier' || selectedRoom.location === 'paris') ? selectedRoom.location : null;
  const poleActive = (id: string) => !!plateauSite && selectedPole === id;
  const siteFloors = floorsOf(location);
  return (
    <section className="workspace" aria-label="Entreprise virtuelle" hidden={props.hidden}>
      <div className="scenehead">
        <div>
          <b>Entreprise virtuelle</b>
          <span>{mode3d ? 'Choisissez un site, un étage puis un espace' : 'Vue 2D accessible — mêmes espaces et modules que la vue 3D'}</span>
        </div>
        {mode3d && (
          <div className="floorbar">
            <div className="segmented" role="radiogroup" aria-label="Site">
              {LOCATIONS.map((l) => (
                <button key={l.id} role="radio" aria-checked={location === l.id} className={location === l.id ? 'active' : ''} onClick={() => onFloor(firstFloorOf(l.id))}>
                  {l.label}
                </button>
              ))}
            </div>
            {siteFloors.length > 1 && (
              <div className="segmented floors" role="radiogroup" aria-label="Étage">
                {siteFloors.map((f) => (
                  <button key={f.id} role="radio" aria-checked={floor === f.id} className={floor === f.id ? 'active' : ''} onClick={() => onFloor(f.id)} title={f.label}>
                    {f.short}
                  </button>
                ))}
              </div>
            )}
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
          {LOCATIONS.filter((l) => l.id !== 'carte').map((l) => (
            <section key={l.id} className="twod-site" aria-label={l.label.replace(' ★', '')}>
              <h2>{l.label}</h2>
              {floorsOf(l.id).map((f) => (
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
                  {roomsOnFloor(f.id).some((r) => r.kind === 'helpdesk') && l.id !== 'externes' && l.id !== 'carte' && polesOf(l.id).length > 0 && (
                    <>
                      <h4>Plateau Helpdesk — pôles clients</h4>
                      <div className="twod-grid poles">
                        {polesOf(l.id).map((p) => (
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
            </section>
          ))}
        </div>
      )}

      {mode3d && floor === 'sites' && <CsmTripsOverlay trips={props.csmTrips.map((v) => v.trip)} individual={props.tripsIndividual} onSelect={props.onTripClick} />}
      {mode3d && floor === 'carte' && (
        <div className="map-note">Implantation des départements : configuration de démonstration, à confirmer. RH et Stock uniquement à La Ciotat.</div>
      )}

      {mode3d && floor !== 'carte' && (
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
        {(mode3d ? roomsOnFloor(floor) : []).map((r) => (
          <button className={selected === r.id && !(r.kind === 'helpdesk' && selectedPole) ? 'active' : ''} key={r.id} onClick={() => onSelect(r.id)}>
            {r.label}
          </button>
        ))}
        {plateauSite &&
          selectedRoom?.floor === floor &&
          polesOf(plateauSite).map((p) => (
            <button className={`pole${poleActive(p.clientId) ? ' active' : ''}`} key={p.clientId} onClick={() => onSelectPole(p.clientId)}>
              {p.label}
            </button>
          ))}
      </div>
    </section>
  );
}

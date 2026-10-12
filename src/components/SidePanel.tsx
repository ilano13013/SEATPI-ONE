import type { ReactNode } from 'react';
import { Activity, X } from 'lucide-react';
import type { DemoState, Room, SiteId } from '../types';
import { roleLabels, type Role } from '../auth/roles';
import { roomDataAccess } from '../auth/access';
import { HelpdeskPanel } from './panels/HelpdeskPanel';
import { PausePanel } from './panels/PausePanel';
import { AccueilPanel, DirectionPanel, ParkingPanel, RhPanel, StockPanel, type FleetProps, type RhCounters } from './panels/OtherPanels';
import { AccessNotice } from './ui';
import { CsmPanel, ExploitationPanel } from './panels/ServicesPanels';
import type { ClientView } from '../external/derive';
import type { ExternalClientId } from '../external/types';
import type { Trip } from '../external/trips';
import { DepartmentPanel, ModuleLinks, type ModuleLink } from './panels/DepartmentPanel';
import { polesOf } from '../data/layout';
import { siteById } from '../data/sites';
import { personById } from '../org/people';

interface Props {
  room: Room;
  state: DemoState;
  role: Role;
  selectedPole: string | null;
  onSelectPole: (clientId: string | null) => void;
  focusAgentId: string | null;
  onFocusAgent: (id: string | null) => void;
  onClose: () => void;
  /** Données des clients externes (services Exploitation et CSM). */
  views: ClientView[];
  trips: Trip[];
  now: number;
  onOpenTicket: (clientId: ExternalClientId, ticketId: string) => void;
  onOpenClient: (clientId: ExternalClientId) => void;
  /** Personne de l'encadrement mise en avant (clic dans la 3D). */
  focusPersonId?: string | null;
  onOpenModule?: (m: ModuleLink) => void;
  /** Ouvre le cockpit de la personne de l'encadrement. */
  onOpenPerson?: (personId: string) => void;
  /** Compteurs RH (même source que la checklist congés). */
  rh?: RhCounters;
  /** Calendrier de réservation du parc automobile. */
  fleet?: FleetProps;
  /** Contenu complémentaire du bureau d'une personne (checklists du manager). */
  personExtras?: (personId: string) => ReactNode;
}

const isSite = (l: Room['location']): l is SiteId => l === 'laciotat' || l === 'montpellier' || l === 'paris';

/** Restreint les données du plateau aux pôles hébergés sur le site. */
function siteState(state: DemoState, site: SiteId): DemoState {
  const clients = new Set(polesOf(site).map((p) => p.clientId));
  return {
    ...state,
    clients: state.clients.filter((c) => clients.has(c.id)),
    queues: state.queues.filter((q) => clients.has(q.clientId)),
    agents: state.agents.filter((a) => a.site === site),
    tickets: state.tickets.filter((t) => clients.has(t.clientId)),
  };
}

export function SidePanel(p: Props) {
  const { room, role, selectedPole, onSelectPole, focusAgentId, onFocusAgent, onClose, views, trips, now, onOpenTicket, onOpenClient, focusPersonId, onOpenModule, onOpenPerson, personExtras } = p;
  const data = roomDataAccess(role, room);
  const allowed = !data || data.ok;
  const site = isSite(room.location) ? room.location : null;
  const state = site ? siteState(p.state, site) : p.state;
  const props = { state, role };
  const person = focusPersonId ? personById(focusPersonId) : undefined;
  const showPerson = person && person.site === site && person.roomKind === room.kind;
  const generic = !['helpdesk', 'pause', 'rh', 'stock', 'parking', 'accueil', 'exploitation', 'csm'].includes(room.kind) && !(room.kind === 'direction' && room.id === 'direction');
  return (
    <aside className="panel" aria-labelledby="panel-title">
      <div className="panelhead">
        <span>MODULE INTERACTIF</span>
        <button onClick={onClose} aria-label="Fermer le panneau">
          <X size={18} />
        </button>
      </div>
      <h2 id="panel-title">{room.label}</h2>
      {site && <span className={`site-tag ${site}`}>{siteById(site).name}</span>}
      <p>{room.description}</p>
      <div className="notice">
        Données fictives — aucune connexion aux systèmes SEATPI. Droits simulés pour le rôle <b>{roleLabels[role]}</b> : la sécurité effective sera
        assurée côté serveur.
      </div>
      {!allowed && data && !data.ok ? (
        <>
          <AccessNotice access={data} />
          <ModuleLinks room={room} role={role} onOpenModule={onOpenModule} />
        </>
      ) : (
        // `key` : réinitialise les filtres locaux quand on change de pièce ou de rôle.
        <div key={`${room.id}-${role}`}>
          {showPerson && (
            <div className="person-card">
              <b>{person.name}</b>
              <span>{person.title}</span>
              <small>Périmètre : {person.scopeSites.map((s) => siteById(s).name).join(', ')}</small>
              {onOpenPerson && (
                <button className="action primary" onClick={() => onOpenPerson(person.id)}>
                  Ouvrir son cockpit
                </button>
              )}
              {personExtras?.(person.id)}
            </div>
          )}
          {!generic && <ModuleLinks room={room} role={role} onOpenModule={onOpenModule} />}
          {generic && site && <DepartmentPanel room={room} site={site} role={role} onOpenModule={onOpenModule} />}
          {room.kind === 'helpdesk' && site && polesOf(site).length === 0 && (
            <p className="itsm-missing">Aucun pôle client affecté à ce plateau — affectation à configurer. Le Pôle Multi est réparti entre La Ciotat et Montpellier.</p>
          )}
          {room.kind === 'helpdesk' && (!site || polesOf(site).length > 0) && <HelpdeskPanel {...props} selectedPole={selectedPole} onSelectPole={onSelectPole} focusAgentId={focusAgentId} onFocusAgent={onFocusAgent} />}
          {room.kind === 'pause' && <PausePanel {...props} />}
          {room.kind === 'rh' && <RhPanel {...props} rh={p.rh} />}
          {room.kind === 'stock' && <StockPanel {...props} />}
          {room.kind === 'parking' && <ParkingPanel {...props} fleet={p.fleet} />}
          {room.id === 'direction' && <DirectionPanel {...props} />}
          {room.kind === 'accueil' && <AccueilPanel {...props} />}
          {room.kind === 'exploitation' && <ExploitationPanel views={views} trips={trips} role={role} now={now} onOpenTicket={onOpenTicket} onOpenClient={onOpenClient} site={site} />}
          {room.kind === 'csm' && <CsmPanel views={views} trips={trips} role={role} now={now} onOpenTicket={onOpenTicket} onOpenClient={onOpenClient} site={site} />}
        </div>
      )}
      <div className="bottom">
        <Activity size={16} /> SEATPI ONE V3.0 — démonstration
      </div>
    </aside>
  );
}

import { Activity, X } from 'lucide-react';
import type { DemoState, Room } from '../types';
import { can, roleLabels, type Role } from '../auth/roles';
import { HelpdeskPanel } from './panels/HelpdeskPanel';
import { PausePanel } from './panels/PausePanel';
import { AccueilPanel, DirectionPanel, ParkingPanel, RhPanel, StockPanel } from './panels/OtherPanels';
import { Restricted } from './ui';
import { CsmPanel, ExploitationPanel } from './panels/ServicesPanels';
import type { ClientView } from '../external/derive';
import type { ExternalClientId } from '../external/types';

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
  now: number;
  onOpenTicket: (clientId: ExternalClientId, ticketId: string) => void;
  onOpenClient: (clientId: ExternalClientId) => void;
}

export function SidePanel({ room, state, role, selectedPole, onSelectPole, focusAgentId, onFocusAgent, onClose, views, now, onOpenTicket, onOpenClient }: Props) {
  const allowed = can(role, room.module);
  const props = { state, role };
  return (
    <aside className="panel" aria-labelledby="panel-title">
      <div className="panelhead">
        <span>MODULE INTERACTIF</span>
        <button onClick={onClose} aria-label="Fermer le panneau">
          <X size={18} />
        </button>
      </div>
      <h2 id="panel-title">{room.label}</h2>
      <p>{room.description}</p>
      <div className="notice">
        Données fictives — aucune connexion aux systèmes SEATPI. Droits simulés pour le rôle <b>{roleLabels[role]}</b> : la sécurité effective sera
        assurée côté serveur.
      </div>
      {!allowed ? (
        <Restricted what={`« ${room.label} »`} />
      ) : (
        // `key` : réinitialise les filtres locaux quand on change de pièce ou de rôle.
        <div key={`${room.id}-${role}`}>
          {room.id === 'helpdesk' && <HelpdeskPanel {...props} selectedPole={selectedPole} onSelectPole={onSelectPole} focusAgentId={focusAgentId} onFocusAgent={onFocusAgent} />}
          {room.id === 'pause' && <PausePanel {...props} />}
          {room.id === 'rh' && <RhPanel {...props} />}
          {room.id === 'stock' && <StockPanel {...props} />}
          {room.id === 'parking' && <ParkingPanel {...props} />}
          {room.id === 'direction' && <DirectionPanel {...props} />}
          {room.id === 'accueil' && <AccueilPanel {...props} />}
          {room.id === 'exploitation' && <ExploitationPanel views={views} role={role} now={now} onOpenTicket={onOpenTicket} onOpenClient={onOpenClient} />}
          {room.id === 'csm' && <CsmPanel views={views} role={role} now={now} onOpenTicket={onOpenTicket} onOpenClient={onOpenClient} />}
        </div>
      )}
      <div className="bottom">
        <Activity size={16} /> Prototype interactif V0.2
      </div>
    </aside>
  );
}

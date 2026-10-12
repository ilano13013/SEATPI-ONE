// URL dédiées (hash, compatibles GitHub Pages) : module, client, onglet, fiche ticket et filtres.
// Exemples : #/helpdesk/tickets?client=thelem&ticket=SPI-100012 · #/externes/monext/integration ·
//            #/finance/mco/historique · #/management/conges · #/carte?espace=lc-rh
import type { ModuleView } from '../auth/access';
import type { AppView } from '../auth/access';
import type { ClientTab, ExternalNav } from '../components/external/common';
import type { HdTab } from '../components/helpdesk/HelpdeskCockpit';
import type { FinanceTab } from '../components/finance/FinanceCockpit';
import type { MgmtTab } from '../components/management/ManagementCockpit';
import type { AdminTab } from '../components/admin/AdminCenter';
import type { Entity } from '../finance/budget';
import { EMPTY_FILTERS, type HdFilters } from '../helpdesk/consolidation';
import { externalClients } from '../external/config';
import type { ExternalClientId } from '../external/types';

export interface RouteState {
  view: AppView;
  room: string | null;
  ext: ExternalNav;
  hd: { tab: HdTab; filters: HdFilters; ticketId: string | null };
  finEntity: Entity;
  finTab: FinanceTab;
  mgmtTab: MgmtTab;
  adminTab: AdminTab;
}

const VIEWS: ModuleView[] = ['helpdesk', 'externes', 'telephonie', 'mco', 'exploitation', 'itsm', 'management', 'moyens', 'crm', 'finance', 'pdg', 'production', 'admin'];
const HD_TABS: HdTab[] = ['synthese', 'tickets', 'kanban', 'effectifs'];
const EXT_TABS: (ClientTab | 'globalReport')[] = ['dashboard', 'tickets', 'kanban', 'techs', 'objectives', 'escalations', 'integration', 'report', 'globalReport'];
const FIN_TABS: FinanceTab[] = ['global', 'rentabilite', 'couts', 'revenus', 'deplacements', 'recrutement', 'previsions', 'historique'];
const MGMT_TABS: MgmtTab[] = ['equipe', 'cra', 'conges', 'objectifs', 'historique'];
const ADMIN_TABS: AdminTab[] = ['connexions', 'roles', 'clients', 'parametres', 'historique'];
const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as (keyof HdFilters)[];

const pick = <T extends string>(v: string | undefined, list: readonly T[], fallback: T): T => (v && (list as readonly string[]).includes(v) ? (v as T) : fallback);

export function toHash(r: RouteState): string {
  const q = new URLSearchParams();
  let path: string[];
  switch (r.view) {
    case 'jumeau':
      path = ['carte'];
      if (r.room) q.set('espace', r.room);
      break;
    case 'helpdesk':
      path = ['helpdesk', r.hd.tab];
      for (const k of FILTER_KEYS) if (r.hd.filters[k] !== EMPTY_FILTERS[k]) q.set(k, String(r.hd.filters[k]));
      if (r.hd.ticketId) q.set('ticket', r.hd.ticketId);
      break;
    case 'externes':
      path = ['externes', r.ext.scope, r.ext.tab];
      if (r.ext.ticketId) q.set('ticket', r.ext.ticketId);
      break;
    case 'finance':
      path = ['finance', r.finEntity, r.finTab];
      break;
    case 'management':
      path = ['management', r.mgmtTab];
      break;
    case 'admin':
      path = ['admin', r.adminTab];
      break;
    default:
      path = [r.view];
  }
  const qs = q.toString();
  return `#/${path.join('/')}${qs ? `?${qs}` : ''}`;
}

/** Lecture d'une URL ; seuls les éléments présents et valides sont renvoyés. */
export function parseHash(hash: string, current: RouteState): RouteState {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, qs = ''] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(qs);
  const head = parts[0];
  if (!head || head === 'carte') return { ...current, view: 'jumeau', room: q.get('espace') ?? current.room };
  if (!(VIEWS as string[]).includes(head)) return { ...current, view: 'jumeau' };
  const view = head as ModuleView;
  const next: RouteState = { ...current, view };
  if (view === 'helpdesk') {
    const filters = { ...EMPTY_FILTERS };
    for (const k of FILTER_KEYS) {
      const v = q.get(k);
      if (v !== null) (filters as Record<string, string>)[k] = v;
    }
    next.hd = { tab: pick(parts[1], HD_TABS, 'synthese'), filters, ticketId: q.get('ticket') };
  }
  if (view === 'externes') {
    const scope = parts[1] === 'global' || externalClients.some((c) => c.id === parts[1]) ? (parts[1] as 'global' | ExternalClientId) : 'global';
    next.ext = { scope, tab: pick(parts[2], EXT_TABS, 'dashboard'), ticketId: q.get('ticket') ?? undefined };
  }
  if (view === 'finance') {
    next.finEntity = parts[1] === 'mco' ? 'mco' : 'helpdesk';
    next.finTab = pick(parts[2], FIN_TABS, 'global');
  }
  if (view === 'management') next.mgmtTab = pick(parts[1], MGMT_TABS, current.mgmtTab);
  if (view === 'admin') next.adminTab = pick(parts[1], ADMIN_TABS, current.adminTab);
  return next;
}

export const DEFAULT_ROUTE: RouteState = {
  view: 'jumeau',
  room: null,
  ext: { scope: 'global', tab: 'dashboard' },
  hd: { tab: 'synthese', filters: EMPTY_FILTERS, ticketId: null },
  finEntity: 'helpdesk',
  finTab: 'global',
  mgmtTab: 'cra',
  adminTab: 'connexions',
};

/** Route lue à l'ouverture de l'application (lien partagé, rafraîchissement). */
export function initialRoute(): RouteState {
  try {
    return window.location.hash ? parseHash(window.location.hash, DEFAULT_ROUTE) : DEFAULT_ROUTE;
  } catch {
    return DEFAULT_ROUTE;
  }
}

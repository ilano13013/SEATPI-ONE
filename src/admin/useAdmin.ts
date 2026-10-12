// État de l'administration (démonstration) : connexions & API, référentiel clients (CRM),
// paramètres SLA et tableaux de bord. Non persisté : en production, ces paramètres seront
// enregistrés et contrôlés par le backend.
import { useCallback, useRef, useState } from 'react';
import { clientRegistry, setClientOverrides, type ClientOverride, type MappedTool, type PoleGroup } from '../config/itsm';
import { contracts } from '../external/config';
import { initialConnectors, looksLikeSecret, validateSecretRef, validateUrl, DEMO_TEST_MESSAGE, type AuthType, type Connector, type ConnectorKind, type Instance } from './connections';

export type ClientStatus = 'Actif' | 'En démarrage' | 'Suspendu';

export interface CrmRecord {
  sector: string;
  referent: string;
  contractRef: string;
  status: ClientStatus;
  notes: string;
}

export interface SlaSettings {
  /** Objectif contractuel de SLA décroché (%) par client — null = non renseigné (jamais inventé). */
  answerObjective: Record<string, number | null>;
  /** Objectifs contractuels N2 (%) : prise en charge et résolution, par client — null = non renseigné. */
  n2TakeCharge: Record<string, number | null>;
  n2Resolution: Record<string, number | null>;
  /** Les valeurs ont-elles été chargées comme démonstration (fictives) ? */
  demoObjectives: boolean;
}

export interface DashboardSettings {
  /** Ancienneté (heures) au-delà de laquelle un ticket ouvert compte dans le backlog. */
  backlogHours: number;
}

export interface AdminState {
  connectors: Connector[];
  crm: Record<string, CrmRecord>;
  overrides: Record<string, ClientOverride>;
  sla: SlaSettings;
  dashboard: DashboardSettings;
}

export interface AdminResult {
  ok: boolean;
  message: string;
}

const contractOf = (id: string) => contracts.find((c) => c.clientId === id)?.id ?? `CTR-INT-${id.toUpperCase()}`;

export function initialAdmin(): AdminState {
  return {
    connectors: initialConnectors(),
    crm: Object.fromEntries(clientRegistry.map((c) => [c.id, { sector: '', referent: '', contractRef: contractOf(c.id), status: 'Actif' as ClientStatus, notes: '' }])),
    overrides: {},
    sla: { answerObjective: {}, n2TakeCharge: {}, n2Resolution: {}, demoObjectives: false },
    dashboard: { backlogHours: 48 },
  };
}

/** Objectifs FICTIFS, chargés uniquement à la demande pour illustrer écarts et alertes. */
export const DEMO_SLA_OBJECTIVES: Omit<SlaSettings, 'demoObjectives'> = {
  answerObjective: Object.fromEntries(clientRegistry.filter((c) => c.pole).map((c) => [c.id, c.pole === 'dedie' ? 90 : 85])),
  n2TakeCharge: { invivo: 90, primagaz: 90, monext: 92 },
  n2Resolution: { invivo: 85, primagaz: 85, monext: 88 },
};

let seq = 100;

export function useAdmin() {
  const init = useRef<AdminState>();
  if (!init.current) init.current = initialAdmin();
  const [state, setState] = useState(init.current);
  const ref = useRef(state);
  ref.current = state;
  const apply = (next: AdminState) => {
    // Le référentiel modifié s'applique immédiatement à toute l'application.
    setClientOverrides(next.overrides);
    ref.current = next;
    setState(next);
  };
  const patchConnector = (id: string, fn: (c: Connector) => Connector) => {
    const s = ref.current;
    apply({ ...s, connectors: s.connectors.map((c) => (c.id === id ? fn(c) : c)) });
  };

  const setConnectorField = useCallback((id: string, field: 'docUrl' | 'secretRef' | 'authType', value: string): AdminResult => {
    if (field === 'docUrl') {
      const e = validateUrl(value);
      if (e) return { ok: false, message: e };
    }
    if (field === 'secretRef') {
      const e = validateSecretRef(value);
      if (e) return { ok: false, message: e };
    }
    patchConnector(id, (c) => ({ ...c, [field]: field === 'authType' ? ((value || null) as AuthType | null) : value.trim() }));
    return { ok: true, message: 'Enregistré (démonstration, non persisté).' };
  }, []);

  const setInstanceField = useCallback((id: string, instanceId: string, field: 'label' | 'instanceUrl' | 'apiUrl', value: string): AdminResult => {
    if (field !== 'label') {
      const e = validateUrl(value);
      if (e) return { ok: false, message: e };
    }
    patchConnector(id, (c) => ({ ...c, instances: c.instances.map((i) => (i.id === instanceId ? { ...i, [field]: value.trim() } : i)) }));
    return { ok: true, message: 'Enregistré.' };
  }, []);

  const setInstanceClients = useCallback((id: string, instanceId: string, clients: string[]) => {
    patchConnector(id, (c) => ({ ...c, instances: c.instances.map((i) => (i.id === instanceId ? { ...i, clients } : i)) }));
  }, []);

  const addInstance = useCallback((id: string) => {
    patchConnector(id, (c) => ({ ...c, instances: [...c.instances, { id: `${id}-${++seq}`, label: `Instance ${c.instances.length + 1}`, clients: [], instanceUrl: '', apiUrl: '', endpoints: [] } as Instance] }));
  }, []);

  const removeInstance = useCallback((id: string, instanceId: string) => {
    patchConnector(id, (c) => (c.instances.length > 1 ? { ...c, instances: c.instances.filter((i) => i.id !== instanceId) } : c));
  }, []);

  const addEndpoint = useCallback((id: string, instanceId: string, name: string, path: string): AdminResult => {
    if (!name.trim() || !path.trim()) return { ok: false, message: 'Nom et chemin obligatoires.' };
    if (!path.startsWith('/') && validateUrl(path)) return { ok: false, message: 'Chemin relatif (/…) ou URL https:// attendu.' };
    if (/[?&](token|key|secret|password)=/i.test(path)) return { ok: false, message: 'Aucun jeton ni clé dans un endpoint.' };
    patchConnector(id, (c) => ({ ...c, instances: c.instances.map((i) => (i.id === instanceId ? { ...i, endpoints: [...i.endpoints, { name: name.trim(), path: path.trim() }] } : i)) }));
    return { ok: true, message: 'Endpoint ajouté.' };
  }, []);

  const setParam = useCallback((id: string, key: string, value: string): AdminResult => {
    if (!key.trim()) return { ok: false, message: 'Nom du paramètre obligatoire.' };
    if (looksLikeSecret(key, value)) return { ok: false, message: 'Les secrets ne se saisissent jamais ici : renseignez uniquement la référence du coffre côté serveur.' };
    patchConnector(id, (c) => ({ ...c, params: [...c.params.filter((p) => p.key !== key.trim()), ...(value.trim() ? [{ key: key.trim(), value: value.trim() }] : [])] }));
    return { ok: true, message: 'Paramètre enregistré.' };
  }, []);

  /** Aucun backend sécurisé : le test réel est impossible et n'est jamais simulé comme réussi. */
  const testConnection = useCallback((id: string): AdminResult => {
    patchConnector(id, (c) => ({ ...c, lastTest: { at: Date.now(), result: DEMO_TEST_MESSAGE } }));
    return { ok: false, message: DEMO_TEST_MESSAGE };
  }, []);

  const addConnector = useCallback((name: string, kind: ConnectorKind, clientId: string | null = null): AdminResult => {
    const s = ref.current;
    const id = (clientId ? `${clientId}-` : '') + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!id) return { ok: false, message: 'Nom du service obligatoire.' };
    if (s.connectors.some((c) => c.id === id)) return { ok: false, message: 'Ce connecteur existe déjà.' };
    const clients = clientId ? [clientId] : clientRegistry.map((c) => c.id);
    apply({ ...s, connectors: [...s.connectors, { id, name: name.trim(), kind, scope: clientId ? 'client' : 'général', clientId, docUrl: '', authType: null, secretRef: '', params: [], instances: [{ id: `${id}-1`, label: clientId ? 'Domaine du client' : 'Instance principale', clients, instanceUrl: '', apiUrl: '', endpoints: [] }], lastTest: null, lastSync: null }] });
    return { ok: true, message: `Connecteur ${name.trim()} ajouté.` };
  }, []);

  const setCrm = useCallback((id: string, patch: Partial<CrmRecord>): AdminResult => {
    const s = ref.current;
    apply({ ...s, crm: { ...s.crm, [id]: { ...s.crm[id], ...patch } } });
    return { ok: true, message: 'Fiche client mise à jour.' };
  }, []);

  const setClientOverride = useCallback((id: string, patch: { name?: string; pole?: PoleGroup | null; tool?: MappedTool | null; budget?: 'helpdesk' | 'mco' }): AdminResult => {
    if (patch.name !== undefined && !patch.name.trim()) return { ok: false, message: 'Le nom ne peut pas être vide.' };
    const s = ref.current;
    apply({ ...s, overrides: { ...s.overrides, [id]: { ...s.overrides[id], ...patch } } });
    return { ok: true, message: 'Référentiel mis à jour.' };
  }, []);

  const setSla = useCallback((kind: 'answerObjective' | 'n2TakeCharge' | 'n2Resolution', clientId: string, value: number | null): AdminResult => {
    if (value !== null && (value < 0 || value > 100)) return { ok: false, message: 'Objectif entre 0 et 100 %.' };
    const s = ref.current;
    apply({ ...s, sla: { ...s.sla, [kind]: { ...s.sla[kind], [clientId]: value } } });
    return { ok: true, message: 'Objectif SLA enregistré.' };
  }, []);

  const loadDemoObjectives = useCallback(() => {
    const s = ref.current;
    apply({ ...s, sla: { ...DEMO_SLA_OBJECTIVES, demoObjectives: true } });
  }, []);

  const setDashboard = useCallback((patch: Partial<DashboardSettings>): AdminResult => {
    if (patch.backlogHours !== undefined && (patch.backlogHours < 1 || patch.backlogHours > 720)) return { ok: false, message: 'Seuil entre 1 et 720 heures.' };
    const s = ref.current;
    apply({ ...s, dashboard: { ...s.dashboard, ...patch } });
    return { ok: true, message: 'Paramètre enregistré.' };
  }, []);

  const reset = useCallback(() => apply(initialAdmin()), []);

  return { state, setConnectorField, setInstanceField, setInstanceClients, addInstance, removeInstance, addEndpoint, setParam, testConnection, addConnector, setCrm, setClientOverride, setSla, loadDemoObjectives, setDashboard, reset };
}

export type AdminStore = ReturnType<typeof useAdmin>;

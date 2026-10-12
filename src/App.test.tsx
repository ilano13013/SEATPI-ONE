import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App';
import { helpdeskPoles, rooms } from './data/layout';

// jsdom ne fournit pas WebGL : on vérifie le parcours via le mode 2D accessible.
vi.mock('./lib/env', () => ({ hasWebGL: () => false, prefersReducedMotion: () => true, isNarrowScreen: () => false }));

const fetchSpy = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const panel = () => within(screen.getByRole('complementary', { name: /./ }));
// Les espaces sont regroupés par site en 2D : on cible La Ciotat (site principal) par défaut.
const openRoom = (label: string, site = 'La Ciotat') =>
  fireEvent.click(within(screen.getByRole('region', { name: site })).getAllByRole('button', { name: new RegExp(label) })[0]);

describe('App (mode démo)', () => {
  it('affiche la mention mode démo et bascule en 2D sans WebGL', () => {
    render(<App />);
    expect(screen.getByText('MODE DÉMO')).toBeTruthy();
    expect(screen.getByText(/WebGL n'est pas disponible/)).toBeTruthy();
    // Tous les espaces des trois sites et des sites clients externes (hors carte d'ensemble).
    expect(document.querySelectorAll('.twod-grid:not(.poles) button')).toHaveLength(rooms.filter((r) => r.floor !== 'carte').length);
    expect(screen.getByRole('region', { name: 'Montpellier' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Paris' })).toBeTruthy();
    expect(document.querySelectorAll('.twod-grid.poles button')).toHaveLength(helpdeskPoles.length);
  });

  it('ouvre le bon panneau au clic sur une pièce', () => {
    render(<App />);
    openRoom('Salle de pause');
    expect(panel().getByRole('heading', { name: 'Salle de pause' })).toBeTruthy();
    expect(panel().getByText('Agent A04')).toBeTruthy();
    openRoom('Parc automobile');
    expect(panel().getByRole('heading', { name: 'Parc automobile' })).toBeTruthy();
  });

  it('filtre les files du plateau Helpdesk par pôle client', () => {
    render(<App />);
    expect(panel().getAllByRole('button', { name: /^(Thelem|IRD|Ortec|Multi|Sodiaal) ·/ })).toHaveLength(7);
    fireEvent.change(panel().getByLabelText('Pôle client'), { target: { value: 'ortec' } });
    const rows = panel().getAllByRole('button', { name: /^Ortec ·/ });
    expect(rows).toHaveLength(2);
    expect(panel().queryByText(/^Thelem ·/)).toBeNull();
    fireEvent.click(rows[0]);
    expect(panel().getByText('Objectif SLA')).toBeTruthy();
  });

  it('ouvre un pôle client depuis le plateau', () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('region', { name: 'La Ciotat' })).getByRole('button', { name: /Dédié · Sodiaal/ }));
    expect(panel().getByRole('heading', { name: 'Plateau Helpdesk' })).toBeTruthy();
    expect((panel().getByLabelText('Pôle client') as HTMLSelectElement).value).toBe('sodiaal');
    expect(panel().getAllByRole('button', { name: /^Sodiaal ·/ })).toHaveLength(1);
    expect(panel().getByText('Agents connectés')).toBeTruthy();
    // Revenir au plateau entier
    fireEvent.change(panel().getByLabelText('Pôle client'), { target: { value: 'all' } });
    expect(panel().getAllByRole('button', { name: /^(Thelem|IRD|Ortec|Multi|Sodiaal) ·/ })).toHaveLength(7);
  });

  it('adapte les vues au rôle simulé', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'direction' } });
    fireEvent.click(panel().getByRole('tab', { name: /Agents/ }));
    expect(panel().getByText(/Vue agrégée/)).toBeTruthy();
    expect(panel().queryByText('Agent A01')).toBeNull();

    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'rh' } });
    expect(panel().getByText('Accès restreint')).toBeTruthy();
  });

  it("n'effectue aucun appel réseau", () => {
    render(<App />);
    openRoom('Stock informatique');
    openRoom('Direction');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ouvre le cockpit des clients externes et navigue jusqu’aux tickets', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clients externes' }));
    const cockpit = within(screen.getByRole('region', { name: 'Supervision des clients externes' }));
    // Vue consolidée : les trois clients et la ligne interne.
    for (const name of ['INVIVO', 'PRIMAGAZ', 'MONEXT', 'Plateau Helpdesk (interne)', 'Total clients externes']) {
      expect(cockpit.getAllByText(name).length).toBeGreaterThan(0);
    }
    fireEvent.click(within(cockpit.getByRole('navigation', { name: 'Clients' })).getByRole('button', { name: /MONEXT/ }));
    const open = cockpit.getByRole('button', { name: /Tickets ouverts/ });
    const count = Number(open.querySelector('strong')!.textContent);
    fireEvent.click(open);
    expect(cockpit.getByRole('tab', { name: 'Tickets', selected: true })).toBeTruthy();
    expect(cockpit.getByText(new RegExp(`^${count} ticket\\(s\\)`))).toBeTruthy();
    // Détail d'un ticket depuis le tableau.
    fireEvent.click(document.querySelector('.xc-table tbody tr')!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Historique des changements')).toBeTruthy();
  });

  it('masque la supervision externe au rôle Agent', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'agent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clients externes' }));
    expect(screen.getByText('Accès restreint')).toBeTruthy();
  });

  it('présente les services internes Exploitation et CSM', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    openRoom('Service Exploitation');
    expect(panel().getByRole('heading', { name: 'Service Exploitation' })).toBeTruthy();
    expect(panel().getByRole('heading', { name: 'Escalades en cours' })).toBeTruthy();
    openRoom('Service CSM');
    expect(panel().getByRole('heading', { name: 'Service CSM' })).toBeTruthy();
    // Chaque site affiche le compte suivi par son CSM.
    expect(panel().getAllByText('INVIVO').length).toBeGreaterThan(0);
    openRoom('Service CSM', 'Montpellier');
    expect(panel().getAllByText('PRIMAGAZ').length).toBeGreaterThan(0);
  });

  it('liste les déplacements des managers CSM dans la vue globale', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clients externes' }));
    expect(screen.getByRole('heading', { name: 'Déplacements des managers CSM' })).toBeTruthy();
    expect(screen.getAllByText(/SEATPI (La Ciotat|Montpellier|Paris) → Siège (INVIVO|PRIMAGAZ|MONEXT)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/En route|Chez le client|Retour/).length).toBeGreaterThan(0);
  });

  it('ouvre les espaces des sites de Montpellier et Paris avec leurs propres données', () => {
    render(<App />);
    openRoom('Plateau Helpdesk', 'Montpellier');
    expect(panel().getByText('Montpellier')).toBeTruthy();
    // Montpellier : seconde équipe du Pôle Multi.
    expect(panel().getAllByRole('button', { name: /^Multi \(Montpellier\) ·/ })).toHaveLength(1);
    expect(panel().queryByText(/^Thelem ·/)).toBeNull();
    // Paris : plateau sans pôle client affecté.
    openRoom('Plateau Helpdesk', 'Paris');
    expect(panel().getByText(/Aucun pôle client affecté/)).toBeTruthy();
    openRoom('Commercial', 'Paris');
    expect(panel().getByRole('heading', { name: 'Commercial' })).toBeTruthy();
    expect(panel().getByText('Paris')).toBeTruthy();
    // Pas de RH ni de Stock hors de La Ciotat.
    expect(within(screen.getByRole('region', { name: 'Paris' })).queryByRole('button', { name: /Ressources humaines|Stock/ })).toBeNull();
  });

  it('affiche la cartographie ITSM unique et signale G2S comme non renseigné', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connecteurs ITSM' }));
    const reg = within(screen.getByRole('region', { name: 'Connecteurs ITSM' }));
    expect(reg.getByText('INVIVO, DMB, TERACT')).toBeTruthy();
    expect(reg.getAllByText('SNR').length).toBeGreaterThan(0);
    expect(reg.getAllByText('Zendesk').length).toBeGreaterThan(0);
    expect(reg.getByText('THELEM, TRANSGOURMET, MONEXT')).toBeTruthy();
    expect(reg.getByText('PRIMAGAZ, SODIAAL, IRD')).toBeTruthy();
    expect(reg.getAllByText('ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE').length).toBe(1); // G2S
  });

  it('cockpit Helpdesk consolidé : compteur cliquable, filtres partagés tableau / Kanban', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Cockpit Helpdesk consolidé' }));
    const hd = within(screen.getByRole('region', { name: 'Cockpit Helpdesk consolidé' }));
    const tile = hd.getByRole('button', { name: /Tickets ouverts/ });
    const count = Number(within(tile).getByText(/^\d+$/).textContent);
    expect(count).toBeGreaterThan(0);
    fireEvent.click(tile);
    expect(hd.getByText(new RegExp(`Tickets ouverts · ${count} ticket`))).toBeTruthy();
    fireEvent.change(hd.getByLabelText('Outil ITSM'), { target: { value: 'GLPI' } });
    const rows = hd.getAllByRole('row').slice(1);
    expect(rows.every((r) => /GLPI/.test(r.textContent ?? '') || /Aucun ticket/.test(r.textContent ?? ''))).toBe(true);
    const tableCount = hd.getByRole('tab', { name: /Tableau/ }).textContent;
    expect(hd.getByRole('tab', { name: /Kanban/ }).textContent?.replace('Kanban', '')).toBe(tableCount?.replace('Tableau', ''));
    // Création simulée sur un client sans ITSM : refusée.
    fireEvent.click(hd.getByRole('button', { name: /Nouveau ticket/ }));
    const dlg = within(screen.getByRole('dialog'));
    fireEvent.change(dlg.getByLabelText('Client'), { target: { value: 'N1:g2s' } });
    expect(dlg.getByText('ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE')).toBeTruthy();
    expect((dlg.getByRole('button', { name: /Créer dans/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('budget déplacements : demande au-delà du plafond bloquée et journalisée ; plafond réservé à la direction', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'finance' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /Budget & Rentabilité/ }));
    const fin = within(screen.getByRole('region', { name: 'Budget et rentabilité' }));
    expect(fin.getByText(/distinct du résultat comptable/)).toBeTruthy();
    fireEvent.click(fin.getByRole('tab', { name: 'Budget déplacements' }));
    fireEvent.change(fin.getByLabelText('Objet du déplacement'), { target: { value: 'Séminaire client' } });
    fireEvent.change(fin.getByLabelText('Montant estimé'), { target: { value: '999999' } });
    fireEvent.click(fin.getByRole('button', { name: /Soumettre/ }));
    expect(fin.getAllByText(/Bloquée/).length).toBeGreaterThan(0);
    expect(fin.getByText(/Procédure de révision budgétaire réservée/)).toBeTruthy();
    // Recrutement : règle d'imputation à confirmer.
    fireEvent.click(fin.getByRole('tab', { name: 'Budget recrutement' }));
    expect(fin.getAllByText(/RÈGLE D’IMPUTATION À CONFIRMER/).length).toBeGreaterThan(0);
  });

  it('préparation à la production : NO-GO, Validé exige une preuve, rapport généré', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'admin' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: 'Préparation à la production' }));
    const pr = within(screen.getByRole('region', { name: 'Préparation à la production' }));
    expect(pr.getByText('NO-GO')).toBeTruthy();
    expect(pr.getByText(/pas une certification de sécurité/)).toBeTruthy();
    fireEvent.click(pr.getAllByText('SEC-05')[0]);
    const dlg = within(screen.getByRole('dialog'));
    fireEvent.click(dlg.getByRole('button', { name: 'Validé' }));
    expect(screen.getByText(/qu’après vérification réelle/)).toBeTruthy();
    fireEvent.click(dlg.getByRole('button', { name: /Fermer/ }));
    fireEvent.click(pr.getByRole('button', { name: 'GÉNÉRER LE RAPPORT DE PRÉPARATION' }));
    expect(within(screen.getByRole('dialog')).getByText(/Décision : NO-GO/)).toBeTruthy();
  });

  it('Moyens généraux : déplacements gérés opérationnellement, enveloppe Helpdesk non dupliquée et plafonnée', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /Moyens généraux/ }));
    const mg = within(screen.getByRole('region', { name: 'Moyens généraux — déplacements' }));
    expect(mg.getByText(/lecture seule ici/)).toBeTruthy();
    fireEvent.change(mg.getByLabelText('Objet'), { target: { value: 'Séminaire' } });
    fireEvent.change(mg.getByLabelText('Montant estimé'), { target: { value: '999999' } });
    fireEvent.click(mg.getByRole('button', { name: 'Enregistrer la demande' }));
    expect(mg.getAllByText(/Bloquée/).length).toBeGreaterThan(0);
    for (const tab of ['Déplacements prévus', 'Réalisés', 'Dépenses', 'Historique']) fireEvent.click(mg.getByRole('tab', { name: new RegExp(tab) }));
    fireEvent.click(mg.getByRole('tab', { name: /Justificatifs/ }));
    const before = mg.getAllByRole('row').length;
    fireEvent.change(mg.getAllByRole('combobox', { name: /Justificatif/ })[0], { target: { value: 'Reçu' } });
    expect(mg.getAllByRole('row').length).toBe(before - 1);
  });

  it('checklist CRA : cocher « Traité » met à jour les compteurs et l’historique du suivi', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /Management/ }));
    const mg = within(screen.getByRole('region', { name: 'Cockpit Management' }));
    fireEvent.click(mg.getByRole('tab', { name: 'Checklist CRA' }));
    const remaining = () => Number(within(mg.getByLabelText('CRA restant à traiter')).getByText(/^\d+$/).textContent);
    const r0 = remaining();
    expect(r0).toBeGreaterThan(0);
    fireEvent.click(mg.getAllByRole('checkbox', { name: /Traité : CRA/ })[0]);
    expect(remaining()).toBe(r0 - 1);
    expect(mg.getByText(/pas une validation officielle/)).toBeTruthy();
    fireEvent.click(mg.getByRole('tab', { name: 'Historique du suivi' }));
    expect(mg.getByText(/À traiter → Traité/)).toBeTruthy();
  });

  it('checklist congés et RÉINITIALISER LA DÉMONSTRATION', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    const modules = within(screen.getByRole('navigation', { name: 'Modules' }));
    fireEvent.click(modules.getByRole('button', { name: /Management/ }));
    let mg = within(screen.getByRole('region', { name: 'Cockpit Management' }));
    fireEvent.click(mg.getByRole('tab', { name: 'Checklist congés' }));
    const remaining = () => Number(within(mg.getByLabelText('Congés restant à traiter')).getByText(/^\d+$/).textContent);
    const r0 = remaining();
    fireEvent.change(mg.getAllByRole('combobox', { name: /Suivi : congé/ })[0], { target: { value: 'Traité' } });
    expect(remaining()).toBe(r0 - 1);
    fireEvent.click(screen.getByRole('button', { name: /RÉINITIALISER LA DÉMONSTRATION/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(screen.getByText(/Démonstration réinitialisée/)).toBeTruthy();
    fireEvent.click(modules.getByRole('button', { name: /Management/ }));
    mg = within(screen.getByRole('region', { name: 'Cockpit Management' }));
    fireEvent.click(mg.getByRole('tab', { name: 'Checklist congés' }));
    expect(remaining()).toBe(r0);
  });

  it('les checklists sont accessibles depuis le cockpit de la responsable et le bureau 3D du manager', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: 'Cockpit Helpdesk consolidé' }));
    const hd = within(screen.getByRole('region', { name: 'Cockpit Helpdesk consolidé' }));
    fireEvent.click(within(hd.getByLabelText('Checklists de suivi')).getByRole('button', { name: /Congés/ }));
    expect(within(screen.getByRole('region', { name: 'Cockpit Management' })).getByRole('region', { name: 'Checklist congés' })).toBeTruthy();
  });

  it('rouage ⚙️ : Connexions & API — statuts, test indisponible en démonstration, secrets refusés', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Administration' }));
    const adm = within(screen.getByRole('region', { name: 'Administration' }));
    // Un connecteur par client (domaine propre), un QlikView commun.
    for (const n of ['PRIMAGAZ', 'SODIAAL', 'IRD', 'THELEM', 'ORTEC', 'INVIVO', 'SNR', 'G2S', 'MONEXT', 'QlikView', 'Genesys Cloud']) expect(adm.getByRole('button', { name: `Fiche ${n}` })).toBeTruthy();
    expect(adm.getAllByRole('button', { name: 'Fiche QlikView' })).toHaveLength(1);
    fireEvent.click(adm.getByRole('button', { name: 'Fiche PRIMAGAZ' }));
    const sheet = within(adm.getByRole('article', { name: 'Configuration PRIMAGAZ' }));
    expect(sheet.getByRole('heading', { name: 'PRIMAGAZ — ServiceNow' })).toBeTruthy();
    expect(sheet.getAllByText('Non configuré').length).toBeGreaterThan(0);
    fireEvent.click(sheet.getByRole('button', { name: /Tester la connexion/ }));
    expect(screen.getAllByText('Test réel indisponible en démonstration').length).toBeGreaterThan(0);
    // URL de l'API renseignée → configuration incomplète ; URL non https refusée.
    fireEvent.click(sheet.getByRole('button', { name: /Modifier PRIMAGAZ \/ Domaine PRIMAGAZ — URL de l’API/ }));
    fireEvent.change(sheet.getByRole('textbox', { name: /URL de l’API/ }), { target: { value: 'http://exemple.invalid' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    expect(sheet.getByRole('alert').textContent).toMatch(/https/);
    fireEvent.change(sheet.getByRole('textbox', { name: /URL de l’API/ }), { target: { value: 'https://instance.exemple.invalid/api' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer' }));
    expect(sheet.getAllByText('Configuration incomplète').length).toBeGreaterThan(0);
    // Un secret n'est jamais accepté comme paramètre.
    fireEvent.change(sheet.getByLabelText('Nom du paramètre'), { target: { value: 'api_key' } });
    fireEvent.change(sheet.getByLabelText('Valeur du paramètre'), { target: { value: 'abc123' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Enregistrer le paramètre' }));
    expect(screen.getByText(/Les secrets ne se saisissent jamais ici/)).toBeTruthy();
    // Historique des modifications.
    fireEvent.click(adm.getByRole('tab', { name: 'Historique des modifications' }));
    expect(within(adm.getByRole('table', { name: 'Historique des modifications' })).getByText('https://instance.exemple.invalid/api')).toBeTruthy();
  });

  it('modification en direct d’un revenu : recalcul du résultat et historique ; lecture seule sans droit', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    const modules = within(screen.getByRole('navigation', { name: 'Modules' }));
    fireEvent.click(modules.getByRole('button', { name: /Budget & Rentabilité/ }));
    const fin = within(screen.getByRole('region', { name: 'Budget et rentabilité' }));
    const landing = () => within(fin.getByRole('button', { name: /Atterrissage annuel/ })).getAllByText(/€/)[0].textContent;
    const before = landing();
    fireEvent.click(fin.getByRole('tab', { name: /Revenus/ }));
    fireEvent.click(fin.getAllByRole('button', { name: /Modifier Prix unitaire/ })[0]);
    fireEvent.change(fin.getAllByRole('spinbutton', { name: /Prix unitaire/ })[0], { target: { value: '99999' } });
    fireEvent.click(fin.getByRole('button', { name: 'Enregistrer' }));
    fireEvent.click(fin.getByRole('tab', { name: 'Vue globale' }));
    expect(landing()).not.toBe(before);
    // Le plafond déplacements ne se modifie pas en ligne (procédure de révision réservée).
    fireEvent.click(fin.getByRole('tab', { name: 'Budget déplacements' }));
    expect(fin.getByText(/Procédure de révision budgétaire réservée/)).toBeTruthy();
    // Manager : pas d'accès aux finances.
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'teamLeader' } });
    expect(within(screen.getByRole('region', { name: 'Budget et rentabilité' })).getByText(/Accès réservé/)).toBeTruthy();
  });

  it('CRM : modification du pôle d’un client (sensible, confirmée) répercutée et historisée', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Administration' }));
    const adm = within(screen.getByRole('region', { name: 'Administration' }));
    fireEvent.click(adm.getByRole('tab', { name: 'Clients (CRM)' }));
    fireEvent.click(adm.getByRole('button', { name: 'Modifier Pôle de G2S' }));
    fireEvent.change(adm.getByLabelText('Pôle de G2S'), { target: { value: 'dedie' } });
    fireEvent.click(adm.getByRole('button', { name: 'Enregistrer' }));
    expect(adm.getByText(/Modification sensible/)).toBeTruthy();
    fireEvent.click(adm.getByRole('button', { name: /Confirmer/ }));
    expect(adm.getByRole('button', { name: 'Modifier Pôle de G2S' }).textContent).toMatch(/Pôle Dédié/);
    // Profil Manager : lecture seule.
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'teamLeader' } });
    expect(within(screen.getByRole('region', { name: 'Administration' })).queryByRole('button', { name: 'Modifier Pôle de G2S' })).toBeNull();
  });

  it('SLA décroché (QlikView) : global par volumes, objectifs non renseignés, puis objectifs de démonstration et écarts', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'admin' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /SLA décroché/ }));
    const tel = within(screen.getByRole('region', { name: 'SLA décroché' }));
    expect(within(tel.getByLabelText('SLA décroché global')).getByText(/%$/)).toBeTruthy();
    expect(tel.getAllByText('Non renseigné').length).toBeGreaterThan(0);
    expect(tel.getAllByText('Calcul indisponible').length).toBeGreaterThan(0); // Pôle Multi (file partagée)
    fireEvent.click(tel.getAllByRole('button', { name: 'Non renseigné' })[0]);
    const adm = within(screen.getByRole('region', { name: 'Administration' }));
    fireEvent.click(adm.getByRole('button', { name: /Charger des objectifs de démonstration/ }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /SLA décroché/ }));
    expect(within(screen.getByRole('region', { name: 'SLA décroché' })).getByText(/valeurs de DÉMONSTRATION/)).toBeTruthy();
  });

  it('cockpit MCO : SLA de prise en charge et SLA de résolution distincts', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: 'Cockpit MCO / Support N2' }));
    const mco = within(screen.getByRole('region', { name: 'Cockpit MCO N2' }));
    expect(mco.getByRole('region', { name: 'SLA de prise en charge' })).toBeTruthy();
    expect(mco.getByRole('region', { name: 'SLA de résolution' })).toBeTruthy();
  });

  it('budgets séparés : Helpdesk N1 et MCO N2, enveloppes déplacements / recrutement uniquement côté Helpdesk', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'finance' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /Budget & Rentabilité/ }));
    const fin = within(screen.getByRole('region', { name: 'Budget et rentabilité' }));
    const result = () => within(fin.getByRole('button', { name: /^Résultat analytique/ })).getByText(/€/).textContent;
    const hd = result();
    expect(fin.getByRole('tab', { name: 'Budget déplacements' })).toBeTruthy();
    fireEvent.click(fin.getByRole('radio', { name: /Budget MCO N2/ }));
    expect(fin.getByText(/Budget & Rentabilité — MCO N2/)).toBeTruthy();
    expect(result()).not.toBe(hd);
    expect(fin.queryByRole('tab', { name: 'Budget déplacements' })).toBeNull();
    fireEvent.click(fin.getByRole('tab', { name: /Revenus/ }));
    expect(fin.queryAllByText(/CTR-INT-/).length).toBe(0);
    expect(fin.getAllByText('CTR-PRI-01').length).toBeGreaterThan(0);
  });
});

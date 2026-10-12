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

  it('management : refus de congé avec commentaire obligatoire et historique', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /Management : congés/ }));
    const mg = within(screen.getByRole('region', { name: 'Cockpit Management' }));
    fireEvent.click(mg.getByRole('tab', { name: /Congés/ }));
    const before = mg.getAllByRole('button', { name: 'Refuser' }).length;
    fireEvent.click(mg.getAllByRole('button', { name: 'Refuser' })[0]);
    expect(screen.getByText(/commentaire est obligatoire/)).toBeTruthy();
    fireEvent.change(mg.getAllByPlaceholderText(/Commentaire/)[0], { target: { value: 'Charge trop forte' } });
    fireEvent.click(mg.getAllByRole('button', { name: 'Refuser' })[0]);
    expect(mg.queryAllByRole('button', { name: 'Refuser' }).length).toBe(before - 1);
    fireEvent.click(mg.getByRole('tab', { name: 'Historique' }));
    expect(mg.getAllByText(/Charge trop forte/).length).toBeGreaterThan(0);
  });

  it('management : CRA — compteurs et validation d’un CRA soumis', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /Management : congés/ }));
    const mg = within(screen.getByRole('region', { name: 'Cockpit Management' }));
    fireEvent.click(mg.getByRole('tab', { name: 'CRA' }));
    const validated = () => Number(within(mg.getByRole('button', { name: /^Validés/ })).getByText(/^\d+$/).textContent);
    const v0 = validated();
    fireEvent.click(mg.getByRole('button', { name: /^Soumis/ }));
    fireEvent.click(mg.getAllByRole('row')[1]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Valider' }));
    expect(validated()).toBe(v0 + 1);
  });

  it('budget déplacements : demande au-delà du plafond bloquée et journalisée ; plafond réservé à la direction', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'finance' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /Budget & Rentabilité/ }));
    const fin = within(screen.getByRole('region', { name: 'Budget et rentabilité' }));
    expect(fin.getByText(/pas le résultat comptable/)).toBeTruthy();
    fireEvent.click(fin.getByRole('tab', { name: 'Budget déplacements' }));
    fireEvent.change(fin.getByLabelText('Objet du déplacement'), { target: { value: 'Séminaire client' } });
    fireEvent.change(fin.getByLabelText('Montant estimé'), { target: { value: '999999' } });
    fireEvent.click(fin.getByRole('button', { name: /Soumettre/ }));
    expect(fin.getAllByText(/Bloquée/).length).toBeGreaterThan(0);
    expect(fin.getByText(/réservée à une personne habilitée/)).toBeTruthy();
    // Recrutement : règle d'imputation à confirmer.
    fireEvent.click(fin.getByRole('tab', { name: 'Budget recrutement' }));
    expect(fin.getAllByText(/RÈGLE D’IMPUTATION À CONFIRMER/).length).toBeGreaterThan(0);
  });

  it('RÉINITIALISER LA DÉMONSTRATION remet tous les modules à leur état initial', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    const modules = within(screen.getByRole('navigation', { name: 'Modules' }));
    fireEvent.click(modules.getByRole('button', { name: /Management : congés/ }));
    let mg = within(screen.getByRole('region', { name: 'Cockpit Management' }));
    const pendingTab = () => mg.getByRole('tab', { name: /Congés/ }).textContent;
    const before = pendingTab();
    fireEvent.click(mg.getByRole('tab', { name: /Congés/ }));
    fireEvent.change(mg.getAllByPlaceholderText(/Commentaire/)[0], { target: { value: 'Non' } });
    fireEvent.click(mg.getAllByRole('button', { name: 'Refuser' })[0]);
    expect(pendingTab()).not.toBe(before);
    fireEvent.click(screen.getByRole('button', { name: /RÉINITIALISER LA DÉMONSTRATION/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(screen.getByText(/Démonstration réinitialisée/)).toBeTruthy();
    fireEvent.click(modules.getByRole('button', { name: /Management : congés/ }));
    mg = within(screen.getByRole('region', { name: 'Cockpit Management' }));
    expect(pendingTab()).toBe(before);
  });

  it('préparation à la production : NO-GO, Validé exige une preuve, rapport généré', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
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

  it('une validation de congé se répercute sur les effectifs prévus du cockpit Helpdesk', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    const modules = within(screen.getByRole('navigation', { name: 'Modules' }));
    fireEvent.click(modules.getByRole('button', { name: 'Cockpit Helpdesk consolidé' }));
    const planned = () => Number(within(within(screen.getByRole('region', { name: 'Cockpit Helpdesk consolidé' })).getByRole('button', { name: /Agents prévus/ })).getByText(/^\d+$/).textContent);
    const p0 = planned();
    fireEvent.click(modules.getByRole('button', { name: /Management : congés/ }));
    const mg = within(screen.getByRole('region', { name: 'Cockpit Management' }));
    fireEvent.click(mg.getByRole('tab', { name: /Congés/ }));
    fireEvent.click(mg.getByRole('button', { name: /Saisir une demande/ }));
    const today = new Date();
    while (today.getDay() === 0 || today.getDay() === 6) today.setDate(today.getDate() + 1);
    const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    fireEvent.change(mg.getByLabelText('Début'), { target: { value: d } });
    fireEvent.change(mg.getByLabelText('Fin'), { target: { value: d } });
    fireEvent.change(mg.getByLabelText('Collaborateur'), { target: { value: 'ag-01' } });
    fireEvent.change(mg.getByLabelText('Type'), { target: { value: 'RTT' } });
    fireEvent.click(mg.getByRole('button', { name: 'Soumettre' }));
    const card = mg.getAllByRole('article').find((a) => a.textContent?.includes('RTT') && a.textContent.includes(new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })))!;
    const c = within(card);
    if (c.queryByRole('checkbox')) fireEvent.click(c.getByRole('checkbox'));
    fireEvent.change(c.getByPlaceholderText(/Commentaire/), { target: { value: 'OK' } });
    fireEvent.click(c.getByRole('button', { name: 'Valider' }));
    fireEvent.click(modules.getByRole('button', { name: 'Cockpit Helpdesk consolidé' }));
    expect(planned()).toBe(p0 - 1);
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
});

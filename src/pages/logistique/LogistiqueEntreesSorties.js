import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Calendar, Plus, Search, X, CheckSquare, Loader2, ArrowRightLeft, ChevronDown, ChevronUp, PenLine, Circle, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import SignaturePad from '../../components/SignaturePad';
import { Fragment } from 'react';
import { CAMERA_COULEURS, NameCombobox, POSTES_CAM, cameraCouleur, heureFromInput, heureToInput, isDrawnSig, jourCouleurStyle, nextWeekendRefDate, sigText, weekendKey, weekendParite } from './shared';

export function LogistiqueEntreesSorties({
  MOIS_NOMS_FR,
  ROLE_CODES,
  ROLE_LABELS_FULL,
  STORAGE_ROW,
  addEquipeMembre,
  addEquipementLigne,
  addPlannedToEquipe,
  allChecked,
  autoSaveState,
  autoSavedAt,
  camIndispo,
  camLabelFor,
  canManage,
  canWriteObservations,
  canonName,
  closeFiche,
  collapseAllSeances,
  collapsedPostes,
  expandAllSeances,
  expandedSeance,
  filterSeancePoste,
  fmtUntil,
  handleEditSeance,
  handleSeanceSubmit,
  isAdmin,
  isAutoCheckExcluded,
  isSeanceVide,
  isStorageLine,
  isYearOpen,
  monthsByPosteYear,
  namesForRole,
  openSeanceToSign,
  plannedCadreurs,
  principauxFor,
  reactivateCam,
  regisseursRoster,
  resetSeanceForm,
  seanceDialogOpen,
  seanceEditingId,
  seanceForm,
  seanceSearch,
  seanceSubmitting,
  selectedMonthFor,
  setExpandedSeance,
  setFilterSeancePoste,
  setMonthSel,
  setSeanceDialogOpen,
  setSeanceForm,
  setSeanceSearch,
  setYearOpen,
  sortedSeances,
  toggleAllChecks,
  toggleColumnChecks,
  togglePoste,
  updateEquipeMembre,
  updateEquipementCheck,
  updateEquipementNom,
}) {
  return (
    <div className="space-y-4">
      {/* Fiche(s) du jour — accès direct sans fouiller le classeur
(demande 28/09/2026) : la ou les fiches du jour de service en cours
(aujourd'hui si Vendredi/Dimanche, sinon la prochaine), un clic pour
l'ouvrir. Si aujourd'hui n'est pas un jour de service, propose de
créer une fiche "événement" pour la date du jour. */}
      {(() => {
        const nowLocal = new Date();
        const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
        const todayDow = nowLocal.getDay(); // 0=dim, 5=ven
        const isServiceDay = todayDow === 0 || todayDow === 5;
        const todaysFiches = sortedSeances.filter((s) => s.date === todayStr);
        if (isServiceDay) {
          return (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  Fiches du jour — {todayStr}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 flex flex-wrap gap-2">
                {POSTES_CAM.map((poste) => {
                  const fiche = todaysFiches.find((s) => s.poste === poste);
                  const cam = cameraCouleur(poste);
                  if (camIndispo[poste]) {
                    return (
                      <span key={poste} className="inline-flex items-center gap-2">
                        <button type="button" disabled aria-disabled="true"
                          title={`${poste} indisponible jusqu'au ${fmtUntil(camIndispo[poste].until)}`}
                          className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed bg-muted px-4 py-2 text-sm font-bold text-muted-foreground opacity-60 cursor-not-allowed line-through">
                          {poste}
                        </button>
                        <span className="text-xs text-muted-foreground">Indisponible jusqu'au {fmtUntil(camIndispo[poste].until)}</span>
                        {isAdmin() && <Button size="sm" variant="outline" onClick={() => reactivateCam(poste)}>Réactiver</Button>}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={poste}
                      type="button"
                      title={fiche ? `Ouvrir la fiche de ${poste}` : `Créer la fiche de ${poste}`}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold shadow-sm transition hover:brightness-95 ${
                        fiche
                          ? cam?.solid || 'bg-primary text-primary-foreground'
                          : `border-2 bg-background text-foreground ${cam?.edge || 'border-border'}`
                      }`}
                      onClick={() => {
                        if (fiche) {
                          handleEditSeance(fiche);
                        } else if (canManage()) {
                          resetSeanceForm();
                          setSeanceForm((f) => ({ ...f, date: todayStr, poste }));
                          setSeanceDialogOpen(true);
                        }
                      }}
                    >
                      {poste}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          );
        }
        if (canManage()) {
          return (
            <Card className="border-dashed">
              <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-muted-foreground">
                  Aujourd'hui n'est pas un jour de culte (Vendredi/Dimanche) — pas de fiche pré-remplie.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resetSeanceForm();
                    setSeanceForm((f) => ({ ...f, date: todayStr }));
                    setSeanceDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Créer une fiche événement pour aujourd'hui
                </Button>
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={seanceSearch}
            onChange={(e) => setSeanceSearch(e.target.value)}
            placeholder="Rechercher (date, nom, superviseur, équipement...)"
            className="pl-8"
          />
        </div>
        {/* Demande 28/09/2026 : possibilité de tout ouvrir/fermer en
un clic, en plus de l'accordéon année/mois ci-dessous. */}
        <Button type="button" variant="outline" size="sm" onClick={expandAllSeances}>
          Tout ouvrir
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={collapseAllSeances}>
          Tout fermer
        </Button>
        {/* Légende : couleur = caméra ; fond blanc / gris en alternance = week-end */}
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
          {Object.entries(CAMERA_COULEURS).map(([n, c]) => (
            <span
              key={n}
              title={`Caméra ${n} : ${c.nom}`}
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${c.solid}`}
            >
              {n}
            </span>
          ))}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-3.5 w-5 rounded border bg-background" />
          <span className="h-3.5 w-5 rounded border bg-muted-foreground/25" />
          week-ends en alternance
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-x-auto border-b -mb-px">
          <button
            type="button"
            onClick={() => setFilterSeancePoste('all')}
            className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              filterSeancePoste === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            }`}
          >
            Toutes les caméras
          </button>
          {POSTES_CAM.map((p) => (
            <button
              key={p}
              type="button"
              disabled={!!camIndispo[p]}
              title={camIndispo[p] ? `${p} indisponible jusqu'au ${fmtUntil(camIndispo[p].until)}` : undefined}
              onClick={() => setFilterSeancePoste(p)}
              className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${camIndispo[p] ? 'opacity-50 cursor-not-allowed line-through ' : ''}${
                filterSeancePoste === p
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {cameraCouleur(p) && <span className={`h-2.5 w-2.5 rounded-full ${cameraCouleur(p).dot}`} />}
                {p}
              </span>
            </button>
          ))}
        </div>
        {canManage() && (
          <Dialog open={seanceDialogOpen} onOpenChange={(open) => { if (open) setSeanceDialogOpen(true); else closeFiche(); }}>
            <DialogTrigger asChild>
              <Button data-testid="add-seance-btn"><Plus className="w-4 h-4 mr-2" />Nouveau culte</Button>
            </DialogTrigger>
            {/* onOpenAutoFocus : sur iPad, le focus automatique sur le champ date
                ouvrait le sélecteur de date dès l'ouverture de la fiche. */}
            <DialogContent className="max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
              {/* Bandeau collé en haut de la fiche : numéro de caméra en
                  très grand, toujours visible pendant le défilement, pour
                  ne pas se tromper de fiche. */}
              {seanceForm.poste && (() => {
                const camNum = (seanceForm.poste.match(/\d+/) || [null])[0];
                const camCouleur = cameraCouleur(seanceForm.poste);
                const jour = seanceForm.date
                  ? new Date(`${seanceForm.date}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                  : '';
                return (
                  <div
                    className="sticky top-0 z-20 -mx-6 -mt-6 flex items-center gap-4 border-b bg-background px-6 py-3 pr-20 shadow-sm"
                    data-testid="fiche-camera-banner"
                  >
                    <div className={`flex h-20 min-w-[5rem] flex-col items-center justify-center rounded-xl px-3 shadow ${camCouleur?.solid || 'bg-primary text-primary-foreground'}`}>
                      <span className="text-[10px] font-semibold uppercase leading-none tracking-widest opacity-80">Caméra</span>
                      <span className="text-5xl font-black leading-none">{camNum || '•'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xl font-bold">{seanceForm.poste}</p>
                      {jour && (
                        <p className="w-fit max-w-full truncate rounded-md border px-2 py-0.5 text-sm font-bold capitalize text-muted-foreground" style={jourCouleurStyle(seanceForm.date) || undefined}>{jour}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label="Fermer la fiche"
                      onClick={closeFiche}
                      className="touch-manipulation absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background text-foreground shadow hover:bg-muted"
                      data-testid="fiche-close-btn"
                    >
                      <X className="h-7 w-7" />
                    </button>
                  </div>
                );
              })()}
              <DialogHeader>
                <DialogTitle>{seanceEditingId ? 'Modifier le culte' : 'Nouveau culte'}</DialogTitle>
                <DialogDescription>Enregistrer les entrées/sorties d'équipement</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSeanceSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input type="date" value={seanceForm.date} onChange={(e) => setSeanceForm({ ...seanceForm, date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Poste *</Label>
                    <Input value={seanceForm.poste} onChange={(e) => setSeanceForm({ ...seanceForm, poste: e.target.value })} required placeholder="ex: CAM 1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Superviseur</Label>
                    <Input value={seanceForm.superviseur} onChange={(e) => setSeanceForm({ ...seanceForm, superviseur: e.target.value })} />
                  </div>
                </div>
                {plannedCadreurs.length > 0 && (
                  <div className="rounded-lg border overflow-hidden" data-testid="planned-cadreurs">
                    <div className="bg-muted px-3 py-1.5 text-xs font-semibold text-foreground">
                      Cadreurs prévus au planning ce jour-là — cliquer sur un nom pour l'ajouter à l'équipe
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32 h-8">Poste</TableHead>
                          <TableHead className="h-8">Cadreur (C)</TableHead>
                          <TableHead className="h-8">Assistant (A)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plannedCadreurs.map((p) => {
                          const isCurrent =
                            p.num != null &&
                            p.num === parseInt((seanceForm.poste || '').replace(/\D+/g, ''), 10);
                          const nameBtn = (slot, role) => {
                            const n = p.names.find((x) => x.slot === slot);
                            if (!n) return <span className="text-muted-foreground">—</span>;
                            return (
                              <button
                                type="button"
                                onClick={() => addPlannedToEquipe(role, n.nom)}
                                className="px-2 py-0.5 rounded-md border border-border bg-background hover:bg-primary/10 hover:border-primary/50 text-xs font-medium transition-colors"
                              >
                                {n.nom}
                              </button>
                            );
                          };
                          return (
                            <TableRow key={p.label} className={isCurrent ? `${cameraCouleur(p.label)?.soft || 'bg-muted'} hover:brightness-95` : ''}>
                              <TableCell className="py-1.5">
                                <span className="inline-flex items-center gap-2 font-medium text-sm">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${cameraCouleur(p.label)?.solid || 'bg-primary text-primary-foreground'}`}>
                                    {p.num ?? '•'}
                                  </span>
                                  {p.label}
                                </span>
                              </TableCell>
                              <TableCell className="py-1.5">{nameBtn(0, 'C')}</TableCell>
                              <TableCell className="py-1.5">{nameBtn(1, 'A')}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Heure sortie</Label>
                    <Input
                      type="time"
                      step={60}
                      value={heureToInput(seanceForm.horaire_debut)}
                      onChange={(e) => setSeanceForm({ ...seanceForm, horaire_debut: heureFromInput(e.target.value) })}
                      className="max-w-[160px]"
                      data-testid="heure-sortie"
                    />
                    {seanceForm.horaire_debut && !heureToInput(seanceForm.horaire_debut) && (
                      <p className="text-xs text-muted-foreground">Ancienne saisie : « {seanceForm.horaire_debut} » — choisissez l'heure pour la remplacer.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Équipe (Cadreur / Assistant / Régisseur...)</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addEquipeMembre}>
                      <Plus className="w-3 h-3 mr-1" />Ajouter
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {seanceForm.equipe.map((m, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2 border rounded p-2">
                        <Input
                          className="w-28"
                          placeholder="Rôle (C/A/R)"
                          value={m.role}
                          onChange={(e) => updateEquipeMembre(idx, 'role', e.target.value)}
                        />
                        {ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()] && (
                          <span className="text-sm font-bold">
                            {(m.role || '').trim().toUpperCase()} - {ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()]}
                          </span>
                        )}
                        {/* Liste selon le rôle de la ligne : C / A = cadreurs (ceux du planning
                            d'abord), R = régisseurs, autre = tout l'effectif ; filtrée par les
                            lettres tapées. */}
                        <NameCombobox
                          value={m.nom}
                          options={namesForRole(m.role, m.role_code)}
                          labelFor={camLabelFor}
                          onChange={(v) => updateEquipeMembre(idx, 'nom', v)}
                          onCommit={(v) => v && updateEquipeMembre(idx, 'nom', canonName(v))}
                        />
                        {camLabelFor(m.nom) && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/40">
                            {camLabelFor(m.nom)}
                          </Badge>
                        )}
                        <Button type="button" size="icon" variant="ghost" className="ml-auto h-8 w-8 text-destructive" title="Supprimer cette ligne" aria-label="Supprimer cette ligne"
                          onClick={() => setSeanceForm((f) => ({ ...f, equipe: f.equipe.filter((_, i) => i !== idx) }))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {seanceForm.equipe.length === 0 && (
                      <p className="text-xs text-muted-foreground">Aucun membre d'équipe ajouté</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Équipements — case Entrée/Sortie par membre (comme la fiche papier)</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addEquipementLigne}>
                      <Plus className="w-3 h-3 mr-1" />Ajouter une ligne
                    </Button>
                  </div>
                  {seanceForm.equipements.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={allChecked('sortie') ? 'secondary' : 'outline'}
                        onClick={() => toggleAllChecks('sortie')}
                        data-testid="check-all-sorties"
                      >
                        <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                        {allChecked('sortie') ? 'Décocher toutes les sorties' : 'Tout cocher : sorties'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={allChecked('entree') ? 'secondary' : 'outline'}
                        onClick={() => toggleAllChecks('entree')}
                        data-testid="check-all-entrees"
                      >
                        <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                        {allChecked('entree') ? 'Décocher toutes les entrées' : 'Tout cocher : entrées'}
                      </Button>
                    </div>
                  )}
                  <div className="border rounded-lg overflow-auto max-h-[380px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead rowSpan={2} className="min-w-[170px] align-middle">Équipement</TableHead>
                          {ROLE_CODES.map((rc) => (
                            <TableHead key={rc} colSpan={2} className="text-center border-l h-8">
                              <span className="font-bold">{rc} - {ROLE_LABELS_FULL[rc]}</span>
                            </TableHead>
                          ))}
                          <TableHead rowSpan={2} className="w-10" />
                        </TableRow>
                        <TableRow>
                          {ROLE_CODES.flatMap((rc) =>
                            ['sortie', 'entree'].map((field) => (
                              <TableHead key={`${rc}-${field}`} className={`text-center p-1 h-8 ${field === 'sortie' ? 'border-l' : ''}`}>
                                <button
                                  type="button"
                                  onClick={() => toggleColumnChecks(rc, field)}
                                  title="Cliquer pour tout cocher / décocher cette colonne"
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-colors ${
                                    field === 'sortie'
                                      ? 'bg-blue-800/20 text-blue-900 dark:text-blue-300 hover:bg-blue-800/30'
                                      : 'bg-sky-300/30 text-sky-800 dark:text-sky-300 hover:bg-sky-300/45'
                                  }`}
                                >
                                  {field === 'sortie' ? 'Sortie' : 'Entrée'}
                                </button>
                              </TableHead>
                            ))
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {seanceForm.equipements.map((eq, idx) => (
                          <TableRow key={idx} className={isStorageLine(eq.nom) ? STORAGE_ROW : ''}>
                            <TableCell className="p-1">
                              <Input
                                className="h-8"
                                placeholder="Équipement (ex: JVC GY HM 750)"
                                value={eq.nom}
                                onChange={(e) => updateEquipementNom(idx, e.target.value)}
                              />
                              {isAutoCheckExcluded(eq.nom) && (
                                <span className="block text-[10px] text-muted-foreground px-1 pt-0.5">
                                  pas coché par « Tout cocher »
                                </span>
                              )}
                            </TableCell>
                            {ROLE_CODES.flatMap((rc) =>
                              ['sortie', 'entree'].map((field) => {
                                const checked = !!eq.checks?.[rc]?.[field];
                                return (
                                  <TableCell
                                    key={`${rc}-${field}`}
                                    className={`text-center p-2 ${field === 'sortie' ? 'border-l' : ''} ${
                                      checked ? (field === 'sortie' ? 'bg-blue-800/15' : 'bg-sky-300/25') : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="w-7 h-7 cursor-pointer accent-primary"
                                      checked={checked}
                                      onChange={(e) => updateEquipementCheck(idx, rc, field, e.target.checked)}
                                      aria-label={`${rc} ${field === 'sortie' ? 'sortie' : 'entrée'}`}
                                    />
                                  </TableCell>
                                );
                              })
                            )}
                            <TableCell className="p-1 text-center">
                              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Supprimer cette ligne" aria-label="Supprimer cette ligne"
                                onClick={() => setSeanceForm((f) => ({ ...f, equipements: f.equipements.filter((_, i) => i !== idx) }))}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {seanceForm.equipements.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-4">
                              Aucune ligne d'équipement — cliquez sur "Ajouter une ligne"
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observations (rédigées par les régisseurs)</Label>
                  <Textarea
                    value={seanceForm.observations}
                    onChange={(e) => setSeanceForm({ ...seanceForm, observations: e.target.value })}
                    rows={2}
                    disabled={!canWriteObservations}
                    placeholder={canWriteObservations ? '' : 'Réservé aux régisseurs'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interventions</Label>
                  <Textarea value={seanceForm.interventions} onChange={(e) => setSeanceForm({ ...seanceForm, interventions: e.target.value })} rows={2} />
                </div>
                  <div className="space-y-2">
                    <Label>Heure entrée</Label>
                    <Input
                      type="time"
                      step={60}
                      value={heureToInput(seanceForm.horaire_fin)}
                      onChange={(e) => setSeanceForm({ ...seanceForm, horaire_fin: heureFromInput(e.target.value) })}
                      className="max-w-[160px]"
                      data-testid="heure-entree"
                    />
                    {seanceForm.horaire_fin && !heureToInput(seanceForm.horaire_fin) && (
                      <p className="text-xs text-muted-foreground">Ancienne saisie : « {seanceForm.horaire_fin} » — choisissez l'heure pour la remplacer.</p>
                    )}
                  </div>
                {/* Signature unique « Retour matériel » : uniquement au doigt (ou à la
                    souris), grandes zones l'une sous l'autre. */}
                <div className="space-y-4">
                  {[
                    ['entree', 'Signature — Retour matériel', 'signature_entree'],
                  ].map(([key, label, field]) => {
                    const value = seanceForm[field] || '';
                    return (
                      <div key={key} className="space-y-2 rounded-lg border p-3" data-testid={`signature-${key}`}>
                        <Label className="text-base font-semibold">{label}</Label>
                        {value && !isDrawnSig(value) && (
                          <p className="text-xs text-muted-foreground">
                            Ancienne signature (initiales) : « {value} » — signez ci-dessous pour la remplacer.
                          </p>
                        )}
                        <SignaturePad
                          value={isDrawnSig(value) ? value : ''}
                          onChange={(v) => setSeanceForm((f) => ({ ...f, [field]: v }))}
                        />
                        {(() => {
                          const parField = `${field}_par`;
                          const parVal = seanceForm[parField] || '';
                          const suggestions = Array.from(new Set([
                            ...(seanceForm.equipe || []).map((m) => canonName(m.nom)),
                            canonName(seanceForm.superviseur),
                          ].filter(Boolean)));
                          return (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Cadreur signataire</Label>
                              <Input
                                value={parVal}
                                onChange={(e) => setSeanceForm((f) => ({ ...f, [parField]: e.target.value }))}
                                placeholder="Nom du signataire"
                                data-testid={`signataire-${key}`}
                              />
                              {suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {suggestions.map((n) => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => setSeanceForm((f) => ({ ...f, [parField]: n }))}
                                      className={`rounded-full border px-3 py-1 text-sm ${parVal === n ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                                    >
                                      {n}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Régisseur</Label>
                              <select
                                value={seanceForm.regisseur_signataire || ''}
                                onChange={(e) => { const v = e.target.value; setSeanceForm((f) => ({ ...f, regisseur_signataire: v })); }}
                                className="h-11 w-full rounded-md border bg-background px-3 text-base"
                                data-testid="regisseur-signataire"
                              >
                                <option value="">— Choisir un régisseur —</option>
                                {Array.from(new Set([
                                  ...regisseursRoster.map((t) => canonName(t.nom)),
                                  seanceForm.regisseur_signataire,
                                ].filter(Boolean))).sort((x, y) => x.localeCompare(y, 'fr')).map((n) => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
                {seanceForm.signature && !seanceForm.signature_entree && (
                  <p className="text-xs text-muted-foreground">
                    Ancienne signature enregistrée : « {sigText(seanceForm.signature)} » — signez ci-dessus (Retour matériel) pour la remplacer.
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={seanceSubmitting}>
                  {seanceSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enregistrer
                </Button>
                {seanceEditingId && autoSaveState && (
                  <p className="text-center text-xs text-muted-foreground" data-testid="autosave-state">
                    {autoSaveState === 'saving' ? 'Enregistrement automatique…' : autoSaveState === 'error' ? 'Enregistrement automatique impossible — vérifiez la connexion' : `Enregistré automatiquement${autoSavedAt ? ` à ${autoSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                  </p>
                )}
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {sortedSeances.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ArrowRightLeft className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucun culte enregistré</p>
          </CardContent>
        </Card>
      ) : (() => {
        const knownPostes = new Set(POSTES_CAM);
        const groupsOrder = [...POSTES_CAM, ...Array.from(new Set(sortedSeances.map(s => s.poste).filter(p => !knownPostes.has(p))))];
        const visibleGroups = groupsOrder.filter((p) => filterSeancePoste === 'all' || filterSeancePoste === p);
        return visibleGroups.map((poste) => {
          const group = sortedSeances.filter((s) => s.poste === poste);
          if (group.length === 0 && filterSeancePoste === 'all') return null;
          return (
            <Card key={poste}>
              <CardHeader
                className={`py-3 border-b cursor-pointer select-none hover:bg-muted/40 transition-colors ${cameraCouleur(poste)?.soft || ''}`}
                onClick={() => togglePoste(poste)}
                role="button"
                aria-expanded={!collapsedPostes.has(poste)}
                data-testid={`poste-header-${poste}`}
              >
                <CardTitle className="text-xl flex items-center gap-2">
                  {collapsedPostes.has(poste) ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                  {cameraCouleur(poste) && (
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-base font-black ${cameraCouleur(poste).solid}`}>
                      {parseInt((poste.match(/\d+/) || [''])[0], 10)}
                    </span>
                  )}
                  {poste || 'Non classé'}
                  <Badge variant="secondary" className="font-normal">{group.length}</Badge>
                </CardTitle>
              </CardHeader>
              {!collapsedPostes.has(poste) && (
              <CardContent className="p-0">
                {group.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Aucun culte enregistré sur ce poste</p>
                  </div>
                ) : (
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap min-w-[120px]">Date</TableHead>
                        <TableHead className="min-w-[130px]">Superviseur</TableHead>
                        <TableHead className="min-w-[150px]">Cadreurs</TableHead>
                        <TableHead className="min-w-[200px]">Commentaire</TableHead>
                        <TableHead className="whitespace-nowrap min-w-[110px]">Horaires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const rows = [];
                        const pillsDone = new Set();
                        let currentYear = null;
                        group.forEach((s) => {
                          const year = (s.date || '').slice(0, 4) || 'Sans date';
                          const monthNum = (s.date || '').slice(5, 7) || '00';
                          if (year !== currentYear) {
                            currentYear = year;
                            const yearKey = `${poste}__${year}`;
                            const yearCount = group.filter((g) => (g.date || '').slice(0, 4) === year).length;
                            const open = isYearOpen(yearKey, year);
                            rows.push(
                              <TableRow key={`year-${yearKey}`} className="bg-muted/50 hover:bg-muted cursor-pointer touch-manipulation" onClick={(e) => setYearOpen(poste, year, !open, e.currentTarget)}>
                                <TableCell colSpan={5} className="p-0 cursor-pointer">
                                  {/* Vrai bouton (et non clic sur la ligne) : fiable au toucher sur iPad. */}
                                  <button
                                    type="button"
                                    aria-expanded={open}
                                    className="flex w-full touch-manipulation items-center gap-2 px-4 py-4 text-left text-lg font-bold"
                                  >
                                    {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    {year}
                                    <Badge variant="outline" className="font-normal text-sm">{yearCount}</Badge>
                                  </button>
                                </TableCell>
                              </TableRow>,
                            );
                          }
                          const yearKey = `${poste}__${currentYear}`;
                          if (!isYearOpen(yearKey, currentYear)) return;
                          // Fix 28/09/2026 : 2e niveau de regroupement par mois sous
                          // l'année (mois en cours ouvert par défaut) pour retrouver
                          // une fiche en année → mois → jour au lieu d'une longue liste.
                          // Pastilles des mois (une seule fois par année) : un seul mois
                          // est affiché à la fois, choisi d'un toucher sur sa pastille.
                          const selMonth = selectedMonthFor(poste, currentYear);
                          if (!pillsDone.has(currentYear)) {
                            pillsDone.add(currentYear);
                            const yearMonths = monthsByPosteYear.get(`${poste}__${currentYear}`) || [];
                            // Copie figée : currentYear change à chaque tour de boucle, un
                            // gestionnaire qui l'utiliserait au clic verrait la dernière année.
                            const pillKey = `${poste}__${currentYear}`;
                            rows.push(
                              <TableRow key={`pills-${poste}-${currentYear}`} className="hover:bg-transparent">
                                <TableCell colSpan={5} className="p-3">
                                  <div className="flex flex-wrap items-center gap-2" data-testid="month-pills">
                                    {/* Liste déroulante native : fiable au toucher, même choix que les pastilles. */}
                                    <select
                                      aria-label="Choisir le mois"
                                      value={selMonth}
                                      onChange={(e) => { const v = e.target.value; setMonthSel((prev) => ({ ...prev, [pillKey]: v })); }}
                                      className="h-11 rounded-md border-2 border-blue-600 bg-background px-3 text-base font-semibold"
                                      data-testid="month-select"
                                    >
                                      {yearMonths.map(({ month }) => (
                                        <option key={month} value={month}>{MOIS_NOMS_FR[parseInt(month, 10) - 1] || month}</option>
                                      ))}
                                    </select>
                                    {yearMonths.map(({ month }) => {
                                      const n = group.filter((g) => (g.date || '').slice(0, 4) === currentYear && (g.date || '').slice(5, 7) === month).length;
                                      const active = month === selMonth;
                                      return (
                                        <button
                                          key={month}
                                          type="button"
                                          onClick={() => setMonthSel((prev) => ({ ...prev, [pillKey]: month }))}
                                          onPointerUp={() => setMonthSel((prev) => ({ ...prev, [pillKey]: month }))}
                                          className={`touch-manipulation inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-base font-semibold ${active ? 'border-blue-600 bg-blue-600 text-white shadow' : 'border-border bg-background hover:bg-muted'}`}
                                        >
                                          {MOIS_NOMS_FR[parseInt(month, 10) - 1] || month}
                                          <span className={`rounded-full px-2 text-sm ${active ? 'bg-white/25' : 'bg-muted text-muted-foreground'}`}>{n}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </TableCell>
                              </TableRow>,
                            );
                          }
                          if (monthNum !== selMonth) return;
                          const vide = isSeanceVide(s);
                          // Zone bleue entourant les fiches d'un même week-end (vendredi + dimanche).
                          const monthList = group.filter((g) => (g.date || '').slice(0, 4) === currentYear && (g.date || '').slice(5, 7) === selMonth);
                          const mIdx = monthList.indexOf(s);
                          const wk = weekendKey(s.date);
                          const wkFirst = !!wk && (mIdx <= 0 || weekendKey(monthList[mIdx - 1].date) !== wk);
                          const wkLast = !!wk && (mIdx >= monthList.length - 1 || weekendKey(monthList[mIdx + 1].date) !== wk);
                          const isExpanded = expandedSeance === s.id;
                          // Seul le week-end en cours (le prochain vendredi/dimanche, ou celui d'aujourd'hui) est entouré.
                          const thisWe = !!wk && wk === weekendKey(nextWeekendRefDate());
                          // Cadre épais bleu vif + fond bleuté + bandeau « Ce week-end » : impossible à rater.
                          const boxClass = thisWe
                            ? `[&>td]:bg-blue-100 dark:[&>td]:bg-blue-950/60 [&>td:last-child]:border-r-4 [&>td:last-child]:border-r-blue-600 ${wkLast && !isExpanded ? '[&>td]:border-b-4 [&>td]:border-b-blue-600' : ''}`
                            : '';
                          const boxDetailClass = thisWe
                            ? `[&>td]:bg-blue-100 dark:[&>td]:bg-blue-950/60 [&>td:last-child]:border-r-4 [&>td:last-child]:border-r-blue-600 ${wkLast ? '[&>td]:border-b-4 [&>td]:border-b-blue-600' : ''}`
                            : '';
                          const weFriday = thisWe ? new Date(`${wk}T00:00:00`) : null;
                          if (weFriday) weFriday.setDate(weFriday.getDate() - 2);
                          rows.push(
                        <Fragment key={s.id}>
                          {thisWe && wkFirst && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={5} className="border-4 border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-extrabold uppercase tracking-wider text-white">
                                ▶ Ce week-end · {weFriday.getDate()}–{new Date(`${wk}T00:00:00`).getDate()} {MOIS_NOMS_FR[new Date(`${wk}T00:00:00`).getMonth()]}
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow
                            onClick={() => (canManage() ? handleEditSeance(s) : setExpandedSeance(expandedSeance === s.id ? null : s.id))}
                            className={`${weekendParite(s.date) === 1 ? 'bg-slate-300 hover:bg-slate-400/80 dark:bg-slate-700 dark:hover:bg-slate-600' : 'bg-background hover:bg-muted/40'} cursor-pointer ${boxClass}`}
                          >
                            <TableCell className={`font-medium align-top border-l-8 ${cameraCouleur(s.poste)?.border || 'border-l-transparent'}`}>
                              <div className="flex flex-col gap-1">
                                <span className="w-fit whitespace-nowrap rounded-md border px-2 py-1 font-bold" style={jourCouleurStyle(s.date) || undefined}>
                                  {s.date
                                    ? new Date(`${s.date}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
                                    : '-'}
                                </span>
                                {vide && (
                                  <Badge variant="outline" className="font-normal text-muted-foreground w-fit">Vide</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="align-top">{s.superviseur ? canonName(s.superviseur) : <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="align-top">
                              {(() => {
                                const pr = principauxFor(s);
                                // Le principal déjà présent dans l'équipe n'est pas répété : son badge porte l'étoile.
                                const inTeam = new Set((s.equipe || []).filter((m) => (m.nom || '').trim()).map((m) => canonName(m.nom).toLowerCase()));
                                const solo = pr.names.filter((n) => !inTeam.has(canonName(n).toLowerCase()));
                                if (!solo.length) return null;
                                return (
                                  <div className="mb-1 flex flex-wrap gap-1" title={pr.auto ? 'Cadreur principal prévu' : 'Cadreur principal'}>
                                    {solo.map((n) => (
                                      <span key={n} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                                        ★ {n}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}
                              {(s.equipe || []).filter((m) => (m.nom || '').trim()).length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {(s.equipe || [])
                                    .filter((m) => (m.nom || '').trim())
                                    .map((m, i) => (
                                      <span
                                        key={i}
                                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${principauxFor(s).names.some((n) => canonName(n).toLowerCase() === canonName(m.nom).toLowerCase()) ? 'border-primary/40 bg-primary/10 font-bold text-primary' : 'bg-background'}`}
                                        title={principauxFor(s).names.some((n) => canonName(n).toLowerCase() === canonName(m.nom).toLowerCase()) ? `Cadreur principal — ${ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()] || m.role || ''}` : (ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()] || m.role || '')}
                                      >
                                        {principauxFor(s).names.some((n) => canonName(n).toLowerCase() === canonName(m.nom).toLowerCase()) && '★'}
                                        {m.role && (
                                          <span className="font-bold text-primary">{(m.role || '').trim().toUpperCase().slice(0, 1)}</span>
                                        )}
                                        {canonName(m.nom)}
                                      </span>
                                    ))}
                                </div>
                              ) : principauxFor(s).names.length === 0 ? (
                                <span className="text-muted-foreground">—</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="align-top">
                              {s.observations ? (
                                <p className="text-sm whitespace-pre-wrap break-words line-clamp-3" title={s.observations}>
                                  {s.observations}
                                </p>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="align-top whitespace-nowrap text-sm">
                              {[['Sortie', s.horaire_debut, null, null], ['Entrée', s.horaire_fin, s.signature_entree, s.signature_entree_par]].map(([lab, h, sig, par]) => {
                                const signed = !!sig;
                                const hasSig = lab === 'Entrée';
                                return (
                                  <div key={lab} className="flex items-center gap-1.5" title={!hasSig ? undefined : signed ? `Retour matériel signé${par ? ` par ${par}` : ''}` : 'Retour matériel non signé'}>
                                    <span className="w-11 text-xs text-muted-foreground">{lab}</span>
                                    <span className="font-medium tabular-nums">{h || '—'}</span>
                                    {hasSig && (signed ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-1 text-sm font-bold text-white shadow-sm">
                                        <PenLine className="w-5 h-5" /> Signé
                                      </span>
                                    ) : canManage() ? (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); openSeanceToSign(s); }}
                                        className="touch-manipulation inline-flex items-center gap-1 rounded-full border-2 border-dashed border-amber-500 px-2.5 py-1 text-sm font-semibold text-amber-600 hover:bg-amber-50"
                                        data-testid="open-sign-btn"
                                      >
                                        <Circle className="w-5 h-5" /> À signer
                                      </button>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-amber-500 px-2.5 py-1 text-sm font-semibold text-amber-600">
                                        <Circle className="w-5 h-5" /> À signer
                                      </span>
                                    ))}
                                  </div>
                                );
                              })}
                            </TableCell>
                          </TableRow>
                          {expandedSeance === s.id && (
                            <TableRow key={`${s.id}-detail`} className={boxDetailClass}>
                              <TableCell colSpan={5} className="bg-muted/30">
                                <div className="space-y-1 py-2">
                                  {(s.equipe || []).length > 0 && (
                                    <div className="flex flex-wrap gap-3 mb-2">
                                      {(s.equipe || []).map((m, i) => (
                                        <span key={i} className="text-sm"><span className="font-bold">{ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()] ? `${(m.role || '').trim().toUpperCase()} - ${ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()]}` : m.role}</span> : {m.nom}</span>
                                      ))}
                                    </div>
                                  )}
                                  {(s.horaire_debut || s.horaire_fin) && (
                                    <p className="text-xs text-muted-foreground mb-2">Horaires: {s.horaire_debut || '-'} → {s.horaire_fin || '-'}</p>
                                  )}
                                  {(s.equipements || []).length > 0 && (s.equipements[0].checks) ? (
                                    <div className="overflow-x-auto">
                                      <table className="text-xs border-collapse">
                                        <thead>
                                          <tr>
                                            <th className="text-left pr-3 pb-1">Équipement</th>
                                            {['C', 'A', 'R'].map((rc) => (
                                              <th key={rc} className="px-2 pb-1 text-center font-bold" colSpan={2}>{rc} - {ROLE_LABELS_FULL[rc]}</th>
                                            ))}
                                          </tr>
                                          <tr className="text-muted-foreground">
                                            <th></th>
                                            {['C', 'A', 'R'].map((rc) => (
                                              <>
                                                <th key={rc + '-s'} className="px-1 font-normal">Sortie</th>
                                                <th key={rc + '-e'} className="px-1 font-normal">Entrée</th>
                                              </>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(s.equipements || []).map((eq, i) => (
                                            <tr key={i} className={`border-t ${isStorageLine(eq.nom) ? STORAGE_ROW : ''}`}>
                                              <td className="pr-3 py-1 font-medium">{eq.nom}</td>
                                              {['C', 'A', 'R'].map((rc) => (
                                                <>
                                                  <td key={rc + '-s'} className="px-1 text-center">{eq.checks?.[rc]?.sortie ? '✓' : '—'}</td>
                                                  <td key={rc + '-e'} className="px-1 text-center">{eq.checks?.[rc]?.entree ? '✓' : '—'}</td>
                                                </>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    (s.equipements || []).map((eq, i) => (
                                      <div key={i} className={`flex gap-4 text-sm ${isStorageLine(eq.nom) ? `${STORAGE_ROW} rounded px-1` : ''}`}>
                                        <span className="font-medium">{eq.nom}</span>
                                        <span className="text-muted-foreground">{eq.personne}</span>
                                        {eq.entree && <Badge variant="outline">Entrée</Badge>}
                                        {eq.sortie && <Badge variant="outline">Sortie</Badge>}
                                      </div>
                                    ))
                                  )}
                                  {s.derniere_modif_par && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      Dernière modification par <span className="font-medium text-foreground">{s.derniere_modif_par}</span>
                                      {s.updated_at ? ` · ${new Date(s.updated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                                    </p>
                                  )}
                                  {s.observations && <p className="text-xs text-muted-foreground italic mt-2">Obs: {s.observations}</p>}
                                  {s.interventions && <p className="text-xs text-muted-foreground italic mt-2">Interventions: {s.interventions}</p>}
                                  {!s.signature_entree && !s.signature && canManage() && (
                                    <button
                                      type="button"
                                      onClick={() => openSeanceToSign(s)}
                                      className="touch-manipulation mt-2 inline-flex items-center gap-1 rounded-full border-2 border-dashed border-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-600 hover:bg-amber-50"
                                    >
                                      <PenLine className="w-5 h-5" /> À signer — Retour matériel
                                    </button>
                                  )}
                                  {(s.signature_entree || s.signature) && (
                                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                      {[['Retour matériel', s.signature_entree]].map(([lab, v]) =>
                                        v ? (
                                          <div key={lab} className="flex items-center gap-2">
                                            <span>Signature {lab.toLowerCase()} :</span>
                                            {isDrawnSig(v) ? (
                                              <img src={v} alt={`Signature ${lab.toLowerCase()}`} className="h-10 rounded border bg-white" />
                                            ) : (
                                              <span className="font-medium text-foreground">{v}</span>
                                            )}
                                            {s.signature_entree_par && (
                                              <span className="font-medium text-foreground">— {s.signature_entree_par}</span>
                                            )}
                                          </div>
                                        ) : null
                                      )}
                                      {!s.signature_entree && s.signature && (
                                        <span>Signature : <span className="font-medium text-foreground">{sigText(s.signature)}</span></span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>,
                          );
                        });
                        return rows;
                      })()}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
              )}
            </Card>
          );
        });
      })()}
    </div>
  );
}

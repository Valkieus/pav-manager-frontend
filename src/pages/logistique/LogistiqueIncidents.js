import { Search, Archive, Plus, Loader2, Edit, ArchiveRestore, Trash2 } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { FREQUENCE_OPTIONS, POSTES_CAM, cameraCouleur } from './shared';

export function LogistiqueIncidents({
  canManage,
  filterIncidentPoste,
  filteredIncidents,
  handleArchiveIncident,
  handleDeleteIncident,
  handleEditIncident,
  handleIncidentSubmit,
  handleUnarchiveIncident,
  incidentDialogOpen,
  incidentEditingId,
  incidentForm,
  incidentSearch,
  incidentSubmitting,
  resetIncidentForm,
  setFilterIncidentPoste,
  setIncidentDialogOpen,
  setIncidentForm,
  setIncidentSearch,
  setShowArchivedInc,
  showArchivedInc,
}) {
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={incidentSearch}
          onChange={(e) => setIncidentSearch(e.target.value)}
          placeholder="Rechercher (date, description, équipement, personne...)"
          className="pl-8"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant={showArchivedInc ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowArchivedInc((v) => !v)}
          data-testid="toggle-archived-incidents"
        >
          <Archive className="w-4 h-4 mr-2" />
          {showArchivedInc ? 'Retour aux incidents' : 'Archivés'}
        </Button>
        {showArchivedInc && (
          <p className="text-sm text-muted-foreground">
            Incidents archivés : vous pouvez les remettre dans la liste ou les supprimer définitivement.
          </p>
        )}
      </div>
      {/* Onglets "feuilles" façon Excel : un onglet cliquable par caméra,
          comme les feuilles CAMERA 1 / CAMERA 2 / ... du classeur d'origine. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-1 overflow-x-auto pb-1 border-b -mb-px flex-1">
          <button
            type="button"
            onClick={() => setFilterIncidentPoste('all')}
            className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              filterIncidentPoste === 'all'
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
              onClick={() => setFilterIncidentPoste(p)}
              className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                filterIncidentPoste === p
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
          <Dialog open={incidentDialogOpen} onOpenChange={(open) => { setIncidentDialogOpen(open); if (!open) resetIncidentForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="add-incident-btn"><Plus className="w-4 h-4 mr-2" />Signaler un incident</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{incidentEditingId ? 'Modifier' : 'Signaler'} un incident</DialogTitle>
                <DialogDescription>Problème matériel ou technique rencontré sur un poste caméra</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleIncidentSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Poste *</Label>
                    <Select value={incidentForm.poste} onValueChange={(v) => setIncidentForm({ ...incidentForm, poste: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {POSTES_CAM.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={incidentForm.date} onChange={(e) => setIncidentForm({ ...incidentForm, date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fréquence</Label>
                    <Select value={incidentForm.frequence} onValueChange={(v) => setIncidentForm({ ...incidentForm, frequence: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FREQUENCE_OPTIONS.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cadreur / Régisseur</Label>
                    <Input value={incidentForm.cadreur_regisseur} onChange={(e) => setIncidentForm({ ...incidentForm, cadreur_regisseur: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Équipement concerné</Label>
                    <Input value={incidentForm.equipement_concerne} onChange={(e) => setIncidentForm({ ...incidentForm, equipement_concerne: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description du problème *</Label>
                  <Textarea value={incidentForm.description_probleme} onChange={(e) => setIncidentForm({ ...incidentForm, description_probleme: e.target.value })} rows={2} required />
                </div>
                <div className="space-y-2">
                  <Label>Résolution</Label>
                  <Textarea value={incidentForm.resolution} onChange={(e) => setIncidentForm({ ...incidentForm, resolution: e.target.value })} rows={2} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date de fin</Label>
                    <Input type="date" value={incidentForm.date_fin} onChange={(e) => setIncidentForm({ ...incidentForm, date_fin: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsable du suivi</Label>
                    <Input value={incidentForm.responsable_suivi} onChange={(e) => setIncidentForm({ ...incidentForm, responsable_suivi: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Commentaire</Label>
                  <Textarea value={incidentForm.commentaire} onChange={(e) => setIncidentForm({ ...incidentForm, commentaire: e.target.value })} rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={incidentSubmitting}>
                  {incidentSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {incidentEditingId ? 'Modifier' : 'Signaler'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {(() => {
        const knownPostes = new Set(POSTES_CAM);
        const groupsOrder = [...POSTES_CAM, ...Array.from(new Set(filteredIncidents.map(i => i.poste).filter(p => !knownPostes.has(p))))];
        const visibleGroups = groupsOrder.filter((p) => filterIncidentPoste === 'all' || filterIncidentPoste === p);
        return visibleGroups.map((poste) => {
          const group = filteredIncidents.filter((i) => i.poste === poste);
          if (group.length === 0 && filterIncidentPoste === 'all') return null;
          return (
            <Card key={poste}>
              <CardHeader className={`py-3 border-b ${cameraCouleur(poste)?.soft || ''}`}>
                <CardTitle className="text-xl flex items-center gap-2">
                  {cameraCouleur(poste) && (
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-base font-black ${cameraCouleur(poste).solid}`}>
                      {parseInt((poste.match(/\d+/) || [''])[0], 10)}
                    </span>
                  )}
                  {poste || 'Non classé'}
                  <Badge variant="secondary" className="font-normal">{group.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {group.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">Aucun incident signalé sur ce poste</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Cadreur / Régisseur</TableHead>
                        <TableHead>Équipement</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.map((i) => (
                        <TableRow key={i.id} onClick={() => !i.is_archived && handleEditIncident(i)} className={i.is_archived ? 'opacity-80' : 'cursor-pointer hover:bg-muted/50'}>
                          <TableCell className={`text-muted-foreground border-l-8 ${cameraCouleur(i.poste)?.border || 'border-l-transparent'}`}>{i.date || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{i.cadreur_regisseur || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{i.equipement_concerne || '-'}</TableCell>
                          <TableCell className="max-w-[280px] truncate" title={i.description_probleme}>{i.description_probleme}</TableCell>
                          <TableCell>
                            {i.date_fin ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Résolu</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">En cours</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{i.responsable_suivi || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {canManage() && !i.is_archived && (
                                <Button size="sm" variant="ghost" title="Modifier" onClick={(e) => { e.stopPropagation(); handleEditIncident(i); }}><Edit className="w-4 h-4" /></Button>
                              )}
                              {canManage() && !i.is_archived && (
                                <Button size="sm" variant="ghost" title="Archiver" onClick={(e) => { e.stopPropagation(); handleArchiveIncident(i.id); }}><Archive className="w-4 h-4" /></Button>
                              )}
                              {canManage() && i.is_archived && (
                                <Button size="sm" variant="outline" title="Remettre dans la liste" onClick={(e) => { e.stopPropagation(); handleUnarchiveIncident(i.id); }}>
                                  <ArchiveRestore className="w-4 h-4 mr-1" />Restaurer
                                </Button>
                              )}
                              {canManage() && (
                                <Button size="sm" variant="ghost" className="text-destructive" title="Supprimer définitivement" onClick={(e) => { e.stopPropagation(); handleDeleteIncident(i.id); }}><Trash2 className="w-4 h-4" /></Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        });
      })()}
    </div>
  );
}

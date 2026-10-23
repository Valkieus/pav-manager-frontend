import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Tag, Loader2, Plus, Trash2, ImagePlus, Search, Archive, Package, Edit, ArchiveRestore } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { PhotoTile } from './shared';

export function LogistiqueStock({
  SortableHead,
  canManage,
  categories,
  categoryDialogOpen,
  dialogOpen,
  editingId,
  enums,
  filterCategorie,
  form,
  getStatutBadge,
  handleAddCategory,
  handleArchive,
  handleDelete,
  handleDeleteCategory,
  handleEdit,
  handleMatPhotoUpload,
  handleSubmit,
  handleUnarchive,
  isAdmin,
  isSuperAdmin,
  newCategoryName,
  resetForm,
  searchTerm,
  setCategoryDialogOpen,
  setDialogOpen,
  setFilterCategorie,
  setForm,
  setNewCategoryName,
  setSearchTerm,
  setShowArchivedMat,
  showArchivedMat,
  sortedMateriel,
  submitting,
  uploadingMatPhoto,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {isAdmin() && (
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="manage-categories-btn">
                  <Tag className="w-4 h-4 mr-2" />Catégories
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Gérer les catégories</DialogTitle>
                  <DialogDescription>Ajoutez ou supprimez des catégories de matériel</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nouvelle catégorie..." />
                    <Button onClick={handleAddCategory} disabled={submitting}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="border rounded-lg p-2 max-h-[300px] overflow-y-auto">
                    {categories.map((cat) => (
                      <div key={cat} className="flex items-center justify-between py-2 px-2 hover:bg-muted rounded">
                        <span className="text-sm">{cat}</span>
                        {isSuperAdmin() && !['Caméras', 'Trépied', 'Batterie', 'Câbles', 'Micro', 'Lumière', 'Moniteur', 'Enregistreur', 'Accessoire', 'Autres'].includes(cat) && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteCategory(cat)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {canManage() && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20" data-testid="add-mat-btn">
                <Plus className="w-4 h-4 mr-2" />Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Modifier' : 'Ajouter'} du matériel</DialogTitle>
                <DialogDescription>Remplissez les informations</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Photo</Label>
                  <div className="flex items-center gap-3">
                    {form.photo_url ? (
                      <img src={`${process.env.REACT_APP_BACKEND_URL}${form.photo_url}`} alt="aperçu" className="w-16 h-16 object-cover rounded border" />
                    ) : (
                      <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center">
                        <ImagePlus className="w-6 h-6 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                          {uploadingMatPhoto && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {form.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleMatPhotoUpload} disabled={uploadingMatPhoto} />
                      </label>
                      {form.photo_url && (
                        <button type="button" className="text-xs text-muted-foreground hover:text-destructive text-left" onClick={() => setForm((f) => ({ ...f, photo_url: '' }))}>
                          Retirer la photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Catégorie *</Label>
                    <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Référence / sous-catégorie</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="ex: CAM 1, HDMI..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantité *</Label>
                    <Input type="number" min="1" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Marque</Label>
                    <Input value={form.marque} onChange={(e) => setForm({ ...form, marque: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Modèle</Label>
                    <Input value={form.modele} onChange={(e) => setForm({ ...form, modele: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>N° Série</Label>
                    <Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {enums.statuts_materiel?.filter(s => s !== 'Archivé').map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Salle</Label>
                    <Input value={form.salle} onChange={(e) => setForm({ ...form, salle: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Groupe</Label>
                    <Input value={form.groupe} onChange={(e) => setForm({ ...form, groupe: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date d'achat</Label>
                    <Input type="date" value={form.date_achat} onChange={(e) => setForm({ ...form, date_achat: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>État</Label>
                    <Input value={form.etat} onChange={(e) => setForm({ ...form, etat: e.target.value })} placeholder="Neuf, bon, usé..." />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingId ? 'Modifier' : 'Ajouter'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button
          type="button"
          variant={showArchivedMat ? 'default' : 'outline'}
          onClick={() => setShowArchivedMat((v) => !v)}
          data-testid="toggle-archived-materiel"
        >
          <Archive className="w-4 h-4 mr-2" />
          {showArchivedMat ? "Retour à l'inventaire" : 'Archivés'}
        </Button>
      </div>
      {showArchivedMat && (
        <p className="text-sm text-muted-foreground">
          Matériel archivé : retiré de l'inventaire courant. Vous pouvez le remettre en service ou le supprimer définitivement.
        </p>
      )}

      {/* Onglets "feuilles" façon Excel : un onglet par catégorie (CAMÉRAS,
          CONNECTIQUES, CÂBLES, SON, ... comme dans le fichier INVENTAIRE
          d'origine), pour cliquer directement sur le titre plutôt que
          passer par un menu déroulant. */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b -mb-px">
        <button
          type="button"
          onClick={() => setFilterCategorie('all')}
          className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            filterCategorie === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
          }`}
        >
          Toutes catégories
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilterCategorie(c)}
            className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              filterCategorie === c
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {sortedMateriel.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucun matériel trouvé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Photo</TableHead>
                  <SortableHead sortKey="nom">Nom</SortableHead>
                  <SortableHead sortKey="categorie">Catégorie</SortableHead>
                  <SortableHead sortKey="quantite" className="text-center">Qté</SortableHead>
                  <SortableHead sortKey="marque">Marque / Modèle</SortableHead>
                  <SortableHead sortKey="salle">Salle / Groupe</SortableHead>
                  <SortableHead sortKey="etat">État</SortableHead>
                  <SortableHead sortKey="statut">Statut</SortableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMateriel.map((m) => (
                  <TableRow key={m.id} onClick={() => !m.is_archived && handleEdit(m)} className={m.is_archived ? 'opacity-80' : 'cursor-pointer hover:bg-muted/50'}>
                    <TableCell>
                      <PhotoTile url={m.photo_url} alt={m.nom} Icon={Package} />
                    </TableCell>
                    <TableCell className="font-medium">{m.nom}</TableCell>
                    <TableCell><Badge variant="outline">{m.categorie}</Badge></TableCell>
                    <TableCell className="text-center font-semibold">{m.quantite || 1}</TableCell>
                    <TableCell className="text-muted-foreground">{m.marque} {m.modele}</TableCell>
                    <TableCell className="text-muted-foreground">{m.salle}{m.salle && m.groupe ? ' / ' : ''}{m.groupe}</TableCell>
                    <TableCell className="text-muted-foreground">{m.etat || '-'}</TableCell>
                    <TableCell>{getStatutBadge(m.statut)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canManage() && !m.is_archived && (
                          <Button size="sm" variant="ghost" title="Modifier" onClick={(e) => { e.stopPropagation(); handleEdit(m); }}><Edit className="w-4 h-4" /></Button>
                        )}
                        {canManage() && !m.is_archived && (
                          <Button size="sm" variant="ghost" title="Archiver" onClick={(e) => { e.stopPropagation(); handleArchive(m.id); }}><Archive className="w-4 h-4" /></Button>
                        )}
                        {canManage() && m.is_archived && (
                          <Button size="sm" variant="outline" title="Remettre dans l'inventaire" onClick={(e) => { e.stopPropagation(); handleUnarchive(m.id); }}>
                            <ArchiveRestore className="w-4 h-4 mr-1" />Restaurer
                          </Button>
                        )}
                        {canManage() && (
                          <Button size="sm" variant="ghost" className="text-destructive" title="Supprimer définitivement" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}><Trash2 className="w-4 h-4" /></Button>
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
    </div>
  );
}

import { Search, Plus, ImagePlus, Loader2, Trash2, ChevronDown, ChevronUp, Contact2, Edit } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { CONTACT_TYPES, PhotoTile } from './shared';

export function LogistiqueContacts({
  addContactSecondaire,
  canManage,
  collapsedContactTypes,
  contactDialogOpen,
  contactEditingId,
  contactForm,
  contactSearch,
  contactSubmitting,
  contacts,
  filterContactType,
  filteredContacts,
  handleContactPhotoUpload,
  handleContactSubmit,
  handleDeleteContact,
  handleEditContact,
  removeContactSecondaire,
  resetContactForm,
  setContactDialogOpen,
  setContactForm,
  setContactSearch,
  setFilterContactType,
  toggleContactType,
  updateContactSecondaire,
  uploadingContactPhoto,
}) {
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={contactSearch}
          onChange={(e) => setContactSearch(e.target.value)}
          placeholder="Rechercher (nom, contact, téléphone, email...)"
          className="pl-8"
        />
      </div>
      {/* Demande 28/09/2026 ("sous forme de classeur") : barre
d'onglets façon intercalaires de classeur (même style que les onglets
caméra ailleurs dans l'app) au lieu d'un menu déroulant — on feuillette
les catégories Fournisseur/Location/Réparation comme des sections d'un
classeur plutôt que de choisir dans une liste. */}
      <div className="flex overflow-x-auto border-b -mb-px">
        <button
          type="button"
          onClick={() => setFilterContactType('all')}
          className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            filterContactType === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
          }`}
        >
          Tous les types
        </button>
        {CONTACT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterContactType(t)}
            className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              filterContactType === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            }`}
          >
            {t}
            <Badge variant="secondary" className="ml-1.5 font-normal">{contacts.filter((c) => c.type_contact === t).length}</Badge>
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
        {canManage() && (
          <Dialog open={contactDialogOpen} onOpenChange={(open) => { setContactDialogOpen(open); if (!open) resetContactForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="add-contact-btn"><Plus className="w-4 h-4 mr-2" />Ajouter un contact</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{contactEditingId ? 'Modifier' : 'Ajouter'} un contact</DialogTitle>
                <DialogDescription>Fournisseur, location ou réparation</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Logo / Photo</Label>
                  <div className="flex items-center gap-3">
                    {contactForm.photo_url ? (
                      <img src={`${process.env.REACT_APP_BACKEND_URL}${contactForm.photo_url}`} alt="aperçu" className="w-16 h-16 object-contain rounded border bg-white" />
                    ) : (
                      <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center">
                        <ImagePlus className="w-6 h-6 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                          {uploadingContactPhoto && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {contactForm.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleContactPhotoUpload} disabled={uploadingContactPhoto} />
                      </label>
                      {contactForm.photo_url && (
                        <button type="button" className="text-xs text-muted-foreground hover:text-destructive text-left" onClick={() => setContactForm((f) => ({ ...f, photo_url: '' }))}>
                          Retirer la photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={contactForm.nom} onChange={(e) => setContactForm({ ...contactForm, nom: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select value={contactForm.type_contact} onValueChange={(v) => setContactForm({ ...contactForm, type_contact: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONTACT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact (personne)</Label>
                      <Input value={contactForm.contact} onChange={(e) => setContactForm({ ...contactForm, contact: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Téléphone</Label>
                      <Input value={contactForm.telephone} onChange={(e) => setContactForm({ ...contactForm, telephone: e.target.value })} />
                    </div>
                  </div>
                  {contactForm.contacts_secondaires.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                      <div className="space-y-2">
                        <Input placeholder="Autre contact (personne)" value={p.contact} onChange={(e) => updateContactSecondaire(idx, 'contact', e.target.value)} />
                      </div>
                      <div className="flex gap-2 items-center">
                        <Input placeholder="Téléphone" value={p.telephone} onChange={(e) => updateContactSecondaire(idx, 'telephone', e.target.value)} />
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeContactSecondaire(idx)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={addContactSecondaire}>
                    <Plus className="w-3.5 h-3.5 mr-1" />Ajouter une autre personne à contacter
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input value={contactForm.adresse} onChange={(e) => setContactForm({ ...contactForm, adresse: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Input value={contactForm.categorie} onChange={(e) => setContactForm({ ...contactForm, categorie: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Site web</Label>
                    <Input value={contactForm.site} onChange={(e) => setContactForm({ ...contactForm, site: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>N° SIRET</Label>
                    <Input value={contactForm.n_siret} onChange={(e) => setContactForm({ ...contactForm, n_siret: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>N° Client</Label>
                    <Input value={contactForm.n_client} onChange={(e) => setContactForm({ ...contactForm, n_client: e.target.value })} />
                  </div>
                </div>
                {contactForm.type_contact === 'Réparation' && (
                  <div className="space-y-2">
                    <Label>Notation</Label>
                    <Input value={contactForm.notation} onChange={(e) => setContactForm({ ...contactForm, notation: e.target.value })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Notes / Commentaire</Label>
                  <Textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={contactSubmitting}>
                  {contactSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {contactEditingId ? 'Modifier' : 'Ajouter'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {CONTACT_TYPES.filter((t) => filterContactType === 'all' || filterContactType === t).map((t) => {
        const group = filteredContacts.filter((c) => c.type_contact === t);
        const isCollapsed = collapsedContactTypes.has(t);
        return (
          <Card key={t}>
            <CardHeader
              className="py-3 border-b cursor-pointer select-none"
              onClick={() => toggleContactType(t)}
            >
              <CardTitle className="text-base flex items-center gap-2">
                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                {t}
                <Badge variant="secondary" className="font-normal">{group.length}</Badge>
              </CardTitle>
            </CardHeader>
            {!isCollapsed && (
            <CardContent className="p-0">
              {group.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">Aucun contact dans cette catégorie</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Logo</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.map((c) => (
                      <TableRow key={c.id} onClick={() => handleEditContact(c)} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <PhotoTile url={c.photo_url} alt={c.nom} contain Icon={Contact2} />
                        </TableCell>
                        <TableCell className="font-medium">{c.nom}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.contact ? (
                            <div>{c.contact}{c.telephone ? ` : ${c.telephone}` : ''}</div>
                          ) : (!c.contacts_secondaires || c.contacts_secondaires.length === 0) ? '-' : null}
                          {(c.contacts_secondaires || []).map((p, idx) => (
                            <div key={idx}>{p.contact || '-'}{p.telephone ? ` : ${p.telephone}` : ''}</div>
                          ))}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.telephone || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canManage() && (
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEditContact(c); }}><Edit className="w-4 h-4" /></Button>
                            )}
                            {canManage() && (
                              <Button size="sm" variant="ghost" className="text-destructive" title="Supprimer ce contact" onClick={(e) => { e.stopPropagation(); handleDeleteContact(c.id); }}><Trash2 className="w-4 h-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

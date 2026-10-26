import { LIVE_POLES, POLES } from './poles';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Plus, Edit, Phone, Mail, Check, IdCard, Loader2 } from 'lucide-react';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { SHEET_CLASS, getBranchColor } from './constants';

export function TechEditDialog({
  dialogOpen,
  editingId,
  enums,
  form,
  handleSubmit,
  isAdminOrReadOnly,
  isGestionnairePlus,
  resetForm,
  setDialogOpen,
  setForm,
  submitting,
  toggleBranche,
  togglePosteSecondaire,
  user,
}) {
  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}
    >
      {/* Tâche #415 : un Responsable ne peut plus créer de fiche
        technicien (le backend le refuse désormais aussi) — seul le
        bouton "Modifier" depuis la fiche d'un technicien existant
        reste disponible pour lui, via le même Dialog contrôlé plus
        haut par dialogOpen/editingId. */}
      {user?.niveau_acces !== "Responsable" && (
        <DialogTrigger asChild>
          <Button
            className="shadow-lg shadow-primary/20"
            data-testid="add-tech-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className={SHEET_CLASS}
        data-testid="tech-edit-dialog"
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-4 pb-3 pt-4 sm:px-6">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="flex items-center gap-2 pr-8">
                {editingId ? <Edit className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                {editingId ? "Modifier la fiche" : "Nouveau technicien"}
              </DialogTitle>
              <DialogDescription>
                {editingId ? (form.nom || "Technicien") : "Remplissez les informations de la personne"}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
            {/* Identité */}
            <section className="space-y-3 rounded-xl border p-3 sm:p-4">
              <h3 className="text-sm font-semibold">Identité</h3>
              <div className="space-y-1.5">
                <Label htmlFor="tech-nom">Nom *</Label>
                <Input
                  id="tech-nom"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  className="h-11 text-base sm:h-10 sm:text-sm"
                  autoComplete="off"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Niveau technicien</Label>
                  <Select value={form.niveau_technicien} onValueChange={(v) => setForm({ ...form, niveau_technicien: v })}>
                    <SelectTrigger className="h-11 sm:h-10"><SelectValue placeholder="Optionnel" /></SelectTrigger>
                    <SelectContent>
                      {enums.niveaux_technicien?.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Niveau d'accès *</Label>
                  <Select value={form.niveau_acces} onValueChange={(v) => setForm({ ...form, niveau_acces: v })}>
                    <SelectTrigger className="h-11 sm:h-10"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {enums.niveaux_acces?.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Coordonnées */}
            <section className="space-y-3 rounded-xl border p-3 sm:p-4">
              <h3 className="text-sm font-semibold">Coordonnées</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tech-tel">Téléphone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="tech-tel" type="tel" inputMode="tel" autoComplete="off" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="h-11 pl-9 text-base sm:h-10 sm:text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tech-mail">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="tech-mail" type="email" inputMode="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 pl-9 text-base sm:h-10 sm:text-sm" />
                  </div>
                </div>
              </div>
            </section>

            {/* Branches : pastilles à toucher */}
            <section className="space-y-3 rounded-xl border p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Pôles * <span className="font-normal text-muted-foreground">(Captation, Régisseurs, Animation, Incrustation, Diffusion font partie du Live)</span></h3>
                <span className="text-xs text-muted-foreground">{form.branches.length} choisie(s)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {
                  // Un Responsable/Coordination scopé à une ou plusieurs branches
                  // (User.branches) ne peut créer/éditer que dans son propre
                  // périmètre — le backend le refuse aussi (tâche #292).
                  (!isAdminOrReadOnly() && user?.branches?.length
                    ? POLES.filter((p) => user.branches.includes(p) || (user.branches.includes("Live") && LIVE_POLES.includes(p)))
                    : POLES
                  ).map((b) => {
                    const c = getBranchColor(b);
                    const on = form.branches.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleBranche(b)}
                        className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition ${on ? `${c.bg} ${c.text} ${c.border} ring-2 ring-primary/40` : "hover:bg-muted"}`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                        {b}
                        {on && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })
                }
              </div>
            </section>

            {/* Postes : sert à filtrer les noms proposés dans le Planning */}
            <section className="space-y-3 rounded-xl border p-3 sm:p-4">
              <h3 className="text-sm font-semibold">Postes</h3>
              <div className="space-y-1.5">
                <Label>Poste principal</Label>
                <Select
                  value={form.poste_principal || "__none__"}
                  onValueChange={(v) => setForm({ ...form, poste_principal: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger className="h-11 sm:h-10"><SelectValue placeholder="Optionnel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {enums.postes?.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Postes secondaires</Label>
                <div className="flex flex-wrap gap-2">
                  {enums.postes?.filter((p) => p !== form.poste_principal).map((p) => {
                    const on = form.postes_secondaires.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        onClick={() => togglePosteSecondaire(p)}
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-sm transition ${on ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40" : "hover:bg-muted"}`}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                        {p}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Dans le Planning, la liste des noms proposée pour un poste ne montre que les personnes ayant ce poste en principal ou secondaire.
                </p>
              </div>
              {isGestionnairePlus() && (
                <div className="space-y-1.5 border-t pt-3">
                  <Label htmlFor="tech-orga">Étiquette dans l'organigramme (optionnel)</Label>
                  <Input
                    id="tech-orga"
                    value={form.organigramme_label}
                    onChange={(e) => setForm({ ...form, organigramme_label: e.target.value })}
                    placeholder={form.poste_principal || "Par défaut : poste principal"}
                    className="h-11 text-base sm:h-10 sm:text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Petit badge affiché à côté du nom dans l'organigramme du Dashboard. Laissez vide pour reprendre le poste principal.
                  </p>
                </div>
              )}
            </section>

            {/* Badge */}
            <label
              htmlFor="badge"
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 sm:p-4"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <IdCard className="h-4 w-4 text-muted-foreground" /> Badge attribué
              </span>
              <Checkbox
                id="badge"
                checked={form.badge_attribue}
                onCheckedChange={(checked) => setForm({ ...form, badge_attribue: checked })}
                className="h-6 w-6"
              />
            </label>
          </div>

          <div
            className="flex gap-2 border-t bg-background px-4 py-3 sm:justify-end sm:px-6"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <Button type="button" variant="outline" className="h-11 flex-1 sm:h-10 sm:flex-none" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Annuler
            </Button>
            <Button type="submit" className="h-11 flex-1 sm:h-10 sm:flex-none sm:min-w-[160px]" disabled={submitting} data-testid="tech-save-btn">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

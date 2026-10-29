import { TabsContent } from '../../components/ui/tabs';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Plus, Loader2, Search, Key, Trash2 } from 'lucide-react';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { NIVEAUX_ACCES } from './constants';
import { ServiceAppsCard } from './ServiceAppsCard';

export function UsersTab({
  createKioskAccount,
  currentUser,
  editingUser,
  generateKioskPassword,
  getNiveauAccesColor,
  handleDeleteUser,
  handleToggleUserStatus,
  handleUserSubmit,
  isGestionnaireOnly,
  isReadOnlyAdmin,
  isSuperAdmin,
  kioskCreated,
  kioskDialogOpen,
  kioskForm,
  kioskSubmitting,
  loading,
  setEditingUser,
  setKioskCreated,
  setKioskDialogOpen,
  setKioskForm,
  setNewPassword,
  setResetPasswordDialogOpen,
  setSelectedUserForReset,
  setUserDetailOpen,
  setUserDialogOpen,
  setUserForm,
  setUserLevelFilter,
  setUserSearch,
  submitting,
  userDialogOpen,
  userForm,
  userLevelFilter,
  userSearch,
  users,
}) {
  // Comptes d'appareils (tablette, incrustation) : Super Admin et Admin (droit « Comptes d'appareils » côté serveur).
  const canDevices = ['Super Admin', 'Admin'].includes(currentUser?.niveau_acces);
  return (
    <TabsContent value="users" className="space-y-4">
      {!isReadOnlyAdmin && (
        <div className="flex flex-wrap justify-end gap-2">
          <Dialog
            open={userDialogOpen}
            onOpenChange={(open) => {
              setUserDialogOpen(open);
              if (!open) {
                setUserForm({
                  username: "",
                  password: "",
                  full_name: "",
                  niveau_acces: "",
                });
                setEditingUser(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button data-testid="add-user-btn">
                <Plus className="w-4 h-4 mr-2" /> Nouvel utilisateur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Modifier" : "Créer"} un utilisateur
                </DialogTitle>
                <DialogDescription>
                  {editingUser
                    ? "Modifiez les informations"
                    : "Ajoutez un nouveau compte"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Identifiant *</Label>
                  <Input
                    value={userForm.username}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        username: e.target.value,
                      })
                    }
                    required
                    data-testid="user-username"
                  />
                  {editingUser && (
                    <p className="text-xs text-muted-foreground">
                      Attention : changer l'identifiant modifie le nom
                      utilisé pour se connecter.
                    </p>
                  )}
                </div>
                {!editingUser && (
                  <div className="space-y-2">
                    <Label>Mot de passe *</Label>
                    <Input
                      type="password"
                      value={userForm.password}
                      onChange={(e) =>
                        setUserForm({
                          ...userForm,
                          password: e.target.value,
                        })
                      }
                      required
                      data-testid="user-password"
                    />
                    <p className="text-xs text-muted-foreground">
                      L'utilisateur devra le modifier à la première
                      connexion
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Nom complet *</Label>
                  <Input
                    value={userForm.full_name}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        full_name: e.target.value,
                      })
                    }
                    required
                    data-testid="user-fullname"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Niveau d'accès *</Label>
                  <Select
                    value={userForm.niveau_acces}
                    onValueChange={(v) =>
                      setUserForm({ ...userForm, niveau_acces: v })
                    }
                  >
                    <SelectTrigger data-testid="user-niveau">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 20/08/2026 (#298) : la Coordination ne peut pas
créer/promouvoir un compte Admin ou Super Admin
(assert_coordination_user_mgmt_scope côté
serveur) — la liste proposée ici reflète cette
même limite pour éviter un 403 après coup. */}
                      {(isGestionnaireOnly
                        ? NIVEAUX_ACCES.filter(
                            (n) =>
                              ![
                                "Admin (lecture seule)",
                                "Admin",
                                "Super Admin",
                              ].includes(n),
                          )
                        : NIVEAUX_ACCES
                      ).map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {editingUser && (
                  <label className="flex items-start gap-2 text-sm" data-testid="user-songs-access">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4"
                      checked={userForm.songs_access !== false}
                      onChange={(e) => setUserForm({ ...userForm, songs_access: e.target.checked })}
                    />
                    <span>
                      Accès à CEC Songs
                      <span className="block text-xs text-muted-foreground">Connexion unique depuis PAV Manager (décochez pour retirer l'accès à cette personne).</span>
                    </span>
                  </label>
                )}
                {editingUser && (
                  <label className="flex items-start gap-2 text-sm" data-testid="user-portal-only">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4"
                      checked={!!userForm.portal_only}
                      onChange={(e) => setUserForm({ ...userForm, portal_only: e.target.checked })}
                    />
                    <span>
                      Vue PAV Manager verrouillée
                      <span className="block text-xs text-muted-foreground">La personne ne voit que le portail (PAV LED, CEC Songs, Recherche Biblique) avec « PAV Manager sera disponible prochainement pour vous ». Décochez pour lui ouvrir PAV Manager.</span>
                    </span>
                  </label>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                  data-testid="user-submit"
                >
                  {submitting && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingUser ? "Modifier" : "Créer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {(() => {
        const q = userSearch.trim().toLowerCase();
        const searched = users.filter((u) => {
          if (!q) return true;
          return (
            (u.username || "").toLowerCase().includes(q) ||
            (u.full_name || "").toLowerCase().includes(q) ||
            (u.niveau_acces || "").toLowerCase().includes(q)
          );
        });
        // Les comptes tablette forment leur propre catégorie (pas « Responsable »).
        const SERVICE = "Comptes de service";
        const groupOf = (u) => (u.kiosk_mode ? SERVICE : u.niveau_acces);
        const countOf = (n) =>
          searched.filter((u) => groupOf(u) === n).length;
        const levelsDesc = [...NIVEAUX_ACCES].reverse().concat([SERVICE]);
        const shownLevels = levelsDesc.filter(
          (n) =>
            (userLevelFilter === "all" || userLevelFilter === n) &&
            countOf(n) > 0,
        );
        return (
          <>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="pl-9"
              />
            </div>

            {/* Filtre par niveau : pastilles avec le nombre de comptes */}
            <div className="flex flex-wrap gap-2" data-testid="user-level-chips">
              {[["all", "Tous", searched.length]]
                .concat(
                  levelsDesc
                    .filter((n) => countOf(n) > 0)
                    .map((n) => [n, n, countOf(n)]),
                )
                .map(([value, label, n]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setUserLevelFilter(value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                      userLevelFilter === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {label}
                    <span
                      className={`rounded-full px-1.5 text-xs ${
                        userLevelFilter === value
                          ? "bg-white/25"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {n}
                    </span>
                  </button>
                ))}
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              </div>
            ) : shownLevels.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Aucun utilisateur trouvé.
              </p>
            ) : (
              shownLevels.map((niveau) => (
                <section key={niveau} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        niveau === SERVICE
                          ? "bg-slate-200 text-slate-800"
                          : getNiveauAccesColor(niveau)
                      }
                    >
                      {niveau}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {countOf(niveau)}
                    </span>
                  </div>
                  {countOf(niveau) > 4 ? (
                    /* Plus de 4 comptes dans la catégorie : vue compacte en liste dense, défilante, au lieu d'un mur de cartes */
                    <div
                      className={`grid gap-1 overflow-y-auto rounded-xl border bg-card p-1.5 sm:grid-cols-2 xl:grid-cols-3 ${
                        userLevelFilter === niveau ? "max-h-[70vh]" : "max-h-64"
                      }`}
                      data-testid={`user-list-compact-${niveau}`}
                    >
                      {searched
                        .filter((u) => groupOf(u) === niveau)
                        .map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setUserDetailOpen(u)}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-muted ${u.is_active ? "" : "opacity-60"}`}
                          >
                            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {u.full_name?.charAt(0)}
                              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${u.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{u.full_name || u.username}</span>
                            {u.id === currentUser?.id && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Vous</Badge>}
                            {!u.is_active && <Badge className="bg-red-100 px-1.5 py-0 text-[10px] text-red-800">Inactif</Badge>}
                          </button>
                        ))}
                    </div>
                  ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {searched
                      .filter((u) => groupOf(u) === niveau)
                      .map((u) => {
                        const isProtected = [
                          "Guichard",
                          "svc-ops-s5xf3f",
                        ].includes(u.username);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setUserDetailOpen(u)}
                            className={`flex items-center gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition hover:bg-muted/50 hover:shadow ${
                              u.is_active ? "" : "opacity-60"
                            }`}
                          >
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <span className="text-primary font-semibold">
                                {u.full_name?.charAt(0)}
                              </span>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                                  u.is_active ? "bg-emerald-500" : "bg-red-500"
                                }`}
                                title={u.is_active ? "Actif" : "Inactif"}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium leading-tight">
                                {u.full_name || u.username}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {u.username}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {u.kiosk_mode && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Tablette
                                  </Badge>
                                )}
                                {u.id === currentUser?.id && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    Vous
                                  </Badge>
                                )}
                                {isProtected && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0"
                                    title="Compte protégé — ne peut pas être supprimé, désactivé ou rétrogradé"
                                  >
                                    Protégé
                                  </Badge>
                                )}
                                {!u.is_active && (
                                  <Badge className="bg-red-100 text-red-800 text-[10px] px-1.5 py-0">
                                    Inactif
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                  )}
                </section>
              ))
            )}
          </>
        );
      })()}
      {canDevices && !isReadOnlyAdmin && (
        <Card data-testid="service-accounts-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" /> Comptes de service
            </CardTitle>
            <CardDescription>
              Comptes partagés par un appareil, sans personne derrière.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {users
              .filter((u) => u.kiosk_mode)
              .map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {u.full_name}{" "}
                      <Badge variant="secondary">Tablette</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Identifiant : {u.username} · Entrées / Sorties
                      uniquement · session permanente
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUserForReset(u);
                        setNewPassword("");
                        setResetPasswordDialogOpen(true);
                      }}
                    >
                      <Key className="w-4 h-4 mr-1" /> Définir le mot de passe
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleUserStatus(u)}
                      data-testid="kiosk-toggle-active"
                    >
                      {u.is_active ? "Désactiver" : "Activer"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => handleDeleteUser(u.id)}
                      data-testid="kiosk-delete"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                    </Button>
                    <Badge
                      className={
                        u.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {u.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </div>
              ))}
            {kioskCreated && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">
                  Compte créé — notez ces identifiants maintenant, le
                  mot de passe ne sera plus affiché :
                </p>
                <p>
                  Identifiant : <b>{kioskCreated.username}</b>
                </p>
                <p>
                  Mot de passe : <b>{kioskCreated.password}</b>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setKioskCreated(null)}
                >
                  J'ai noté
                </Button>
              </div>
            )}
            <Dialog open={kioskDialogOpen} onOpenChange={setKioskDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="add-kiosk-account-btn">
                  <Plus className="w-4 h-4 mr-2" /> Compte tablette iPad
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Compte « Régisseurs iPad »</DialogTitle>
                  <DialogDescription>
                    Compte partagé de la tablette des régisseurs : la
                    session ne se déconnecte jamais et seule la vue
                    Entrées / Sorties est accessible. Au démarrage, la
                    tablette demande quel régisseur l'utilise.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Identifiant</Label>
                    <Input
                      value={kioskForm.username}
                      onChange={(e) =>
                        setKioskForm({ ...kioskForm, username: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mot de passe (8 caractères minimum)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={kioskForm.password}
                        onChange={(e) =>
                          setKioskForm({ ...kioskForm, password: e.target.value })
                        }
                      />
                      <Button type="button" variant="outline" onClick={generateKioskPassword}>
                        Générer
                      </Button>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={createKioskAccount}
                    disabled={kioskSubmitting || kioskForm.password.length < 8}
                  >
                    {kioskSubmitting && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Créer le compte tablette
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
      {canDevices && !isReadOnlyAdmin && <ServiceAppsCard />}
    </TabsContent>
  );
}

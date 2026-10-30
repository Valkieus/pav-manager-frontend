import { TabsContent } from '../../components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { AlertTriangle, Trash2, Loader2, Timer, FlaskConical } from 'lucide-react';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Input } from '../../components/ui/input';
import { MAINTENANCE_PAGES, MAINTENANCE_ROLES } from './constants';
import { PortalLockCard } from './PortalLockCard';
import { BasketValidatorsCard } from './BasketValidatorsCard';

export function MaintenanceTab({
  handleAddMaintenanceEntry,
  handleRemoveMaintenanceEntry,
  handleRetardToggle,
  handleTestModeToggle,
  handleToggleRetardRecipient,
  handleToggleTestUser,
  isAdmin,
  isSuperAdmin,
  maintenanceAffectedRoles,
  maintenanceEntries,
  maintenanceLoading,
  maintenanceMessage,
  maintenancePagePath,
  maintenanceScope,
  retardEnabled,
  retardLoading,
  retardNotifyUserIds,
  retardRecipientsSaving,
  setMaintenanceMessage,
  setMaintenancePagePath,
  setMaintenanceScope,
  setTestModeUserQuery,
  testModeEnabled,
  testModeLoading,
  testModeSaving,
  testModeUserIds,
  testModeUserQuery,
  toggleMaintenanceRole,
  users,
}) {
  return (
    <TabsContent value="maintenance" className="space-y-4">
      <PortalLockCard users={users} canEdit={isSuperAdmin()} />
      <BasketValidatorsCard users={users} canEdit={isSuperAdmin() || isAdmin()} />
<Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Mode Maintenance
          </CardTitle>
          <CardDescription>
            Activez une ou plusieurs maintenances en même temps (le site
            entier, ou des pages différentes en parallèle) pour bloquer
            l'accès pendant les travaux — chaque activation a son propre
            message et peut être retirée indépendamment des autres.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Liste des activations en cours */}
          <div className="space-y-2">
            <Label>Activations en cours ({maintenanceEntries.length})</Label>
            {maintenanceEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 border rounded-lg border-dashed">
                Aucune maintenance active en ce moment.
              </p>
            ) : (
              <div className="space-y-2">
                {maintenanceEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">
                          {entry.scope === "page"
                            ? `Page "${MAINTENANCE_PAGES.find((p) => p.path === entry.page_path)?.label || entry.page_path}"`
                            : "Site complet"}
                        </p>
                        {entry.message && (
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            {entry.message}
                          </p>
                        )}
                        <p className="text-xs text-yellow-700/80 dark:text-yellow-300/80">
                          Activé par {entry.activated_by} le{" "}
                          {entry.activated_at
                            ? new Date(entry.activated_at).toLocaleString("fr-FR")
                            : "-"}
                          {" — "}
                          Rôles impactés :{" "}
                          {entry.affected_roles && entry.affected_roles.length > 0
                            ? entry.affected_roles.join(", ")
                            : "tout le monde (sous Super Admin)"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!isSuperAdmin() || maintenanceLoading}
                      onClick={() => handleRemoveMaintenanceEntry(entry.id)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-4">
            <Label className="text-base">Ajouter une nouvelle activation</Label>

            <div className="space-y-2">
              <Label>Portée de la maintenance</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMaintenanceScope("site")}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${
                    maintenanceScope === "site"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-sm">Site complet</p>
                  <p className="text-xs text-muted-foreground">
                    Bloque l'accès à toute l'application pour les
                    Techniciens
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setMaintenanceScope("page")}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${
                    maintenanceScope === "page"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-sm">Une seule page</p>
                  <p className="text-xs text-muted-foreground">
                    Bloque uniquement la page choisie ci-dessous — vous
                    pouvez répéter l'opération pour plusieurs pages
                    différentes
                  </p>
                </button>
              </div>

              {maintenanceScope === "page" && (
                <Select
                  value={maintenancePagePath}
                  onValueChange={setMaintenancePagePath}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choisir une page" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_PAGES.map((p) => (
                      <SelectItem key={p.path} value={p.path}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Qui est impacté par cette maintenance</Label>
              <p className="text-xs text-muted-foreground">
                Par défaut, tout le monde en dessous de Super Admin est
                impacté. Cochez des rôles précis pour restreindre la
                maintenance à ces rôles uniquement — Super Admin n'est
                jamais impacté.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MAINTENANCE_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={!isSuperAdmin()}
                    onClick={() => toggleMaintenanceRole(role)}
                    className={`text-sm p-2 rounded-lg border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      maintenanceAffectedRoles.includes(role)
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {maintenanceAffectedRoles.length > 0
                  ? `Maintenance restreinte à : ${maintenanceAffectedRoles.join(", ")}`
                  : "Aucun rôle spécifique sélectionné — tout le monde en dessous de Super Admin sera impacté"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Message affiché aux membres</Label>
              <Textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="Ex: Maintenance en cours. Nous revenons bientôt !"
                rows={3}
              />
            </div>

            <Button
              onClick={handleAddMaintenanceEntry}
              disabled={maintenanceLoading || !isSuperAdmin()}
            >
              {maintenanceLoading && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Activer cette maintenance
            </Button>
          </div>

          {/* Preview */}
          <div className="space-y-2 border-t pt-4">
            <Label>Aperçu de la page maintenance</Label>
            <div className="border rounded-lg p-8 text-center bg-muted/30">
              <AlertTriangle className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
              <h2 className="text-xl font-bold mb-2">
                Maintenance en cours
              </h2>
              <p className="text-muted-foreground">
                {maintenanceMessage ||
                  "Nous effectuons une maintenance. Veuillez réessayer plus tard."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="w-5 h-5" />
            Signalement de retard
          </CardTitle>
          <CardDescription>
            Quand c'est activé, chaque personne planifiée voit un bouton
            "Je vais être en retard" sur son jour de service (Dashboard).
            L'envoi notifie le/la superviseur du jour (selon le planning),
            le Responsable PAV et les Responsables Coordination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">
                Activer le signalement de retard
              </p>
              <p className="text-sm text-muted-foreground">
                {retardEnabled
                  ? "Le bouton est visible pour les personnes planifiées aujourd'hui."
                  : "Le bouton est masqué pour tout le monde."}
              </p>
            </div>
            <Switch
              checked={retardEnabled}
              onCheckedChange={handleRetardToggle}
              disabled={retardLoading || !isAdmin()}
            />
          </div>

          <div className="space-y-2 mt-4">
            <Label>Destinataires toujours notifiés (Coordination+)</Label>
            <p className="text-xs text-muted-foreground">
              En plus du/de la superviseur du jour (déduit automatiquement
              du planning). Tant qu'aucun n'est coché ici, Paul Baptista,
              Delphine et Winchel sont notifiés par défaut.
            </p>
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
              {users
                .filter((u) =>
                  [
                    "Coordination",
                    "Admin (lecture seule)",
                    "Admin",
                    "Super Admin",
                  ].includes(u.niveau_acces),
                )
                .sort((a, b) =>
                  (a.full_name || "").localeCompare(b.full_name || ""),
                )
                .map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  >
                    <span>
                      {u.full_name}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({u.niveau_acces})
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={retardNotifyUserIds.includes(u.id)}
                      onChange={() => handleToggleRetardRecipient(u.id)}
                      disabled={retardRecipientsSaving || !isAdmin()}
                      className="h-4 w-4"
                    />
                  </label>
                ))}
              {users.filter((u) =>
                [
                  "Coordination",
                  "Admin (lecture seule)",
                  "Admin",
                  "Super Admin",
                ].includes(u.niveau_acces),
              ).length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                  Aucun compte Coordination+ trouvé
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Mode test
          </CardTitle>
          <CardDescription>
            Permet à des comptes désignés ici de tester les
            fonctionnalités qui dépendent normalement du jour réel (ex :
            le bouton "Signaler un retard", visible d'ordinaire seulement
            le jour où on est planifié). Pour un compte testeur, ce bouton
            devient visible n'importe quel jour tant que le signalement de
            retard est activé ci-dessus. Le reste du comportement
            (notifications envoyées, logs) fonctionne normalement — c'est
            un vrai test de bout en bout. Retire un testeur ou coupe le
            mode entier à tout moment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">Activer le mode test</p>
              <p className="text-sm text-muted-foreground">
                {testModeEnabled
                  ? `Actif pour ${testModeUserIds.length} compte(s) testeur(s).`
                  : "Désactivé — personne n'a d'accès de test."}
              </p>
            </div>
            <Switch
              checked={testModeEnabled}
              onCheckedChange={handleTestModeToggle}
              disabled={testModeLoading || !isAdmin()}
            />
          </div>

          <div className="space-y-2 mt-4">
            <Label>Comptes testeurs</Label>
            {testModeUserIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {testModeUserIds.map((uid) => {
                  const u = users.find((x) => x.id === uid);
                  return (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                      {u ? u.full_name : uid}
                      <button
                        type="button"
                        onClick={() => handleToggleTestUser(uid)}
                        disabled={testModeSaving || !isAdmin()}
                        className="hover:text-destructive"
                        title="Retirer ce testeur"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <Input
              placeholder="Rechercher un compte à ajouter comme testeur..."
              value={testModeUserQuery}
              onChange={(e) => setTestModeUserQuery(e.target.value)}
              className="mt-2"
            />
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
              {users
                .filter(
                  (u) =>
                    !testModeUserQuery ||
                    (u.full_name || "")
                      .toLowerCase()
                      .includes(testModeUserQuery.toLowerCase()),
                )
                .sort((a, b) =>
                  (a.full_name || "").localeCompare(b.full_name || ""),
                )
                .map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  >
                    <span>
                      {u.full_name}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({u.niveau_acces})
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={testModeUserIds.includes(u.id)}
                      onChange={() => handleToggleTestUser(u.id)}
                      disabled={testModeSaving || !isAdmin()}
                      className="h-4 w-4"
                    />
                  </label>
                ))}
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                  Aucun compte trouvé
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

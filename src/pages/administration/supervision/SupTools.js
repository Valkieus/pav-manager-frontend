import { Power, Trash, Loader2, FileArchive, Activity, Bell, AlertTriangle, Database, RefreshCw, Download, Eye, HardDrive, History, BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { SUPERVISED_COLLECTIONS_FRONT, SUPERVISED_COLLECTIONS_LABELS } from '../constants';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/table';

export function SupTools({
  allowlistAddUserId,
  allowlistBusy,
  canPurgeAllLogs,
  cleanupBusy,
  entityError,
  entityExporting,
  entityLoading,
  entitySelected,
  entitySnapshot,
  exportCollection,
  exportFormat,
  exporting,
  fetchEntitySnapshot,
  formatBytes,
  handleAddAllowlistUser,
  handleCleanupLogs,
  handleCleanupNotifications,
  handleClearBrowserCache,
  handleConfirmOrphanedCleanup,
  handleExportData,
  handleExportEntityXlsx,
  handlePreviewOrphanedFiles,
  handlePurgeAllLogsNow,
  handlePurgeAllNotificationsNow,
  handleRemoveAllowlistUser,
  isOwnerAccount,
  isSuperAdmin,
  logPurgeAllowlist,
  orphanPreview,
  purgeAllBusy,
  purgeAllDialogOpen,
  purgeAllNotifBusy,
  purgeAllNotifDialogOpen,
  setAllowlistAddUserId,
  setEntitySelected,
  setExportCollection,
  setExportFormat,
  setOrphanPreview,
  setPurgeAllDialogOpen,
  setPurgeAllNotifDialogOpen,
  setRestartDialogOpen,
  systemStatus,
  users,
}) {
  return (
    <>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 pt-1">
          <Power className="w-3.5 h-3.5" /> Nettoyage & actions
        </h3>

        {/* Nettoyage & maintenance */}
        <Card>
          <CardHeader>
            <CardTitle>Nettoyage & maintenance</CardTitle>
            <CardDescription>
              Dernier nettoyage automatique des logs :{" "}
              {systemStatus.last_logs_purge
                ? systemStatus.last_logs_purge
                : "jamais"}{" "}
              · notifications :{" "}
              {systemStatus.last_notifications_purge
                ? systemStatus.last_notifications_purge
                : "jamais"}
              . Un nettoyage automatique des logs et notifications de
              plus de 1 mois tourne aussi chaque début de mois.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-border space-y-2">
              <p className="font-medium text-sm flex items-center gap-2">
                <Trash className="w-4 h-4" /> Cache navigateur
              </p>
              <p className="text-xs text-muted-foreground">
                Vide le cache local de l'app dans ce navigateur et
                recharge la page.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearBrowserCache}
                disabled={cleanupBusy === "cache"}
              >
                {cleanupBusy === "cache" && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Vider le cache
              </Button>
            </div>
            <div className="p-3 rounded-lg border border-border space-y-2">
              <p className="font-medium text-sm flex items-center gap-2">
                <FileArchive className="w-4 h-4" /> Fichiers orphelins
              </p>
              <p className="text-xs text-muted-foreground">
                Fichiers uploadés qui ne sont plus reliés à aucune
                actualité ou document.
              </p>
              {orphanPreview ? (
                <div className="text-xs space-y-1">
                  <p>
                    {orphanPreview.count} fichier(s),{" "}
                    {formatBytes(orphanPreview.total_bytes)}
                  </p>
                  {(orphanPreview.files || []).length > 0 && (
                    <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
                      {orphanPreview.files.map((f) => {
                        const url = `${process.env.REACT_APP_BACKEND_URL}/api/uploads/${f.id}`;
                        const isImg = /\.(png|jpe?g|gif|webp)$/i.test(f.id);
                        return (
                          <a
                            key={f.id}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-2 hover:bg-muted/50"
                          >
                            {isImg ? (
                              <img
                                src={url}
                                alt=""
                                loading="lazy"
                                className="w-10 h-10 rounded object-cover bg-muted shrink-0"
                              />
                            ) : (
                              <span className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                                <FileArchive className="w-4 h-4" />
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {f.name || f.id}
                              </span>
                              <span className="block text-muted-foreground">
                                {formatBytes(f.size || 0)}
                                {f.date
                                  ? ` · ${new Date(f.date).toLocaleDateString("fr-FR")}`
                                  : ""}
                              </span>
                            </span>
                            <span className="text-primary shrink-0">Voir</span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                  {orphanPreview.count > (orphanPreview.files || []).length && (
                    <p className="text-muted-foreground">
                      Liste limitée aux {orphanPreview.files.length} premiers fichiers.
                    </p>
                  )}
                  {orphanPreview.count > 0 ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleConfirmOrphanedCleanup}
                        disabled={
                          cleanupBusy === "orphan-delete" ||
                          !isSuperAdmin()
                        }
                        title={
                          !isSuperAdmin()
                            ? "Réservé à Super Admin (configurable dans Droits d'accès)"
                            : undefined
                        }
                      >
                        {cleanupBusy === "orphan-delete" && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Confirmer suppression
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOrphanPreview(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePreviewOrphanedFiles}
                  disabled={cleanupBusy === "orphan-preview"}
                >
                  {cleanupBusy === "orphan-preview" && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Vérifier
                </Button>
              )}
            </div>
            <div className="p-3 rounded-lg border border-border space-y-2">
              <p className="font-medium text-sm flex items-center gap-2">
                <Activity className="w-4 h-4" /> Logs (+1 mois)
              </p>
              <p className="text-xs text-muted-foreground">
                Purge manuelle immédiate des journaux d'activité de plus
                de 1 mois.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCleanupLogs}
                disabled={cleanupBusy === "logs" || !isSuperAdmin()}
                title={
                  !isSuperAdmin()
                    ? "Réservé à Super Admin (configurable dans Droits d'accès)"
                    : undefined
                }
              >
                {cleanupBusy === "logs" && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Nettoyer maintenant
              </Button>
            </div>

            <div className="p-3 rounded-lg border border-border space-y-2">
              <p className="font-medium text-sm flex items-center gap-2">
                <Bell className="w-4 h-4" /> Notifications (+1 mois)
              </p>
              <p className="text-xs text-muted-foreground">
                Purge manuelle immédiate des notifications reçues de
                plus de 1 mois.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCleanupNotifications}
                disabled={
                  cleanupBusy === "notifications" || !isSuperAdmin()
                }
                title={
                  !isSuperAdmin()
                    ? "Réservé à Super Admin (configurable dans Droits d'accès)"
                    : undefined
                }
              >
                {cleanupBusy === "notifications" && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Nettoyer maintenant
              </Button>
            </div>

            {isSuperAdmin() && (
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 space-y-2">
                <p className="font-medium text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />{" "}
                  Logs — purge totale immédiate
                </p>
                <p className="text-xs text-muted-foreground">
                  Supprime tout l'historique des logs, y compris le
                  dernier mois. Irréversible.
                  {!canPurgeAllLogs &&
                    " Réservé au titulaire du compte, ou aux comptes qu'il autorise explicitement."}
                </p>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setPurgeAllDialogOpen(true)}
                  disabled={!canPurgeAllLogs}
                  title={
                    !canPurgeAllLogs
                      ? "Réservé au titulaire du compte, ou aux comptes qu'il autorise"
                      : undefined
                  }
                >
                  Purger toutes les logs
                </Button>
              </div>
            )}

            {isSuperAdmin() && (
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 space-y-2">
                <p className="font-medium text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />{" "}
                  Notifications — purge totale immédiate
                </p>
                <p className="text-xs text-muted-foreground">
                  Supprime toutes les notifications de tous les comptes,
                  y compris le dernier mois. Irréversible.
                  {!canPurgeAllLogs &&
                    " Réservé au titulaire du compte, ou aux comptes qu'il autorise explicitement."}
                </p>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setPurgeAllNotifDialogOpen(true)}
                  disabled={!canPurgeAllLogs}
                  title={
                    !canPurgeAllLogs
                      ? "Réservé au titulaire du compte, ou aux comptes qu'il autorise"
                      : undefined
                  }
                >
                  Purger toutes les notifications
                </Button>
              </div>
            )}

            {isOwnerAccount && (
              <div className="p-3 rounded-lg border border-border space-y-2">
                <p className="font-medium text-sm">
                  Qui peut purger toutes les logs
                </p>
                <p className="text-xs text-muted-foreground">
                  Visible uniquement par toi. Ajoute les comptes Super
                  Admin que tu autorises à utiliser la purge totale.
                </p>
                <div className="space-y-1">
                  {(logPurgeAllowlist || []).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Personne d'autre n'est autorisé pour le moment.
                    </p>
                  )}
                  {(logPurgeAllowlist || []).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5"
                    >
                      <span>{u.full_name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveAllowlistUser(u.id)}
                        disabled={allowlistBusy}
                      >
                        Retirer
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Select
                    value={allowlistAddUserId}
                    onValueChange={setAllowlistAddUserId}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choisir un Super Admin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter(
                          (u) =>
                            u.niveau_acces === "Super Admin" &&
                            u.username !== "Guichard" &&
                            !(logPurgeAllowlist || []).some(
                              (a) => a.id === u.id,
                            ),
                        )
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleAddAllowlistUser}
                    disabled={!allowlistAddUserId || allowlistBusy}
                  >
                    Autoriser
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation purge totale des logs */}
        <Dialog
          open={purgeAllDialogOpen}
          onOpenChange={setPurgeAllDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Purger tout l'historique des logs ?
              </DialogTitle>
              <DialogDescription>
                Cette action supprime définitivement TOUS les journaux
                d'activité, y compris le dernier mois habituellement
                conservé. Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPurgeAllDialogOpen(false)}
                disabled={purgeAllBusy}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handlePurgeAllLogsNow}
                disabled={purgeAllBusy}
              >
                {purgeAllBusy && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Purger définitivement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation purge totale des notifications */}
        <Dialog
          open={purgeAllNotifDialogOpen}
          onOpenChange={setPurgeAllNotifDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Purger toutes les notifications ?
              </DialogTitle>
              <DialogDescription>
                Cette action supprime définitivement TOUTES les
                notifications de tous les comptes, y compris le dernier
                mois habituellement conservé. Cette action est
                irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPurgeAllNotifDialogOpen(false)}
                disabled={purgeAllNotifBusy}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handlePurgeAllNotificationsNow}
                disabled={purgeAllNotifBusy}
              >
                {purgeAllNotifBusy && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Purger définitivement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Supervision par entité : snapshot / export / visualisation (#579) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" /> Par entité
            </CardTitle>
            <CardDescription>
              Sélectionne une entité pour voir un aperçu de son état
              actuel, l'exporter en Excel, ou visualiser sa
              répartition.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label>Entité</Label>
                <Select
                  value={entitySelected}
                  onValueChange={setEntitySelected}
                >
                  <SelectTrigger className="w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPERVISED_COLLECTIONS_FRONT.map((c) => (
                      <SelectItem key={c} value={c}>
                        {SUPERVISED_COLLECTIONS_LABELS[c] || c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => fetchEntitySnapshot(entitySelected)}
                disabled={entityLoading}
              >
                {entityLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Actualiser
              </Button>
              <Button
                onClick={handleExportEntityXlsx}
                disabled={entityExporting}
              >
                {entityExporting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                <Download className="w-4 h-4 mr-2" />
                Exporter en Excel
              </Button>
            </div>

            {entityLoading && !entitySnapshot && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Chargement de l'aperçu…
              </div>
            )}

            {entityError && (
              <div className="text-sm text-destructive flex items-center gap-2 py-2">
                <AlertTriangle className="w-4 h-4" /> {entityError}
              </div>
            )}

            {entitySnapshot && !entityError && (
              <>
                {/* Snapshot */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Documents
                    </div>
                    <div className="text-lg font-semibold">
                      {entitySnapshot.count}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <HardDrive className="w-3 h-3" /> Taille
                    </div>
                    <div className="text-lg font-semibold">
                      {formatBytes(entitySnapshot.size_bytes)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <History className="w-3 h-3" /> Dernière modif.
                      connue
                    </div>
                    <div className="text-sm font-medium">
                      {entitySnapshot.last_modified
                        ? new Date(
                            entitySnapshot.last_modified,
                          ).toLocaleString("fr-FR")
                        : "Non disponible"}
                    </div>
                  </div>
                </div>

                {/* Visualisation : répartition par champ catégoriel connu */}
                {entitySnapshot.breakdown_by_field?.counts?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> Répartition par{" "}
                      {entitySnapshot.breakdown_by_field.field}
                    </div>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={entitySnapshot.breakdown_by_field.counts}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-muted"
                          />
                          <XAxis
                            dataKey="value"
                            className="text-xs"
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis className="text-xs" allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar
                            dataKey="count"
                            fill="#001DF3"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Échantillon */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    Aperçu — {entitySnapshot.sample_shown} sur{" "}
                    {entitySnapshot.count} élément(s)
                  </div>
                  <div className="max-h-[320px] overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(entitySnapshot.sample[0] || {})
                            .slice(0, 6)
                            .map((k) => (
                              <TableHead key={k}>{k}</TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entitySnapshot.sample.map((row, i) => (
                          <TableRow key={i}>
                            {Object.keys(entitySnapshot.sample[0] || {})
                              .slice(0, 6)
                              .map((k) => (
                                <TableCell
                                  key={k}
                                  className="max-w-[220px] truncate text-xs"
                                >
                                  {typeof row[k] === "object"
                                    ? JSON.stringify(row[k])
                                    : String(row[k] ?? "")}
                                </TableCell>
                              ))}
                          </TableRow>
                        ))}
                        {entitySnapshot.sample.length === 0 && (
                          <TableRow>
                            <TableCell className="text-center text-muted-foreground py-4">
                              Aucune donnée
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Export de données */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" /> Export de données
            </CardTitle>
            <CardDescription>
              Télécharge une catégorie de données au format CSV ou JSON.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <Select
                value={exportCollection}
                onValueChange={setExportCollection}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPERVISED_COLLECTIONS_FRONT.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Format</Label>
              <Select
                value={exportFormat}
                onValueChange={setExportFormat}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExportData} disabled={exporting}>
              {exporting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Télécharger
            </Button>
          </CardContent>
        </Card>

        {/* Redémarrage du serveur */}
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <Power className="w-5 h-5" /> Redémarrage du serveur
            </CardTitle>
            <CardDescription>
              Redémarre le serveur backend. L'application sera
              indisponible environ 30 à 60 secondes. À utiliser
              seulement si nécessaire (ex : le serveur semble bloqué).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setRestartDialogOpen(true)}
              disabled={!isSuperAdmin()}
              title={
                !isSuperAdmin()
                  ? "Réservé à Super Admin (configurable dans Droits d'accès)"
                  : undefined
              }
            >
              <Power className="w-4 h-4 mr-2" /> Redémarrer le serveur
            </Button>
          </CardContent>
        </Card>
    </>
  );
}

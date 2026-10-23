import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../constants';
import { ExtraStorageCard } from '../../../components/SupervisionExtras';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Cloud, Loader2, Download, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/button';

function OracleOption({ dataBackup, isSuperAdmin }) {
  const [on, setOn] = useState(!!dataBackup?.oracle_toujours);
  if (!dataBackup?.oracle_disponible) return null;
  const toggle = async (v) => {
    try {
      await axios.put(`${API}/admin/infra/data-backup/oracle`, null, { params: { enabled: v } });
      setOn(v);
      toast.success(v ? 'Oracle : copie à chaque sauvegarde' : 'Oracle : seulement en repli');
    } catch (e) { toast.error(e.response?.data?.detail || 'Échec'); }
  };
  return (
    <label className="flex items-start gap-2 text-xs">
      <input type="checkbox" className="mt-0.5" checked={on} disabled={!isSuperAdmin()} onChange={(e) => toggle(e.target.checked)} data-testid="backup-oracle-option" />
      <span>Copier aussi chaque sauvegarde sur <strong>Oracle</strong> <span className="text-muted-foreground">(sinon Oracle n'intervient qu'en repli, si la copie Europe ou États-Unis échoue)</span></span>
    </label>
  );
}

export function SupBackup({
  dataBacking,
  dataBackup,
  fillLabel,
  formatBytes,
  handleDataBackupNow,
  handlePlanningFillOctobre,
  handlePlanningRepair,
  handleR2BackupCloudinary,
  handleSnapDownload,
  handleSnapRestore,
  isSuperAdmin,
  loadSnapDates,
  patchSnap,
  r2Backing,
  r2Status,
  snapSel,
}) {
  return (
    <>
    <ExtraStorageCard />
    {/* PRA / PCA : copie Cloudflare R2 */}
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud className="w-5 h-5" /> Copie de secours PRA/PCA (Cloudflare R2)
        </CardTitle>
        <CardDescription>
          Troisième fournisseur, indépendant de Backblaze et de Cloudinary (10 Go gratuits, sans frais de téléchargement).
          Chaque fichier envoyé sur B2 y est copié automatiquement ; lecture de secours si B2 tombe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!r2Status ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : !r2Status.enabled ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">{r2Status.message}</p>
        ) : r2Status.error ? (
          <p className="text-xs text-red-500">{r2Status.error}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Connecté au bucket <span className="font-medium text-foreground">{r2Status.bucket}</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Espace utilisé</p>
                <p className="text-sm font-bold">{r2Status.used_bytes != null ? `${formatBytes(r2Status.used_bytes)} / 10 Go` : "—"}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Fichiers copiés</p>
                <p className="text-sm font-bold">{r2Status.object_count ?? "—"}</p>
              </div>
            </div>
            {r2Status.used_bytes != null && (
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div
                  className={`h-full ${r2Status.used_bytes / r2Status.free_bytes >= 0.75 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (r2Status.used_bytes / r2Status.free_bytes) * 100)}%` }}
                />
              </div>
            )}
            {r2Status.used_bytes != null && r2Status.used_bytes / r2Status.free_bytes >= 0.9 && (
              <p className="text-[11px] text-muted-foreground">
                R2 n'est plus utilisé pour les sauvegardes de données (elles sont sur B2 Europe + États-Unis) : c'est sans danger. Le nettoyage quotidien
                (Maintenance) libère cet espace petit à petit.
              </p>
            )}
            {r2Status.backup_cloudinary && (
              <p className="text-xs text-muted-foreground">
                {r2Status.backup_cloudinary.running
                  ? `Copie des médias Cloudinary en cours : ${r2Status.backup_cloudinary.done} / ${r2Status.backup_cloudinary.total}`
                  : r2Status.backup_cloudinary.finished_at
                    ? `Dernière copie des médias Cloudinary : ${r2Status.backup_cloudinary.copied} nouveau(x) fichier(s)`
                    : "Médias Cloudinary : pas encore copiés"}
              </p>
            )}
            {r2Status.backup_cloudinary?.errors?.length > 0 && (
              <ul className="text-[11px] text-amber-600 dark:text-amber-500 list-disc pl-4 space-y-0.5">
                {r2Status.backup_cloudinary.errors.slice(0, 5).map((e, i) => (<li key={i}>{e}</li>))}
              </ul>
            )}
            {isSuperAdmin() && (
              <Button size="sm" variant="outline" onClick={handleR2BackupCloudinary} disabled={r2Backing || r2Status.backup_cloudinary?.running}>
                {(r2Backing || r2Status.backup_cloudinary?.running) && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Copier les médias Cloudinary vers R2
              </Button>
            )}
          </>
        )}
        {dataBackup && (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-sm font-semibold">Sauvegardes des données (Planning, Régisseurs, Communication)</p>
            <p className="text-[11px] text-muted-foreground">
              {dataBackup.planning ? `${dataBackup.planning} · ` : ""}Copiées sur {dataBackup.stockages?.join(", ") || "aucun stockage"} · {dataBackup.retention}.
            </p>
            <OracleOption dataBackup={dataBackup} isSuperAdmin={isSuperAdmin} />
            <ul className="space-y-2 text-xs">
              {Object.entries(dataBackup.domaines || {}).map(([name, d]) => (
                <li key={name} className="rounded-lg bg-muted/40 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium capitalize">{name}</span>
                    <span className="text-muted-foreground">
                      {d.last_ok ? new Date(d.last_ok).toLocaleString("fr-FR") : "pas encore sauvegardé"}
                      {d.counts && Object.keys(d.counts).length ? ` · ${Object.values(d.counts).reduce((a, b) => a + b, 0)} fiches` : ""}
                    </span>
                  </div>
                  {d.targets?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {d.targets.map((t) => (
                        <span
                          key={t.cible}
                          title={t.erreur || "Copie réussie"}
                          className={`rounded-full px-2 py-0.5 text-[11px] ${t.ok ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-500"}`}
                        >
                          {t.ok ? "✓" : "✗"} {t.cible}
                        </span>
                      ))}
                    </div>
                  )}
                  {isSuperAdmin() && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <select
                        className="h-7 rounded-md border border-input bg-background px-2 text-[11px]"
                        value={snapSel[name]?.source || "auto"}
                        onChange={(e) => loadSnapDates(name, e.target.value)}
                        aria-label="Stockage"
                      >
                        <option value="auto">Stockage : automatique</option>
                        {(dataBackup.stockages || []).map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                      <select
                        className="h-7 rounded-md border border-input bg-background px-2 text-[11px]"
                        value={snapSel[name]?.date || "latest"}
                        onFocus={() => { if (!(snapSel[name]?.dates || []).length) loadSnapDates(name, snapSel[name]?.source || "auto"); }}
                        onChange={(e) => patchSnap(name, { date: e.target.value })}
                        aria-label="Date de la sauvegarde"
                      >
                        <option value="latest">Dernière sauvegarde</option>
                        {(snapSel[name]?.dates || []).filter((x) => x !== "latest").map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!snapSel[name]?.busy} onClick={() => handleSnapDownload(name)}>
                        {snapSel[name]?.busy === "download" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />} Télécharger
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!snapSel[name]?.busy} onClick={() => handleSnapRestore(name)}>
                        {snapSel[name]?.busy === "restore" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />} Restaurer les fiches manquantes
                      </Button>
                      {name === "planning" && (
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!snapSel[name]?.busy} onClick={handlePlanningRepair}>
                          {snapSel[name]?.busy === "repair" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />} Réparer les cases du planning
                        </Button>
                      )}
                      {name === "planning" && (
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!snapSel[name]?.busy} onClick={handlePlanningFillOctobre}>
                          {snapSel[name]?.busy === "fill" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />} Remplir {fillLabel}
                        </Button>
                      )}
                    </div>
                  )}
                  {d.warning && <p className="mt-1 text-amber-600">{d.warning}</p>}
                  {d.last_error && (
                    <p className="mt-1 text-red-500">
                      {d.last_error} — nouvel essai automatique toutes les heures ; une copie de secours reste dans la base.
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {isSuperAdmin() && (
              <Button size="sm" variant="outline" onClick={handleDataBackupNow} disabled={dataBacking}>
                {dataBacking && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Sauvegarder maintenant
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}

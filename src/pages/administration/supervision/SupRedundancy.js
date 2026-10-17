import { HardDrive, Cloud, Loader2, CheckCircle2, XCircle, ArrowLeftRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';

export function SupRedundancy({
  b2Backfilling,
  b2LimitInputs,
  b2LimitsSaving,
  b2MirrorToggling,
  b2Status,
  b2StatusLoading,
  formatBytes,
  handleB2Backfill,
  handleB2MirrorToggle,
  handleSaveB2Limit,
  isSuperAdmin,
  setB2LimitInputs,
  setB2ToggleDialogOpen,
}) {
  return (
    <>
    {/* SECTION : REDONDANCE DU STOCKAGE (Backblaze B2) */}
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 pt-1">
      <HardDrive className="w-3.5 h-3.5" /> Redondance du stockage
    </h3>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" /> Redondance stockage (Backblaze
            B2)
          </CardTitle>
          <CardDescription>
            Chaque fichier (photos badge, documents, images actualités)
            est envoyé sur tous les comptes configurés à chaque fois —
            la bascule change seulement lequel est lu en premier parmi
            principal/secours, pas où les données existent. Tous les
            comptes restent gratuits (10 Go chacun, sans carte).
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={handleB2Backfill}
          disabled={b2Backfilling || !isSuperAdmin()}
          title={
            !isSuperAdmin()
              ? "Réservé à Super Admin (configurable dans Droits d'accès)"
              : "Copie les fichiers déjà présents sur un compte vers les comptes qui ne les ont pas encore"
          }
        >
          {b2Backfilling && (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          )}
          Backfill fichiers existants
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {b2StatusLoading && !b2Status ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : !b2Status ? (
          <p className="text-sm text-muted-foreground">
            Aucune donnée pour le moment
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {["primary", "backup"].map((acctKey) => {
                const acct = b2Status[acctKey];
                const label =
                  acctKey === "primary"
                    ? "Compte principal"
                    : "Compte de secours";
                return (
                  <div
                    key={acctKey}
                    className="p-4 rounded-lg border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{label}</p>
                      <div className="flex items-center gap-1.5">
                        {acct.active && (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">
                            Actif
                          </Badge>
                        )}
                        {acct.configured ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    {!acct.configured ? (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        {acct.message}
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground truncate">
                          Bucket{" "}
                          <span className="font-medium text-foreground">
                            {acct.bucket}
                          </span>
                          {" · "}
                          {acct.region}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="text-[10px] text-muted-foreground">
                              Utilisé
                            </p>
                            <p className="text-sm font-bold">
                              {formatBytes(acct.used_bytes)}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="text-[10px] text-muted-foreground">
                              Limite
                            </p>
                            <p className="text-sm font-bold">
                              {acct.limit_gb
                                ? `${acct.limit_gb} Go`
                                : "—"}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="text-[10px] text-muted-foreground">
                              %
                            </p>
                            <p className="text-sm font-bold">
                              {acct.percent_used != null
                                ? `${acct.percent_used}%`
                                : "—"}
                            </p>
                          </div>
                        </div>
                        {acct.message && (
                          <p className="text-xs text-red-500">
                            {acct.message}
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <Input
                            type="number"
                            min="0"
                            placeholder="Limite en Go"
                            className="h-8 text-sm"
                            value={b2LimitInputs[acctKey]}
                            onChange={(e) =>
                              setB2LimitInputs((prev) => ({
                                ...prev,
                                [acctKey]: e.target.value,
                              }))
                            }
                            disabled={!isSuperAdmin()}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveB2Limit(acctKey)}
                            disabled={
                              b2LimitsSaving === acctKey ||
                              !isSuperAdmin()
                            }
                            title={
                              !isSuperAdmin()
                                ? "Réservé à Super Admin (configurable dans Droits d'accès)"
                                : undefined
                            }
                          >
                            {b2LimitsSaving === acctKey ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              "Définir"
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <p className="font-medium text-sm">
                  Copie automatique vers les comptes de secours
                </p>
                <p className="text-xs text-muted-foreground">
                  Activée par défaut : chaque nouveau fichier est copié
                  partout dès l'upload. Si désactivée, un fichier n'est
                  écrit que sur le compte actif — utilisez "Backfill
                  fichiers existants" pour rattraper manuellement ce qui
                  a été stocké entre-temps.
                </p>
              </div>
              <Switch
                checked={!!b2Status.mirroring_enabled}
                onCheckedChange={handleB2MirrorToggle}
                disabled={b2MirrorToggling || !isSuperAdmin()}
                title={
                  !isSuperAdmin()
                    ? "Réservé à Super Admin (configurable dans Droits d'accès)"
                    : undefined
                }
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Compte actif actuellement :{" "}
                <span className="font-medium text-foreground">
                  {b2Status.active_account === "primary"
                    ? "Compte principal"
                    : "Compte de secours"}
                </span>
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setB2ToggleDialogOpen(true)}
                disabled={
                  !b2Status.redundancy_enabled || !isSuperAdmin()
                }
                title={
                  !isSuperAdmin()
                    ? "Réservé à Super Admin (configurable dans Droits d'accès)"
                    : undefined
                }
              >
                <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />{" "}
                Basculer
              </Button>
            </div>

            {b2Status.tertiary && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">
                  Compte géo-redondant (région distincte — protège
                  contre un incident propre à la région EU des deux
                  comptes ci-dessus). Toujours écrit en miroir, mais ne
                  participe pas à la bascule.
                </p>
                <div className="p-4 rounded-lg border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">
                      Compte géo-redondant (US)
                    </p>
                    <div className="flex items-center gap-1.5">
                      {b2Status.tertiary.configured && (
                        <Badge variant="secondary">Géo</Badge>
                      )}
                      {b2Status.tertiary.configured ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  {!b2Status.tertiary.configured ? (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      {b2Status.tertiary.message}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground truncate">
                        Bucket{" "}
                        <span className="font-medium text-foreground">
                          {b2Status.tertiary.bucket}
                        </span>
                        {" · "}
                        {b2Status.tertiary.region}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground">
                            Utilisé
                          </p>
                          <p className="text-sm font-bold">
                            {formatBytes(b2Status.tertiary.used_bytes)}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground">
                            Limite
                          </p>
                          <p className="text-sm font-bold">
                            {b2Status.tertiary.limit_gb
                              ? `${b2Status.tertiary.limit_gb} Go`
                              : "—"}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground">
                            %
                          </p>
                          <p className="text-sm font-bold">
                            {b2Status.tertiary.percent_used != null
                              ? `${b2Status.tertiary.percent_used}%`
                              : "—"}
                          </p>
                        </div>
                      </div>
                      {b2Status.tertiary.message && (
                        <p className="text-xs text-red-500">
                          {b2Status.tertiary.message}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          type="number"
                          min="0"
                          placeholder="Limite en Go"
                          className="h-8 text-sm"
                          value={b2LimitInputs.tertiary}
                          onChange={(e) =>
                            setB2LimitInputs((prev) => ({
                              ...prev,
                              tertiary: e.target.value,
                            }))
                          }
                          disabled={!isSuperAdmin()}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveB2Limit("tertiary")}
                          disabled={
                            b2LimitsSaving === "tertiary" ||
                            !isSuperAdmin()
                          }
                          title={
                            !isSuperAdmin()
                              ? "Réservé à Super Admin (configurable dans Droits d'accès)"
                              : undefined
                          }
                        >
                          {b2LimitsSaving === "tertiary" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Définir"
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
    </>
  );
}

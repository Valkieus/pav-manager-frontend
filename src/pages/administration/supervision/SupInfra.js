import { Cloud, Loader2, Server, CheckCircle2, XCircle, GitBranch, RotateCcw, History, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';

export function SupInfra({
  formatUptime,
  handleNetlifyRestore,
  handleRenderRedeploy,
  infraStatus,
  infraStatusLoading,
  isSuperAdmin,
  netlifyDeploys,
  netlifyDeploysLoading,
  netlifyDeploysOpen,
  netlifyRestoringId,
  renderDeploys,
  renderDeploysLoading,
  renderDeploysOpen,
  renderRedeployDialogOpen,
  renderRedeploying,
  setRenderRedeployDialogOpen,
  toggleNetlifyDeploys,
  toggleRenderDeploys,
}) {
  return (
    <>
    {/* SECTION : INFRASTRUCTURE — backend (Render) + frontend (Netlify), en direct */}
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 pt-1">
      <Cloud className="w-3.5 h-3.5" /> Infrastructure
    </h3>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="w-5 h-5" /> Infrastructure
        </CardTitle>
        <CardDescription>
          État en direct des services qui font tourner l'application :
          le serveur (Render), le site (Netlify) et la base de données
          ci-dessous.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {infraStatusLoading && !infraStatus ? (
          <div className="p-6 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          </div>
        ) : !infraStatus ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Aucune donnée pour le moment
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Backend / Render */}
            <div className="p-4 rounded-lg border border-border space-y-2">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary shrink-0" />
                <p className="font-medium text-sm flex-1">
                  Backend (Render)
                </p>
                {infraStatus.backend?.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {infraStatus.backend?.ok
                  ? "En ligne"
                  : "Problème détecté"}
                {" · "}
                {infraStatus.backend?.region}
                {typeof infraStatus.backend?.response_time_ms ===
                  "number" &&
                  ` · ${infraStatus.backend.response_time_ms} ms`}
              </p>
              <p className="text-xs text-muted-foreground">
                Actif depuis{" "}
                {formatUptime(infraStatus.backend?.uptime_seconds || 0)}
              </p>

              {infraStatus.render?.configured === false ? (
                <p className="text-xs text-amber-600 dark:text-amber-500 pt-1 border-t border-border mt-2">
                  {infraStatus.render.message}
                </p>
              ) : infraStatus.render?.error ? (
                <p className="text-xs text-red-500 pt-1 border-t border-border mt-2">
                  {infraStatus.render.error}
                </p>
              ) : infraStatus.render ? (
                <div className="pt-2 border-t border-border mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Service{" "}
                    <span className="font-medium text-foreground">
                      {infraStatus.render.name}
                    </span>
                    {infraStatus.render.plan &&
                      ` · plan ${infraStatus.render.plan}`}
                  </p>
                  {infraStatus.render.latest_deploy_status && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <GitBranch className="w-3 h-3 shrink-0" />
                      Dernier déploiement :{" "}
                      {infraStatus.render.latest_deploy_status}
                      {infraStatus.render.latest_deploy_at &&
                        ` · ${new Date(infraStatus.render.latest_deploy_at).toLocaleString("fr-FR")}`}
                    </p>
                  )}
                  {infraStatus.render.latest_deploy_commit && (
                    <p className="text-xs text-muted-foreground truncate">
                      {infraStatus.render.latest_deploy_commit}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRenderRedeployDialogOpen(true)}
                      disabled={!isSuperAdmin()}
                      title={
                        !isSuperAdmin()
                          ? "Réservé à Super Admin"
                          : undefined
                      }
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{" "}
                      Redéployer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={toggleRenderDeploys}
                    >
                      <History className="w-3.5 h-3.5 mr-1.5" />{" "}
                      Historique
                      {renderDeploysOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 ml-1" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 ml-1" />
                      )}
                    </Button>
                  </div>

                  {renderDeploysOpen && (
                    <div className="pt-2 space-y-1.5">
                      {renderDeploysLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : renderDeploys?.length ? (
                        renderDeploys.map((d) => (
                          <div
                            key={d.id}
                            className="text-xs bg-muted/50 rounded px-2 py-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">
                                {d.status}
                              </span>
                              <span className="text-muted-foreground">
                                {d.finished_at
                                  ? new Date(
                                      d.finished_at,
                                    ).toLocaleString("fr-FR")
                                  : ""}
                              </span>
                            </div>
                            {d.commit_message && (
                              <p className="text-muted-foreground truncate">
                                {d.commit_message}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Aucun déploiement trouvé.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Frontend / Netlify */}
            <div className="p-4 rounded-lg border border-border space-y-2">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-primary shrink-0" />
                <p className="font-medium text-sm flex-1">
                  Frontend (Netlify)
                </p>
                {infraStatus.netlify?.configured &&
                  (infraStatus.netlify?.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  ))}
              </div>

              {infraStatus.netlify?.configured === false ? (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {infraStatus.netlify.message}
                </p>
              ) : infraStatus.netlify?.error ? (
                <p className="text-xs text-red-500">
                  {infraStatus.netlify.error}
                </p>
              ) : infraStatus.netlify ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Site{" "}
                    <span className="font-medium text-foreground">
                      {infraStatus.netlify.name}
                    </span>
                    {" · "}
                    {infraStatus.netlify.state}
                  </p>
                  {infraStatus.netlify.latest_deploy_state && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <GitBranch className="w-3 h-3 shrink-0" />
                      Dernier déploiement :{" "}
                      {infraStatus.netlify.latest_deploy_state}
                      {infraStatus.netlify.latest_deploy_at &&
                        ` · ${new Date(infraStatus.netlify.latest_deploy_at).toLocaleString("fr-FR")}`}
                    </p>
                  )}
                  {infraStatus.netlify.latest_deploy_title && (
                    <p className="text-xs text-muted-foreground truncate">
                      {infraStatus.netlify.latest_deploy_title}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={toggleNetlifyDeploys}
                    >
                      <History className="w-3.5 h-3.5 mr-1.5" />{" "}
                      Historique
                      {netlifyDeploysOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 ml-1" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 ml-1" />
                      )}
                    </Button>
                  </div>

                  {netlifyDeploysOpen && (
                    <div className="pt-2 space-y-1.5">
                      {netlifyDeploysLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : netlifyDeploys?.length ? (
                        netlifyDeploys.map((d) => (
                          <div
                            key={d.id}
                            className="text-xs bg-muted/50 rounded px-2 py-1.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {d.state}
                                </span>
                                {d.is_current && (
                                  <span className="text-emerald-600 dark:text-emerald-500">
                                    · en ligne
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground truncate">
                                {d.title || ""}
                                {d.created_at &&
                                  ` · ${new Date(d.created_at).toLocaleString("fr-FR")}`}
                              </p>
                            </div>
                            {!d.is_current && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0"
                                onClick={() =>
                                  handleNetlifyRestore(d.id)
                                }
                                disabled={
                                  netlifyRestoringId === d.id ||
                                  !isSuperAdmin()
                                }
                                title={
                                  !isSuperAdmin()
                                    ? "Réservé à Super Admin"
                                    : undefined
                                }
                              >
                                {netlifyRestoringId === d.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  "Restaurer"
                                )}
                              </Button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Aucun déploiement trouvé.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Confirmation redéploiement Render */}
    <Dialog
      open={renderRedeployDialogOpen}
      onOpenChange={setRenderRedeployDialogOpen}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redéployer le backend ?</DialogTitle>
          <DialogDescription>
            Render va relancer un déploiement à partir du dernier
            commit. Le service reste accessible pendant le build ; une
            brève coupure (quelques secondes) peut survenir au moment du
            basculement, comme pour tout déploiement normal.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setRenderRedeployDialogOpen(false)}
            disabled={renderRedeploying}
          >
            Annuler
          </Button>
          <Button
            onClick={handleRenderRedeploy}
            disabled={renderRedeploying}
          >
            {renderRedeploying && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Redéployer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

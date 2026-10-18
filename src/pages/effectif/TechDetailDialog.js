import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { IdCard, Phone, Mail, Loader2, Download, Check, X, Archive, Trash2, Edit, FileText } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useEffect, useState } from 'react';
import { BadgeWizard } from './BadgeWizard';
import { SHEET_CLASS, getBranchColor } from './constants';

export function TechDetailDialog({
  badgeReadOnly,
  autoOpenWizard,
  setAutoOpenWizard,
  badgeActionBusy,
  badgeDetail,
  badgeDetailLoading,
  canManage,
  canManageBadges,
  exportingFichePdf,
  getAccesColor,
  getBadgeStatusInfo,
  getNiveauColor,
  handleArchive,
  handleArchiveBadge,
  handleCloseDetail,
  handleCollectBadge,
  handleConfirmBadge,
  handleDelete,
  handleDeleteBadge,
  handleEdit,
  handleExportFichePdf,
  handleRejectBadge,
  isAdmin,
  isSuperAdmin,
  rejectMessage,
  rejectingBadge,
  selectedTech,
  setRejectMessage,
  setRejectingBadge,
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  // Arrivée depuis la vue « Badges » : on ouvre directement validation + badge dès que le détail est chargé.
  useEffect(() => {
    if (autoOpenWizard && badgeDetail?.badge_photo_url) {
      setWizardOpen(true);
      setAutoOpenWizard(false);
    }
  }, [autoOpenWizard, badgeDetail, setAutoOpenWizard]);
  return (
    <>
    <Dialog open={!!selectedTech} onOpenChange={handleCloseDetail}>
      <DialogContent className={SHEET_CLASS} data-testid="tech-detail-dialog">
        {selectedTech && (() => {
          const t = selectedTech;
          const bc = getBranchColor((t.branches || [])[0]);
          return (
            <>
              <div className={`${bc.bg} px-4 pb-4 pt-5 sm:px-6`}>
                <DialogHeader className="space-y-0 text-left">
                  <DialogTitle className="flex items-center gap-3 pr-8">
                    <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-background/70 text-2xl font-bold shadow-sm ${bc.text}`}>
                      {(t.nom || "?").charAt(0)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xl font-bold leading-tight">{t.nom}</span>
                      <span className="block truncate text-sm font-normal text-foreground/70">
                        {t.poste_principal || "Poste non renseigné"}
                      </span>
                    </span>
                  </DialogTitle>
                  <DialogDescription className="sr-only">Fiche de {t.nom}</DialogDescription>
                </DialogHeader>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.niveau_technicien && <Badge className={`${getNiveauColor(t.niveau_technicien)} border-0`}>{t.niveau_technicien}</Badge>}
                  <Badge variant="outline" className="flex items-center gap-1 bg-background/60">
                    <span className={`h-2 w-2 rounded-full ${getAccesColor(t.niveau_acces)}`} />
                    {t.niveau_acces}
                  </Badge>
                  <Badge variant="outline" className={`flex items-center gap-1 bg-background/60 ${t.badge_attribue ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
                    <IdCard className="h-3 w-3" /> {t.badge_attribue ? "Badge attribué" : "Sans badge"}
                  </Badge>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                {/* Joindre la personne en un geste */}
                <div className="grid grid-cols-2 gap-2">
                  {t.telephone ? (
                    <a href={`tel:${t.telephone}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm active:scale-[0.98]">
                      <Phone className="h-4 w-4" /> Appeler
                    </a>
                  ) : (
                    <span className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground"><Phone className="h-4 w-4" /> Pas de numéro</span>
                  )}
                  {t.email ? (
                    <a href={`mailto:${t.email}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold hover:bg-muted active:scale-[0.98]">
                      <Mail className="h-4 w-4" /> Écrire
                    </a>
                  ) : (
                    <span className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground"><Mail className="h-4 w-4" /> Pas d'email</span>
                  )}
                </div>

                <section className="space-y-2 rounded-xl border p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coordonnées</h3>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Téléphone</dt><dd className="truncate font-medium">{t.telephone || "—"}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Email</dt><dd className="truncate font-medium">{t.email || "—"}</dd></div>
                  </dl>
                </section>

                <section className="space-y-2 rounded-xl border p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Branches</h3>
                  {(t.branches || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune branche</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {t.branches.map((b) => {
                        const c = getBranchColor(b);
                        return (
                          <span key={b} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${c.bg} ${c.text} ${c.border}`}>
                            <span className={`h-2 w-2 rounded-full ${c.dot}`} />{b}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="space-y-2 rounded-xl border p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Postes</h3>
                  {!t.poste_principal && (t.postes_secondaires || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun poste renseigné</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {t.poste_principal && <Badge className="border border-primary/30 bg-primary/10 text-primary">{t.poste_principal}</Badge>}
                      {(t.postes_secondaires || []).map((p) => (<Badge key={p} variant="secondary">{p}</Badge>))}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <IdCard className="w-4 h-4" /> Badge
                  </p>
                  {!canManageBadges() && (
                    <Badge
                      className={
                        selectedTech.badge_attribue
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : ""
                      }
                      variant={
                        selectedTech.badge_attribue ? undefined : "outline"
                      }
                    >
                      {selectedTech.badge_attribue
                        ? "Attribué"
                        : "Non attribué"}
                    </Badge>
                  )}
                </div>

                {!canManageBadges() ? null : badgeDetailLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
                  </div>
                ) : (
                  badgeDetail && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className={
                            getBadgeStatusInfo(badgeDetail.badge_status).color
                          }
                        >
                          {getBadgeStatusInfo(badgeDetail.badge_status).label}
                        </Badge>
                        {badgeDetail.badge_is_renewal && (
                          <Badge variant="outline">Renouvellement</Badge>
                        )}
                        {badgeDetail.badge_archived && (
                          <Badge variant="outline">Archivée</Badge>
                        )}
                      </div>

                      {badgeDetail.badge_photo_url && (
                        <Button size="sm" className="w-full" onClick={() => setWizardOpen(true)} data-testid="open-badge-wizard">
                          <IdCard className="w-4 h-4 mr-1" /> Validation &amp; badge (aperçu, PNG, PDF)
                        </Button>
                      )}

                      {badgeDetail.badge_photo_url && (
                        <div className="flex items-center gap-3">
                          <img
                            src={`${process.env.REACT_APP_BACKEND_URL}${badgeDetail.badge_photo_url}`}
                            alt="Photo badge"
                            className="w-16 h-16 rounded-lg object-cover border"
                          />
                          <a
                            href={`${process.env.REACT_APP_BACKEND_URL}${badgeDetail.badge_photo_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> Voir /
                            télécharger
                          </a>
                        </div>
                      )}

                      {badgeDetail.badge_message && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          Motif du dernier refus : {badgeDetail.badge_message}
                        </p>
                      )}

                      {badgeDetail.badge_status === "en_attente_validation" && !badgeReadOnly &&
                        (rejectingBadge ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full text-sm border rounded-md p-2 bg-background"
                              rows={2}
                              placeholder="Motif du refus (envoyé au technicien)..."
                              value={rejectMessage}
                              onChange={(e) =>
                                setRejectMessage(e.target.value)
                              }
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={badgeActionBusy}
                                onClick={handleRejectBadge}
                              >
                                {badgeActionBusy && (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                )}
                                Confirmer le refus
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setRejectingBadge(false);
                                  setRejectMessage("");
                                }}
                              >
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              disabled={badgeActionBusy}
                              onClick={handleConfirmBadge}
                            >
                              {badgeActionBusy && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}
                              <Check className="w-4 h-4 mr-1" /> Valider la
                              photo
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={() => setRejectingBadge(true)}
                            >
                              <X className="w-4 h-4 mr-1" /> Refuser
                            </Button>
                          </div>
                        ))}

                      {badgeDetail.badge_status === "pret_a_recuperer" && !badgeReadOnly && (
                        <Button
                          size="sm"
                          disabled={badgeActionBusy}
                          onClick={handleCollectBadge}
                        >
                          {badgeActionBusy && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          <IdCard className="w-4 h-4 mr-1" /> Marquer comme
                          remis
                        </Button>
                      )}

                      {badgeDetail.badge_status && !badgeReadOnly && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={badgeActionBusy}
                            onClick={() =>
                              handleArchiveBadge(!badgeDetail.badge_archived)
                            }
                          >
                            <Archive className="w-3.5 h-3.5 mr-1" />{" "}
                            {badgeDetail.badge_archived
                              ? "Désarchiver"
                              : "Archiver"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={badgeActionBusy}
                            onClick={handleDeleteBadge}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

                </section>
              </div>

              {/* Actions toujours visibles en bas */}
              <div
                className="flex flex-wrap items-center gap-2 border-t bg-background px-4 py-3 sm:px-6"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                {canManage() && (
                  <Button className="h-11 flex-1 sm:h-10" onClick={() => handleEdit(t)} data-testid="tech-edit-btn">
                    <Edit className="mr-2 h-4 w-4" /> Modifier
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="h-11 sm:h-10"
                  disabled={exportingFichePdf}
                  onClick={handleExportFichePdf}
                  data-testid="effectif-fiche-export-pdf-btn"
                  title="Exporter la fiche (PDF)"
                >
                  {exportingFichePdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">PDF</span>
                </Button>
                {canManage() && isAdmin() && (
                  <Button variant="outline" className="h-11 sm:h-10" onClick={() => handleArchive(t.id)} title="Archiver">
                    <Archive className="h-4 w-4" />
                  </Button>
                )}
                {canManage() && isSuperAdmin() && (
                  <Button variant="destructive" size="icon" className="h-11 w-11 sm:h-10 sm:w-10" onClick={() => handleDelete(t.id)} title="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          );
        })()}
    {selectedTech && (
      <BadgeWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        tech={selectedTech}
        readOnly={badgeReadOnly}
        badgeDetail={badgeDetail}
        badgeActionBusy={badgeActionBusy}
        handleConfirmBadge={handleConfirmBadge}
        handleRejectBadge={handleRejectBadge}
        rejectMessage={rejectMessage}
        setRejectMessage={setRejectMessage}
      />
    )}
      </DialogContent>
    </Dialog>
    </>
  );
}

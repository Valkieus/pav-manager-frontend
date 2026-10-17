import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Card, CardContent } from '../../components/ui/card';
import { GraduationCap, Loader2, Plus, Archive, BookOpen, UserX, XCircle, CheckCircle2, Users, ShieldCheck, Calendar as CalendarIcon, Clock, UserCheck, MapPin, Star, Edit, ArrowRight, Trash2 } from 'lucide-react';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

export function FormationsTabs({
  Stepper,
  activeSuggestions,
  activeTab,
  archivedSuggestions,
  catalogue,
  filteredFormations,
  getStatusBadge,
  handleArchive,
  handleArchiveSuggestion,
  handleDelete,
  handleEdit,
  handleExpressInterest,
  handleFinalValidate,
  handleSuggestFormation,
  handleSuggestionStatus,
  handleToggleCatalogue,
  handleUnarchiveSuggestion,
  handleWithdrawSuggestion,
  isAdmin,
  isConsole,
  isCoordination,
  isCoordinationWrite,
  isDirection,
  isDirectionWrite,
  isSuperAdmin,
  loading,
  mySuggestions,
  openCoordDialog,
  originBadge,
  pendingCoordinationCount,
  pendingDirectionCount,
  pendingSuggestionsCount,
  setActiveTab,
  setRejectTarget,
  setShowArchivedSuggestions,
  setSuggDescription,
  setSuggTitre,
  showArchivedSuggestions,
  suggDescription,
  suggSubmitting,
  suggTitre,
  user,
}) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="space-y-6"
    >
      <TabsList className="flex-wrap h-auto">
        {isConsole ? (
          <>
            {isCoordination && (
              <TabsTrigger value="a_traiter" data-testid="tab-a-traiter">
                À traiter
                {pendingCoordinationCount > 0
                  ? ` (${pendingCoordinationCount})`
                  : ""}
              </TabsTrigger>
            )}
            {isDirection && (
              <TabsTrigger value="a_valider" data-testid="tab-a-valider">
                À valider
                {pendingDirectionCount > 0
                  ? ` (${pendingDirectionCount})`
                  : ""}
              </TabsTrigger>
            )}
            <TabsTrigger value="validees" data-testid="tab-validees">
              Validées
            </TabsTrigger>
            <TabsTrigger value="refusees" data-testid="tab-refusees">
              Refusées
            </TabsTrigger>
            <TabsTrigger value="toutes" data-testid="tab-toutes">
              Toutes
            </TabsTrigger>
            <TabsTrigger value="suggestions" data-testid="tab-suggestions">
              Suggestions
              {pendingSuggestionsCount > 0
                ? ` (${pendingSuggestionsCount})`
                : ""}
            </TabsTrigger>
            {(isAdmin() || isSuperAdmin()) && (
              <TabsTrigger value="archivees" data-testid="tab-archivees">
                Archivées
              </TabsTrigger>
            )}
          </>
        ) : (
          <>
            <TabsTrigger value="mes_demandes" data-testid="tab-mes-demandes">
              Mes demandes
            </TabsTrigger>
            <TabsTrigger value="catalogue" data-testid="tab-catalogue">
              Catalogue
            </TabsTrigger>
          </>
        )}
      </TabsList>

      <TabsContent value={activeTab} className="space-y-6 mt-0">
        {activeTab === "catalogue" ? (
          <div className="space-y-5">
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-3">
                <p className="font-medium flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  Suggérer un sujet de formation
                </p>
                <form onSubmit={handleSuggestFormation} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Intitulé *</Label>
                      <Input
                        value={suggTitre}
                        onChange={(e) => setSuggTitre(e.target.value)}
                        placeholder="Ex: Étalonnage avancé"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description (optionnel)</Label>
                      <Input
                        value={suggDescription}
                        onChange={(e) => setSuggDescription(e.target.value)}
                        placeholder="Pourquoi cette formation vous intéresse..."
                      />
                    </div>
                  </div>
                  <Button type="submit" size="sm" disabled={suggSubmitting}>
                    {suggSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Envoyer la suggestion
                  </Button>
                </form>
                {mySuggestions.filter((s) => !s.formation_id).length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    {mySuggestions
                      .filter((s) => !s.formation_id)
                      .map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 text-xs text-muted-foreground border rounded-lg px-3 py-1.5"
                        >
                          <span>{s.titre}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={
                                s.statut === "Approuvée"
                                  ? "text-emerald-600"
                                  : s.statut === "Rejetée"
                                    ? "text-red-600"
                                    : "text-amber-600"
                              }
                            >
                              {s.statut}
                            </span>
                            {s.statut === "En attente" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleWithdrawSuggestion(s.id)}
                              >
                                Retirer
                              </Button>
                            )}
                            {s.statut !== "En attente" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleArchiveSuggestion(s.id)}
                              >
                                <Archive className="w-3 h-3 mr-1" /> Archiver
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Formations disponibles
              </p>
              {catalogue.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      Aucune formation au catalogue pour le moment
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catalogue.map((f) => {
                    const mySugg = mySuggestions.find(
                      (s) => s.formation_id === f.id,
                    );
                    return (
                      <Card key={f.id}>
                        <CardContent className="p-4 space-y-2">
                          <p className="font-semibold">{f.titre}</p>
                          {f.description && (
                            <p className="text-sm text-muted-foreground">
                              {f.description}
                            </p>
                          )}
                          {mySugg ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground"
                              onClick={() =>
                                handleWithdrawSuggestion(mySugg.id)
                              }
                            >
                              <UserX className="w-4 h-4 mr-1" /> Se retirer
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExpressInterest(f)}
                            >
                              Je suis intéressé(e)
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "suggestions" ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowArchivedSuggestions((v) => !v)}
              >
                <Archive className="w-4 h-4 mr-1.5" />
                {showArchivedSuggestions
                  ? "Voir les actives"
                  : `Voir les archivées${archivedSuggestions.length > 0 ? ` (${archivedSuggestions.length})` : ""}`}
              </Button>
            </div>
            {(showArchivedSuggestions
              ? archivedSuggestions
              : activeSuggestions
            ).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    {showArchivedSuggestions
                      ? "Aucune suggestion archivée"
                      : "Aucune suggestion pour le moment"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              (showArchivedSuggestions
                ? archivedSuggestions
                : activeSuggestions
              ).map((s) => (
                <Card
                  key={s.id}
                  className={showArchivedSuggestions ? "opacity-70" : ""}
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{s.titre}</p>
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {s.formation_id
                            ? "Intérêt catalogue"
                            : "Nouveau sujet"}
                        </Badge>
                        <span
                          className={`text-xs ${
                            s.statut === "Approuvée"
                              ? "text-emerald-600"
                              : s.statut === "Rejetée"
                                ? "text-red-600"
                                : "text-amber-600"
                          }`}
                        >
                          {s.statut}
                        </span>
                      </div>
                      {s.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Par {s.created_by_name}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!showArchivedSuggestions &&
                        isCoordinationWrite &&
                        s.statut === "En attente" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600"
                              onClick={() =>
                                handleSuggestionStatus(s.id, "Rejetée")
                              }
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Rejeter
                            </Button>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() =>
                                handleSuggestionStatus(s.id, "Approuvée")
                              }
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />{" "}
                              Approuver
                            </Button>
                          </>
                        )}
                      {!showArchivedSuggestions &&
                        s.statut !== "En attente" &&
                        (isCoordinationWrite ||
                          s.created_by === user?.id) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => handleArchiveSuggestion(s.id)}
                          >
                            <Archive className="w-4 h-4 mr-1" /> Archiver
                          </Button>
                        )}
                      {showArchivedSuggestions && isCoordinationWrite && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUnarchiveSuggestion(s.id)}
                        >
                          Désarchiver
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Pipeline summary — visible to whoever can act on at least one stage */}
            {isConsole &&
              activeTab === "toutes" &&
              (isCoordination || isDirection) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card
                    className={
                      pendingCoordinationCount > 0 && isCoordination
                        ? "border-amber-300 dark:border-amber-800"
                        : ""
                    }
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          À traiter — Coordination
                        </p>
                        <p className="text-2xl font-bold">
                          {pendingCoordinationCount}
                        </p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-amber-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className={
                      pendingDirectionCount > 0 && isDirection
                        ? "border-violet-300 dark:border-violet-800"
                        : ""
                    }
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          À traiter — Validation finale
                        </p>
                        <p className="text-2xl font-bold">
                          {pendingDirectionCount}
                        </p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-violet-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

            {/* Lightweight pointer to the dedicated "Suggestions" tab — the full
list (all statuses, new topics + catalogue interest) lives there. */}
            {isConsole &&
              activeTab === "toutes" &&
              pendingSuggestionsCount > 0 && (
                <Card className="border-blue-300 dark:border-blue-800">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <p className="text-sm flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                      {pendingSuggestionsCount} suggestion(s) de membres en
                      attente
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveTab("suggestions")}
                    >
                      Voir les suggestions
                    </Button>
                  </CardContent>
                </Card>
              )}

            {/* Member's own topic suggestions also live under "Mes demandes" so
they can track everything they've submitted in one place. */}
            {!isConsole &&
              activeTab === "mes_demandes" &&
              mySuggestions.filter((s) => !s.formation_id).length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Mes suggestions de sujet
                  </p>
                  <div className="space-y-2">
                    {mySuggestions
                      .filter((s) => !s.formation_id)
                      .map((s) => (
                        <Card key={s.id}>
                          <CardContent className="p-3 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{s.titre}</p>
                              <span
                                className={`text-xs ${
                                  s.statut === "Approuvée"
                                    ? "text-emerald-600"
                                    : s.statut === "Rejetée"
                                      ? "text-red-600"
                                      : "text-amber-600"
                                }`}
                              >
                                {s.statut}
                              </span>
                            </div>
                            {s.statut === "En attente" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleWithdrawSuggestion(s.id)}
                              >
                                Retirer
                              </Button>
                            )}
                            {s.statut !== "En attente" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleArchiveSuggestion(s.id)}
                              >
                                <Archive className="w-4 h-4 mr-1" /> Archiver
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              </div>
            ) : filteredFormations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    {!isConsole && activeTab === "mes_demandes"
                      ? "Vous n'avez pas encore fait de demande"
                      : "Aucune formation dans cette vue"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredFormations.map((f) => (
                  <Card key={f.id} className="card-hover">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <GraduationCap className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold truncate">
                                  {f.titre}
                                </p>
                                {isConsole && originBadge(f)}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Demandé par {f.created_by_name}
                              </p>
                            </div>
                          </div>
                          {getStatusBadge(f.statut)}
                        </div>

                        <Stepper f={f} />

                        <p className="text-sm text-muted-foreground">
                          {f.description}
                        </p>

                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {f.dates_souhaitees &&
                            f.dates_souhaitees.length > 0
                              ? f.dates_souhaitees
                                  .map((d) =>
                                    new Date(
                                      d + "T00:00:00",
                                    ).toLocaleDateString("fr-FR", {
                                      day: "numeric",
                                      month: "short",
                                    }),
                                  )
                                  .join(", ")
                              : "-"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {f.duree || "-"}
                          </span>
                          {f.formateur && (
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5" />
                              {f.formateur}
                            </span>
                          )}
                          {f.cursus && (
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5" />
                              {f.cursus}
                            </span>
                          )}
                          {f.lieu && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />
                              {f.lieu}
                            </span>
                          )}
                        </div>

                        {f.statut === "Refusée" && f.motif_refus && (
                          <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-2">
                            Motif du refus : {f.motif_refus}
                          </p>
                        )}

                        {f.statut === "Validée" &&
                          isConsole &&
                          f.interested_members &&
                          f.interested_members.length > 0 && (
                            <div className="flex items-start gap-1.5 text-sm">
                              <Star className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                              <span className="text-muted-foreground">
                                {f.interested_members.length} membre(s)
                                intéressé(e)s :{" "}
                                {f.interested_members.join(", ")}
                              </span>
                            </div>
                          )}

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-border">
                          {f.statut === "En attente Coordination" &&
                            f.created_by === user?.id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(f)}
                              >
                                <Edit className="w-4 h-4 mr-1" /> Modifier
                              </Button>
                            )}

                          {f.statut === "En attente Coordination" &&
                            isCoordinationWrite && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                  onClick={() =>
                                    setRejectTarget({
                                      formation: f,
                                      stage: "coordination",
                                    })
                                  }
                                >
                                  <XCircle className="w-4 h-4 mr-1" /> Refuser
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => openCoordDialog(f)}
                                >
                                  <ArrowRight className="w-4 h-4 mr-1" />{" "}
                                  Valider &amp; transmettre
                                </Button>
                              </>
                            )}

                          {f.statut === "En attente validation finale" &&
                            isDirectionWrite && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                  onClick={() =>
                                    setRejectTarget({
                                      formation: f,
                                      stage: "direction",
                                    })
                                  }
                                >
                                  <XCircle className="w-4 h-4 mr-1" /> Refuser
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleFinalValidate(f.id)}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />{" "}
                                  Valider définitivement
                                </Button>
                              </>
                            )}

                          {f.statut === "Validée" && isCoordinationWrite && (
                            <Button
                              size="sm"
                              variant={
                                f.disponible_catalogue ? "default" : "outline"
                              }
                              className={
                                f.disponible_catalogue
                                  ? "bg-emerald-600 hover:bg-emerald-700"
                                  : ""
                              }
                              onClick={() => handleToggleCatalogue(f)}
                            >
                              <BookOpen className="w-4 h-4 mr-1" />
                              {f.disponible_catalogue
                                ? "Au catalogue"
                                : "Ajouter au catalogue"}
                            </Button>
                          )}

                          {isAdmin() && !f.is_archived && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleArchive(f.id)}
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          )}
                          {isSuperAdmin() && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDelete(f.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

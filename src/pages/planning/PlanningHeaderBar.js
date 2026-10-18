import { Badge } from '../../components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../components/ui/dropdown-menu';
import { Button } from '../../components/ui/button';
import { Download, ChevronDown, Printer, Loader2, ImageDown, FileSpreadsheet, PartyPopper, Eraser, CopyPlus, ArrowLeftRight, Save, Undo2, CheckCircle2, Cloud, EyeOff, X, Pencil } from 'lucide-react';
import { LivePresence, LiveStyle } from '../../lib/useLiveDoc';

export function PlanningHeaderBar({
  activeDay,
  autoSaveStatus,
  canManage,
  canValidate,
  duplicating,
  exportingPng,
  handleExportPngStory,
  exportingXlsx,
  handleExportPng,
  handleExportXlsx,
  handlePrint,
  handlePublish,
  handleResetPlanningVierge,
  handleSave,
  handleUndo,
  handleUnpublish,
  isGestionnairePlus,
  live,
  openDuplicate,
  planning,
  planningEditMode,
  planningScope,
  publishing,
  saving,
  setCopyDaysDialog,
  setEvenementView,
  toggleEditMode,
  undoStack,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Planning général
          {canManage() && planning && !planning.is_published && (
            <Badge
              variant="outline"
              className="text-amber-700 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 print:hidden"
            >
              Brouillon — invisible pour les Techniciens
            </Badge>
          )}
        </h1>
        <p className="text-muted-foreground">
          Planification mensuelle des équipes
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              data-testid="export-menu-btn"
              className="flex-1 min-w-[45%] sm:min-w-0 sm:flex-none"
            >
              <Download className="w-4 h-4 shrink-0 mr-2" />
              <span className="text-xs sm:text-sm">Exporter</span>
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handlePrint} data-testid="print-btn">
              <Printer className="w-4 h-4 shrink-0 mr-2" />
              Imprimer
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportPng}
              disabled={exportingPng}
              data-testid="export-png-btn"
            >
              {exportingPng ? (
                <Loader2 className="w-4 h-4 shrink-0 mr-2 animate-spin" />
              ) : (
                <ImageDown className="w-4 h-4 shrink-0 mr-2" />
              )}
              Enregistrer en PNG
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportPngStory}
              disabled={exportingPng}
              data-testid="export-png-story-btn"
            >
              <ImageDown className="w-4 h-4 shrink-0 mr-2" />
              PNG vertical (9:16)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportXlsx}
              disabled={exportingXlsx}
              data-testid="export-xlsx-btn"
            >
              {exportingXlsx ? (
                <Loader2 className="w-4 h-4 shrink-0 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 shrink-0 mr-2" />
              )}
              Enregistrer en Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {canManage() && (
          <Button
            variant="outline"
            onClick={() => setEvenementView(true)}
            data-testid="planning-evenement-btn"
            className="flex-1 min-w-[45%] sm:min-w-0 sm:flex-none"
          >
            <PartyPopper className="w-4 h-4 shrink-0 mr-2" />
            <span className="text-xs sm:text-sm">Planning événement</span>
          </Button>
        )}
        {canValidate() &&
          planningEditMode &&
          !planningScope.is_restricted && (
            <Button
              variant="outline"
              onClick={handleResetPlanningVierge}
              data-testid="reset-planning-btn"
              className="flex-1 min-w-[45%] sm:min-w-0 sm:flex-none text-destructive hover:text-destructive"
            >
              <Eraser className="w-4 h-4 shrink-0 mr-2" />
              <span className="text-xs sm:text-sm">Planning vierge</span>
            </Button>
          )}
        {canManage() && planningEditMode && planning?.id && (
          <Button
            variant="outline"
            onClick={openDuplicate}
            disabled={duplicating || saving}
            data-testid="duplicate-last-month-btn"
            className="flex-1 min-w-[45%] sm:min-w-0 sm:flex-none"
            title="Remplir les cases vides avec le mois précédent"
          >
            {duplicating ? (
              <Loader2 className="w-4 h-4 shrink-0 mr-2 animate-spin" />
            ) : (
              <CopyPlus className="w-4 h-4 shrink-0 mr-2" />
            )}
            <span className="text-xs sm:text-sm">
              Dupliquer le mois dernier
            </span>
          </Button>
        )}
        {canManage() && planningEditMode && planning?.id && (
          <Button
            variant="outline"
            onClick={() => setCopyDaysDialog(true)}
            data-testid="copy-between-days-btn"
            className="flex-1 min-w-[45%] sm:min-w-0 sm:flex-none"
            title="Copier ce qui est rempli d'un jour vers l'autre (même mois)"
          >
            <ArrowLeftRight className="w-4 h-4 shrink-0 mr-2" />
            <span className="text-xs sm:text-sm">
              Copier Dimanche ⇄ Vendredi
            </span>
          </Button>
        )}
        {canManage() && planningEditMode && (
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="save-btn"
            className="flex-1 min-w-[45%] sm:min-w-0 sm:flex-none"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 shrink-0 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 shrink-0 mr-2" />
            )}
            <span className="text-xs sm:text-sm">Enregistrer</span>
          </Button>
        )}
        {canManage() && planningEditMode && (
          <Button
            variant="outline"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            data-testid="undo-btn"
            className="flex-1 min-w-[45%] sm:min-w-0 sm:flex-none"
            title={
              undoStack.length === 0
                ? "Aucune action à annuler"
                : "Annuler la dernière action effectuée sur ce planning"
            }
          >
            <Undo2 className="w-4 h-4 shrink-0 mr-2" />
            <span className="text-xs sm:text-sm">Retour en arrière</span>
          </Button>
        )}
        <LivePresence users={live.users} />
        <LiveStyle users={live.users} flashes={live.flashes} cellPrefix={`${activeDay}|`} />
        {canManage() && planningEditMode && (
          <span
            className="text-xs text-muted-foreground flex items-center gap-1 print:hidden"
            data-testid="autosave-status"
          >
            {autoSaveStatus === "saving" && (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                Enregistrement...
              </>
            )}
            {autoSaveStatus === "saved" && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />{" "}
                Enregistré automatiquement
              </>
            )}
            {autoSaveStatus === "pending" && (
              <>
                <Cloud className="w-3.5 h-3.5" /> Modifications en attente...
              </>
            )}
            {autoSaveStatus === "error" && (
              <span className="text-destructive">
                Échec de l'enregistrement auto
              </span>
            )}
          </span>
        )}
        {isGestionnairePlus &&
          planning?.id &&
          (planning.is_published ? (
            <Button
              variant="outline"
              onClick={handleUnpublish}
              disabled={publishing}
              data-testid="unpublish-btn"
              className="flex-1 min-w-[45%] sm:min-w-0 sm:flex-none"
              title="Repasser en brouillon (invisible pour les Techniciens)"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 shrink-0 mr-2 animate-spin" />
              ) : (
                <EyeOff className="w-4 h-4 shrink-0 mr-2" />
              )}
              <span className="text-xs sm:text-sm">Dépublier</span>
            </Button>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={publishing}
              data-testid="publish-btn"
              className="flex-1 min-w-[45%] sm:min-w-0 sm:flex-none bg-emerald-600 hover:bg-emerald-700"
              title="Rendre ce planning visible pour tous les Techniciens"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 shrink-0 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mr-2" />
              )}
              <span className="text-xs sm:text-sm">Publier</span>
            </Button>
          ))}
        {canManage() && (
          <Button
            variant={planningEditMode ? "secondary" : "default"}
            onClick={toggleEditMode}
            data-testid="toggle-edit-mode-btn"
            className="flex-1 min-w-[45%] sm:min-w-0 sm:flex-none"
          >
            {planningEditMode ? (
              <X className="w-4 h-4 shrink-0 mr-2" />
            ) : (
              <Pencil className="w-4 h-4 shrink-0 mr-2" />
            )}
            <span className="text-xs sm:text-sm">
              {planningEditMode ? "Terminer l'édition" : "Editer"}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}

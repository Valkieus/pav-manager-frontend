import { MOIS_NOMS, slugPoste } from './constants';
import { Button } from '../../components/ui/button';
import { Settings, Ban, FolderPlus } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Card, CardContent } from '../../components/ui/card';
import { ScaleToFitMobile } from './cells';

export function PlanningTableArea({
  activeDay,
  affichageNoms,
  canManage,
  canValidate,
  cellBlockMode,
  currentDates,
  currentMonth,
  currentYear,
  daySections,
  distinctPostesToday,
  isGestionnairePlus,
  namesForPoste,
  openAddCategory,
  openEditDates,
  openEditHeader,
  planningEditMode,
  planningScope,
  printRef,
  renderTable,
  setAffichageNoms,
  setCellBlockMode,
  technicienNames,
  theme,
  titreOverrides,
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div
          ref={printRef}
          className="bg-white text-black p-2 sm:p-4 print:p-0"
        >
          <div
            className={`text-center font-bold text-base sm:text-xl mb-1 ${theme.title}`}
          >
            {titreOverrides[activeDay]?.titre ||
              `${MOIS_NOMS[currentMonth - 1].toUpperCase()} ${currentYear} - ${activeDay.toUpperCase()}`}
          </div>
          <div
            className={`text-center font-semibold text-xs sm:text-sm py-1 mb-3 ${theme.subtitle}`}
          >
            {titreOverrides[activeDay]?.sous_titre ||
              (activeDay === "dimanche"
                ? "RDV à partir de 8h00 en salle 114"
                : "RDV à partir de 18h30 en salle 114")}
          </div>
          {canManage() &&
            planningEditMode &&
            !planningScope.is_restricted && (
              <div className="flex justify-center mb-2 print:hidden">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={openEditHeader}
                >
                  <Settings className="w-3 h-3 mr-1" /> Modifier l'en-tête
                </Button>
              </div>
            )}

          {isGestionnairePlus && planningEditMode && (
            <div className="flex justify-end items-center gap-2 mb-2 print:hidden">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Affichage des noms
              </span>
              <Select value={affichageNoms} onValueChange={setAffichageNoms}>
                <SelectTrigger
                  className="w-[150px] h-8 text-xs"
                  data-testid="affichage-noms-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="upper">MAJUSCULE</SelectItem>
                  <SelectItem value="lower">minuscule</SelectItem>
                  <SelectItem value="capitalize">Première lettre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {canValidate() &&
            planningEditMode &&
            !planningScope.is_restricted && (
              <div className="flex justify-end items-center gap-2 mb-2 print:hidden">
                {cellBlockMode && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Cliquez sur une case pour la griser / dégriser
                  </span>
                )}
                <Button
                  variant={cellBlockMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCellBlockMode((v) => !v)}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  {cellBlockMode ? "Terminer" : "Griser une case"}
                </Button>
                <Button variant="outline" size="sm" onClick={openEditDates}>
                  <Settings className="w-4 h-4 mr-2" />
                  Éditer dates
                </Button>
              </div>
            )}

          <Card className="print:shadow-none print:border-0 bg-white text-black">
            <CardContent className="p-0">
              {/* Sum of the fixed colgroup widths in renderTable (220px label
+ 115px per date column + 120px actions column — sized for the
common 4-button row; merged/split rows grow a 2nd row instead of
widening) — passed in directly rather than measured, since
measuring a `w-full` table's own wrapper creates a circular width
reference. */}
              <ScaleToFitMobile
                key={`t1-${activeDay}-${currentDates.length}`}
                naturalWidth={
                  220 +
                  currentDates.length * 115 +
                  (canValidate() && planningEditMode ? 120 : 0) +
                  4
                }
              >
                {renderTable("table1", daySections.table1)}
              </ScaleToFitMobile>
              {canValidate() &&
                planningEditMode &&
                !planningScope.is_restricted && (
                  <div className="flex justify-end px-2 pb-3 print:hidden">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAddCategory("table1")}
                    >
                      <FolderPlus className="w-4 h-4 mr-2" /> Ajouter
                      catégorie
                    </Button>
                  </div>
                )}
              <ScaleToFitMobile
                key={`t2-${activeDay}-${currentDates.length}`}
                naturalWidth={
                  220 +
                  currentDates.length * 115 +
                  (canValidate() && planningEditMode ? 120 : 0) +
                  4
                }
              >
                {renderTable("table2", daySections.table2)}
              </ScaleToFitMobile>
              {canValidate() &&
                planningEditMode &&
                !planningScope.is_restricted && (
                  <div className="flex justify-end px-2 pb-3 print:hidden">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAddCategory("table2")}
                    >
                      <FolderPlus className="w-4 h-4 mr-2" /> Ajouter
                      catégorie
                    </Button>
                  </div>
                )}

              {/*One datalist per poste category actually used today, each
pre-filtered to the people qualified for it — plus the
unfiltered "tech-list" as a safety-net fallback id. */}
              {distinctPostesToday.map((poste) => (
                <datalist key={poste} id={`tech-list-${slugPoste(poste)}`}>
                  {namesForPoste(poste).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              ))}
              <datalist id="tech-list">
                {technicienNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-2 italic font-semibold">
            SOUS RÉSERVE DE CHANGEMENTS ÉVENTUELS FAITS PAR LE RESPONSABLE DU
            DÉPARTEMENT
          </p>
        </div>

      </div>

    </div>
  );
}

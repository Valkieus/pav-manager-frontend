import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { MOIS_NOMS } from './constants';
import { Button } from '../../components/ui/button';

export function EditHeaderDialog({
  activeDay,
  currentMonth,
  currentYear,
  editHeaderDialog,
  headerDraft,
  resetHeaderDraft,
  saveHeaderDraft,
  setEditHeaderDialog,
  setHeaderDraft,
}) {
  return (
    <Dialog
      open={editHeaderDialog}
      onOpenChange={(open) => !open && setEditHeaderDialog(false)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Modifier l'en-tête (
            {activeDay === "dimanche" ? "Dimanche" : "Vendredi"})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Titre principal</label>
            <Input
              value={headerDraft.titre}
              onChange={(e) =>
                setHeaderDraft((prev) => ({ ...prev, titre: e.target.value }))
              }
              placeholder={`${MOIS_NOMS[currentMonth - 1].toUpperCase()} ${currentYear} - ${activeDay.toUpperCase()}`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Sous-titre</label>
            <Input
              value={headerDraft.sous_titre}
              onChange={(e) =>
                setHeaderDraft((prev) => ({
                  ...prev,
                  sous_titre: e.target.value,
                }))
              }
              placeholder={
                activeDay === "dimanche"
                  ? "RDV à partir de 8h00 en salle 114"
                  : "RDV à partir de 18h30 en salle 114"
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Laissez vide pour revenir au texte généré automatiquement.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={resetHeaderDraft}
            >
              Réinitialiser
            </Button>
            <Button className="flex-1" onClick={saveHeaderDraft}>
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

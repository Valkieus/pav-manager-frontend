import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Loader2 } from 'lucide-react';

export function CoordValidationDialog({
  coordDialogFormation,
  coordForm,
  handleCoordinationValidate,
  setCoordDialogFormation,
  setCoordForm,
  submitting,
}) {
  return (
    <Dialog
      open={!!coordDialogFormation}
      onOpenChange={(open) => !open && setCoordDialogFormation(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Validation Coordination</DialogTitle>
          <DialogDescription>
            Confirmez le formateur, le cursus et le lieu avant de transmettre
            à la Direction pour validation finale.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCoordinationValidate} className="space-y-4">
          <div className="space-y-2">
            <Label>Formateur *</Label>
            <Input
              value={coordForm.formateur}
              onChange={(e) =>
                setCoordForm({ ...coordForm, formateur: e.target.value })
              }
              placeholder="Nom du formateur"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Cursus *</Label>
            <Input
              value={coordForm.cursus}
              onChange={(e) =>
                setCoordForm({ ...coordForm, cursus: e.target.value })
              }
              placeholder="Intitulé du cursus / programme"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lieu *</Label>
              <Input
                value={coordForm.lieu}
                onChange={(e) =>
                  setCoordForm({ ...coordForm, lieu: e.target.value })
                }
                placeholder="Ex: Salle 114, en ligne..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Durée confirmée</Label>
              <Input
                value={coordForm.duree}
                onChange={(e) =>
                  setCoordForm({ ...coordForm, duree: e.target.value })
                }
                placeholder="ex: 2 jours"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setCoordDialogFormation(null)}
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Transmettre à la Direction
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

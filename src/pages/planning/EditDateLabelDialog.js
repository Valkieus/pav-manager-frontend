import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export function EditDateLabelDialog({
  clearDateLabelDraft,
  dateLabelDraft,
  editDateLabelDialog,
  formatDate,
  saveDateLabelDraft,
  setDateLabelDraft,
  setEditDateLabelDialog,
}) {
  return (
    <Dialog
      open={!!editDateLabelDialog}
      onOpenChange={(open) => !open && setEditDateLabelDialog(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Texte sous la date
            {editDateLabelDialog
              ? ` (${formatDate(editDateLabelDialog)})`
              : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={dateLabelDraft}
            onChange={(e) => setDateLabelDraft(e.target.value)}
            placeholder="Ex : Invité : Jonathan Stockstill, ou Fête des pères"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={clearDateLabelDraft}
            >
              Effacer
            </Button>
            <Button className="flex-1" onClick={saveDateLabelDraft}>
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';

export function RejectDialog({
  rejectMotif,
  rejectTarget,
  setRejectMotif,
  setRejectTarget,
  submitReject,
}) {
  return (
    <Dialog
      open={!!rejectTarget}
      onOpenChange={(open) => {
        if (!open) {
          setRejectTarget(null);
          setRejectMotif("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuser la demande</DialogTitle>
          <DialogDescription>
            {rejectTarget?.formation?.titre}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motif (optionnel)</Label>
            <Textarea
              value={rejectMotif}
              onChange={(e) => setRejectMotif(e.target.value)}
              placeholder="Expliquez la raison du refus..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectMotif("");
              }}
            >
              Annuler
            </Button>
            <Button variant="destructive" onClick={submitReject}>
              Confirmer le refus
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

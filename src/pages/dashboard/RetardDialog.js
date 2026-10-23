import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { AlarmClock, Loader2, Send } from 'lucide-react';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';

export function RetardDialog({
  handleSendRetard,
  retardDialogOpen,
  retardHeure,
  retardMessage,
  retardSending,
  setRetardDialogOpen,
  setRetardHeure,
  setRetardMessage,
}) {
  return (
    <Dialog open={retardDialogOpen} onOpenChange={setRetardDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlarmClock className="w-5 h-5 text-amber-600" />
            Signaler un retard
          </DialogTitle>
          <DialogDescription>
            Le/la superviseur du jour, le Responsable PAV et les Responsables
            Coordination seront notifiés immédiatement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Heure d'arrivée estimée</Label>
            <Input
              placeholder="Ex: 18h45"
              value={retardHeure}
              onChange={(e) => setRetardHeure(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Message (optionnel)</Label>
            <Textarea
              placeholder="Ex: bloqué dans les transports..."
              value={retardMessage}
              onChange={(e) => setRetardMessage(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setRetardDialogOpen(false)}
          >
            Annuler
          </Button>
          <Button onClick={handleSendRetard} disabled={retardSending}>
            {retardSending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

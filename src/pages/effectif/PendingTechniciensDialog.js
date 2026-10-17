import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Send, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';

export function PendingTechniciensDialog({
  handleApprovePending,
  handleRejectPending,
  pendingActionBusy,
  pendingManagerOpen,
  pendingRejectMessage,
  pendingTechs,
  pendingTechsLoading,
  rejectingPendingId,
  setPendingManagerOpen,
  setPendingRejectMessage,
  setRejectingPendingId,
}) {
  return (
    <Dialog
      open={pendingManagerOpen}
      onOpenChange={setPendingManagerOpen}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="relative">
          <Send className="w-4 h-4 mr-2" />
          Fiches à valider
          {pendingTechs.length > 0 && (
            <Badge className="ml-2 bg-amber-500 hover:bg-amber-500">
              {pendingTechs.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Fiches techniciens à valider</DialogTitle>
          <DialogDescription>
            Fiches proposées par un Responsable — elles n'intègrent
            l'effectif qu'après validation.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3">
          {pendingTechsLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </div>
          ) : pendingTechs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Aucune fiche en attente
            </p>
          ) : (
            pendingTechs.map((t) => (
              <div
                key={t.id}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t.nom}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Proposée par{" "}
                      {t.proposed_by_name || "un Responsable"}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {t.branches?.join(", ")}
                  </Badge>
                </div>
                {rejectingPendingId === t.id ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Motif (optionnel)</Label>
                    <Input
                      value={pendingRejectMessage}
                      onChange={(e) =>
                        setPendingRejectMessage(e.target.value)
                      }
                      placeholder="Motif du rejet..."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pendingActionBusy === t.id}
                        onClick={() => handleRejectPending(t.id)}
                      >
                        Confirmer le rejet
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRejectingPendingId(null);
                          setPendingRejectMessage("");
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={pendingActionBusy === t.id}
                      onClick={() => handleApprovePending(t.id)}
                    >
                      {pendingActionBusy === t.id ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                      )}
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => {
                        setRejectingPendingId(t.id);
                        setPendingRejectMessage("");
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Rejeter
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

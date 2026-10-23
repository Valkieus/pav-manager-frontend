import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ArrowLeftRight } from 'lucide-react';
import { MOIS_NOMS } from './constants';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Button } from '../../components/ui/button';

export function CopyDaysDialog({
  copyDaysDialog,
  copyDaysDirection,
  currentMonth,
  currentYear,
  handleCopyBetweenDays,
  setCopyDaysDialog,
  setCopyDaysDirection,
}) {
  return (
    <Dialog open={copyDaysDialog} onOpenChange={setCopyDaysDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Copier entre Dimanche et Vendredi
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copie les cases remplies d'un jour vers les rôles équivalents de
            l'autre jour, pour ce même mois ({MOIS_NOMS[currentMonth - 1]}{" "}
            {currentYear}). Les cases déjà remplies côté destination seront
            remplacées.
          </p>
          <Select
            value={copyDaysDirection}
            onValueChange={setCopyDaysDirection}
          >
            <SelectTrigger data-testid="copy-days-direction-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dimanche_to_vendredi">
                Dimanche → Vendredi
              </SelectItem>
              <SelectItem value="vendredi_to_dimanche">
                Vendredi → Dimanche
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCopyDaysDialog(false)}
            >
              Annuler
            </Button>
            <Button
              className="flex-1"
              onClick={handleCopyBetweenDays}
              data-testid="copy-days-confirm-btn"
            >
              Copier
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

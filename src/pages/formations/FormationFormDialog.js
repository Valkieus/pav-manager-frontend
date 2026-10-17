import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Plus, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';
import { Calendar } from '../../components/ui/calendar';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';

export function FormationFormDialog({
  competences,
  dialogOpen,
  editingId,
  form,
  handleSubmit,
  isConsole,
  resetForm,
  setDialogOpen,
  setForm,
  submitting,
}) {
  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button
          className="shadow-lg shadow-primary/20"
          data-testid="add-formation-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {isConsole ? "Proposer une formation" : "Faire une demande"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingId
              ? "Modifier"
              : isConsole
                ? "Proposer une"
                : "Demande de"}{" "}
            formation
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Modifiez les informations"
              : "Cette demande sera soumise à la Coordination"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Formation souhaitée *</Label>
            <Select
              value={form.titre}
              onValueChange={(v) => setForm({ ...form, titre: v })}
            >
              <SelectTrigger data-testid="formation-titre">
                <SelectValue placeholder="Sélectionner une formation souhaitée" />
              </SelectTrigger>
              <SelectContent>
                {competences.map((comp) => (
                  <SelectItem key={comp} value={comp}>
                    {comp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description / Objectifs *</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              required
              rows={3}
              placeholder="Décrivez vos objectifs d'apprentissage..."
              data-testid="formation-description"
            />
          </div>
          {isConsole && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date(s) souhaitée(s) *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal"
                      data-testid="formation-date"
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {form.dates_souhaitees.length === 0
                        ? "Choisir un ou plusieurs jours"
                        : `${form.dates_souhaitees.length} jour(s) sélectionné(s)`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="multiple"
                      selected={form.dates_souhaitees.map(
                        (d) => new Date(d + "T00:00:00"),
                      )}
                      onSelect={(days) =>
                        setForm({
                          ...form,
                          dates_souhaitees: (days || [])
                            .map((d) => d.toISOString().slice(0, 10))
                            .sort(),
                        })
                      }
                    />
                  </PopoverContent>
                </Popover>
                {form.dates_souhaitees.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {form.dates_souhaitees.map((d) => (
                      <Badge
                        key={d}
                        variant="secondary"
                        className="text-xs font-normal"
                      >
                        {new Date(d + "T00:00:00").toLocaleDateString(
                          "fr-FR",
                          { day: "numeric", month: "short" },
                        )}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Durée estimée *</Label>
                <Input
                  value={form.duree}
                  onChange={(e) =>
                    setForm({ ...form, duree: e.target.value })
                  }
                  placeholder="ex: 2 jours"
                  required
                  data-testid="formation-duree"
                />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting}
              data-testid="formation-submit"
            >
              {submitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingId ? "Modifier" : "Envoyer la demande"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

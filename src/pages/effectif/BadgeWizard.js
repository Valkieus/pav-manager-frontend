import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Check, X, Loader2, Download, FileText } from 'lucide-react';
import { renderBadge, splitName, badgeFileName, downloadPng, downloadPdf } from './badgeRender';

// Badge en deux pages : 1. validation de la photo, 2. badge fabriqué (aperçu, PNG, PDF).
export function BadgeWizard({
  open, onOpenChange, tech, readOnly, badgeDetail, badgeActionBusy,
  handleConfirmBadge, handleRejectBadge, rejectMessage, setRejectMessage,
}) {
  const status = badgeDetail?.badge_status;
  const validated = ['pret_a_recuperer', 'recupere'].includes(status);
  const [step, setStep] = useState(validated ? 2 : 1);
  const [rejecting, setRejecting] = useState(false);
  const [names, setNames] = useState(splitName(tech?.nom));
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  const photoUrl = badgeDetail?.badge_photo_url ? `${process.env.REACT_APP_BACKEND_URL}${badgeDetail.badge_photo_url}` : null;

  // Après validation, on passe tout seul à la page 2.
  useEffect(() => { if (open) setStep(validated ? 2 : 1); }, [open, validated]);
  useEffect(() => { if (open) setNames(splitName(tech?.nom)); }, [open, tech?.nom]);

  useEffect(() => {
    if (!open || step !== 2) return undefined;
    let cancelled = false;
    setRendering(true);
    setError('');
    const t = setTimeout(() => {
      if (!canvasRef.current) return;
      renderBadge(canvasRef.current, { photoUrl, ...names })
        .then((res) => { if (!cancelled && res && res.photoOk === false) setError("La photo n'a pas pu être chargée dans l'aperçu (le texte reste modifiable)."); })
        .catch(() => !cancelled && setError("Impossible de dessiner le badge"))
        .finally(() => !cancelled && setRendering(false));
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, step, names, photoUrl]);

  const tabCls = (n) => `flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${step === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="badge-wizard">
        <DialogHeader>
          <DialogTitle>Badge — {tech?.nom}</DialogTitle>
          <DialogDescription>1. Valider la photo · 2. Badge prêt à imprimer</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <button type="button" className={tabCls(1)} onClick={() => setStep(1)}>1. Validation</button>
          <button type="button" className={tabCls(2)} onClick={() => setStep(2)} disabled={!photoUrl} data-testid="badge-step2">2. Badge</button>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            {photoUrl ? (
              <img src={photoUrl} alt="Photo badge" className="mx-auto max-h-80 rounded-lg border object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">Aucune photo envoyée pour le moment.</p>
            )}
            {badgeDetail?.badge_motif && <p className="text-xs text-muted-foreground">Motif : {badgeDetail.badge_motif}</p>}
            {status === 'en_attente_validation' && !readOnly ? (
              rejecting ? (
                <div className="space-y-2">
                  <Input value={rejectMessage} onChange={(e) => setRejectMessage(e.target.value)} placeholder="Motif du refus (visible par la personne)" />
                  <div className="flex gap-2">
                    <Button variant="destructive" disabled={badgeActionBusy} onClick={handleRejectBadge}>Refuser la photo</Button>
                    <Button variant="outline" onClick={() => setRejecting(false)}>Annuler</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button disabled={badgeActionBusy} onClick={handleConfirmBadge} data-testid="badge-validate">
                    {badgeActionBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    Valider la photo
                  </Button>
                  <Button variant="outline" onClick={() => setRejecting(true)}><X className="w-4 h-4 mr-1" /> Refuser</Button>
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                {validated ? 'Photo validée.' : 'Rien à valider pour le moment.'}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input className="font-bold" value={names.prenom} onChange={(e) => setNames({ ...names, prenom: e.target.value })} placeholder="Prénom" />
              <Input className="font-bold uppercase" value={names.nom} onChange={(e) => setNames({ ...names, nom: e.target.value.toUpperCase() })} placeholder="NOM" />
            </div>
            <div className="relative">
              <canvas ref={canvasRef} className="w-full rounded-lg border shadow-sm" data-testid="badge-canvas" />
              {rendering && <Loader2 className="absolute right-2 top-2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={rendering} data-testid="badge-png"
                onClick={() => downloadPng(canvasRef.current, badgeFileName(names.prenom, names.nom, 'png'))}>
                <Download className="w-4 h-4 mr-1" /> Enregistrer en PNG
              </Button>
              <Button variant="outline" disabled={rendering} data-testid="badge-pdf"
                onClick={() => downloadPdf(canvasRef.current, badgeFileName(names.prenom, names.nom, 'pdf'))}>
                <FileText className="w-4 h-4 mr-1" /> Enregistrer en PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

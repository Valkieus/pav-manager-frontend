import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Check, X, Loader2, Download, FileText, Wand2, RotateCcw } from 'lucide-react';
import { renderBadge, autoFrame, DEFAULT_ADJUST, splitName, badgeFileName, downloadPng, downloadPdf } from './badgeRender';

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
  const [adjust, setAdjust] = useState(DEFAULT_ADJUST);
  const [framing, setFraming] = useState(false);
  const panRef = useRef({ mx: 0, my: 0 });
  const dragRef = useRef(null);
  const adjustKey = tech?.id ? `pav-badge-cadrage-${tech.id}` : null;
  const photoUrl = badgeDetail?.badge_photo_url ? `${process.env.REACT_APP_BACKEND_URL}${badgeDetail.badge_photo_url}` : null;

  // Après validation, on passe tout seul à la page 2.
  useEffect(() => { if (open) setStep(validated ? 2 : 1); }, [open, validated]);
  // Prénom / NOM du badge : propres au badge (la fiche ne change pas). On reprend ceux enregistrés, sinon ceux de la fiche.
  const namesDirty = useRef(false);
  const savedNamesRef = useRef({}); // noms enregistrés pendant cette session (la fiche détail n'est pas rechargée à chaque ouverture)
  const [namesSaved, setNamesSaved] = useState(false);
  useEffect(() => {
    if (!open) return;
    namesDirty.current = false;
    setNamesSaved(false);
    setNames(savedNamesRef.current[badgeDetail?.user_id] || badgeDetail?.badge_names || splitName(tech?.nom));
  }, [open, tech?.nom, badgeDetail?.badge_names]);
  const editNames = (next) => { namesDirty.current = true; setNamesSaved(false); setNames(next); };
  useEffect(() => {
    if (!open || !namesDirty.current || readOnly || !badgeDetail?.user_id) return undefined;
    const t = setTimeout(() => {
      axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/admin/badges/${badgeDetail.user_id}/names`, names)
        .then(() => { savedNamesRef.current[badgeDetail.user_id] = names; setNamesSaved(true); }).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [names, open, readOnly, badgeDetail?.user_id]);
  // Le cadrage choisi est enregistré sur le compte de la personne (copie locale en secours).
  useEffect(() => {
    if (!open) return;
    let saved = badgeDetail?.badge_adjust || null;
    try { if (!saved && adjustKey) saved = JSON.parse(localStorage.getItem(adjustKey) || 'null'); } catch (e) { /* ignoré */ }
    setAdjust(saved && typeof saved.zoom === 'number' ? saved : DEFAULT_ADJUST);
  }, [open, adjustKey, photoUrl, badgeDetail?.badge_adjust]);
  const saveAdjust = (a) => {
    setAdjust(a);
    try { if (adjustKey) localStorage.setItem(adjustKey, JSON.stringify(a)); } catch (e) { /* ignoré */ }
    // Enregistré sur le compte : la personne voit son badge avec ce même cadrage.
    if (badgeDetail?.user_id && !readOnly) {
      axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/admin/badges/${badgeDetail.user_id}/adjust`, a).catch(() => {});
    }
  };
  const runAutoFrame = async () => {
    if (!photoUrl) return;
    setFraming(true);
    try { saveAdjust(await autoFrame(photoUrl)); } finally { setFraming(false); }
  };

  // Glisser la photo directement sur l'aperçu (souris ou doigt).
  const onPointerDown = (e) => {
    if (!photoUrl) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, a: adjust };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const k = 726 / e.currentTarget.getBoundingClientRect().width; // pixels écran -> pixels du badge
    const { mx, my } = panRef.current;
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    setAdjust({
      ...d.a,
      x: mx > 0 ? clamp(d.a.x + ((e.clientX - d.px) * k) / mx) : 0,
      y: my > 0 ? clamp(d.a.y + ((e.clientY - d.py) * k) / my) : 0,
    });
  };
  const onPointerUp = () => { if (dragRef.current) { dragRef.current = null; saveAdjust(adjust); } };

  useEffect(() => {
    if (!open || step !== 2) return undefined;
    let cancelled = false;
    setRendering(true);
    setError('');
    const t = setTimeout(() => {
      if (!canvasRef.current) return;
      renderBadge(canvasRef.current, { photoUrl, ...names, adjust })
        .then((res) => { if (res?.pan) panRef.current = res.pan; if (!cancelled && res && res.photoOk === false) setError("La photo n'a pas pu être chargée dans l'aperçu (le texte reste modifiable)."); })
        .catch(() => !cancelled && setError("Impossible de dessiner le badge"))
        .finally(() => !cancelled && setRendering(false));
    }, 40);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, step, names, photoUrl, adjust]);

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
              <Input className="font-bold" value={names.prenom} onChange={(e) => editNames({ ...names, prenom: e.target.value })} placeholder="Prénom" />
              <Input className="font-bold uppercase" value={names.nom} onChange={(e) => editNames({ ...names, nom: e.target.value.toUpperCase() })} placeholder="NOM" />
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">
              Ces noms ne servent qu'à ce badge : la fiche reste inchangée.{namesSaved && <span className="ml-1 text-emerald-600">Enregistré ✓</span>}
            </p>
            <div className="relative">
              <canvas ref={canvasRef} className={`w-full rounded-lg border shadow-sm ${photoUrl ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ touchAction: 'none' }} data-testid="badge-canvas"
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
              {rendering && <Loader2 className="absolute right-2 top-2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {photoUrl && (
              <div className="rounded-lg border p-3 space-y-2" data-testid="badge-adjust">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Cadrage de la photo <span className="text-xs font-normal text-muted-foreground">(glissez la photo sur l'aperçu ou utilisez les curseurs)</span></p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={framing} onClick={runAutoFrame} data-testid="badge-autoframe">
                      {framing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}Cadrage auto
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => saveAdjust(DEFAULT_ADJUST)}><RotateCcw className="w-4 h-4 mr-1" />Réinitialiser</Button>
                  </div>
                </div>
                {[['Zoom', 'zoom', 1, 3, 0.02], ['Gauche ↔ droite', 'x', -1, 1, 0.01], ['Haut ↕ bas', 'y', -1, 1, 0.01]].map(([label, key, min, max, step]) => (
                  <label key={key} className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="w-28 shrink-0">{label}</span>
                    <input type="range" className="flex-1 accent-primary h-6" min={min} max={max} step={step} value={adjust[key]}
                      onChange={(e) => setAdjust({ ...adjust, [key]: parseFloat(e.target.value) })}
                      onPointerUp={() => saveAdjust(adjust)} onKeyUp={() => saveAdjust(adjust)} aria-label={label} />
                  </label>
                ))}
              </div>
            )}
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

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IdCard, Loader2, Maximize2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { renderBadge, splitName, DEFAULT_ADJUST } from '../effectif/badgeRender';

// Badge validé par la coordination (photo acceptée) : la personne peut l'afficher depuis son tableau de bord.
// La version digitale n'est visible qu'une fois le badge identifié comme « remis » par la Coordination (« recupere » ; « validee » = ancien statut).
export const BADGE_READY = ['recupere', 'validee'];
export const hasBadgeToShow = (user) => !!user && BADGE_READY.includes(user.badge_status) && !!user.badge_photo_url;

// Taille de l'écran (suit la rotation et le redimensionnement) : le badge est dimensionné à la main pour remplir l'écran sans déformation.
const useScreen = () => {
  const get = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [size, setSize] = useState(get);
  useEffect(() => {
    const on = () => setSize(get());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  return size;
};

// Plein écran en paysage : téléphone tenu droit → le badge est tourné de 90° pour remplir l'écran ; téléphone couché → tel quel.
export function BadgeViewer({ user, onClose }) {
  const canvasRef = useRef(null);
  const { w, h } = useScreen();
  const portrait = h > w;
  const [long, short] = portrait ? [h, w] : [w, h]; // grand et petit côté de l'écran une fois le badge « couché »
  const k = Math.min((long - 32) / 726, (short - 32) / 507);
  const [state, setState] = useState('loading');

  useEffect(() => {
    try { window.screen?.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* non pris en charge */ }
    return () => { try { window.screen?.orientation?.unlock?.(); } catch (e) { /* ignoré */ } };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const { prenom, nom } = user.badge_names || splitName(user.full_name);
    renderBadge(canvasRef.current, {
      photoUrl: `${process.env.REACT_APP_BACKEND_URL}${user.badge_photo_url}`, prenom, nom, adjust: user.badge_adjust || DEFAULT_ADJUST,
    })
      .then((res) => !cancelled && setState(res?.photoOk === false ? 'nophoto' : 'ok'))
      .catch(() => !cancelled && setState('error'));
    return () => { cancelled = true; };
  }, [user]);

  const box = portrait
    ? { position: 'fixed', top: 0, left: 0, width: h, height: w, transformOrigin: 'top left', transform: `translateX(${w}px) rotate(90deg)` }
    : { position: 'fixed', inset: 0 };
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000' }} role="dialog" aria-label="Mon badge" data-testid="badge-viewer">
      <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <canvas ref={canvasRef} style={{ width: 726 * k, height: 507 * k, flex: 'none', borderRadius: 12 }} />
      </div>
      {state === 'loading' && <Loader2 className="fixed left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />}
      {state !== 'loading' && state !== 'ok' && (
        <p className="fixed bottom-6 left-4 right-4 text-center text-sm text-white/90">
          {state === 'nophoto' ? "La photo n'a pas pu être chargée — vérifiez la connexion et rouvrez le badge." : "Impossible d'afficher le badge."}
        </p>
      )}
      <button type="button" onClick={onClose} aria-label="Fermer" data-testid="badge-viewer-close"
        style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)', right: 'calc(env(safe-area-inset-right) + 0.75rem)' }}
        className="fixed z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}

export function MonBadgeCard({ user }) {
  const [open, setOpen] = useState(false);
  if (!hasBadgeToShow(user)) return null;
  const day = new Date().getDay();
  const serviceDay = day === 5 || day === 0; // vendredi / dimanche
  return (
    <>
      <div className={`flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm ${serviceDay ? 'border-primary/50 bg-primary/5' : 'bg-card'}`} data-testid="mon-badge-card">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><IdCard className="h-6 w-6" /></span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Mon badge</p>
            <p className="truncate text-xs text-muted-foreground">{serviceDay ? "Jour de service — à présenter à l'entrée" : 'Affichez-le en plein écran, en paysage'}</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="shrink-0" data-testid="mon-badge-open"><Maximize2 className="mr-1.5 h-4 w-4" />Ouvrir</Button>
      </div>
      {open && <BadgeViewer user={user} onClose={() => setOpen(false)} />}
    </>
  );
}

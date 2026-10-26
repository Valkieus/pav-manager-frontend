import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Clock, IdCard, Loader2, Maximize2, ShieldAlert, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { renderBadge, splitName, DEFAULT_ADJUST } from './effectif/badgeRender';
import { BadgeViewer, hasBadgeToShow } from './dashboard/MonBadgeCard';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Ce qu'on affiche selon l'état de la demande : le badge dès qu'il est validé, sinon la raison.
function statusMessage(info) {
  const s = info?.badge_status;
  if (s === 'en_attente_validation') {
    return { icon: Clock, tone: 'text-amber-600', title: 'Photo en attente de validation', text: "Ta photo est bien arrivée. La coordination doit la valider : ton badge apparaîtra ici dès que ce sera fait." };
  }
  if (s === 'non_conforme') {
    return { icon: ShieldAlert, tone: 'text-destructive', title: 'Photo refusée', text: info?.badge_message ? `Motif : ${info.badge_message}. Envoie une nouvelle photo.` : 'Ta photo ne convient pas. Envoie une nouvelle photo (de face, visage dégagé, fond neutre).', action: true };
  }
  if (['pret_a_recuperer', 'recupere', 'validee'].includes(s) && !info?.badge_photo_url) {
    return { icon: IdCard, tone: 'text-muted-foreground', title: 'Version digitale indisponible', text: "Aucune photo n'est enregistrée pour ton badge. Envoie une photo pour obtenir ta version digitale.", action: true };
  }
  return { icon: IdCard, tone: 'text-muted-foreground', title: 'Pas encore de badge', text: "Tu n'as pas encore demandé de badge. Envoie une photo récente (de face, visage dégagé) : il sera disponible ici dès sa validation.", action: true };
}

export default function MonBadge() {
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [full, setFull] = useState(false);
  const [state, setState] = useState('loading');
  const canvasRef = useRef(null);

  const load = useCallback(async () => {
    try { setInfo((await axios.get(`${API}/auth/me`)).data); } catch (e) { setState('error'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const ready = hasBadgeToShow(info);
  useEffect(() => {
    if (!info) return undefined;
    if (!ready) { setState('message'); return undefined; }
    let cancelled = false;
    setState('loading');
    const { prenom, nom } = info.badge_names || splitName(info.full_name);
    // le canvas n'existe qu'une fois « ready » rendu : on attend le prochain tour
    const t = setTimeout(() => {
      if (!canvasRef.current) return;
      renderBadge(canvasRef.current, { photoUrl: `${process.env.REACT_APP_BACKEND_URL}${info.badge_photo_url}`, prenom, nom, adjust: info.badge_adjust || DEFAULT_ADJUST })
        .then((r) => !cancelled && setState(r?.photoOk === false ? 'nophoto' : 'ok'))
        .catch(() => !cancelled && setState('error'));
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [info, ready]);

  const msg = !ready && info ? statusMessage(info) : null;
  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="mon-badge-page">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><IdCard className="h-6 w-6 text-primary" /> Mon badge</h1>
      {!info && state !== 'error' && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {state === 'error' && !info && <p className="text-sm text-destructive">Impossible de charger ton badge. Vérifie ta connexion et réessaie.</p>}

      {ready && (
        <>
          <div className="relative">
            <canvas ref={canvasRef} className="w-full rounded-xl border shadow-md" data-testid="mon-badge-canvas" style={{ aspectRatio: '726 / 507' }} />
            {state === 'loading' && <Loader2 className="absolute right-3 top-3 h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
          {state === 'nophoto' && <p className="text-sm text-destructive">La photo n'a pas pu être chargée. Vérifie ta connexion et recharge la page.</p>}
          <Button className="w-full sm:w-auto" onClick={() => setFull(true)} data-testid="mon-badge-fullscreen"><Maximize2 className="mr-2 h-4 w-4" />Afficher en plein écran (paysage)</Button>
          {full && <BadgeViewer user={info} onClose={() => setFull(false)} />}
        </>
      )}

      {msg && (
        <Card data-testid="mon-badge-status">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <msg.icon className={`h-8 w-8 ${msg.tone}`} />
            <div>
              <p className="text-lg font-semibold">{msg.title}</p>
              <p className="text-sm text-muted-foreground">{msg.text}</p>
            </div>
            {msg.action && (
              <Button onClick={() => navigate('/mon-espace?tab=badge')}><Upload className="mr-2 h-4 w-4" />Envoyer une photo</Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

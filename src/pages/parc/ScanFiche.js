import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, ScanLine, MapPin, Tag, History, Wrench, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { API, RESULTS, TONES, fmtDT } from './shared';

const ETATS = ['Bon', 'À surveiller', 'Défectueux'];
const ICON = { ok: CheckCircle2, bad: XCircle, warn: AlertTriangle };

function Row({ label, children }) {
  if (!children) return null;
  return <div className="flex justify-between gap-3 py-1.5 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{children}</span></div>;
}

// Fiche d'un matériel retrouvé par son code : infos de la fiche, confirmation du n° de série (comparaison tolérante),
// puis historique (dernières confirmations, séances où il est sorti, incidents).
export default function ScanFiche({ code, canWrite, onClose, onVerified }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [serial, setSerial] = useState('');
  const [etat, setEtat] = useState('');
  const [note, setNote] = useState('');
  const [adopt, setAdopt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    setError(''); setData(null); setDone(null); setSerial(''); setEtat(''); setNote(''); setAdopt(false);
    try { setData((await axios.get(`${API}/materiel-parc/scan/${encodeURIComponent(code)}`)).data); }
    catch (e) { setError(e.response?.data?.detail || 'Matériel introuvable.'); }
  }, [code]);
  useEffect(() => { load(); }, [load]);

  const verify = async (withSerial) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/materiel-parc/scan/${encodeURIComponent(data.code)}/verify`, {
        serial_lu: withSerial ? serial : null, etat: etat || null, note: note || null, enregistrer_serie: adopt,
      });
      setDone(res.data);
      if (res.data.serie_enregistree) toast.success('N° de série enregistré dans la fiche.');
      onVerified && onVerified();
      const h = await axios.get(`${API}/materiel-parc/scan/${encodeURIComponent(data.code)}`); setData(h.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'Confirmation impossible.'); }
    finally { setBusy(false); }
  };

  if (error) return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert" data-testid="fiche-error">
      <p className="font-medium">{error}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onClose}>Scanner un autre code</Button>
    </div>
  );
  if (!data) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const f = data.fiche;
  const noSerial = !f.numero_serie;
  const res = done ? RESULTS[done.result] : null;
  const Icon = res ? ICON[res.tone] : null;

  return (
    <div className="space-y-3" data-testid="fiche">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{data.code}</p>
            <h2 className="text-lg font-semibold leading-tight">{f.nom}</h2>
            <p className="text-sm text-muted-foreground">{[f.marque, f.modele].filter(Boolean).join(' · ') || f.categorie}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fermer"><X className="h-4 w-4" /></Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {f.categorie && <Badge variant="secondary">{f.categorie}</Badge>}
          {f.statut && <Badge variant="outline">{f.statut}</Badge>}
          {f.etat && <Badge variant="outline">{f.etat}</Badge>}
          {f.is_archived && <Badge variant="destructive">Archivé</Badge>}
        </div>
        <div className="mt-2 divide-y">
          <Row label="N° de série (fiche)"><span className="font-mono">{f.numero_serie || <em className="font-normal text-amber-700">non renseigné</em>}</span></Row>
          <Row label="Référence">{f.reference}</Row>
          <Row label="Salle"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{f.salle}</span></Row>
          <Row label="Groupe">{f.groupe}</Row>
          <Row label="Quantité">{f.quantite > 1 ? f.quantite : null}</Row>
        </div>
        {f.notes && <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">{f.notes}</p>}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><ScanLine className="h-4 w-4" />Confirmer ce matériel</p>
        <div>
          <Label htmlFor="serial-lu" className="text-xs">N° de série lu sur l'appareil {noSerial ? '(la fiche n\'en a pas)' : ''}</Label>
          <Input id="serial-lu" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Saisir le n° imprimé sur l'appareil"
            autoCapitalize="characters" autoCorrect="off" className="mt-1 h-12 font-mono text-base" data-testid="serial-input" />
          <p className="mt-1 text-[11px] text-muted-foreground">Espaces, tirets et majuscules sont ignorés lors de la comparaison.</p>
        </div>
        <div>
          <p className="mb-1 text-xs">État constaté (facultatif)</p>
          <div className="flex flex-wrap gap-1.5">
            {ETATS.map((e) => (
              <button key={e} type="button" onClick={() => setEtat(etat === e ? '' : e)}
                className={`rounded-full border px-3 py-1.5 text-sm ${etat === e ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}>{e}</button>
            ))}
          </div>
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Remarque (facultatif)" maxLength={300} />
        {noSerial && canWrite && serial.trim() && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={adopt} onChange={(e) => setAdopt(e.target.checked)} />Enregistrer ce n° dans la fiche</label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-12" disabled={busy || !serial.trim()} onClick={() => verify(true)} data-testid="verify-serial">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Comparer le n°
          </Button>
          <Button className="h-12" variant="outline" disabled={busy} onClick={() => verify(false)} data-testid="verify-present">Présent (sans n°)</Button>
        </div>
        {res && (
          <div className={`flex items-start gap-3 rounded-lg border-2 p-3 ${TONES[res.tone]}`} role="status" data-testid="verify-result">
            <Icon className="mt-0.5 h-6 w-6 shrink-0" />
            <div><p className="font-semibold">{res.label}</p><p className="text-sm opacity-90">{res.hint}</p></div>
          </div>
        )}
      </div>

      {(data.scans.length > 0 || data.seances.length > 0 || data.incidents.length > 0) && (
        <div className="rounded-xl border bg-card p-4 space-y-3 text-sm">
          {data.scans.length > 0 && (
            <div><p className="mb-1 flex items-center gap-2 font-semibold"><History className="h-4 w-4" />Dernières confirmations</p>
              <ul className="space-y-1">{data.scans.slice(0, 5).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-2 text-xs"><span className={`h-2 w-2 rounded-full ${RESULTS[s.result]?.tone === 'bad' ? 'bg-red-500' : RESULTS[s.result]?.tone === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span>{fmtDT(s.at)}</span><span className="font-medium">{s.by_name}</span><span className="text-muted-foreground">{RESULTS[s.result]?.label}{s.etat ? ` · ${s.etat}` : ''}</span></li>))}</ul></div>
          )}
          {data.seances.length > 0 && (
            <div><p className="mb-1 flex items-center gap-2 font-semibold"><Tag className="h-4 w-4" />Dernières séances où il est sorti</p>
              <ul className="space-y-0.5 text-xs">{data.seances.map((s) => <li key={s.id}>{s.date} · {s.poste}{s.superviseur ? ` · ${s.superviseur}` : ''}</li>)}</ul></div>
          )}
          {data.incidents.length > 0 && (
            <div><p className="mb-1 flex items-center gap-2 font-semibold"><Wrench className="h-4 w-4" />Incidents liés</p>
              <ul className="space-y-0.5 text-xs">{data.incidents.map((i) => <li key={i.id}>{i.date} · {i.poste} — {i.description} {i.resolu ? '(résolu)' : <strong className="text-amber-700">(ouvert)</strong>}</li>)}</ul></div>
          )}
        </div>
      )}
    </div>
  );
}

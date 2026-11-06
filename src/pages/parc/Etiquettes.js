import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Loader2, Printer, QrCode, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { API, codeUrl } from './shared';

// Planche d'étiquettes : un QR (adresse de la fiche) + nom + code + n° de série, à imprimer sur papier autocollant.
// Les codes sont créés une fois pour toutes (jamais modifiés) : une étiquette imprimée reste valable.
export default function Etiquettes({ items, canWrite, reload }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState({});
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState({});

  const withCode = useMemo(() => items.filter((i) => i.code), [items]);
  const missing = items.length - withCode.length;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return withCode.filter((i) => !s || [i.nom, i.code, i.numero_serie, i.salle, i.categorie].some((v) => String(v || '').toLowerCase().includes(s)));
  }, [withCode, q]);
  const chosen = withCode.filter((i) => sel[i.id]);

  // QR générés dans le navigateur (aucun envoi vers un service externe).
  useEffect(() => {
    let alive = true;
    (async () => {
      const next = {};
      for (const i of chosen) next[i.id] = qr[i.id] || await QRCode.toDataURL(codeUrl(i.code), { margin: 1, width: 240, errorCorrectionLevel: 'M' });
      if (alive) setQr((cur) => ({ ...cur, ...next }));
    })();
    return () => { alive = false; };
  }, [sel, items]); // eslint-disable-line

  const generate = async () => {
    setBusy(true);
    try { const r = await axios.post(`${API}/materiel-parc/generate`); toast.success(`${r.data.created} code(s) créé(s).`); await reload(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Génération impossible.'); }
    finally { setBusy(false); }
  };
  const toggleAll = (on) => setSel(on ? Object.fromEntries(shown.map((i) => [i.id, true])) : {});

  return (
    <div className="space-y-3">
      <style>{`@media print { html, body { background: #fff !important; } body * { visibility: hidden !important; } #parc-print, #parc-print * { visibility: visible !important; } #parc-print { position: absolute; left: 0; top: 0; width: 100%; } @page { margin: 8mm; } }`}</style>

      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-sm"><strong>{withCode.length}</strong> matériel(s) avec étiquette · <strong>{missing}</strong> sans code</p>
        {missing > 0 && (canWrite
          ? <Button onClick={generate} disabled={busy} data-testid="generate-codes">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}Créer les {missing} code(s) manquant(s)</Button>
          : <p className="text-xs text-muted-foreground">Seul un Admin (ou un groupe Régisseurs en écriture) peut créer les codes.</p>)}
        <p className="text-[11px] text-muted-foreground">Créer les codes n'en change aucun existant et ne modifie aucune fiche matériel.</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un matériel, un code, un n° de série…" className="h-10 pl-9" /></div>
        <Button variant="outline" onClick={() => toggleAll(chosen.length < shown.length)}>{chosen.length < shown.length ? 'Tout cocher' : 'Tout décocher'}</Button>
      </div>

      <ul className="divide-y rounded-xl border bg-card">
        {shown.map((i) => (
          <li key={i.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
              <input type="checkbox" className="h-5 w-5" checked={!!sel[i.id]} onChange={(e) => setSel((c) => ({ ...c, [i.id]: e.target.checked }))} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{i.nom}</span>
                <span className="block truncate text-xs text-muted-foreground">{[i.categorie, i.salle, i.numero_serie && `S/N ${i.numero_serie}`].filter(Boolean).join(' · ')}</span></span>
              <span className="font-mono text-xs text-muted-foreground">{i.code}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Aucun matériel avec étiquette.</li>}
      </ul>

      <div className="sticky bottom-2">
        <Button className="h-12 w-full shadow-lg" disabled={chosen.length === 0} onClick={() => window.print()} data-testid="print-labels">
          <Printer className="mr-2 h-5 w-5" />Imprimer {chosen.length} étiquette(s)
        </Button>
      </div>

      {/* Planche réellement imprimée (invisible à l'écran) */}
      <div id="parc-print" className="hidden print:block" aria-hidden="true">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3mm' }}>
          {chosen.map((i) => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: '2.5mm', border: '0.3mm dashed #999', padding: '2mm', height: '30mm', breakInside: 'avoid', color: '#000' }}>
              {qr[i.id] && <img src={qr[i.id]} alt="" style={{ width: '25mm', height: '25mm' }} />}
              <div style={{ minWidth: 0, fontFamily: 'Arial, sans-serif' }}>
                <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '0.5pt' }}>PAV</div>
                <div style={{ fontSize: '8.5pt', fontWeight: 700, lineHeight: 1.15, overflow: 'hidden', maxHeight: '13mm' }}>{i.nom}</div>
                <div style={{ fontSize: '8pt', fontFamily: 'monospace', marginTop: '1mm' }}>{i.code}</div>
                {i.numero_serie && <div style={{ fontSize: '6.5pt', fontFamily: 'monospace' }}>S/N {i.numero_serie}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

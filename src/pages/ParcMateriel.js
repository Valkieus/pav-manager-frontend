import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, QrCode, ScanLine, ClipboardCheck, Search, Keyboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import CameraScanner from './parc/CameraScanner';
import ScanFiche from './parc/ScanFiche';
import Etiquettes from './parc/Etiquettes';
import Suivi from './parc/Suivi';
import { API, extractCode } from './parc/shared';

const TABS = [
  { id: 'scan', label: 'Scanner', icon: ScanLine },
  { id: 'labels', label: 'Étiquettes', icon: QrCode },
  { id: 'suivi', label: 'Suivi', icon: ClipboardCheck },
];

// Gestion de parc par QR code (page ADDITIVE : n'altère ni le stock ni les entrées/sorties existants).
// /parc-materiel : scanner, étiquettes, suivi.  /parc/<code> : adresse écrite dans chaque QR -> ouvre directement la fiche.
export default function ParcMateriel({ embedded = false }) {
  const { code: routeCode } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const canWrite = isAdmin() || isSuperAdmin() || (user?.branches || []).includes('Régisseurs');
  const [tab, setTab] = useState('scan');
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState(routeCode ? extractCode(routeCode) : '');
  const [manual, setManual] = useState('');
  const [q, setQ] = useState('');

  const reload = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([axios.get(`${API}/materiel-parc/items`), axios.get(`${API}/materiel-parc/stats`)]);
      setItems(a.data); setStats(b.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'Chargement du parc impossible.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const open = (raw) => { const c = extractCode(raw); if (c) { setCode(c); setTab('scan'); window.scrollTo({ top: 0 }); } };
  const close = () => { setCode(''); setManual(''); if (routeCode) navigate('/parc-materiel', { replace: true }); };

  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return items.filter((i) => [i.nom, i.numero_serie, i.code, i.reference, i.marque, i.modele].some((v) => String(v || '').toLowerCase().includes(s))).slice(0, 8);
  }, [items, q]);

  return (
    <div className={embedded ? "mx-auto max-w-3xl space-y-4" : "mx-auto max-w-3xl space-y-4 p-3 sm:p-6"} data-testid="parc-materiel">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Parc matériel</h1>
        <p className="text-sm text-muted-foreground">Scannez l'étiquette d'un matériel pour ouvrir sa fiche et confirmer son numéro de série.</p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium ${tab === t.id ? 'bg-background shadow' : 'text-muted-foreground'}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <>
          {tab === 'scan' && (code ? (
            <ScanFiche code={code} canWrite={canWrite} onClose={close} onVerified={reload} />
          ) : (
            <div className="space-y-4">
              <CameraScanner onCode={open} />
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); open(manual); }}>
                <div className="relative flex-1"><Keyboard className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Code : PAV-XXXXXX" autoCapitalize="characters" className="h-11 pl-9 font-mono" data-testid="manual-code" /></div>
                <Button type="submit" className="h-11" disabled={!manual.trim()}>Ouvrir</Button>
              </form>
              <div className="rounded-xl border bg-card p-3">
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher par nom ou n° de série (étiquette abîmée…)" className="h-10 pl-9" data-testid="search-parc" /></div>
                {found.length > 0 && (
                  <ul className="mt-2 divide-y">{found.map((i) => (
                    <li key={i.id}><button type="button" disabled={!i.code} onClick={() => open(i.code)} className="flex w-full items-center justify-between gap-2 py-2 text-left disabled:opacity-50">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{i.nom}</span><span className="block truncate text-xs text-muted-foreground">{[i.categorie, i.numero_serie && `S/N ${i.numero_serie}`].filter(Boolean).join(' · ')}</span></span>
                      <span className="font-mono text-xs text-muted-foreground">{i.code || 'sans code'}</span></button></li>))}</ul>
                )}
              </div>
            </div>
          ))}
          {tab === 'labels' && <Etiquettes items={items} canWrite={canWrite} reload={reload} />}
          {tab === 'suivi' && <Suivi items={items} stats={stats} onOpen={open} />}
        </>
      )}
    </div>
  );
}

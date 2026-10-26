import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Check, Loader2, Minus, Search, Shield, Users, X } from 'lucide-react';
import { TabsContent } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const MODE_TONE = { complet: 'bg-emerald-100 text-emerald-800', limite: 'bg-amber-100 text-amber-800', lecture: 'bg-slate-100 text-slate-700' };

// Droits de chacun, en détail : niveau, groupes, planning, chaque droit et d'où il vient ; ou tableau de comparaison.
export function UserRightsTab() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState('person'); // 'person' | 'compare'
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/rights/overview`).then((r) => setOverview(r.data)).catch((e) => setError(e.response?.data?.detail || 'Chargement impossible'));
  }, []);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setLoadingDetail(true);
    axios.get(`${API}/admin/rights/users/${selectedId}`).then((r) => setDetail(r.data)).catch(() => setDetail(null)).finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const users = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (overview?.users || []).filter((u) => !t || u.full_name.toLowerCase().includes(t) || (u.groups || []).some((g) => (g || '').toLowerCase().includes(t)) || (u.niveau_acces || '').toLowerCase().includes(t));
  }, [overview, q]);

  return (
    <TabsContent value="userrights" className="space-y-4" data-testid="user-rights-tab">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher une personne, un groupe, un niveau…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="inline-flex rounded-lg border overflow-hidden">
          <button type="button" onClick={() => setView('person')} className={`h-10 px-3 text-sm ${view === 'person' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Par personne</button>
          <button type="button" onClick={() => setView('compare')} className={`h-10 px-3 text-sm ${view === 'compare' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} data-testid="rights-compare">Comparer</button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!overview && !error && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}

      {overview && view === 'person' && (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card className="lg:max-h-[75vh] overflow-y-auto"><CardContent className="p-2 space-y-1">
            {users.map((u) => (
              <button key={u.id} type="button" onClick={() => setSelectedId(u.id)} data-testid="rights-user"
                className={`w-full text-left rounded-lg px-3 py-2 ${selectedId === u.id ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted'}`}>
                <p className="font-medium text-sm truncate">{u.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.niveau_acces}{u.groups.length ? ` · ${u.groups.join(', ')}` : ''}</p>
              </button>
            ))}
            {users.length === 0 && <p className="p-3 text-sm text-muted-foreground">Aucune personne.</p>}
          </CardContent></Card>
          <div>
            {!selectedId && <p className="text-sm text-muted-foreground p-4">Choisis une personne pour voir ses droits en détail.</p>}
            {selectedId && loadingDetail && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
            {detail && !loadingDetail && <Detail d={detail} />}
          </div>
        </div>
      )}

      {overview && view === 'compare' && <Compare overview={overview} users={users} />}
    </TabsContent>
  );
}

function Detail({ d }) {
  const allowed = d.permissions.filter((p) => p.allowed);
  const denied = d.permissions.filter((p) => !p.allowed);
  return (
    <div className="space-y-4" data-testid="rights-detail">
      <div>
        <h3 className="text-lg font-semibold">{d.full_name} <span className="text-sm font-normal text-muted-foreground">@{d.username}</span></h3>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <Badge>{d.niveau_acces}</Badge>
          {(d.branches || []).map((b) => <Badge key={b} variant="outline">{b}</Badge>)}
          {d.is_active === false && <Badge variant="destructive">Compte désactivé</Badge>}
        </div>
      </div>
      <Card><CardContent className="p-4 space-y-2">
        <p className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Groupes ({d.groups.length})</p>
        {d.groups.length === 0 && <p className="text-sm text-muted-foreground">Aucun groupe : uniquement les droits du niveau d'accès.</p>}
        {d.groups.map((g) => (
          <div key={g.id} className="rounded-lg border p-3 text-sm space-y-1">
            <p className="font-medium flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />{g.name}</p>
            {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
            {g.permissions.length > 0 && <p className="text-xs"><span className="text-muted-foreground">Droits : </span>{g.permissions.join(' · ')}</p>}
            <p className="text-xs"><span className="text-muted-foreground">Planning : </span>{g.planning_full_control ? 'accès complet' : g.planning_scope.length ? g.planning_scope.join(', ') : '—'}{g.planning_structure && !g.planning_full_control ? ' · peut modifier les lignes' : ''}</p>
            {Object.keys(g.scope_map).length > 0 && <p className="text-xs"><span className="text-muted-foreground">Périmètres : </span>{Object.entries(g.scope_map).map(([k, v]) => `${k} : ${v.join(', ')}`).join(' · ')}</p>}
          </div>
        ))}
      </CardContent></Card>
      <Card><CardContent className="p-4 space-y-1">
        <p className="text-sm font-semibold">Planning</p>
        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${MODE_TONE[d.planning.mode]}`}>{d.planning.label}</span>
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <p className="text-sm font-semibold mb-2">Droits accordés ({allowed.length})</p>
        <ul className="divide-y">
          {allowed.map((p) => (
            <li key={p.key} className="py-2 flex gap-2 text-sm"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div><p>{p.label}</p><p className="text-xs text-muted-foreground">{p.sources.join(' · ')}</p></div></li>
          ))}
          {allowed.length === 0 && <li className="py-2 text-sm text-muted-foreground">Aucun droit particulier accordé.</li>}
        </ul>
        {denied.length > 0 && (
          <details className="mt-3"><summary className="text-sm text-muted-foreground cursor-pointer">Droits non accordés ({denied.length})</summary>
            <ul className="mt-2 space-y-1">{denied.map((p) => <li key={p.key} className="flex gap-2 text-sm text-muted-foreground"><X className="w-4 h-4 shrink-0 mt-0.5" />{p.label}</li>)}</ul>
          </details>
        )}
      </CardContent></Card>
    </div>
  );
}

// Tableau personnes × droits : on voit d'un coup d'œil qui peut quoi (ex. Nathalie / Joanna / Nicolas).
function Compare({ overview, users }) {
  const [picked, setPicked] = useState([]);
  const cols = overview.catalog;
  const rows = picked.length ? users.filter((u) => picked.includes(u.id)) : users;
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div className="space-y-2" data-testid="rights-compare-table">
      <p className="text-xs text-muted-foreground">Coche des personnes pour les comparer ({picked.length ? `${picked.length} choisie(s)` : 'toutes affichées'}). ✓ = droit accordé.</p>
      {picked.length > 0 && <Button size="sm" variant="ghost" onClick={() => setPicked([])}>Tout afficher</Button>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="text-xs min-w-full">
          <thead className="bg-muted">
            <tr>
              <th className="sticky left-0 bg-muted text-left px-3 py-2 min-w-[190px]">Personne</th>
              <th className="px-2 py-2 min-w-[150px] text-left">Planning</th>
              {cols.map((c) => <th key={c.key} className="px-2 py-2 align-bottom"><span className="block max-w-[110px] font-medium leading-tight">{c.label.split(' — ')[0]}<br /><span className="font-normal text-muted-foreground">{c.label.split(' — ')[1] || ''}</span></span></th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="sticky left-0 bg-background px-3 py-2">
                  <label className="flex items-start gap-2 cursor-pointer"><input type="checkbox" className="mt-0.5" checked={picked.includes(u.id)} onChange={() => toggle(u.id)} />
                    <span><span className="font-medium block">{u.full_name}</span><span className="text-muted-foreground">{u.niveau_acces}{u.groups.length ? ` · ${u.groups.join(', ')}` : ''}</span></span></label>
                </td>
                <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 ${MODE_TONE[u.planning.mode]}`}>{u.planning.mode === 'complet' ? 'Complet' : u.planning.mode === 'lecture' ? 'Lecture' : (u.planning.sections.join(', ') || 'Aucune')}</span></td>
                {cols.map((c) => <td key={c.key} className="px-2 py-2 text-center">{u.granted.includes(c.key) ? <Check className="w-4 h-4 text-emerald-600 inline" /> : <Minus className="w-3.5 h-3.5 text-muted-foreground/40 inline" />}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, CircleDashed, Hash, QrCode } from 'lucide-react';
import { RESULTS, fmtDT } from './shared';

function Tile({ icon: Icon, label, value, tone, active, onClick }) {
  const cls = { ok: 'text-emerald-600', bad: 'text-red-600', warn: 'text-amber-600', mute: 'text-muted-foreground' }[tone];
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border bg-card p-3 text-left transition ${active ? 'ring-2 ring-primary' : ''}`}>
      <Icon className={`h-5 w-5 ${cls}`} /><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p>
    </button>
  );
}

// Tableau de bord d'inventaire : où en est-on de l'étiquetage et des vérifications, et quoi traiter en priorité.
export default function Suivi({ items, stats, onOpen }) {
  const [filter, setFilter] = useState('ecarts');
  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  if (!stats) return null;
  const pct = stats.total ? Math.round((stats.verifies_recemment / stats.total) * 100) : 0;
  const lists = { ecarts: stats.ecarts_ids, jamais: stats.jamais_ids, serie: stats.sans_serie_ids };
  const rows = (lists[filter] || []).map((id) => byId[id]).filter(Boolean);
  const titles = { ecarts: 'Écarts de n° de série à vérifier', jamais: 'Jamais vérifiés', serie: 'Fiches sans n° de série' };

  return (
    <div className="space-y-3" data-testid="suivi">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-baseline justify-between"><p className="text-sm font-semibold">Inventaire des {stats.days} derniers jours</p><p className="text-2xl font-bold tabular-nums">{pct} %</p></div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
        <p className="mt-1 text-xs text-muted-foreground">{stats.verifies_recemment} matériel(s) vérifié(s) sur {stats.total}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile icon={QrCode} label="Étiquetés" value={`${stats.etiquetes}/${stats.total}`} tone="mute" />
        <Tile icon={AlertTriangle} label="Écarts de n° de série" value={stats.ecarts} tone={stats.ecarts ? 'bad' : 'ok'} active={filter === 'ecarts'} onClick={() => setFilter('ecarts')} />
        <Tile icon={CircleDashed} label="Jamais vérifiés" value={stats.jamais_verifies} tone={stats.jamais_verifies ? 'warn' : 'ok'} active={filter === 'jamais'} onClick={() => setFilter('jamais')} />
        <Tile icon={Hash} label="Sans n° de série" value={stats.sans_numero_serie} tone={stats.sans_numero_serie ? 'warn' : 'ok'} active={filter === 'serie'} onClick={() => setFilter('serie')} />
      </div>
      <div className="rounded-xl border bg-card">
        <p className="border-b px-3 py-2 text-sm font-semibold">{titles[filter]}</p>
        {rows.length === 0 ? <p className="flex items-center gap-2 p-4 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Rien à traiter ici.</p> : (
          <ul className="divide-y">{rows.map((i) => (
            <li key={i.id}><button type="button" disabled={!i.code} onClick={() => onOpen(i.code)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:opacity-60">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{i.nom}</span>
                <span className="block truncate text-xs text-muted-foreground">{[i.categorie, i.salle].filter(Boolean).join(' · ')}{i.last_scan_at ? ` · vérifié ${fmtDT(i.last_scan_at)} (${RESULTS[i.last_result]?.label})` : ''}</span></span>
              <span className="font-mono text-xs text-muted-foreground">{i.code || 'sans code'}</span>
            </button></li>))}</ul>
        )}
      </div>
    </div>
  );
}

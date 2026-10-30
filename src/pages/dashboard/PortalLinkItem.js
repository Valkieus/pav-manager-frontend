import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { API } from '../administration/constants';
import { Award, BookOpen, ExternalLink, Globe, Lightbulb, Loader2, Music, Palette, Youtube } from 'lucide-react';
import { TONES } from './portalLinks';

// Maintenance d'un site annexe / lien du portail (entrée « site:<id> » ou site entier) : un seul appel partagé, rafraîchi toutes les 60 s.
let _maint = { at: 0, p: null };
const loadMaintenance = () => {
  if (!_maint.p || Date.now() - _maint.at > 60000) {
    _maint = { at: Date.now(), p: axios.get(`${API}/maintenance`).then((r) => r.data.entries || []).catch(() => []) };
  }
  return _maint.p;
};
function useLinkMaintenance(id) {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  useEffect(() => { loadMaintenance().then(setEntries); }, []);
  if (!user || user.niveau_acces === 'Super Admin') return null;
  return entries.find((e) => (e.scope === 'site' || (e.scope === 'page' && e.page_path === `site:${id}`)) && (!e.affected_roles || e.affected_roles.length === 0 || e.affected_roles.includes(user.niveau_acces))) || null;
}

const ICONS = { globe: Globe, youtube: Youtube, palette: Palette, award: Award, lightbulb: Lightbulb, music: Music, book: BookOpen };

// Un lien de la barre (même rendu en bandeau PC et en liste téléphone).
export function PortalLinkItem({ link, onOpen, busy, fullWidth = false }) {
  const maint = useLinkMaintenance(link.id);
  const t = TONES[link.tone] || TONES.primary;
  const Icon = ICONS[link.icon] || Globe;
  const cls = `flex ${fullWidth ? '' : 'shrink-0'} items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border ${t.hover} hover:shadow-md transition-all group text-left disabled:opacity-60`;
  const body = (
    <>
      <div className={`w-8 h-8 rounded-lg ${t.bg} flex items-center justify-center shrink-0`}>
        {busy ? <Loader2 className={`w-4 h-4 ${t.icon} animate-spin`} /> : <Icon className={`w-4 h-4 ${t.icon}`} />}
      </div>
      <div className="whitespace-nowrap">
        <p className={`font-medium text-sm ${t.text} transition-colors`}>{link.label}</p>
        {maint ? <p className="text-xs text-amber-500" title={maint.message || ''} data-testid={`portal-${link.id}-maintenance`}>En maintenance</p> : link.subtitle && <p className="text-xs text-muted-foreground">{link.subtitle}</p>}
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
    </>
  );
  if (maint) {
    return <button type="button" disabled title={maint.message || 'En maintenance'} className={cls} data-testid={`portal-${link.id}`}>{body}</button>;
  }
  if (link.kind === 'url') {
    return <a href={link.url} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>;
  }
  return <button type="button" onClick={() => onOpen(link)} disabled={busy} className={cls} data-testid={`portal-${link.id}`}>{body}</button>;
}

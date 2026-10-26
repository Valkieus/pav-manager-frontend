import { Award, BookOpen, ExternalLink, Globe, Lightbulb, Loader2, Music, Palette, Youtube } from 'lucide-react';
import { TONES } from './portalLinks';

const ICONS = { globe: Globe, youtube: Youtube, palette: Palette, award: Award, lightbulb: Lightbulb, music: Music, book: BookOpen };

// Un lien de la barre (même rendu en bandeau PC et en liste téléphone).
export function PortalLinkItem({ link, onOpen, busy, fullWidth = false }) {
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
        {link.subtitle && <p className="text-xs text-muted-foreground">{link.subtitle}</p>}
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
    </>
  );
  if (link.kind === 'url') {
    return <a href={link.url} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>;
  }
  return <button type="button" onClick={() => onOpen(link)} disabled={busy} className={cls} data-testid={`portal-${link.id}`}>{body}</button>;
}

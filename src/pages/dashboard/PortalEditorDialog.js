import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { ALL_ROLES, DEFAULT_LINKS } from './portalLinks';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BUILTIN = new Set(DEFAULT_LINKS.map((d) => d.id));
const KIND_NOTE = { led: 'Ouvre PAV LED déjà connecté (réservé à ceux qui ont accès à LED).', academy: "Ouvre PAV Academy déjà connecté (réservé à ceux qui y ont accès).", songs: 'Ouvre CEC Songs déjà connecté.' };

// Super Admin : modifier la barre (libellés, adresses, ordre, masquer) et choisir QUI voit chaque lien.
export function PortalEditorDialog({ open, onOpenChange, links, onSaved }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setRows(links.map((l) => ({ ...l, roles: [...(l.roles || [])] }))); }, [open, links]);

  const patch = (i, p) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i, d) => setRows((r) => { const n = [...r]; const j = i + d; if (j < 0 || j >= n.length) return r; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const toggleRole = (i, role) => patch(i, { roles: rows[i].roles.includes(role) ? rows[i].roles.filter((x) => x !== role) : [...rows[i].roles, role] });
  const add = () => setRows((r) => [...r, { id: `lien-${Date.now().toString(36)}`, label: '', subtitle: '', url: 'https://', kind: 'url', roles: [], enabled: true, icon: 'globe', tone: 'primary' }]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = rows.map((r) => ({ id: r.id, label: r.label.trim(), subtitle: (r.subtitle || '').trim(), url: r.kind === 'url' ? r.url.trim() : '', kind: r.kind, roles: r.roles, enabled: r.enabled }));
      const res = await axios.put(`${API}/dashboard/portal-links`, { links: payload });
      toast.success('Barre enregistrée');
      onSaved(res.data.links);
      onOpenChange(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || (Array.isArray(e.response?.data?.detail) ? 'Vérifie les champs' : "Enregistrement impossible"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto" data-testid="portal-editor">
        <DialogHeader>
          <DialogTitle>Modifier la barre « Portail Charisma »</DialogTitle>
          <DialogDescription>Change l'ordre, masque ou ajoute des liens, et choisis qui voit chacun. Sans case cochée, le lien est visible par tous.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.id} className={`rounded-xl border p-3 space-y-2 ${r.enabled ? '' : 'opacity-60'}`} data-testid="portal-row">
              <div className="flex items-center gap-2">
                <Input value={r.label} onChange={(e) => patch(i, { label: e.target.value })} placeholder="Nom du lien" className="font-medium" maxLength={60} />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-md border disabled:opacity-30" aria-label="Monter"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="p-1.5 rounded-md border disabled:opacity-30" aria-label="Descendre"><ArrowDown className="w-4 h-4" /></button>
                <label className="flex items-center gap-1.5 text-xs shrink-0"><Switch checked={r.enabled} onCheckedChange={(v) => patch(i, { enabled: v })} />{r.enabled ? 'Affiché' : 'Masqué'}</label>
                {!BUILTIN.has(r.id) && <button type="button" onClick={() => setRows((x) => x.filter((_, k) => k !== i))} className="p-1.5 rounded-md border border-destructive text-destructive" aria-label="Supprimer le lien"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <Input value={r.subtitle || ''} onChange={(e) => patch(i, { subtitle: e.target.value })} placeholder="Sous-titre (facultatif)" maxLength={80} className="text-sm" />
              {r.kind === 'url' ? (
                <Input value={r.url} onChange={(e) => patch(i, { url: e.target.value })} placeholder="https://…" className="text-sm" data-testid="portal-url" />
              ) : <p className="text-xs text-muted-foreground">{KIND_NOTE[r.kind]}</p>}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Visible pour {r.roles.length === 0 ? '(tous)' : ':'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_ROLES.map((role) => {
                    const on = r.roles.includes(role);
                    return <button key={role} type="button" onClick={() => toggleRole(i, role)} aria-pressed={on}
                      className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>{role}</button>;
                  })}
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={add}><Plus className="w-4 h-4 mr-2" />Ajouter un lien</Button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving || rows.some((r) => !r.label.trim())} data-testid="portal-save">{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enregistrer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

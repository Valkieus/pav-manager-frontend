import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Check, X, Clock, ShoppingCart, KeyRound, Settings2, Loader2, ChevronDown, ChevronUp, CircleDot, FileText, Receipt,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const eur = (n) => (n === null || n === undefined || n === '' ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n));
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

const ETAPE_LABEL = { live: 'Chez le Live', validation: 'En validation', execution: 'À commander / louer', terminee: 'Terminée', refusee: 'Refusée' };
const ETAPE_TONE = {
  live: 'bg-sky-100 text-sky-800', validation: 'bg-amber-100 text-amber-800', execution: 'bg-violet-100 text-violet-800',
  terminee: 'bg-emerald-100 text-emerald-800', refusee: 'bg-red-100 text-red-800',
};
const STEPS = ['live', 'validation', 'execution', 'terminee'];
const STEP_NAME = { live: 'Live', validation: 'Validation', execution: 'Exécution', terminee: 'Terminée' };

// Frise : Responsable ✓ → Live → Validation (un point par validateur) → Exécution → Terminée
function Timeline({ a, names }) {
  const idx = a.etape === 'refusee' ? -1 : STEPS.indexOf(a.etape);
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs" aria-label="Suivi de la demande">
      <li className="inline-flex items-center gap-1 text-emerald-700"><Check className="w-3.5 h-3.5" /> Responsable</li>
      {STEPS.map((s, i) => {
        const done = a.etape === 'terminee' || (idx >= 0 && i < idx);
        const cur = idx === i && a.etape !== 'terminee';
        return (
          <li key={s} className="inline-flex items-center gap-1">
            <span className="text-muted-foreground mx-0.5">›</span>
            <span className={`inline-flex items-center gap-1 ${done ? 'text-emerald-700' : cur ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
              {done ? <Check className="w-3.5 h-3.5" /> : cur ? <CircleDot className="w-3.5 h-3.5 text-primary" /> : <Clock className="w-3.5 h-3.5" />}
              {STEP_NAME[s]}
              {s === 'validation' && (a.validations || []).length > 0 && (
                <span className="inline-flex items-center gap-1 ml-1">
                  {a.validations.map((v) => (
                    <span key={v.user_id} title={`${names[v.user_id] || v.name || 'Validateur'} : ${v.decision === 'approve' ? 'approuvé' : v.decision === 'reject' ? 'refusé' : 'en attente'}`}
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] ${v.decision === 'approve' ? 'border-emerald-500 text-emerald-700' : v.decision === 'reject' ? 'border-red-500 text-red-700' : 'border-border text-muted-foreground'}`}>
                      {(names[v.user_id] || v.name || '?').split(' ')[0]} {v.decision === 'approve' ? '✓' : v.decision === 'reject' ? '✗' : '…'}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TextPrompt({ open, title, label, required, onClose, onConfirm, extra }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setText(''); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{label}</DialogDescription></DialogHeader>
        {extra}
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={required ? 'Motif (obligatoire)' : 'Commentaire (facultatif)'} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={busy || (required && !text.trim())} onClick={async () => { setBusy(true); try { await onConfirm(text); } finally { setBusy(false); } }}>Confirmer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UserPicker({ label, users, value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="max-h-40 overflow-y-auto rounded-md border p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
        {users.map((u) => (
          <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={value.includes(u.id)} onChange={() => toggle(u.id)} />
            {u.full_name}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function AchatsTab({ fournisseurs, isAdmin }) {
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [circuit, setCircuit] = useState({ live_ids: [], validateur_ids: [], executant_ids: [], names: {} });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todo');
  const [open, setOpen] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [circuitOpen, setCircuitOpen] = useState(false);
  const [liveFor, setLiveFor] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [users, setUsers] = useState([]);
  const [circuitDraft, setCircuitDraft] = useState(null);
  const [form, setForm] = useState({ titre: '', type: 'achat', piece: 'devis', description: '', montant: '', fournisseur_id: '', evenement: '', technicien_nom: '', date_debut: '', date_fin: '' });
  const [liveForm, setLiveForm] = useState({ fournisseur_id: '', montant: '', note: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, l, c] = await Promise.all([axios.get(`${API}/achats/me`), axios.get(`${API}/achats`), axios.get(`${API}/achats/circuit`)]);
      setMe(m.data); setItems(l.data); setCircuit(c.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur de chargement des demandes');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast.success(okMsg); await load(); } catch (e) { toast.error(e.response?.data?.detail || 'Action impossible'); }
  };

  // Ce que j'ai à faire sur une demande
  const myAction = useCallback((a) => {
    if (!me) return null;
    if (a.etape === 'live' && me.live) return 'live';
    if (a.etape === 'validation' && (a.validations || []).some((v) => v.user_id === me.id && !v.decision)) return 'validate';
    if (a.etape === 'execution' && me.executant) return 'execute';
    return null;
  }, [me]);

  const shown = useMemo(() => items.filter((a) => {
    if (filter === 'todo') return !!myAction(a);
    if (filter === 'open') return !['terminee', 'refusee'].includes(a.etape);
    if (filter === 'done') return a.etape === 'terminee';
    if (filter === 'refused') return a.etape === 'refusee';
    return true;
  }), [items, filter, myAction]);
  const todoCount = items.filter((a) => myAction(a)).length;

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!me?.can_view) return <p className="text-muted-foreground py-6">Cette vue est réservée aux responsables.</p>;

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submitCreate = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/achats`, { ...form, montant: form.montant === '' ? null : Number(form.montant), fournisseur_id: form.fournisseur_id || null, date_debut: form.date_debut || null, date_fin: form.date_fin || null });
      toast.success('Demande envoyée au Live');
      setCreateOpen(false);
      setForm({ titre: '', type: 'achat', piece: 'devis', description: '', montant: '', fournisseur_id: '', evenement: '', technicien_nom: '', date_debut: '', date_fin: '' });
      await load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur'); } finally { setSaving(false); }
  };

  const openCircuit = async () => {
    if (isAdmin) { try { setUsers(((await axios.get(`${API}/auth/users`)).data || []).filter((u) => u.is_active !== false)); } catch { /* liste vide */ } }
    setCircuitDraft({ live_ids: circuit.live_ids, validateur_ids: circuit.validateur_ids, executant_ids: circuit.executant_ids });
    setCircuitOpen(true);
  };
  const nm = (ids) => ids.map((i) => circuit.names[i]).filter(Boolean).join(', ') || 'non défini';

  return (
    <div className="space-y-4" data-testid="achats-tab">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[['todo', `À faire par moi${todoCount ? ` (${todoCount})` : ''}`], ['open', 'En cours'], ['done', 'Terminées'], ['refused', 'Refusées'], ['all', 'Toutes']].map(([k, l]) => (
            <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>{l}</Button>
          ))}
        </div>
        <div className="flex gap-2">
          {isAdmin && <Button size="sm" variant="outline" onClick={openCircuit}><Settings2 className="w-4 h-4 mr-1.5" /> Circuit</Button>}
          {me.can_create && <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="achat-new"><Plus className="w-4 h-4 mr-1.5" /> Nouvelle demande</Button>}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Circuit : Responsable → <b>Live</b> ({nm(circuit.live_ids)}) → validation de <b>{nm(circuit.validateur_ids)}</b> (tous requis) → <b>{nm(circuit.executant_ids)}</b>.
      </p>

      {shown.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">Aucune demande dans cette vue.</CardContent></Card>}

      {shown.map((a) => {
        const todo = myAction(a);
        return (
          <Card key={a.id} className={todo ? 'border-primary' : ''} data-testid="achat-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{a.titre}</h3>
                    <Badge variant="outline" className="gap-1">{a.type === 'location' ? <KeyRound className="w-3 h-3" /> : <ShoppingCart className="w-3 h-3" />}{a.type === 'location' ? 'Location' : 'Achat'}</Badge>
                    <Badge variant="outline" className="gap-1">{a.piece === 'facture' ? <Receipt className="w-3 h-3" /> : <FileText className="w-3 h-3" />}{a.piece === 'facture' ? 'Facture' : 'Devis'}</Badge>
                    <Badge className={ETAPE_TONE[a.etape]}>{ETAPE_LABEL[a.etape]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {eur(a.montant)} · {a.fournisseur_nom || 'fournisseur à définir'} · par {a.created_by_name}{a.technicien_nom ? ` (pour ${a.technicien_nom})` : ''} · {fmt(a.created_at)}
                    {a.type === 'location' && a.date_debut ? ` · du ${a.date_debut} au ${a.date_fin || '…'}` : ''}{a.evenement ? ` · ${a.evenement}` : ''}
                  </p>
                  {a.description && <p className="text-sm mt-1 whitespace-pre-line">{a.description}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {todo === 'live' && <>
                    <Button size="sm" onClick={() => { setLiveForm({ fournisseur_id: a.fournisseur_id || '', montant: a.montant ?? '', note: '' }); setLiveFor(a); }}>Transmettre aux validateurs</Button>
                    <Button size="sm" variant="outline" onClick={() => setPrompt({ title: 'Refuser la demande', required: true, run: (t) => act(() => axios.post(`${API}/achats/${a.id}/reject`, { note: t }), 'Demande refusée') })}><X className="w-4 h-4 mr-1" /> Refuser</Button>
                  </>}
                  {todo === 'validate' && <>
                    <Button size="sm" onClick={() => setPrompt({ title: 'Valider la demande', required: false, run: (t) => act(() => axios.post(`${API}/achats/${a.id}/decision`, { decision: 'approve', comment: t }), 'Validation enregistrée') })}><Check className="w-4 h-4 mr-1" /> Valider</Button>
                    <Button size="sm" variant="outline" onClick={() => setPrompt({ title: 'Refuser la demande', required: true, run: (t) => act(() => axios.post(`${API}/achats/${a.id}/decision`, { decision: 'reject', comment: t }), 'Demande refusée') })}><X className="w-4 h-4 mr-1" /> Refuser</Button>
                  </>}
                  {todo === 'execute' && <>
                    <Button size="sm" onClick={() => setPrompt({ title: a.type === 'location' ? 'Location effectuée' : 'Commande effectuée', required: false, withRef: true, run: (t, ref) => act(() => axios.post(`${API}/achats/${a.id}/complete`, { note: t, facture_ref: ref || null }), 'Demande terminée') })}><Check className="w-4 h-4 mr-1" /> {a.type === 'location' ? 'Loué' : 'Commandé'}</Button>
                    <Button size="sm" variant="outline" onClick={() => setPrompt({ title: 'Refuser la demande', required: true, run: (t) => act(() => axios.post(`${API}/achats/${a.id}/reject`, { note: t }), 'Demande refusée') })}><X className="w-4 h-4 mr-1" /> Refuser</Button>
                  </>}
                </div>
              </div>

              {a.etape !== 'refusee' && <Timeline a={a} names={circuit.names} />}

              <button type="button" className="text-xs text-primary inline-flex items-center gap-1" onClick={() => setOpen((o) => ({ ...o, [a.id]: !o[a.id] }))}>
                {open[a.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Historique ({(a.history || []).length})
              </button>
              {open[a.id] && (
                <ul className="text-xs space-y-1 border-l-2 pl-3">
                  {(a.history || []).map((h, i) => (
                    <li key={i}><span className="text-muted-foreground">{fmt(h.at)}</span> — <b>{h.by}</b> : {h.action}{h.detail ? ` — ${h.detail}` : ''}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Nouvelle demande */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvelle demande</DialogTitle><DialogDescription>À créer une fois validée avec le technicien concerné : elle part au Live.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Achat ou location</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="achat">Achat</SelectItem><SelectItem value="location">Location</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Pièce</Label>
                <Select value={form.piece} onValueChange={(v) => setForm((f) => ({ ...f, piece: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="devis">Devis</SelectItem><SelectItem value="facture">Facture</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><Label>Titre</Label><Input value={form.titre} onChange={setF('titre')} /></div>
            <div className="space-y-1.5"><Label>Description / besoin</Label><Textarea value={form.description} onChange={setF('description')} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Montant estimé (€)</Label><Input type="number" value={form.montant} onChange={setF('montant')} /></div>
              <div className="space-y-1.5"><Label>Technicien demandeur</Label><Input value={form.technicien_nom} onChange={setF('technicien_nom')} placeholder="Facultatif" /></div>
            </div>
            <div className="space-y-1.5"><Label>Fournisseur</Label>
              <Select value={form.fournisseur_id || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, fournisseur_id: v === 'none' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">À définir par le Live</SelectItem>{(fournisseurs || []).map((f) => <SelectItem key={f.id} value={f.id}>{f.nom}</SelectItem>)}</SelectContent></Select></div>
            {form.type === 'location' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Du</Label><Input type="date" value={form.date_debut} onChange={setF('date_debut')} /></div>
                <div className="space-y-1.5"><Label>Au</Label><Input type="date" value={form.date_fin} onChange={setF('date_fin')} /></div>
              </div>
            )}
            <div className="space-y-1.5"><Label>Événement lié</Label><Input value={form.evenement} onChange={setF('evenement')} placeholder="Facultatif" /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button><Button disabled={saving || !form.titre.trim()} onClick={submitCreate}>Envoyer au Live</Button></div>
        </DialogContent>
      </Dialog>

      {/* Live : transmettre */}
      <Dialog open={!!liveFor} onOpenChange={(o) => !o && setLiveFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transmettre aux validateurs</DialogTitle><DialogDescription>{liveFor?.titre} — complète fournisseur et montant du devis.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Fournisseur</Label>
              <Select value={liveForm.fournisseur_id || 'none'} onValueChange={(v) => setLiveForm((f) => ({ ...f, fournisseur_id: v === 'none' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{(fournisseurs || []).map((f) => <SelectItem key={f.id} value={f.id}>{f.nom}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Montant (€)</Label><Input type="number" value={liveForm.montant} onChange={(e) => setLiveForm((f) => ({ ...f, montant: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Note</Label><Textarea rows={2} value={liveForm.note} onChange={(e) => setLiveForm((f) => ({ ...f, note: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setLiveFor(null)}>Annuler</Button>
            <Button onClick={() => act(() => axios.post(`${API}/achats/${liveFor.id}/live-submit`, { fournisseur_id: liveForm.fournisseur_id || null, montant: liveForm.montant === '' ? null : Number(liveForm.montant), note: liveForm.note }), 'Transmis aux validateurs').then(() => setLiveFor(null))}>Transmettre</Button></div>
        </DialogContent>
      </Dialog>

      <PromptHost prompt={prompt} onClose={() => setPrompt(null)} />

      {/* Circuit (Admin) */}
      <Dialog open={circuitOpen} onOpenChange={setCircuitOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Circuit des demandes</DialogTitle><DialogDescription>Qui fait quoi à chaque étape. Ces personnes voient aussi l'onglet.</DialogDescription></DialogHeader>
          {circuitDraft && (
            <div className="space-y-4">
              <UserPicker label="Live (monte la demande)" users={users} value={circuitDraft.live_ids} onChange={(v) => setCircuitDraft((d) => ({ ...d, live_ids: v }))} />
              <UserPicker label="Validateurs (tous doivent valider)" users={users} value={circuitDraft.validateur_ids} onChange={(v) => setCircuitDraft((d) => ({ ...d, validateur_ids: v }))} />
              <UserPicker label="Exécution (commande / location)" users={users} value={circuitDraft.executant_ids} onChange={(v) => setCircuitDraft((d) => ({ ...d, executant_ids: v }))} />
            </div>
          )}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCircuitOpen(false)}>Annuler</Button>
            <Button onClick={() => act(() => axios.put(`${API}/achats/circuit`, circuitDraft), 'Circuit enregistré').then(() => setCircuitOpen(false))}>Enregistrer</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Fenêtre de saisie générique (motif / commentaire / référence de facture)
function PromptHost({ prompt, onClose }) {
  const [ref, setRef] = useState('');
  useEffect(() => { setRef(''); }, [prompt]);
  return (
    <TextPrompt
      open={!!prompt}
      title={prompt?.title || ''}
      label={prompt?.required ? 'Un motif est obligatoire.' : 'Commentaire facultatif.'}
      required={prompt?.required}
      onClose={onClose}
      extra={prompt?.withRef ? <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="N° de facture / commande (facultatif)" /> : null}
      onConfirm={async (t) => { await prompt.run(t, ref); onClose(); }}
    />
  );
}

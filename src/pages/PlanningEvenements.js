import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import { Loader2, Plus, Trash2, PartyPopper, Pencil, Eye, Archive } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function slugify(label) {
  return (label || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `role_${Math.random().toString(36).slice(2, 7)}`;
}

function dateRange(debut, fin) {
  if (!debut || !fin || fin < debut) return [];
  const out = [];
  let [y, m, d] = debut.split('-').map(Number);
  const end = fin;
  let cur = new Date(y, m - 1, d);
  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  let guard = 0;
  while (fmt(cur) <= end && guard < 400) {
    out.push(fmt(cur));
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return out;
}

const emptyForm = () => ({
  titre: '',
  date_debut: todayIso(),
  date_fin: todayIso(),
  roles: [],
  affectations: {},
  notes: '',
});

export default function PlanningEvenements() {
  const { canManage, isSuperAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [techniciens, setTechniciens] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/planning-evenements`);
      setEvents(res.data);
    } catch (err) {
      toast.error("Erreur lors du chargement des événements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    axios.get(`${API}/techniciens`).then((res) => setTechniciens(res.data)).catch(() => {});
  }, [fetchEvents]);

  const technicienNames = useMemo(() => techniciens.map((t) => t.nom).sort(), [techniciens]);
  const dates = useMemo(() => dateRange(form.date_debut, form.date_fin), [form.date_debut, form.date_fin]);

  const openCreate = () => {
    setEditingId(null);
    setViewOnly(false);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (ev, readOnly) => {
    setEditingId(ev.id);
    setViewOnly(readOnly);
    setForm({
      titre: ev.titre,
      date_debut: ev.date_debut,
      date_fin: ev.date_fin,
      roles: ev.roles || [],
      affectations: ev.affectations || {},
      notes: ev.notes || '',
    });
    setDialogOpen(true);
  };

  const addRole = () => {
    if (!newRoleLabel.trim()) return;
    const key = slugify(newRoleLabel);
    if (form.roles.some((r) => r.key === key)) {
      toast.error('Un rôle avec ce nom existe déjà');
      return;
    }
    setForm((prev) => ({ ...prev, roles: [...prev.roles, { key, label: newRoleLabel.trim(), slots: 1 }] }));
    setNewRoleLabel('');
  };

  const removeRole = (key) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.filter((r) => r.key !== key),
    }));
  };

  const setSlots = (key, slots) => {
    const n = Math.max(1, Math.min(10, parseInt(slots, 10) || 1));
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.map((r) => (r.key === key ? { ...r, slots: n } : r)),
    }));
  };

  const setCell = (affKey, dateIdx, value) => {
    setForm((prev) => {
      const arr = [...(prev.affectations[affKey] || [])];
      arr[dateIdx] = value;
      return { ...prev, affectations: { ...prev.affectations, [affKey]: arr } };
    });
  };

  const handleSave = async () => {
    if (!form.titre.trim()) {
      toast.error('Titre requis');
      return;
    }
    if (!form.date_debut || !form.date_fin || form.date_fin < form.date_debut) {
      toast.error('Plage de dates invalide');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        titre: form.titre.trim(),
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        roles: form.roles,
        affectations: form.affectations,
        notes: form.notes || null,
      };
      if (editingId) {
        await axios.put(`${API}/planning-evenements/${editingId}`, payload);
        toast.success('Événement modifié');
      } else {
        await axios.post(`${API}/planning-evenements`, payload);
        toast.success('Événement créé');
      }
      setDialogOpen(false);
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (ev) => {
    if (!window.confirm(`Archiver l'événement "${ev.titre}" ?`)) return;
    try {
      await axios.put(`${API}/planning-evenements/${ev.id}/archive`);
      toast.success('Événement archivé');
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'archivage");
    }
  };

  const statusBadge = (ev) => {
    const today = todayIso();
    if (ev.date_fin < today) return <Badge variant="outline">Terminé</Badge>;
    if (ev.date_debut > today) return <Badge className="bg-blue-100 text-blue-800">À venir</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-800">En cours</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PartyPopper className="w-6 h-6" /> Événements
          </h1>
          <p className="text-muted-foreground">Plannings ponctuels en dehors du rythme habituel (vendredi/dimanche).</p>
        </div>
        {canManage() && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Nouvel événement
          </Button>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
      ) : events.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Aucun événement pour le moment.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <Card key={ev.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{ev.titre}</p>
                    {statusBadge(ev)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {ev.date_debut === ev.date_fin
                      ? new Date(`${ev.date_debut}T00:00:00`).toLocaleDateString('fr-FR')
                      : `${new Date(`${ev.date_debut}T00:00:00`).toLocaleDateString('fr-FR')} → ${new Date(`${ev.date_fin}T00:00:00`).toLocaleDateString('fr-FR')}`}
                    {' · '}{(ev.roles || []).length} rôle(s)
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(ev, !canManage())} title={canManage() ? 'Modifier' : 'Voir'}>
                    {canManage() ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  {isSuperAdmin() && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleArchive(ev)} title="Archiver">
                      <Archive className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewOnly ? form.titre : (editingId ? "Modifier l'événement" : 'Nouvel événement')}</DialogTitle>
            <DialogDescription>
              Structure libre : ajoute les rôles nécessaires puis affecte un nom par date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label>Titre</Label>
                <Input value={form.titre} disabled={viewOnly} onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))} placeholder="Ex: Soirée spéciale" />
              </div>
              <div className="space-y-1.5">
                <Label>Date de début</Label>
                <Input type="date" value={form.date_debut} disabled={viewOnly} onChange={(e) => setForm((p) => ({ ...p, date_debut: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date de fin</Label>
                <Input type="date" value={form.date_fin} disabled={viewOnly} onChange={(e) => setForm((p) => ({ ...p, date_fin: e.target.value }))} />
              </div>
            </div>

            {!viewOnly && (
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label>Ajouter un rôle</Label>
                  <Input
                    value={newRoleLabel}
                    onChange={(e) => setNewRoleLabel(e.target.value)}
                    placeholder="Ex: Régisseur, Caméra, Accueil..."
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }}
                  />
                </div>
                <Button variant="outline" onClick={addRole}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
              </div>
            )}

            {form.roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun rôle défini pour le moment.</p>
            ) : dates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Choisis une plage de dates valide pour voir la grille d'affectation.</p>
            ) : (
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="p-2 text-left font-medium sticky left-0 bg-muted/50">Rôle</th>
                      {dates.map((d) => (
                        <th key={d} className="p-2 text-center font-medium whitespace-nowrap">
                          {new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.roles.map((role) => (
                      Array.from({ length: role.slots }).map((_, slotIdx) => {
                        const affKey = `${role.key}_${slotIdx}`;
                        return (
                          <tr key={affKey} className="border-t border-border">
                            <td className="p-2 sticky left-0 bg-background">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{role.label}{role.slots > 1 ? ` #${slotIdx + 1}` : ''}</span>
                                {!viewOnly && slotIdx === 0 && (
                                  <>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={10}
                                      value={role.slots}
                                      onChange={(e) => setSlots(role.key, e.target.value)}
                                      className="w-14 h-7 text-xs"
                                      title="Nombre de postes"
                                    />
                                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeRole(role.key)} title="Supprimer ce rôle">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                            {dates.map((d, dateIdx) => (
                              <td key={d} className="p-1 text-center">
                                <input
                                  list="evenement-tech-list"
                                  disabled={viewOnly}
                                  value={form.affectations[affKey]?.[dateIdx] || ''}
                                  onChange={(e) => setCell(affKey, dateIdx, e.target.value)}
                                  className="w-28 text-xs border border-border rounded px-1.5 py-1 bg-background disabled:opacity-70 disabled:bg-muted/30"
                                  placeholder="—"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
                <datalist id="evenement-tech-list">
                  {technicienNames.map((n) => <option key={n} value={n} />)}
                </datalist>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes (optionnel)</Label>
              <Input value={form.notes || ''} disabled={viewOnly} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Infos complémentaires" />
            </div>
          </div>

          {!viewOnly && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

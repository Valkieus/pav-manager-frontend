import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Cloud, Cpu, Loader2, Eye, Trash2, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtBytes = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v < 1024) return `${v} o`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} Ko`;
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(1)} Mo`;
  return `${(v / 1024 ** 3).toFixed(2)} Go`;
};

const Bar = ({ percent }) => {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const color = p >= 80 ? "bg-red-500" : p >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${color}`} style={{ width: `${p}%` }} />
    </div>
  );
};

// ---- Charge du serveur Render (protection anti-saturation) ----
export function ServerLoadCard() {
  const [d, setD] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/infra/server-load`);
      setD(res.data);
    } catch (e) {
      setD(null);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Cpu className="w-5 h-5" /> Charge du serveur (Render)
        </CardTitle>
        <CardDescription>
          Au-delà de 92 % de mémoire, les envois lourds sont refusés quelques instants et les tâches de fond (vignettes, migrations)
          se mettent en pause ; la mémoire est libérée automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!d ? (
          <p className="text-sm text-muted-foreground">Lecture impossible pour le moment.</p>
        ) : (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Mémoire</span>
                <span className="font-semibold">{d.memory_mb} Mo / {d.memory_limit_mb} Mo ({d.memory_percent} %)</span>
              </div>
              <Bar percent={d.memory_percent} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Requêtes en cours</p><p className="font-semibold">{d.inflight} / {d.max_inflight}</p></div>
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Requêtes refusées</p><p className="font-semibold">{d.requests_shed}</p></div>
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Libérations mémoire</p><p className="font-semibold">{d.memory_trims}</p></div>
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">En ligne depuis</p><p className="font-semibold">{d.uptime_s >= 3600 ? `${Math.floor(d.uptime_s / 3600)} h ${Math.floor((d.uptime_s % 3600) / 60)} min` : `${Math.floor(d.uptime_s / 60)} min`}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={d.busy ? "destructive" : "secondary"}>{d.busy ? "Serveur chargé" : "Charge normale"}</Badge>
              {d.poster_job_running && <Badge variant="outline">Vignettes LED en cours</Badge>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Les deux comptes Cloudinary : usage + exploration des fichiers ----
export function CloudinaryAccountsCard({ canEdit = false }) {
  const [accounts, setAccounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ cloud: "", api_key: "", api_secret: "" });
  const [saving, setSaving] = useState(false);
  const [browse, setBrowse] = useState(null); // { account, cloud }
  const [rtype, setRtype] = useState("image");
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/infra/cloudinary-accounts`);
      setAccounts(res.data.accounts || []);
    } catch (e) {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const fetchPage = useCallback(async (account, type, next) => {
    setBusy(true);
    try {
      const res = await axios.get(`${API}/admin/infra/cloudinary-browse`, {
        params: { account, resource_type: type, ...(next ? { cursor: next } : {}) },
      });
      setItems((prev) => (next ? [...prev, ...res.data.items] : res.data.items));
      setCursor(res.data.next_cursor || null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Lecture impossible");
      if (!next) setItems([]);
      setCursor(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const openBrowse = (acc) => {
    setBrowse({ account: acc.account, cloud: acc.cloud });
    setRtype("image");
    setItems([]);
    setCursor(null);
    setPreview(null);
    fetchPage(acc.account, "image", null);
  };
  const changeType = (t) => {
    setRtype(t);
    setItems([]);
    setCursor(null);
    fetchPage(browse.account, t, null);
  };

  const save2 = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/infra/cloudinary-config-2`, form);
      toast.success("Second compte Cloudinary connecté");
      setForm({ cloud: "", api_key: "", api_secret: "" });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Connexion impossible");
    } finally {
      setSaving(false);
    }
  };
  const del2 = async () => {
    if (!window.confirm("Déconnecter le second compte Cloudinary ? (les fichiers ne sont pas touchés)")) return;
    try {
      await axios.delete(`${API}/admin/infra/cloudinary-config-2`);
      toast.success("Second compte déconnecté");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="space-y-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5" /> Cloudinary — les deux comptes
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={load} aria-label="Actualiser"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <CardDescription>Usage de chaque compte et visualisation de leurs fichiers (lecture seule).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="p-4 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : (
            (accounts || []).map((a) => {
              const u = a.usage || {};
              return (
                <div key={a.account} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      Compte {a.account}
                      {a.configured ? ` — « ${a.cloud} » (clé ${a.api_key_hint})` : " — non connecté"}
                    </p>
                    {a.configured && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openBrowse(a)}>
                          <Eye className="mr-2 h-4 w-4" /> Visualiser
                        </Button>
                        {canEdit && a.account === 2 && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={del2}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {a.configured && (u.error ? (
                    <p className="text-sm text-destructive">{u.error}</p>
                  ) : (
                    <>
                      {u.credits_percent != null && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Crédits {u.plan ? `(${u.plan})` : ""}</span>
                            <span>{u.credits_used} / {u.credits_limit} ({u.credits_percent} %)</span>
                          </div>
                          <Bar percent={u.credits_percent} />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Stockage {fmtBytes(u.storage_bytes)} · Bande passante {fmtBytes(u.bandwidth_bytes)} · {u.resources ?? "—"} fichiers
                      </p>
                    </>
                  ))}
                  {!a.configured && a.account === 2 && canEdit && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input placeholder="Cloud name" value={form.cloud} onChange={(e) => setForm({ ...form, cloud: e.target.value })} />
                      <Input placeholder="Clé API" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
                      <Input type="password" placeholder="Secret API" autoComplete="off" value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })} />
                      <Button className="sm:col-span-3" onClick={save2} disabled={saving || !form.cloud || !form.api_key || !form.api_secret}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Connecter le compte 2
                      </Button>
                    </div>
                  )}
                  {!a.configured && a.account === 1 && (
                    <p className="text-xs text-muted-foreground">Le compte 1 se connecte dans « Stockage Éléments LED (Cloudinary) » ci-dessous.</p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={!!browse} onOpenChange={(o) => { if (!o) { setBrowse(null); setPreview(null); } }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col gap-3 p-4">
          <DialogHeader className="shrink-0">
            <DialogTitle>Cloudinary — compte {browse?.account} « {browse?.cloud} »</DialogTitle>
            <DialogDescription>Cliquez sur un fichier pour l'afficher ici.</DialogDescription>
          </DialogHeader>
          <div className="flex shrink-0 gap-2">
            {[["image", "Images"], ["video", "Vidéos"], ["raw", "Documents"]].map(([id, label]) => (
              <Button key={id} size="sm" variant={rtype === id ? "default" : "outline"} onClick={() => changeType(id)}>{label}</Button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-2">
            {preview ? (
              <div className="space-y-2">
                <Button size="sm" variant="outline" onClick={() => setPreview(null)}>← Retour à la liste</Button>
                <p className="break-all text-sm font-medium">{preview.public_id}{preview.format ? `.${preview.format}` : ""} · {fmtBytes(preview.bytes)}</p>
                {preview.resource_type === "image" && <img src={preview.url} alt="" className="mx-auto max-h-[65vh] max-w-full object-contain" />}
                {preview.resource_type === "video" && <video src={preview.url} controls className="mx-auto max-h-[65vh] max-w-full" />}
                {preview.resource_type === "raw" && <a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Ouvrir le fichier</a>}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {items.map((it) => (
                    <button key={it.public_id} type="button" onClick={() => setPreview(it)} className="overflow-hidden rounded-md border text-left hover:border-primary">
                      <div className="flex aspect-square items-center justify-center bg-muted">
                        {it.thumb ? <img src={it.thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Cloud className="h-8 w-8 text-muted-foreground" />}
                      </div>
                      <div className="p-1.5">
                        <p className="truncate text-xs font-medium" title={it.public_id}>{it.public_id.split("/").pop()}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtBytes(it.bytes)}{it.format ? ` · ${it.format}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {busy && <div className="p-4 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>}
                {!busy && items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Aucun fichier de ce type.</p>}
                {!busy && cursor && (
                  <div className="p-3 text-center"><Button variant="outline" onClick={() => fetchPage(browse.account, rtype, cursor)}>Charger plus</Button></div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

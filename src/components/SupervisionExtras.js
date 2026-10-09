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
  const [form, setForm] = useState({ cloud: "", api_key: "", api_secret: "", skip_verify: false });
  const [editing, setEditing] = useState(null); // n° du compte dont on saisit les identifiants
  const [saving, setSaving] = useState(false);
  const [browse, setBrowse] = useState(null); // { account, cloud }
  const [rtype, setRtype] = useState("image");
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [reb, setReb] = useState(null); // état de l'équilibrage
  const [rebPlan, setRebPlan] = useState(null);
  const [rebBusy, setRebBusy] = useState(false);

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

  const loadReb = useCallback(async () => {
    try { setReb((await axios.get(`${API}/led/rebalance-status`)).data); } catch (e) { setReb(null); }
  }, []);
  useEffect(() => {
    loadReb();
    const t = setInterval(loadReb, 15000);
    return () => clearInterval(t);
  }, [loadReb]);
  const simulateReb = async () => {
    setRebBusy(true);
    try { setRebPlan((await axios.post(`${API}/led/rebalance-cloudinary`, null, { params: { dry_run: true } })).data); }
    catch (err) { toast.error(err.response?.data?.detail || "Simulation impossible"); }
    finally { setRebBusy(false); }
  };
  const startReb = async () => {
    if (!window.confirm("Déplacer des médias du compte le plus chargé vers l'autre compte puis vers B2 ? Chaque fichier n'est supprimé de l'ancien compte qu'après copie réussie.")) return;
    setRebBusy(true);
    try {
      await axios.post(`${API}/led/rebalance-cloudinary`);
      toast.success("Équilibrage lancé en arrière-plan");
      setRebPlan(null);
      setTimeout(loadReb, 1500);
    } catch (err) { toast.error(err.response?.data?.detail || "Lancement impossible"); }
    finally { setRebBusy(false); }
  };

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

  const saveAcc = async (n) => {
    setSaving(true);
    try {
      const url = n === 1 ? `${API}/admin/infra/cloudinary-config` : `${API}/admin/infra/cloudinary-config-${n}`;
      await axios.put(url, form);
      toast.success(`Compte ${n} connecté`);
      setForm({ cloud: "", api_key: "", api_secret: "", skip_verify: false });
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Connexion impossible");
    } finally {
      setSaving(false);
    }
  };
  const delAcc = async (n) => {
    if (!window.confirm(`Déconnecter le compte ${n} Cloudinary ? (les fichiers ne sont pas touchés)`)) return;
    try {
      await axios.delete(`${API}/admin/infra/cloudinary-config-${n}`);
      toast.success(`Compte ${n} déconnecté`);
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
              <Cloud className="w-5 h-5" /> Cloudinary — les comptes (jusqu'à 3)
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={load} aria-label="Actualiser"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <CardDescription>
            Les envois du site LED sont répartis automatiquement entre les comptes connectés, selon leurs crédits restants. Un compte à 80 % ou plus
            ne reçoit plus rien ; quand tous sont pleins, Backblaze B2 (gratuit) prend le relais. Rien n'est jamais facturé.
          </CardDescription>
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
                      <div className="flex flex-wrap items-center gap-2">
                        {a.receives_uploads
                          ? <Badge className="bg-emerald-600 text-white">Reçoit les envois</Badge>
                          : <Badge variant="outline" className="border-amber-500 text-amber-600">Complet — envois ailleurs</Badge>}
                        {canEdit && <Button size="sm" variant="ghost" onClick={() => { setEditing(a.account); setForm({ cloud: "", api_key: "", api_secret: "", skip_verify: false }); }}>Modifier</Button>}
                        <Button size="sm" variant="outline" onClick={() => openBrowse(a)}>
                          <Eye className="mr-2 h-4 w-4" /> Visualiser
                        </Button>
                        {canEdit && a.account >= 2 && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delAcc(a.account)}>
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
                  {(editing === a.account || (!a.configured && canEdit)) && canEdit && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input placeholder="Cloud name" value={form.cloud} onChange={(e) => setForm({ ...form, cloud: e.target.value.trim() })} />
                      <Input placeholder="Clé API" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value.trim() })} />
                      <Input type="password" placeholder="Secret API" autoComplete="off" value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value.trim() })} />
                      <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-3">
                        <input type="checkbox" className="h-4 w-4" checked={form.skip_verify} onChange={(e) => setForm({ ...form, skip_verify: e.target.checked })} />
                        Compte plein : enregistrer sans vérifier (si Cloudinary refuse la vérification)
                      </label>
                      <Button className="sm:col-span-3" onClick={() => saveAcc(a.account)} disabled={saving || !form.cloud || !form.api_key || !form.api_secret}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Connecter le compte {a.account}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {accounts && accounts.filter((a) => a.configured).length > 0 && (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <p className="font-semibold">Équilibrage des comptes</p>
              <p className="text-xs text-muted-foreground">
                Automatique (toutes les 6 h) : quand un compte dépasse 90 % de ses crédits, ses fichiers les plus lourds passent vers
                l'autre compte tant qu'il reste sous 70 %, puis vers B2 gratuit. Les crédits affichés se mettent à jour sous 24 h.
              </p>
              {reb?.message && (
                <p className="text-xs">
                  {reb.running ? "En cours : " : ""}{reb.message}
                  {reb.running || reb.moved_cloud || reb.moved_b2
                    ? ` (${reb.moved_cloud || 0} vers l'autre compte, ${reb.moved_b2 || 0} vers B2, ${reb.failed || 0} échec(s), ${fmtBytes(reb.freed_bytes || 0)} libérés)`
                    : ""}
                </p>
              )}
              {reb?.errors?.length > 0 && (
                <ul className="list-disc pl-4 text-[11px] text-amber-600">
                  {reb.errors.slice(0, 5).map((e, i) => (<li key={i}>{e}</li>))}
                </ul>
              )}
              {rebPlan && (
                <p className="text-xs text-muted-foreground">
                  {rebPlan.plan?.length
                    ? `Simulation : ${rebPlan.plan.length} fichier(s), ${fmtBytes(rebPlan.total_bytes)} à déplacer depuis « ${rebPlan.source?.cloud} » (${rebPlan.source?.pct} %).`
                    : (rebPlan.message || "Simulation : rien à déplacer pour le moment.")}
                </p>
              )}
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={simulateReb} disabled={rebBusy || reb?.running}>Simuler</Button>
                  <Button size="sm" onClick={startReb} disabled={rebBusy || reb?.running}>
                    {(rebBusy || reb?.running) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Équilibrer maintenant
                  </Button>
                </div>
              )}
            </div>
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

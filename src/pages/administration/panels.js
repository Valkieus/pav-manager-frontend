import { useState, useEffect } from 'react';
import { X, Bell, ChevronUp, ChevronDown, CreditCard, AlertTriangle, Plus } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { API, BRANCHES_FOR_FICHE, NOTIFICATION_CATEGORIES, NOTIFICATION_DEFAULT_HINTS, NOTIFICATION_TYPE_ROLES } from './constants';
























export function ScopeChecklist({
  options,
  selected,
  onToggle,
  searchPlaceholder = "Rechercher…",
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.toLowerCase().includes(q))
    : options;
  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-muted/30 p-2 min-h-[2.25rem]">
        {selected.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucune sélection pour l'instant — cochez ci-dessous.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selected.map((opt) => (
              <span
                key={opt}
                className="inline-flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-full pl-2 pr-1 py-0.5"
              >
                {opt}
                <button
                  type="button"
                  onClick={() => onToggle(opt)}
                  aria-label={`Retirer ${opt}`}
                  className="rounded-full p-0.5 hover:bg-white/20"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      {options.length > 8 && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 text-xs"
        />
      )}
      <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Aucun résultat.</p>
        ) : (
          filtered.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/50"
            >
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={() => onToggle(opt)}
              />
              <span>{opt}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export function HealthPill({ icon: Icon, label, status, detail }) {
  const frame = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400",
    down: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400",
    warn: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400",
    loading: "border-border bg-muted/40 text-muted-foreground",
  };
  const dot = {
    ok: "bg-emerald-500",
    down: "bg-red-500",
    warn: "bg-amber-500",
    loading: "bg-muted-foreground/40 animate-pulse",
  };
  const key = status || "loading";
  return (
    <div
      className={`flex items-center gap-2 p-2.5 rounded-lg border ${frame[key]}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot[key]}`} />
      <Icon className="w-4 h-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium leading-tight truncate">{label}</p>
        {detail && (
          <p className="text-[10px] opacity-80 truncate leading-tight">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}







export function NotificationTypeRow({ row, users, savingType, onToggleRole, onToggleUser, onSetMode, onSave, onReset, isOpen, onToggleOpen }) {
  const override = row.override;
  const isConfigured = !!override;
  const roles = (override && override.roles) || [];
  const extraIds = (override && override.extra_user_ids) || [];
  const mode = (override && override.mode) || "replace";
  const defaultHint = NOTIFICATION_DEFAULT_HINTS[row.type_];

  return (
    <div className={`rounded-lg border transition-colors ${isOpen ? "border-primary/40 bg-muted/30" : "border-border"}`}>
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.label}</p>
          {!isConfigured && defaultHint && (
            <p className="text-xs text-muted-foreground truncate">Par défaut : {defaultHint}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConfigured ? (
            <Badge className="text-xs bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">
              Personnalisé
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Défaut
            </Badge>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-3 border-t pt-3">
          <div>
            <p className="text-xs font-medium mb-2 text-muted-foreground">Rôles qui reçoivent cette notif</p>
            <div className="flex flex-wrap gap-1.5">
              {NOTIFICATION_TYPE_ROLES.map((role) => {
                const active = roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => onToggleRole(row.type_, role)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2 text-muted-foreground">Comptes individuels en plus</p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {users.map((u) => {
                const active = extraIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onToggleUser(row.type_, u.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? "bg-secondary text-secondary-foreground border-secondary-foreground/30"
                        : "bg-transparent border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {u.full_name || u.username}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => onSetMode(row.type_, "replace")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors ${
                mode === "replace" ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${mode === "replace" ? "bg-primary" : "bg-muted-foreground"}`} />
              Remplace les destinataires par défaut
            </button>
            <button
              type="button"
              onClick={() => onSetMode(row.type_, "add")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors ${
                mode === "add" ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${mode === "add" ? "bg-primary" : "bg-muted-foreground"}`} />
              Vient en plus des destinataires par défaut
            </button>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" disabled={savingType === row.type_} onClick={() => onSave(row.type_)}>
              Enregistrer
            </Button>
            {isConfigured && (
              <Button size="sm" variant="outline" disabled={savingType === row.type_} onClick={() => onReset(row.type_)}>
                Réinitialiser
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NotificationRoutingPanel() {
  const [routing, setRouting] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState(null);
  const [openCategories, setOpenCategories] = useState(() => new Set());
  const [openType, setOpenType] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [routingRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/notification-routing`),
        axios.get(`${API}/auth/users`),
      ]);
      setRouting(routingRes.data || []);
      setUsers(usersRes.data || []);
    } catch {
      toast.error("Erreur lors du chargement du routage des notifications");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const updateLocal = (type_, patch) => {
    setRouting((prev) => prev.map((r) => r.type_ === type_
      ? { ...r, override: { roles: [], extra_user_ids: [], mode: "replace", ...(r.override || {}), ...patch } }
      : r
    ));
  };

  const toggleRole = (type_, role) => {
    const row = routing.find((r) => r.type_ === type_);
    const current = (row && row.override && row.override.roles) || [];
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    updateLocal(type_, { roles: next });
  };

  const toggleUser = (type_, userId) => {
    const row = routing.find((r) => r.type_ === type_);
    const current = (row && row.override && row.override.extra_user_ids) || [];
    const next = current.includes(userId) ? current.filter((u) => u !== userId) : [...current, userId];
    updateLocal(type_, { extra_user_ids: next });
  };

  const setMode = (type_, mode) => updateLocal(type_, { mode });

  const save = async (type_) => {
    const row = routing.find((r) => r.type_ === type_);
    const override = (row && row.override) || { roles: [], extra_user_ids: [], mode: "replace" };
    setSavingType(type_);
    try {
      await axios.put(`${API}/admin/notification-routing/${type_}`, override);
      toast.success("Routage mis à jour");
      await load();
    } catch {
      toast.error("Erreur lors de l'enregistrement du routage");
    } finally {
      setSavingType(null);
    }
  };

  const reset = async (type_) => {
    setSavingType(type_);
    try {
      await axios.delete(`${API}/admin/notification-routing/${type_}`);
      toast.success("Routage réinitialisé");
      await load();
    } catch {
      toast.error("Erreur lors de la réinitialisation du routage");
    } finally {
      setSavingType(null);
    }
  };

  const toggleCategory = (key) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTypeOpen = (type_) => {
    setOpenType((prev) => (prev === type_ ? null : type_));
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  const routingByType = Object.fromEntries(routing.map((r) => [r.type_, r]));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Gestion des notifications
          </CardTitle>
          <CardDescription>
            Les notifications sont regroupées par thème. Ouvre un thème, puis une notification, pour choisir qui la
            reçoit : des rôles entiers et/ou des comptes précis. Sans réglage, le comportement par défaut de
            l'application s'applique (indiqué sous chaque notification).
          </CardDescription>
        </CardHeader>
      </Card>

      {NOTIFICATION_CATEGORIES.map((cat) => {
        const CatIcon = cat.icon;
        const rows = cat.types.map((t) => routingByType[t]).filter(Boolean);
        if (rows.length === 0) return null;
        const configuredCount = rows.filter((r) => !!r.override).length;
        const isOpen = openCategories.has(cat.key);
        return (
          <Card key={cat.key} className="overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory(cat.key)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cat.chip}`}>
                  <CatIcon className={`w-4 h-4 ${cat.color}`} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-semibold truncate">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {rows.length} notification{rows.length > 1 ? "s" : ""}
                    {configuredCount > 0 ? ` · ${configuredCount} personnalisée${configuredCount > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
              </div>
              {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
            </button>
            {isOpen && (
              <CardContent className="pt-0 space-y-2">
                {rows.map((row) => (
                  <NotificationTypeRow
                    key={row.type_}
                    row={row}
                    users={users}
                    savingType={savingType}
                    onToggleRole={toggleRole}
                    onToggleUser={toggleUser}
                    onSetMode={setMode}
                    onSave={save}
                    onReset={reset}
                    isOpen={openType === row.type_}
                    onToggleOpen={() => toggleTypeOpen(row.type_)}
                  />
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}



export function FicheEffectifSection({ user, onLinked }) {
  const [loading, setLoading] = useState(true);
  const [linkedFiche, setLinkedFiche] = useState(null);
  const [unclaimed, setUnclaimed] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createBranches, setCreateBranches] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [unclaimedRes, ficheRes] = await Promise.all([
        axios.get(`${API}/techniciens/unclaimed`),
        user.technicien_id
          ? axios
              .get(`${API}/techniciens/${user.technicien_id}`)
              .catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ]);
      setUnclaimed(unclaimedRes.data || []);
      setLinkedFiche(ficheRes.data);
    } catch {
      // Section secondaire du popup — une erreur ici ne doit pas bloquer
      // le reste des actions disponibles sur le compte.
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [user.id, user.technicien_id]);

  const link = async (technicienId) => {
    setBusy(true);
    try {
      await axios.put(`${API}/auth/users/${user.id}/technicien`, {
        technicien_id: technicienId,
      });
      toast.success(technicienId ? "Fiche associ\u00e9e" : "Fiche dissoci\u00e9e");
      onLinked();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'association");
    } finally {
      setBusy(false);
    }
  };

  const createAndLink = async () => {
    if (createBranches.length === 0) return;
    setBusy(true);
    try {
      const createRes = await axios.post(`${API}/techniciens`, {
        nom: user.full_name,
        niveau_acces: user.niveau_acces,
        branches: createBranches,
      });
      await axios.put(`${API}/auth/users/${user.id}/technicien`, {
        technicien_id: createRes.data.id,
      });
      toast.success("Fiche cr\u00e9\u00e9e et associ\u00e9e");
      setShowCreate(false);
      setCreateBranches([]);
      onLinked();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de la cr\u00e9ation");
    } finally {
      setBusy(false);
    }
  };

  const filtered = unclaimed.filter((t) =>
    (t.nom || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="border-t pt-3 mt-1 space-y-2">
      <p className="text-sm font-medium flex items-center gap-2">
        <CreditCard className="w-4 h-4" /> Fiche Effectif
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Chargement...</p>
      ) : linkedFiche ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 flex-wrap">
            {linkedFiche.nom}
            <Badge variant="outline" className="text-xs">
              {(linkedFiche.branches || []).join(", ") || "Sans branche"}
            </Badge>
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => link(null)}
          >
            Délier
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-amber-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Aucune fiche
            associée — ce compte n'apparaît pas dans Effectif.
          </p>
          {!showCreate ? (
            <>
              <Input
                placeholder="Rechercher une fiche existante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="max-h-32 overflow-y-auto space-y-1">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucune fiche disponible
                  </p>
                ) : (
                  filtered.slice(0, 20).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={busy}
                      onClick={() => link(t.id)}
                      className="w-full text-left text-sm px-2 py-1 rounded hover:bg-muted flex items-center justify-between"
                    >
                      {t.nom}
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  ))
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="w-4 h-4 mr-2" /> Créer une nouvelle fiche
              </Button>
            </>
          ) : (
            <div className="space-y-2 border rounded-md p-2">
              <p className="text-xs text-muted-foreground">
                Nouvelle fiche « {user.full_name} », niveau{" "}
                {user.niveau_acces}. Choisir la ou les branches :
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BRANCHES_FOR_FICHE.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() =>
                      setCreateBranches((prev) =>
                        prev.includes(b)
                          ? prev.filter((x) => x !== b)
                          : [...prev, b],
                      )
                    }
                    className={`text-xs px-2 py-1 rounded-full border ${
                      createBranches.includes(b)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || createBranches.length === 0}
                  onClick={createAndLink}
                >
                  Créer et associer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateBranches([]);
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

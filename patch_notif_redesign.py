p = "src/pages/Administration.js"
src = open(p, encoding="utf-8").read()

# 1. Add missing lucide icons to the existing import block.
anchor_import = '''  Bell,
  ArrowLeftRight,
  X,
} from "lucide-react";'''
assert src.count(anchor_import) == 1, ("anchor_import count", src.count(anchor_import))
repl_import = '''  Bell,
  ArrowLeftRight,
  X,
  Calendar,
  GraduationCap,
  BookOpen,
  FileText,
  MessageSquare,
} from "lucide-react";'''
src = src.replace(anchor_import, repl_import)

# 2. Replace the whole NotificationRoutingPanel block (from NOTIFICATION_TYPE_ROLES
#    const to the closing brace right before "export default function Administration").
start_marker = 'const NOTIFICATION_TYPE_ROLES = ["Technicien", "Responsable", "Gestionnaire", "Admin (lecture seule)", "Admin", "Super Admin"];'
end_marker = "\n\nexport default function Administration() {"
start_idx = src.index(start_marker)
end_idx = src.index(end_marker, start_idx)
assert start_idx != -1 and end_idx != -1

new_block = '''const NOTIFICATION_TYPE_ROLES = ["Technicien", "Responsable", "Gestionnaire", "Admin (lecture seule)", "Admin", "Super Admin"];

const NOTIFICATION_CATEGORIES = [
  {
    key: "systeme",
    label: "Système & Sécurité",
    icon: Server,
    color: "text-red-500",
    chip: "bg-red-500/10 border-red-500/30 text-red-500",
    types: ["quota_alerte", "securite", "crash", "maintenance", "supervision"],
  },
  {
    key: "comptes",
    label: "Comptes & Utilisateurs",
    icon: Users,
    color: "text-blue-500",
    chip: "bg-blue-500/10 border-blue-500/30 text-blue-500",
    types: ["compte_gestion", "suppression_compte", "technicien", "badge"],
  },
  {
    key: "planning",
    label: "Planning & Présence",
    icon: Calendar,
    color: "text-emerald-500",
    chip: "bg-emerald-500/10 border-emerald-500/30 text-emerald-500",
    types: ["planning_publie", "absence", "retard"],
  },
  {
    key: "formations",
    label: "Formations",
    icon: GraduationCap,
    color: "text-purple-500",
    chip: "bg-purple-500/10 border-purple-500/30 text-purple-500",
    types: ["formation_demande", "formation_statut", "formation_interet", "formation_suggestion"],
  },
  {
    key: "academy",
    label: "PAV Academy",
    icon: BookOpen,
    color: "text-indigo-500",
    chip: "bg-indigo-500/10 border-indigo-500/30 text-indigo-500",
    types: ["academy_assignment", "academy_correction", "academy_corrige"],
  },
  {
    key: "devis",
    label: "Devis & Achats",
    icon: FileText,
    color: "text-amber-500",
    chip: "bg-amber-500/10 border-amber-500/30 text-amber-500",
    types: ["devis"],
  },
  {
    key: "communication",
    label: "Actualités & Communication",
    icon: MessageSquare,
    color: "text-pink-500",
    chip: "bg-pink-500/10 border-pink-500/30 text-pink-500",
    types: ["actualite", "communication", "groupchat"],
  },
  {
    key: "autre",
    label: "Autre",
    icon: Bell,
    color: "text-slate-500",
    chip: "bg-slate-500/10 border-slate-500/30 text-slate-500",
    types: ["test"],
  },
];

const NOTIFICATION_DEFAULT_HINTS = {
  quota_alerte: "Super Admin",
  test: "Toi-même (test personnel)",
  suppression_compte: "Super Admin",
  compte_gestion: "Admin, Super Admin",
  securite: "Super Admin",
  supervision: "Admin, Super Admin",
  technicien: "Coordination, Admin",
  badge: "Coordination",
  devis: "Coordination, Responsable concerné",
  formation_demande: "Coordination",
  formation_statut: "Le demandeur",
  formation_interet: "Le créateur de la formation",
  formation_suggestion: "Coordination",
  planning_publie: "Les personnes concernées",
  absence: "Coordination, Responsable de branche",
  actualite: "Tous les utilisateurs",
  retard: "Paul, Delphine, Winchel, responsable(s) de branche",
  maintenance: "Rôles impactés par le mode maintenance",
  academy_assignment: "L'élève assigné",
  academy_correction: "Examinateur + Coordination",
  academy_corrige: "L'élève",
  communication: "Tous les utilisateurs (Chaîne)",
  groupchat: "Membres du groupe",
  crash: "Tous les Super Admin",
};

function NotificationTypeRow({ row, users, savingType, onToggleRole, onToggleUser, onSetMode, onSave, onReset, isOpen, onToggleOpen }) {
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

function NotificationRoutingPanel() {
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
}'''

src = src[:start_idx] + new_block + src[end_idx:]
open(p, "w", encoding="utf-8").write(src)
print("REDESIGN APPLIED, new length", len(src))

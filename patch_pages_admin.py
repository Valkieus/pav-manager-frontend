p = "src/pages/Administration.js"
src = open(p, encoding="utf-8").read()

# 1. Bell icon already imported in this file — no import change needed.

# 2. New component before export default function Administration
anchor2 = "export default function Administration() {"
assert src.count(anchor2) == 1, ("anchor2 count", src.count(anchor2))

component = '''const NOTIFICATION_TYPE_ROLES = ["Technicien", "Responsable", "Gestionnaire", "Admin (lecture seule)", "Admin", "Super Admin"];

function NotificationRoutingPanel() {
  const [routing, setRouting] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState(null);

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

  if (loading) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gestion des notifications</CardTitle>
          <CardDescription>
            Pour chaque type de notification, choisis qui la reçoit : des rôles entiers et/ou des comptes individuels.
            Sans configuration ici, le comportement par défaut de l'application s'applique.
          </CardDescription>
        </CardHeader>
      </Card>
      {routing.map((row) => {
        const override = row.override;
        const isConfigured = !!override;
        const roles = (override && override.roles) || [];
        const extraIds = (override && override.extra_user_ids) || [];
        const mode = (override && override.mode) || "replace";
        return (
          <Card key={row.type_}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">{row.label}</CardTitle>
                {isConfigured && (
                  <Badge variant="outline" className="text-xs">Personnalisé</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Rôles</p>
                <div className="flex flex-wrap gap-2">
                  {NOTIFICATION_TYPE_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-1.5 text-sm border rounded-md px-2 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roles.includes(role)}
                        onChange={() => toggleRole(row.type_, role)}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Comptes individuels</p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-1.5 text-sm border rounded-md px-2 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={extraIds.includes(u.id)}
                        onChange={() => toggleUser(row.type_, u.id)}
                      />
                      {u.full_name || u.username}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`mode-${row.type_}`}
                    checked={mode === "replace"}
                    onChange={() => setMode(row.type_, "replace")}
                  />
                  Remplace les destinataires par défaut
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`mode-${row.type_}`}
                    checked={mode === "add"}
                    onChange={() => setMode(row.type_, "add")}
                  />
                  Vient en plus des destinataires par défaut
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={savingType === row.type_} onClick={() => save(row.type_)}>
                  Enregistrer
                </Button>
                {isConfigured && (
                  <Button size="sm" variant="outline" disabled={savingType === row.type_} onClick={() => reset(row.type_)}>
                    Réinitialiser (comportement par défaut)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

'''
src = src.replace(anchor2, component + anchor2)

# 3. TabsTrigger — after Supervision trigger, before </TabsList>
anchor3 = '''              <Activity className="w-4 h-4" /> Supervision
            </TabsTrigger>
          )}
        </TabsList>'''
assert src.count(anchor3) == 1, ("anchor3 count", src.count(anchor3))
repl3 = '''              <Activity className="w-4 h-4" /> Supervision
            </TabsTrigger>
          )}
          {isSuperAdmin() && (
            <TabsTrigger
              value="notifications"
              className="flex items-center gap-2"
            >
              <Bell className="w-4 h-4" /> Notifications
            </TabsTrigger>
          )}
        </TabsList>'''
src = src.replace(anchor3, repl3)

# 4. TabsContent — before closing </Tabs>
anchor4 = '''          </TabsContent>
        )}
      </Tabs>'''
assert src.count(anchor4) == 1, ("anchor4 count", src.count(anchor4))
repl4 = '''          </TabsContent>
        )}
        {isSuperAdmin() && (
          <TabsContent value="notifications" className="space-y-4">
            <NotificationRoutingPanel />
          </TabsContent>
        )}
      </Tabs>'''
src = src.replace(anchor4, repl4)

open(p, "w", encoding="utf-8").write(src)
print("ALL EDITS APPLIED, new length", len(src))

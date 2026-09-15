import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { toast } from 'sonner';
import {
  Megaphone,
  Loader2,
  Send,
  Inbox,
  History,
  User,
  Calendar,
  Users,
  Building2,
  Settings,
  Lock,
  Radio,
  ArrowLeft,
  Trash2,
  Clock,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Niveaux ciblables depuis le formulaire de composition. Les Techniciens ne
// figurent pas dans cette liste : leur inclusion passe uniquement par
// l'interrupteur dedie ci-dessous (exclus par defaut).
const NIVEAUX_CIBLE = ['Responsable', 'Gestionnaire', 'Admin (lecture seule)', 'Admin', 'Super Admin'];

const BRANCHES = ['Supervision', 'Coordination', 'Production', 'Live', 'Animation', 'Régisseurs', 'Diffusion'];

const CAN_COMPOSE = ['Responsable', 'Gestionnaire', 'Admin', 'Super Admin'];
const CAN_VIEW_HISTORY = ['Responsable', 'Gestionnaire', 'Admin (lecture seule)', 'Admin', 'Super Admin'];
const CAN_MANAGE_CHAT_SETTINGS = ['Gestionnaire', 'Admin', 'Super Admin'];
const CAN_MANAGE_GROUPS = ['Gestionnaire', 'Admin', 'Super Admin'];
const CAN_MODERATE_MESSAGES = ['Gestionnaire', 'Admin', 'Super Admin'];
const EPHEMERAL_OPTIONS = ['off', '24h', '7j', '90j'];
const EPHEMERAL_LABELS = { off: 'Désactivé', '24h': '24 heures', '7j': '7 jours', '90j': '90 jours' };
// Doit rester en phase avec NIVEAUX_ACCES cote backend (ordre hierarchique).
const NIVEAUX_ACCES_ORDRE = ['Technicien', 'Responsable', 'Gestionnaire', 'Admin (lecture seule)', 'Admin', 'Super Admin'];
const CHAT_WRITE_LEVELS = ['Technicien', 'Responsable', 'Gestionnaire'];
const CHAT_WRITE_LABELS = {
  Technicien: 'Tout le monde',
  Responsable: 'Responsable et plus',
  Gestionnaire: 'Gestionnaire et plus',
};

// Palette a la WhatsApp : chaque participant du groupe recoit une couleur
// stable (nom + avatar) deduite d'un hash simple de son nom.
const AVATAR_PALETTE = [
  { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { bg: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { bg: 'bg-fuchsia-500', text: 'text-fuchsia-600 dark:text-fuchsia-400' },
  { bg: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  { bg: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400' },
  { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
  { bg: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400' },
];

const senderStyle = (name) => {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 1000003;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const initials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = (parts[0] || '')[0] || '';
  const second = parts.length > 1 ? (parts[1] || '')[0] || '' : '';
  return (first + second).toUpperCase();
};

const emptyForm = {
  titre: '',
  message: '',
  cible_niveaux: [],
  cible_branches: [],
  inclure_techniciens: false,
};

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

const CommunicationCard = ({ comm, showDestinataires, user, onDelete }) => (
  <Card className="card-hover animate-fadeIn">
    <CardContent className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-lg">{comm.titre}</h3>
        {showDestinataires && (
          <Badge variant="secondary" className="shrink-0">
            {comm.nb_destinataires} destinataire{comm.nb_destinataires > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comm.message}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t border-border">
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {comm.expediteur_nom}
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(comm.created_at)}
        </div>
        {comm.cible_niveaux?.length > 0 && (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {comm.cible_niveaux.join(', ')}
          </div>
        )}
        {comm.cible_branches?.length > 0 && (
          <div className="flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {comm.cible_branches.join(', ')}
          </div>
        )}
        {comm.inclure_techniciens && (
          <Badge variant="outline" className="text-[10px]">Techniciens inclus</Badge>
        )}
      </div>
          {onDelete && ((user && comm.expediteur_id === user.id) || (user && CAN_MODERATE_MESSAGES.includes(user.niveau_acces))) && (
        <button type="button" className="text-xs text-red-500 underline mt-1" onClick={() => onDelete(comm.id)} data-testid="delete-comm-btn">
          supprimer
        </button>
      )}
    </CardContent>
  </Card>
);

export default function Communication() {
  const { user } = useAuth();
  const canCompose = CAN_COMPOSE.includes(user?.niveau_acces);
  const canViewHistory = CAN_VIEW_HISTORY.includes(user?.niveau_acces);

  const [tab, setTab] = useState('recues');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [loadingSent, setLoadingSent] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [mentionable, setMentionable] = useState({ users: [], roles: [], postes: [], specials: [] });
  const [mentionQuery, setMentionQuery] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [groupFormMode, setGroupFormMode] = useState('create');
  const [groupFormData, setGroupFormData] = useState({ id: null, nom: '', description: '', min_niveau_ecriture: 'Technicien', ephemeral_mode: 'off' });
  const [savingGroup, setSavingGroup] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const fetchReceived = async () => {
    setLoadingReceived(true);
    try {
      const res = await axios.get(`${API}/communications/received`);
      setReceived(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('Erreur lors du chargement des communications');
    } finally {
      setLoadingReceived(false);
    }
  };

  const fetchSent = async () => {
    setLoadingSent(true);
    try {
      const res = await axios.get(`${API}/communications`);
      setSent(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setLoadingSent(false);
    }
  };

  useEffect(() => {
    fetchReceived();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'historique' && canViewHistory) fetchSent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const fetchGroups = async () => {
    setGroupsLoading(true);
    try {
      const res = await axios.get(API + '/communications/discussions/groups');
      const list = Array.isArray(res.data) ? res.data : [];
      setGroups(list);
      if (!activeGroupId && list.length > 0) {
        const def = list.find((g) => g.is_default) || list[0];
        setActiveGroupId(def.id);
      }
    } catch (err) {
      // silencieux
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchMessages = async (groupId) => {
    if (!groupId) return;
    setMessagesLoading(true);
    try {
      const res = await axios.get(API + '/communications/discussions/groups/' + groupId + '/messages');
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      // silencieux
    } finally {
      setMessagesLoading(false);
    }
  };

  const fetchMentionable = async () => {
    try {
      const res = await axios.get(API + '/communications/mentionable');
      setMentionable({
        users: (res.data && res.data.users) || [],
        roles: (res.data && res.data.roles) || [],
        postes: (res.data && res.data.postes) || [],
        specials: (res.data && res.data.specials) || [],
      });
    } catch (err) {
      // silencieux
    }
  };

  useEffect(() => {
    if (tab !== 'groupchat') return;
    fetchGroups();
    fetchMentionable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== 'groupchat' || !activeGroupId) return;
    fetchMessages(activeGroupId);
    const interval = setInterval(() => fetchMessages(activeGroupId), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeGroupId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const activeGroup = groups.find((g) => g.id === activeGroupId) || null;
  const canWriteActiveGroup = activeGroup
    ? NIVEAUX_ACCES_ORDRE.indexOf(user && user.niveau_acces) >= NIVEAUX_ACCES_ORDRE.indexOf(activeGroup.min_niveau_ecriture || 'Technicien')
    : false;

  const canEditMessage = (msg) => {
    if (!msg || !user || msg.auteur_id !== user.id) return false;
    const age = now - new Date(msg.created_at).getTime();
    return age < 180000;
  };

  const handleSelectGroup = (groupId) => {
    setActiveGroupId(groupId);
    setMessageInput('');
    setMentionQuery(null);
    setEditingMessageId(null);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const texte = messageInput.trim();
    if (!texte || !activeGroupId) return;
    setSendingMessage(true);
    try {
      await axios.post(API + '/communications/discussions/groups/' + activeGroupId + '/messages', { message: texte });
      setMessageInput('');
      setMentionQuery(null);
      fetchMessages(activeGroupId);
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.detail) || "Envoi du message impossible");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.message);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (messageId) => {
    const texte = editingText.trim();
    if (!texte) return;
    try {
      await axios.put(API + '/communications/discussions/messages/' + messageId, { message: texte });
      setEditingMessageId(null);
      setEditingText('');
      fetchMessages(activeGroupId);
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.detail) || "Modification impossible");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      await axios.delete(API + '/communications/discussions/messages/' + messageId);
      fetchMessages(activeGroupId);
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.detail) || 'Suppression impossible');
    }
  };

  const handleDeleteCommunication = async (id) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      await axios.delete(API + '/communications/' + id);
      fetchReceived();
      fetchSent();
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.detail) || 'Suppression impossible');
    }
  };

  const openCreateGroupForm = () => {
    setGroupFormMode('create');
    setGroupFormData({ id: null, nom: '', description: '', min_niveau_ecriture: 'Technicien', ephemeral_mode: 'off' });
    setGroupFormOpen(true);
  };

  const openEditGroupForm = (g) => {
    if (!g) return;
    setGroupFormMode('edit');
    setGroupFormData({
      id: g.id,
      nom: g.nom,
      description: g.description || '',
      min_niveau_ecriture: g.min_niveau_ecriture || 'Technicien',
      ephemeral_mode: g.ephemeral_mode || 'off',
    });
    setGroupFormOpen(true);
  };

  const handleSubmitGroupForm = async (e) => {
    e.preventDefault();
    if (!groupFormData.nom.trim()) return;
    setSavingGroup(true);
    try {
      const payload = {
        nom: groupFormData.nom.trim(),
        description: groupFormData.description.trim(),
        min_niveau_ecriture: groupFormData.min_niveau_ecriture,
        ephemeral_mode: groupFormData.ephemeral_mode,
      };
      if (groupFormMode === 'create') {
        const res = await axios.post(API + '/communications/discussions/groups', payload);
        toast.success('Groupe créé');
        setGroupFormOpen(false);
        await fetchGroups();
        setActiveGroupId(res.data.id);
      } else {
        await axios.put(API + '/communications/discussions/groups/' + groupFormData.id, payload);
        toast.success('Groupe modifié');
        setGroupFormOpen(false);
        fetchGroups();
      }
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.detail) || "Erreur");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (g) => {
    if (!g || g.is_default) return;
    if (!window.confirm("Supprimer le groupe \"" + g.nom + "\" ? Cette action est irréversible.")) return;
    try {
      await axios.delete(API + '/communications/discussions/groups/' + g.id);
      toast.success('Groupe supprimé');
      if (activeGroupId === g.id) setActiveGroupId(null);
      fetchGroups();
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.detail) || "Suppression impossible");
    }
  };

  const renderMessageText = (text) => {
    const parts = String(text || '').split(/(@[\w\-']+)/g);
    return parts.map((part, i) => {
      if (part.charAt(0) === '@' && part.length > 1) {
        const isPav = part.toLowerCase() === '@pav'; return <span key={i} className={isPav ? 'font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-1' : 'font-semibold text-indigo-600 dark:text-indigo-400'}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const mentionSuggestions = (() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const usersList = mentionable.users.map((u) => Object.assign({}, u, { kind: 'user' }));
    const rolesList = mentionable.roles.map((r) => Object.assign({}, r, { kind: 'role' }));
    const postesList = mentionable.postes.map((p) => Object.assign({}, p, { kind: 'poste' }));
    const specialsList = (mentionable.specials || []).map((s) => Object.assign({}, s, { kind: 'special' }));
    const all = specialsList.concat(usersList, rolesList, postesList);
    return all.filter((item) => item.nom.toLowerCase().indexOf(q) !== -1).slice(0, 8);
  })();

  const handleMessageInputChange = (val) => {
    setMessageInput(val);
    const m = val.match(/@([\w\-']*)$/);
    setMentionQuery(m ? m[1] : null);
  };

  const selectMention = (nomValue) => {
    const withoutTrigger = messageInput.replace(/@([\w\-']*)$/, '');
    setMessageInput(withoutTrigger + '@' + nomValue + ' ');
    setMentionQuery(null);
  };

  const toggleNiveau = (niveau) => {
    setForm((f) => ({
      ...f,
      cible_niveaux: f.cible_niveaux.includes(niveau)
        ? f.cible_niveaux.filter((n) => n !== niveau)
        : [...f.cible_niveaux, niveau],
    }));
  };

  const toggleBranche = (branche) => {
    setForm((f) => ({
      ...f,
      cible_branches: f.cible_branches.includes(branche)
        ? f.cible_branches.filter((b) => b !== branche)
        : [...f.cible_branches, branche],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titre.trim() || !form.message.trim()) {
      toast.error('Le titre et le message sont obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/communications`, form);
      toast.success(`Communication envoyée à ${res.data.nb_destinataires} destinataire(s)`);
      setForm(emptyForm);
      fetchReceived();
      if (tab === 'historique') fetchSent();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const showChaineHeader = tab === 'recues' || tab === 'envoyer' || tab === 'historique';

  return (
    <div className="space-y-6" data-testid="communication-page">
      <div>
        <h1 className="text-2xl font-bold">Communication</h1>
        <p className="text-muted-foreground">Une chaine pour les annonces, un groupe pour discuter</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 self-center hidden sm:inline">Chaine</span>
          <TabsTrigger value="recues" className="flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Reçues
          </TabsTrigger>
          {canCompose && (
            <TabsTrigger value="envoyer" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Envoyer
            </TabsTrigger>
          )}
          {canViewHistory && (
            <TabsTrigger value="historique" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historique
            </TabsTrigger>
          )}
          <span className="w-px h-5 bg-border mx-1 self-center" aria-hidden="true" />
          <TabsTrigger value="groupchat" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Discussions
          </TabsTrigger>
        </TabsList>

        {showChaineHeader && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">Chaine PAV Manager</p>
              <p className="text-xs text-muted-foreground">Diffusion officielle - toute l'equipe est abonnee</p>
            </div>
          </div>
        )}

        <TabsContent value="recues" className="mt-4 space-y-4">
          {loadingReceived ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : received.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Megaphone className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucune communication pour le moment</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {received.map((c) => (
                <CommunicationCard key={c.id} comm={c} user={user} onDelete={handleDeleteCommunication} />
              ))}
            </div>
          )}
        </TabsContent>

        {canCompose && (
          <TabsContent value="envoyer" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="titre">Titre *</Label>
                    <Input
                      id="titre"
                      value={form.titre}
                      onChange={(e) => setForm({ ...form, titre: e.target.value })}
                      required
                      data-testid="comm-titre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      required
                      rows={5}
                      data-testid="comm-message"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cibler par niveau d'accès (vide = tous)</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {NIVEAUX_CIBLE.map((niveau) => (
                        <label key={niveau} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={form.cible_niveaux.includes(niveau)}
                            onCheckedChange={() => toggleNiveau(niveau)}
                          />
                          {niveau}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Cibler par branche (vide = toutes)</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BRANCHES.map((branche) => (
                        <label key={branche} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={form.cible_branches.includes(branche)}
                            onCheckedChange={() => toggleBranche(branche)}
                          />
                          {branche}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Inclure les Techniciens</p>
                      <p className="text-xs text-muted-foreground">Exclus par défaut de cette communication</p>
                    </div>
                    <Switch
                      checked={form.inclure_techniciens}
                      onCheckedChange={(v) => setForm({ ...form, inclure_techniciens: v })}
                      data-testid="comm-inclure-techniciens"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting} data-testid="comm-submit">
                    {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Envoyer la communication
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewHistory && (
          <TabsContent value="historique" className="mt-4 space-y-4">
            {loadingSent ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : sent.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <History className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun envoi pour le moment</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sent.map((c) => (
                  <CommunicationCard key={c.id} comm={c} showDestinataires user={user} onDelete={handleDeleteCommunication} />
                ))}
              </div>
            )}
          </TabsContent>
        )}
        <TabsContent value="groupchat" className="mt-2 space-y-4">
          {!activeGroupId ? (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">Discussions</p>
                    <p className="text-xs text-muted-foreground">Choisissez un groupe pour discuter</p>
                  </div>
                  {CAN_MANAGE_GROUPS.includes(user?.niveau_acces) && (
                    <Button type="button" size="sm" onClick={openCreateGroupForm} data-testid="create-group-btn">
                      + Nouveau groupe
                    </Button>
                  )}
                </div>
                {groupsLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Chargement...
                  </div>
                ) : groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Aucun groupe pour le moment</p>
                ) : (
                  <div className="space-y-1">
                    {groups.map((g) => {
                      const style = senderStyle(g.nom);
                      return (
                        <div
                          key={g.id}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleSelectGroup(g.id)}
                          data-testid={"group-row-" + g.id}
                        >
                          <div className={"w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white font-semibold " + style.bg}>
                            {initials(g.nom)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm truncate">{g.nom}</p>
                              {g.is_default && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Global</Badge>
                              )}
                              {g.ephemeral_mode && g.ephemeral_mode !== 'off' && (
                                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{g.description || 'Aucune description'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <Button type="button" variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => setActiveGroupId(null)} data-testid="back-to-groups-btn">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className={"w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-semibold " + (senderStyle(activeGroup?.nom || '').bg)}>
                  {initials(activeGroup?.nom || '?')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{activeGroup?.nom}</p>
                    {activeGroup?.is_default && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Global</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {canWriteActiveGroup
                      ? (activeGroup?.description || "Discussion ouverte")
                      : ("Lecture seule : seuls les " + (CHAT_WRITE_LABELS[activeGroup?.min_niveau_ecriture] || 'autorises') + " peuvent écrire")}
                  </p>
                </div>
                {CAN_MANAGE_GROUPS.includes(user?.niveau_acces) && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditGroupForm(activeGroup)} data-testid="edit-group-btn">
                      <Settings className="w-4 h-4" />
                    </Button>
                    {!activeGroup?.is_default && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteGroup(activeGroup)} data-testid="delete-group-btn">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1" data-testid="messages-list">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Chargement...
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">Aucun message. Soyez le premier à écrire !</p>
                    ) : (
                      messages.map((msg) => {
                        const mine = msg.auteur_id === user?.id;
                        const style = senderStyle(msg.auteur_nom);
                        const editable = canEditMessage(msg);
                        return (
                          <div key={msg.id} className={"flex gap-2 " + (mine ? "flex-row-reverse" : "flex-row")}>
                            {!mine && (
                              <div className={"w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-semibold " + style.bg}>
                                {initials(msg.auteur_nom)}
                              </div>
                            )}
                            <div className={"max-w-[75%] rounded-2xl px-3 py-2 " + (mine ? "bg-indigo-600 text-white" : "bg-muted")}>
                              {!mine && (
                                <p className={"text-xs font-semibold mb-0.5 " + style.text}>{msg.auteur_nom}</p>
                              )}
                              {editingMessageId === msg.id ? (
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    className="h-8 text-sm bg-background text-foreground"
                                    data-testid="edit-message-input"
                                  />
                                  <Button type="button" size="sm" className="h-8 px-2" onClick={() => handleSaveEdit(msg.id)} data-testid="save-edit-btn">OK</Button>
                                  <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={handleCancelEdit}>Annuler</Button>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm whitespace-pre-wrap break-words">{renderMessageText(msg.message)}</p>
                                  <div className={"flex items-center gap-2 mt-0.5 text-[10px] " + (mine ? "text-indigo-100" : "text-muted-foreground")}>
                                    <span>
                                      {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {msg.edited_at && <span>modifié</span>}
                                    {msg.expires_at && <Clock className="w-3 h-3" />}
                                    {mine && editable && (
                                      <button type="button" className="underline" onClick={() => handleStartEdit(msg)} data-testid="start-edit-btn">
                                        modifier
                                      </button>
                                    )}
                            {((mine && editable) || (user && CAN_MODERATE_MESSAGES.includes(user.niveau_acces))) && (
                              <button type="button" className="underline text-red-500" onClick={() => handleDeleteMessage(msg.id)} data-testid="delete-message-btn">
                                            supprimer
                                            </button>
                            )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {canWriteActiveGroup ? (
                    <form onSubmit={handleSendMessage} className="mt-3 relative">
                      {mentionSuggestions.length > 0 && (
                        <div className="absolute bottom-full mb-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                          {mentionSuggestions.map((item) => (
                            <button
                              type="button"
                              key={item.kind + "-" + item.id}
                              className={"w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2" + (item.kind === 'special' ? ' text-amber-600 dark:text-amber-400 font-medium' : '')}
                              onClick={() => selectMention(item.nom)}
                            >
                              <span className="text-xs text-muted-foreground">
                                {item.kind === 'special' ? '@' : item.kind === 'user' ? '@' : item.kind === 'role' ? '#' : '~'}
                              </span>
                              {item.kind === 'special' ? ('Tout le monde (' + item.nom + ')') : item.nom}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          value={messageInput}
                          onChange={(e) => handleMessageInputChange(e.target.value)}
                          placeholder="Écrire un message... (@ pour mentionner)"
                          className="flex-1"
                          data-testid="message-input"
                        />
                        <Button type="submit" size="icon" disabled={sendingMessage || !messageInput.trim()} data-testid="send-message-btn">
                          {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-3 text-xs text-center text-muted-foreground py-2 flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Écriture réservée aux {CHAT_WRITE_LABELS[activeGroup?.min_niveau_ecriture] || 'autorises'}.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {groupFormOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setGroupFormOpen(false)}>
              <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <CardContent className="p-4 space-y-3">
                  <p className="font-semibold text-sm">
                    {groupFormMode === 'create' ? 'Nouveau groupe' : 'Modifier le groupe'}
                  </p>
                  <form onSubmit={handleSubmitGroupForm} className="space-y-3">
                    <div className="space-y-1">
                      <Label>Nom du groupe</Label>
                      <Input
                        value={groupFormData.nom}
                        onChange={(e) => setGroupFormData((f) => ({ ...f, nom: e.target.value }))}
                        data-testid="group-form-nom"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Description</Label>
                      <Textarea
                        value={groupFormData.description}
                        onChange={(e) => setGroupFormData((f) => ({ ...f, description: e.target.value }))}
                        rows={2}
                        data-testid="group-form-description"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Qui peut écrire ?</Label>
                      <div className="flex flex-wrap gap-2">
                        {CHAT_WRITE_LEVELS.map((niveau) => (
                          <Button
                            key={niveau}
                            type="button"
                            size="sm"
                            variant={groupFormData.min_niveau_ecriture === niveau ? 'default' : 'outline'}
                            onClick={() => setGroupFormData((f) => ({ ...f, min_niveau_ecriture: niveau }))}
                          >
                            {CHAT_WRITE_LABELS[niveau]}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Messages éphémères</Label>
                      <div className="flex flex-wrap gap-2">
                        {EPHEMERAL_OPTIONS.map((opt) => (
                          <Button
                            key={opt}
                            type="button"
                            size="sm"
                            variant={groupFormData.ephemeral_mode === opt ? 'default' : 'outline'}
                            onClick={() => setGroupFormData((f) => ({ ...f, ephemeral_mode: opt }))}
                          >
                            {EPHEMERAL_LABELS[opt]}
                          </Button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Les nouveaux messages de ce groupe seront supprimés automatiquement après ce délai.
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button type="button" variant="ghost" onClick={() => setGroupFormOpen(false)}>Annuler</Button>
                      <Button type="submit" disabled={savingGroup}>
                        {savingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : (groupFormMode === 'create' ? 'Créer' : 'Enregistrer')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent></Tabs>
    </div>
  );
}

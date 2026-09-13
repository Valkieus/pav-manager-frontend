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
  Building2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Niveaux ciblables depuis le formulaire de composition. Les Techniciens ne
// figurent pas dans cette liste : leur inclusion passe uniquement par
// l'interrupteur dedie ci-dessous (exclus par defaut).
const NIVEAUX_CIBLE = ['Responsable', 'Gestionnaire', 'Admin (lecture seule)', 'Admin', 'Super Admin'];

const BRANCHES = ['Supervision', 'Coordination', 'Production', 'Live', 'Animation', 'Régisseurs', 'Diffusion'];

const CAN_COMPOSE = ['Responsable', 'Gestionnaire', 'Admin', 'Super Admin'];
const CAN_VIEW_HISTORY = ['Responsable', 'Gestionnaire', 'Admin (lecture seule)', 'Admin', 'Super Admin'];

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

const CommunicationCard = ({ comm, showDestinataires }) => (
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

  return (
    <div className="space-y-6" data-testid="communication-page">
      <div>
        <h1 className="text-2xl font-bold">Communication</h1>
        <p className="text-muted-foreground">Memos internes et annonces ciblées</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
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
        </TabsList>

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
                <CommunicationCard key={c.id} comm={c} />
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
                  <CommunicationCard key={c.id} comm={c} showDestinataires />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast, Toaster } from 'sonner';
import { 
  Building2, 
  Loader2,
  Calendar,
  Clock,
  Lock,
  CheckCircle2,
  XCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PublicReservation() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  
  const [linkData, setLinkData] = useState(null);
  const [salles, setSalles] = useState([]);
  const [creneaux, setCreneaux] = useState([]);
  const [reservations, setReservations] = useState([]);
  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSalle, setSelectedSalle] = useState('');
  const [selectedCreneau, setSelectedCreneau] = useState('');
  
  const [form, setForm] = useState({
    nom_demandeur: '',
    telephone: '',
    email: '',
    raison: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    checkAccess();
  }, [token]);

  useEffect(() => {
    if (accessGranted && selectedDate) {
      fetchReservations();
    }
  }, [accessGranted, selectedDate]);

  const checkAccess = async (pwd = null) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/public/share/${token}/access`, {
        mot_de_passe: pwd
      });
      setLinkData(response.data);
      setSalles(response.data.salles);
      setCreneaux(response.data.creneaux);
      setAccessGranted(true);
      setNeedsPassword(false);
      
      // Set default date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow.toISOString().split('T')[0]);
    } catch (err) {
      if (err.response?.status === 401) {
        setNeedsPassword(true);
        if (pwd) {
          toast.error('Mot de passe incorrect');
        }
      } else if (err.response?.status === 410) {
        setError('Ce lien a expiré');
      } else {
        setError('Lien invalide');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchReservations = async () => {
    try {
      const response = await axios.get(`${API}/public/share/${token}/reservations?date=${selectedDate}`);
      setReservations(response.data);
    } catch (err) {
      console.error('Error fetching reservations');
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    checkAccess(password);
  };

  const isSlotTaken = (salleId, creneauId) => {
    return reservations.some(r => 
      r.salle_id === salleId && 
      r.creneau_id === creneauId &&
      ['En attente', 'Validée'].includes(r.statut)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSalle || !selectedCreneau) {
      toast.error('Sélectionnez une salle et un créneau');
      return;
    }
    
    setSubmitting(true);
    try {
      await axios.post(`${API}/public/share/${token}/reservation`, {
        salle_id: selectedSalle,
        date: selectedDate,
        creneau_id: selectedCreneau,
        ...form
      });
      setSubmitted(true);
      toast.success('Demande envoyée !');
    } catch (err) {
      const detail = err.response?.data?.detail;
      let message = 'Erreur lors de l\'envoi';
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail.map((d) => d.msg || JSON.stringify(d)).join(' — ');
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Generate dates for next 60 days
  const availableDates = [];
  for (let i = 1; i <= 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    availableDates.push(d.toISOString().split('T')[0]);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
            <h1 className="text-xl font-bold mb-2">Accès impossible</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
        <Toaster position="top-center" richColors />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Accès protégé</CardTitle>
            <CardDescription>Ce lien nécessite un mot de passe</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Mot de passe</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez le mot de passe"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Accéder
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
            <h1 className="text-xl font-bold mb-2">Demande envoyée !</h1>
            <p className="text-muted-foreground mb-4">
              Votre demande de réservation a été envoyée. Vous recevrez une confirmation par email une fois validée.
            </p>
            <Button onClick={() => {
              setSubmitted(false);
              setForm({ nom_demandeur: '', telephone: '', email: '', raison: '' });
              setSelectedSalle('');
              setSelectedCreneau('');
            }}>
              Nouvelle réservation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-lg border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="PAV" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="font-semibold">PAV - Réservation de salle</h1>
            <p className="text-xs text-muted-foreground">{linkData?.nom}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Calendar & Slots */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Sélectionnez une date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une date" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.map(date => (
                      <SelectItem key={date} value={date}>
                        {new Date(date).toLocaleDateString('fr-FR', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long',
                          year: 'numeric'
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Disponibilités
                </CardTitle>
                <CardDescription>
                  Cliquez sur un créneau disponible pour le sélectionner
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {salles.map(salle => (
                  <div key={salle.id} className="border rounded-lg p-3">
                    <h3 className="font-medium mb-2">{salle.nom}</h3>
                    {salle.capacite && (
                      <p className="text-xs text-muted-foreground mb-2">Capacité: {salle.capacite}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {creneaux.map(creneau => {
                        const taken = isSlotTaken(salle.id, creneau.id);
                        const selected = selectedSalle === salle.id && selectedCreneau === creneau.id;
                        return (
                          <Button
                            key={creneau.id}
                            size="sm"
                            variant={selected ? 'default' : taken ? 'secondary' : 'outline'}
                            disabled={taken}
                            onClick={() => {
                              setSelectedSalle(salle.id);
                              setSelectedCreneau(creneau.id);
                            }}
                            className={taken ? 'opacity-50' : ''}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            {creneau.nom}
                            {taken && ' (Indisponible)'}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right: Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Formulaire de réservation</CardTitle>
                <CardDescription>
                  Remplissez vos informations pour soumettre la demande
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {selectedSalle && selectedCreneau && (
                    <div className="p-3 bg-primary/10 rounded-lg mb-4">
                      <p className="text-sm font-medium">
                        Sélection: {salles.find(s => s.id === selectedSalle)?.nom} - {creneaux.find(c => c.id === selectedCreneau)?.nom}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Nom complet *</Label>
                    <Input
                      value={form.nom_demandeur}
                      onChange={(e) => setForm({ ...form, nom_demandeur: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Téléphone *</Label>
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={form.telephone}
                      onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                      pattern="[0-9+\s().\-]{8,20}"
                      placeholder="06 12 34 56 78"
                      title="Numéro de téléphone valide (8 à 20 chiffres, espaces ou + . - ( ) acceptés)"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="nom@exemple.fr"
                      title="Adresse email valide"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Raison de la réservation *</Label>
                    <Textarea
                      value={form.raison}
                      onChange={(e) => setForm({ ...form, raison: e.target.value })}
                      placeholder="Décrivez l'objet de votre réservation"
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={submitting || !selectedSalle || !selectedCreneau}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Soumettre la demande
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

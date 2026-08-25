import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  Users as UsersIcon,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Archive,
  Trash2,
  Building2,
  Download,
  Edit,
  RotateCcw,
  Wallet,
  TrendingUp
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const categoriesFournisseur = [
  'Équipement vidéo',
  'Équipement audio',
  'Informatique',
  'Fournitures',
  'Services',
  'Autre'
];

export default function DevisAchat() {
  const { user, canValidate, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('devis');
  const [devis, setDevis] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogDevisOpen, setDialogDevisOpen] = useState(false);
  const [dialogFournisseurOpen, setDialogFournisseurOpen] = useState(false);
  const [editingFournisseurId, setEditingFournisseurId] = useState(null);
  const [editingDevisId, setEditingDevisId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [devisForm, setDevisForm] = useState({
    titre: '',
    fournisseur_id: '',
    montant: '',
    description: '',
    evenement: ''
  });
  
  const [fournisseurForm, setFournisseurForm] = useState({
    nom: '',
    contact: '',
    email: '',
    telephone: '',
    adresse: '',
    categorie: ''
  });

  const resetDevisForm = () => {
    setDevisForm({ titre: '', fournisseur_id: '', montant: '', description: '', evenement: '' });
    setEditingDevisId(null);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [devisRes, fournisseursRes] = await Promise.all([
        axios.get(`${API}/devis`),
        axios.get(`${API}/fournisseurs`)
      ]);
      setDevis(devisRes.data);
      setFournisseurs(fournisseursRes.data);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  // Devis handlers
  const handleSubmitDevis = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...devisForm,
        montant: parseFloat(devisForm.montant),
        fournisseur_id: devisForm.fournisseur_id || null,
        evenement: devisForm.evenement || null
      };
      
      const wasEditing = !!editingDevisId;
      if (editingDevisId) {
        await axios.put(`${API}/devis/${editingDevisId}`, payload);
        toast.success('Devis modifié');
      } else {
        await axios.post(`${API}/devis`, payload);
        toast.success('Devis créé');
      }
      setDialogDevisOpen(false);
      resetDevisForm();
      if (wasEditing) {
        navigate('/');
      } else {
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditDevis = (d) => {
    setDevisForm({
      titre: d.titre,
      fournisseur_id: d.fournisseur_id || '',
      montant: d.montant.toString(),
      description: d.description,
      evenement: d.evenement || ''
    });
    setEditingDevisId(d.id);
    setDialogDevisOpen(true);
  };

  const handleValidateDevis = async (id) => {
    try {
      await axios.put(`${API}/devis/${id}/validate`);
      toast.success('Devis validé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleRejectDevis = async (id) => {
    try {
      await axios.put(`${API}/devis/${id}/reject`);
      toast.success('Devis refusé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleRevertDevis = async (id) => {
    try {
      await axios.put(`${API}/devis/${id}/revert`);
      toast.success('Devis remis en attente');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleArchiveDevis = async (id) => {
    try {
      await axios.put(`${API}/devis/${id}/archive`);
      toast.success('Devis archivé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDeleteDevis = async (id) => {
    if (!window.confirm('Supprimer ce devis ?')) return;
    try {
      await axios.delete(`${API}/devis/${id}`);
      toast.success('Devis supprimé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  // Fournisseur handlers
  const handleEditFournisseur = (f) => {
    setFournisseurForm({
      nom: f.nom,
      contact: f.contact,
      email: f.email,
      telephone: f.telephone,
      adresse: f.adresse,
      categorie: f.categorie
    });
    setEditingFournisseurId(f.id);
    setDialogFournisseurOpen(true);
  };

  const handleSubmitFournisseur = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingFournisseurId) {
        await axios.put(`${API}/fournisseurs/${editingFournisseurId}`, fournisseurForm);
        toast.success('Fournisseur modifié');
      } else {
        await axios.post(`${API}/fournisseurs`, fournisseurForm);
        toast.success('Fournisseur ajouté');
      }
      setDialogFournisseurOpen(false);
      setFournisseurForm({ nom: '', contact: '', email: '', telephone: '', adresse: '', categorie: '' });
      setEditingFournisseurId(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveFournisseur = async (id) => {
    try {
      await axios.put(`${API}/fournisseurs/${id}/archive`);
      toast.success('Fournisseur archivé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDeleteFournisseur = async (id) => {
    if (!window.confirm('Supprimer ce fournisseur ?')) return;
    try {
      await axios.delete(`${API}/fournisseurs/${id}`);
      toast.success('Fournisseur supprimé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const getStatutBadge = (statut) => {
    switch (statut) {
      case 'En attente':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case 'Validé':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3 mr-1" />Validé</Badge>;
      case 'Refusé':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><XCircle className="w-3 h-3 mr-1" />Refusé</Badge>;
      default:
        return <Badge variant="secondary">{statut}</Badge>;
    }
  };

  const handleDownloadDevisPdf = async (d) => {
    // Renders the invoice off-screen (no new tab, no browser print dialog) and
    // exports it straight to a downloaded PDF via html2canvas + jsPDF. The
    // previous approach opened a blank window.open('', '_blank') tab and
    // called window.print() on load — with no app chrome in that tab, once
    // the print dialog was dismissed there was no way back to PAV Manager.
    const statutText = d.statut === 'Validé' ? '✓ VALIDÉ' : d.statut === 'Refusé' ? '✗ REFUSÉ' : '⏳ EN ATTENTE';
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '-99999px';
    container.style.width = '794px'; // ~ A4 width at 96dpi
    container.style.background = '#ffffff';
    container.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #333; box-sizing: border-box; width: 794px;">
        <div style="display:flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
          <div>
            <div style="font-size: 28px; font-weight: bold; color: #2563eb;">PAV Manager</div>
            <div style="font-size: 12px; color: #666;">Production Audiovisuelle - Gestion Technique</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: bold; color: #1e40af;">DEVIS</div>
            <div style="color: #666; margin-top: 5px;">Édité le ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
        <div style="margin-bottom: 25px;">
          <div style="font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Informations du devis</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div><div style="font-size: 12px; color: #666; margin-bottom: 3px;">Titre</div><div style="font-size: 16px; font-weight: 500;">${d.titre}</div></div>
            <div><div style="font-size: 12px; color: #666; margin-bottom: 3px;">Événement</div><div style="font-size: 16px; font-weight: 500;">${d.evenement || 'Non spécifié'}</div></div>
            <div><div style="font-size: 12px; color: #666; margin-bottom: 3px;">Fournisseur</div><div style="font-size: 16px; font-weight: 500;">${d.fournisseur_nom || 'Non spécifié'}</div></div>
            <div><div style="font-size: 12px; color: #666; margin-bottom: 3px;">Date de création</div><div style="font-size: 16px; font-weight: 500;">${new Date(d.created_at).toLocaleDateString('fr-FR')}</div></div>
            <div>
              <div style="font-size: 12px; color: #666; margin-bottom: 3px;">Statut</div>
              <div style="font-size: 16px; font-weight: 500;">
                <span style="display:inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; background: ${d.statut === 'Validé' ? '#d1fae5' : d.statut === 'Refusé' ? '#fee2e2' : '#fef3c7'}; color: ${d.statut === 'Validé' ? '#065f46' : d.statut === 'Refusé' ? '#991b1b' : '#92400e'};">${statutText}</span>
              </div>
            </div>
          </div>
        </div>
        <div style="margin-bottom: 25px;">
          <div style="font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Montant</div>
          <div style="font-size: 28px; font-weight: bold; color: #059669;">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(d.montant)}</div>
        </div>
        <div style="margin-bottom: 25px;">
          <div style="font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Description</div>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; line-height: 1.6;">${d.description || 'Aucune description'}</div>
        </div>
        <div style="margin-bottom: 25px;">
          <div style="font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Demandeur</div>
          <div style="font-size: 18px;">${d.created_by_name}</div>
        </div>
        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between;">
          <div style="width: 200px; border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; font-size: 12px; color: #666;">Signature Demandeur</div>
          <div style="width: 200px; border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; font-size: 12px; color: #666;">Signature Validation</div>
        </div>
      </div>
    `;
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight);
      pdf.save(`Devis-${d.titre.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`);
    } catch (err) {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      document.body.removeChild(container);
    }
  };

  const totalEnAttente = devis.filter((d) => d.statut === 'En attente').length;
  const montantValide = devis.filter((d) => d.statut === 'Validé').reduce((acc, d) => acc + (d.montant || 0), 0);
  const montantEnAttente = devis.filter((d) => d.statut === 'En attente').reduce((acc, d) => acc + (d.montant || 0), 0);

  return (
    <div className="space-y-6" data-testid="devis-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Devis & Achat</h1>
          <p className="text-muted-foreground">Gestion des devis et fournisseurs</p>
        </div>
      </div>

      {/* Overview stats — gives the page a real "back office" feel at a glance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="animate-fadeIn">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">En attente de validation</p>
              <p className="text-2xl font-bold">{totalEnAttente}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fadeIn stagger-1">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Montant validé</p>
              <p className="text-2xl font-bold">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(montantValide)}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fadeIn stagger-2">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Montant en attente</p>
              <p className="text-2xl font-bold">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(montantEnAttente)}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="devis" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Devis
          </TabsTrigger>
          <TabsTrigger value="fournisseurs" className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4" /> Fournisseurs
          </TabsTrigger>
        </TabsList>

        {/* DEVIS TAB */}
        <TabsContent value="devis" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogDevisOpen} onOpenChange={(open) => {
              setDialogDevisOpen(open);
              if (!open) resetDevisForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="add-devis-btn">
                  <Plus className="w-4 h-4 mr-2" /> Nouveau Devis
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingDevisId ? 'Modifier' : 'Créer'} un devis</DialogTitle>
                  <DialogDescription>Remplissez les informations du devis</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitDevis} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Titre *</Label>
                    <Input value={devisForm.titre} onChange={(e) => setDevisForm({ ...devisForm, titre: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Événement</Label>
                    <Input 
                      value={devisForm.evenement} 
                      onChange={(e) => setDevisForm({ ...devisForm, evenement: e.target.value })} 
                      placeholder="Ex: Pâques 2026, Noël 2025..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fournisseur</Label>
                    <Select value={devisForm.fournisseur_id || "none"} onValueChange={(v) => setDevisForm({ ...devisForm, fournisseur_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner (optionnel)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {fournisseurs.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Montant (€) *</Label>
                    <Input type="number" step="0.01" min="0" value={devisForm.montant} onChange={(e) => setDevisForm({ ...devisForm, montant: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Textarea value={devisForm.description} onChange={(e) => setDevisForm({ ...devisForm, description: e.target.value })} required rows={3} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogDevisOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {editingDevisId ? 'Modifier' : 'Créer'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : devis.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun devis</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Événement</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Créé par</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devis.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.titre}</TableCell>
                        <TableCell>
                          {d.evenement ? (
                            <Badge variant="outline" className="bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                              {d.evenement}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{d.fournisseur_nom || '-'}</TableCell>
                        <TableCell>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(d.montant)}</TableCell>
                        <TableCell>{getStatutBadge(d.statut)}</TableCell>
                        <TableCell className="text-muted-foreground">{d.created_by_name}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(d.created_at).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" title="Modifier" onClick={() => handleEditDevis(d)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Télécharger en PDF" onClick={() => handleDownloadDevisPdf(d)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            {canValidate() && d.statut === 'En attente' && (
                              <>
                                <Button size="sm" variant="outline" className="text-emerald-600" title="Valider" onClick={() => handleValidateDevis(d.id)}>
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600" title="Refuser" onClick={() => handleRejectDevis(d.id)}>
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {canValidate() && (d.statut === 'Validé' || d.statut === 'Refusé') && (
                              <Button size="sm" variant="outline" title="Remettre en attente" onClick={() => handleRevertDevis(d.id)}>
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            )}
                            {isAdmin() && (
                              <Button size="sm" variant="ghost" onClick={() => handleArchiveDevis(d.id)}>
                                <Archive className="w-4 h-4" />
                              </Button>
                            )}
                            {isSuperAdmin() && (
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteDevis(d.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FOURNISSEURS TAB */}
        <TabsContent value="fournisseurs" className="space-y-4">
          <div className="flex justify-end">
            {canValidate() && (
              <Dialog open={dialogFournisseurOpen} onOpenChange={(open) => {
                setDialogFournisseurOpen(open);
                if (!open) {
                  setFournisseurForm({ nom: '', contact: '', email: '', telephone: '', adresse: '', categorie: '' });
                  setEditingFournisseurId(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="add-fournisseur-btn">
                    <Plus className="w-4 h-4 mr-2" /> Ajouter Fournisseur
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingFournisseurId ? 'Modifier' : 'Ajouter'} un fournisseur</DialogTitle>
                    <DialogDescription>Informations du fournisseur</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitFournisseur} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nom *</Label>
                        <Input value={fournisseurForm.nom} onChange={(e) => setFournisseurForm({ ...fournisseurForm, nom: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact *</Label>
                        <Input value={fournisseurForm.contact} onChange={(e) => setFournisseurForm({ ...fournisseurForm, contact: e.target.value })} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input type="email" value={fournisseurForm.email} onChange={(e) => setFournisseurForm({ ...fournisseurForm, email: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone *</Label>
                        <Input value={fournisseurForm.telephone} onChange={(e) => setFournisseurForm({ ...fournisseurForm, telephone: e.target.value })} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Adresse *</Label>
                      <Input value={fournisseurForm.adresse} onChange={(e) => setFournisseurForm({ ...fournisseurForm, adresse: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Catégorie *</Label>
                      <Select value={fournisseurForm.categorie} onValueChange={(v) => setFournisseurForm({ ...fournisseurForm, categorie: v })}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          {categoriesFournisseur.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogFournisseurOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit" className="flex-1" disabled={submitting}>
                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingFournisseurId ? 'Modifier' : 'Ajouter'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : fournisseurs.length === 0 ? (
                <div className="p-8 text-center">
                  <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun fournisseur</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fournisseurs.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.nom}</TableCell>
                        <TableCell>{f.contact}</TableCell>
                        <TableCell className="text-muted-foreground">{f.email}</TableCell>
                        <TableCell className="text-muted-foreground">{f.telephone}</TableCell>
                        <TableCell><Badge variant="outline">{f.categorie}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canValidate() && (
                              <Button size="sm" variant="ghost" onClick={() => handleEditFournisseur(f)}>Modifier</Button>
                            )}
                            {isAdmin() && (
                              <Button size="sm" variant="ghost" onClick={() => handleArchiveFournisseur(f.id)}>
                                <Archive className="w-4 h-4" />
                              </Button>
                            )}
                            {isSuperAdmin() && (
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteFournisseur(f.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

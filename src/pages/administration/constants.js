import { Server, Users, Calendar, GraduationCap, BookOpen, FileText, MessageSquare, Bell } from 'lucide-react';

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const NIVEAUX_ACCES = [
  "Technicien",
  "Responsable",
  "Coordination",
  "Admin (lecture seule)",
  "Admin",
  "Super Admin",
];

export const SUPERVISED_COLLECTIONS_FRONT = [
  "users",
  "techniciens",
  "planning",
  "absences",
  "formations",
  "formation_suggestions",
  "devis",
  "fournisseurs",
  "materiel",
  "salles",
  "creneaux",
  "reservations",
  "notifications",
  "logs",
  "groups",
  "actualites",
  "documents",
  "organigramme",
  "settings",
  "communications",
  "communication_chat",
];

export const SUPERVISED_COLLECTIONS_LABELS = {
  users: "Utilisateurs",
  techniciens: "Effectif",
  planning: "Planning",
  absences: "Absences",
  formations: "Formations",
  formation_suggestions: "Suggestions de formation",
  devis: "Devis",
  fournisseurs: "Fournisseurs",
  materiel: "Materiel / Regisseurs",
  salles: "Salles",
  creneaux: "Creneaux",
  reservations: "Reservations",
  notifications: "Notifications",
  logs: "Logs",
  groups: "Groupes",
  actualites: "Actualites",
  documents: "Documents (base de connaissance)",
  organigramme: "Organigramme",
  settings: "Parametres",
  communications: "Communication (annonces)",
  communication_chat: "Communication (discussions)",
};

export const MAINTENANCE_PAGES = [
  { path: "/", label: "Dashboard" },
  { path: "/actualites", label: "Actualités" },
  { path: "/planning", label: "Planning" },
  { path: "/mon-espace", label: "Mon espace" },
  { path: "/effectif", label: "Effectif" },
  { path: "/salles", label: "Salles" },
  { path: "/logistique", label: "Régisseurs" },
  { path: "/devis", label: "Devis & Achat" },
  { path: "/formations", label: "Formations" },
  { path: "/documents", label: "Base de connaissance" },
  { path: "/communication", label: "Communication" },
  // Sites annexes (le message s'affiche à la connexion depuis le portail et sur le site s'il est déjà ouvert)
  { path: "site:led", label: "PAV LED (site annexe)" },
  { path: "site:songs", label: "CEC Songs (site annexe)" },
  { path: "site:academy", label: "PAV Academy (site annexe)" },
  // Liens externes du portail : le lien est grisé « En maintenance » dans le Portail Charisma
  { path: "site:bible", label: "Recherche Biblique (lien du portail)" },
  { path: "site:songspot", label: "SongSpot (lien du portail)" },
  { path: "site:acadarts", label: "Académie des Arts (lien du portail)" },
  { path: "site:tv", label: "Charisma TV (lien du portail)" },
  { path: "site:site", label: "Site Web Charisma (lien du portail)" },
];

export const MAINTENANCE_ROLES = [
  "Technicien",
  "Responsable",
  "Coordination",
  "Admin (lecture seule)",
  "Admin",
];

export const PERMISSION_CATEGORIES = {
  Effectif: ["effectif.read", "effectif.write", "effectif.delete"],
  Planning: ["planning.read", "planning.write", "planning.delete"],
  Logistique: ["logistique.read", "logistique.write", "logistique.delete"],
  "Éléments LED": ["led.read", "led.write", "led.download"],
  Devis: ["devis.read", "devis.write", "devis.validate", "devis.delete"],
  Formations: [
    "formations.read",
    "formations.write",
    "formations.validate",
    "formations.delete",
  ],
  Salles: [
    "salles.read",
    "salles.write",
    "salles.reservations",
    "salles.delete",
  ],
  Administration: ["admin.users", "admin.groups", "admin.logs"],
};

export const SEGMENTABLE_PERMISSION_LABELS = {
  "salles.reservations": "Salles — valider / refuser une réservation",
  "devis.validate": "Devis — valider / refuser un devis",
  "formations.validate": "Formations — valider une demande",
  "effectif.write": "Effectif — créer / modifier une fiche",
  "effectif.approve": "Effectif — valider une fiche proposée",
  "documents.write": "Documents — ajouter / modifier",
  "actualites.write": "Actualités — publier / modifier",
};

export const SEGMENTABLE_PERMISSIONS = Object.keys(SEGMENTABLE_PERMISSION_LABELS);

export const PERMISSION_MATRIX_MODULES = [
  { label: "Effectif", prefix: "effectif" },
  { label: "Planning", prefix: "planning" },
  { label: "Logistique", prefix: "logistique" },
  {
    label: "Éléments LED",
    prefix: "led",
    noDelete: true,
    special: { key: "led.download", label: "Télécharger" },
  },
  {
    label: "Devis",
    prefix: "devis",
    special: { key: "devis.validate", label: "Valider" },
  },
  {
    label: "Formations",
    prefix: "formations",
    special: { key: "formations.validate", label: "Valider" },
  },
  {
    label: "Salles",
    prefix: "salles",
    special: { key: "salles.reservations", label: "Réserver" },
  },
];

export const ADMINISTRATION_PERMISSIONS = [
  { key: "admin.users", label: "Utilisateurs" },
  { key: "admin.groups", label: "Groupes & Droits (consulter)" },
  { key: "admin.logs", label: "Logs" },
];

export const NOTIFICATION_TYPE_ROLES = ["Technicien", "Responsable", "Coordination", "Admin (lecture seule)", "Admin", "Super Admin"];

export const NOTIFICATION_CATEGORIES = [
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
    types: ["planning_publie", "absence", "absence_rappel", "retard", "salle_demande", "salle_decision"],
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
    types: ["actualite", "communication", "groupchat", "comm_diffusion", "comm_canal", "comm_mention"],
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

export const NOTIFICATION_DEFAULT_HINTS = {
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
  absence: "Coordination+, Responsables : « X sera absent du … au … » (période envoyée)",
  absence_rappel: "Tous les comptes actifs (rappel le 15 et le 20 du mois)",
  salle_demande: "Gestionnaires des salles désignés (ex. Paul)",
  salle_decision: "Le demandeur de la réservation",
  comm_diffusion: "Les personnes ciblées par le message",
  comm_canal: "Les membres du canal",
  comm_mention: "La personne mentionnée ou répondue",
  actualite: "Tous les utilisateurs",
  retard: "Paul, Delphine, Winchel, superviseur du jour (planning), responsable(s) de branche",
  maintenance: "Rôles impactés par le mode maintenance",
  academy_assignment: "L'élève assigné",
  academy_correction: "Examinateur + Coordination",
  academy_corrige: "L'élève",
  communication: "Tous les utilisateurs (Chaîne)",
  groupchat: "Membres du groupe",
  crash: "Tous les Super Admin",
};

export const BRANCHES_FOR_FICHE = [
  "Supervision",
  "Coordination",
  "Production",
  "Live",
  "Animation",
  "R\u00e9gisseurs",
  "Diffusion",
];

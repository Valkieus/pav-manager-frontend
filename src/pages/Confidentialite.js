import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="space-y-2">
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">{children}</div>
  </div>
);

export default function Confidentialite() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Politique de confidentialité — PAV Manager</h1>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/login"><ArrowLeft className="w-4 h-4 mr-2" />Retour</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <p className="text-sm text-muted-foreground">
              Dernière mise à jour : juillet 2026. Cette page décrit, conformément au Règlement Général sur la
              Protection des Données (RGPD), comment PAV Manager traite les données personnelles des techniciens,
              gestionnaires et personnes réservant une salle.
            </p>

            <Section title="1. Responsable de traitement">
              <p>
                Le responsable de traitement est le département Production Audiovisuelle (PAV). Toute demande relative
                à vos données personnelles peut être adressée à un Super Admin de l'application, via la rubrique
                « Mon espace » (bouton dédié) ou par email à l'adresse de contact communiquée par votre coordination.
              </p>
            </Section>

            <Section title="2. Données collectées">
              <p>Selon votre rôle, PAV Manager traite les catégories de données suivantes :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Identité et contact : nom, prénom, téléphone, email (fiche technicien).</li>
                <li>Données professionnelles : branche(s), sous-branche(s), niveau technicien, niveau d'accès, badge.</li>
                <li>Données de planning : affectations, absences déclarées, notes internes.</li>
                <li>Données de gestion : devis, demandes de formation, réservations de salle (y compris pour les
                  personnes externes au PAV qui réservent via un lien de partage).</li>
                <li>Journal technique : identifiant de connexion, actions effectuées et horodatage (journal
                  d'activité), à des fins de sécurité et de traçabilité.</li>
              </ul>
            </Section>

            <Section title="3. Finalités et bases légales">
              <ul className="list-disc pl-5 space-y-1">
                <li>Gestion des plannings et des ressources humaines du département — exécution des missions internes
                  du PAV / intérêt légitime.</li>
                <li>Gestion des devis, formations et réservations de salle — intérêt légitime de gestion administrative.</li>
                <li>Sécurité applicative (journal d'activité, contrôle d'accès par rôle) — intérêt légitime.</li>
                <li>Notifications email automatiques (confirmations, validations, refus) — exécution du service demandé.</li>
              </ul>
            </Section>

            <Section title="4. Durées de conservation">
              <ul className="list-disc pl-5 space-y-1">
                <li>Fiches techniciens et comptes : conservés tant que la personne est active au sein du département,
                  puis archivés ou supprimés sur demande.</li>
                <li>Journal d'activité (logs) : purgé automatiquement après 12 mois.</li>
                <li>Réservations de salle, devis, formations : conservés à des fins d'historique de gestion, archivables
                  par un administrateur.</li>
              </ul>
            </Section>

            <Section title="5. Destinataires et sous-traitants">
              <p>
                Les données sont hébergées chez les sous-traitants techniques suivants, choisis pour leur conformité :
                MongoDB (base de données), Railway (hébergement du serveur applicatif), Netlify (hébergement de
                l'interface web), et le service SMTP utilisé pour l'envoi des emails automatiques. Aucune donnée n'est
                vendue ni transmise à des fins commerciales.
              </p>
            </Section>

            <Section title="6. Vos droits">
              <p>Conformément au RGPD, vous disposez des droits suivants sur vos données :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Droit d'accès et de portabilité</b> : téléchargez l'ensemble de vos données depuis « Mon espace »
                  (bouton « Télécharger mes données »).</li>
                <li><b>Droit de rectification</b> : demandez la correction de vos informations auprès d'un Gestionnaire
                  ou Super Admin.</li>
                <li><b>Droit à l'effacement</b> : demandez la suppression de votre compte depuis « Mon espace » (bouton
                  « Demander la suppression de mon compte ») — traitée sous 30 jours par un Super Admin.</li>
                <li><b>Droit d'opposition</b> : vous pouvez vous opposer à un traitement en contactant l'administration.</li>
              </ul>
            </Section>

            <Section title="7. Cookies et stockage local">
              <p>
                PAV Manager n'utilise pas de cookies de suivi ni publicitaires. Un jeton de connexion (JWT) est stocké
                dans le stockage local de votre navigateur uniquement pour maintenir votre session ; il est supprimé à
                la déconnexion.
              </p>
            </Section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

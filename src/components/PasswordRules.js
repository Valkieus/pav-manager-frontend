import { Check, Circle } from 'lucide-react';
import { passwordCheck } from '../lib/passwordPolicy';

// Liste de critères qui se coche pendant la saisie (recommandation CNIL). N'affiche rien tant que le champ est vide, sauf `always`.
export default function PasswordRules({ value, username, fullName, always = false, className = '' }) {
  if (!value && !always) return null;
  const chk = passwordCheck(value, { username, fullName });
  return (
    <div className={`rounded-md border bg-muted/40 p-2 text-xs ${className}`} data-testid="password-rules" aria-live="polite">
      <p className="mb-1 font-medium text-muted-foreground">Recommandation CNIL pour un mot de passe sûr :</p>
      <ul className="grid gap-0.5 sm:grid-cols-2">
        {chk.items.map((it) => (
          <li key={it.key} className={`flex items-start gap-1.5 ${it.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            {it.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Circle className="mt-0.5 h-3 w-3 shrink-0" />}
            <span>{it.label}</span>
          </li>
        ))}
      </ul>
      {chk.hasName && <p className="mt-1 text-destructive">Ne contenez ni votre identifiant ni votre nom.</p>}
      {chk.predictable && <p className="mt-1 text-destructive">Trop prévisible (suite, mot courant ou répétition) : choisissez-en un moins devinable.</p>}
      {chk.tooLong && <p className="mt-1 text-destructive">72 caractères maximum.</p>}
    </div>
  );
}

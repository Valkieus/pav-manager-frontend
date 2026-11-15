import { useEffect, useState } from 'react';

// Chargeurs discrets : rien n'apparaît tant que l'attente est courte (la grande majorité des cas).
// - DelayedLoader : un fin trait animé en haut de l'écran, seulement si ça dépasse `delay` ms ;
// - DelayedLogo   : le logo, en fondu, seulement si ça dépasse `delay` ms (sans pulsation).
function useAfter(delay) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return ready;
}

export default function DelayedLoader({ delay = 350 }) {
  const ready = useAfter(delay);
  if (!ready) return null;
  return <div className="route-loader" role="status" aria-label="Chargement" />;
}

export function DelayedLogo({ delay = 450, className = 'w-14 h-14 object-contain' }) {
  const ready = useAfter(delay);
  return (
    <img
      src="/logo.png"
      alt="PAV"
      className={className}
      style={{ opacity: ready ? 0.9 : 0, transition: 'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)' }}
    />
  );
}

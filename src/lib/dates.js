// Date locale (celle que la personne voit) au format AAAA-MM-JJ. À utiliser à la place de toISOString().slice(0, 10), qui
// renvoie la date en UTC : un jour de moins avec minuit heure de France (le calendrier proposait « la veille »).
export const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

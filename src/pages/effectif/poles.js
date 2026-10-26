// Pôles de l'équipe, alignés sur l'organigramme : « Live » est le TITRE qui regroupe Captation, Régisseurs, Animation,
// Incrustation et Diffusion (personne n'est « dans Live » à proprement parler) ; Production, Coordination et Supervision sont à part.
// Les données enregistrées gardent leur forme historique (branches : Live / Régisseurs… + sous-branches) : ce fichier ne fait que
// les traduire vers les pôles pour l'affichage et la saisie, et inversement à l'enregistrement.
export const LIVE_POLES = ["Captation", "Incrustation", "Diffusion", "Régisseurs", "Animation"];
export const POLES = [...LIVE_POLES, "Production", "Coordination", "Supervision"];

const has = (arr, v) => (arr || []).includes(v);

export function polesOf(t) {
  const b = t?.branches_raw || t?.branches || [];
  const sub = t?.sous_branches || [];
  const live = has(b, "Live");
  const out = new Set();
  if (has(b, "Régisseurs")) out.add("Régisseurs");
  if (has(b, "Animation")) out.add("Animation");
  if (has(b, "Diffusion") || (live && has(sub, "Diffusion"))) out.add("Diffusion");
  if (live && has(sub, "Incrustation")) out.add("Incrustation");
  if (live && (has(sub, "Cadreur") || has(sub, "Réalisation"))) out.add("Captation");
  // « Live » sans pôle précis : ceux qui étaient simplement dans Live sont des captation, sauf s'ils ont déjà un autre pôle (un régisseur n'est pas en Captation).
  if (live && !LIVE_POLES.some((p) => out.has(p))) out.add("Captation");
  if (has(b, "Production")) out.add("Production");
  if (has(b, "Coordination")) out.add("Coordination");
  if (has(b, "Supervision")) out.add("Supervision");
  return POLES.filter((p) => out.has(p));
}

export const isLiveMember = (t) => polesOf(t).some((p) => LIVE_POLES.includes(p));

// Pôles choisis dans le formulaire -> branches / sous-branches enregistrées (forme historique, accès par branche inchangés).
// Si les pôles n'ont pas changé, les valeurs d'origine sont renvoyées TELLES QUELLES (aucune réécriture : un régisseur gardé
// « Live + Régisseurs » reste ainsi dans son périmètre). Sinon, seules les différences sont appliquées.
export function toRaw(poles, prevBranches = [], prevSous = []) {
  const prevPoles = polesOf({ branches: prevBranches, sous_branches: prevSous });
  const set = new Set(poles);
  if (prevPoles.length === set.size && prevPoles.every((p) => set.has(p))) {
    return { branches: [...prevBranches], sous_branches: [...prevSous] };
  }
  let branches = [...prevBranches];
  let sous = [...prevSous];
  const drop = (arr, ...vals) => arr.filter((v) => !vals.includes(v));
  prevPoles.filter((p) => !set.has(p)).forEach((p) => {
    if (p === 'Captation') sous = drop(sous, 'Cadreur', 'Réalisation');
    else if (p === 'Incrustation') sous = drop(sous, 'Incrustation');
    else if (p === 'Diffusion') { branches = drop(branches, 'Diffusion'); sous = drop(sous, 'Diffusion'); }
    else branches = drop(branches, p);
  });
  poles.filter((p) => !prevPoles.includes(p)).forEach((p) => {
    if (p === 'Captation') { if (!branches.includes('Live')) branches.push('Live'); if (!sous.includes('Cadreur')) sous.push('Cadreur'); }
    else if (p === 'Incrustation') { if (!branches.includes('Live')) branches.push('Live'); if (!sous.includes('Incrustation')) sous.push('Incrustation'); }
    else if (p === 'Diffusion') { if (!branches.includes('Diffusion')) branches.push('Diffusion'); }
    else if (!branches.includes(p)) branches.push(p);
  });
  // « Live » n'est conservé que s'il sert encore à un pôle choisi (Captation / Incrustation) ou à une ancienne sous-branche.
  const liveStillUsed = set.has('Captation') || set.has('Incrustation') || sous.some((x) => ['Cadreur', 'Réalisation', 'Incrustation', 'Diffusion'].includes(x));
  if (!liveStillUsed) { branches = drop(branches, 'Live'); sous = []; }
  return { branches, sous_branches: sous };
}

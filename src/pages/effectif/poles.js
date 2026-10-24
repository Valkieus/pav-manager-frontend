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
export function toRaw(poles, prevSous = []) {
  const set = new Set(poles);
  const branches = [];
  const sous = [];
  if (set.has("Captation") || set.has("Incrustation")) branches.push("Live");
  if (set.has("Captation")) { sous.push("Cadreur"); if (has(prevSous, "Réalisation")) sous.push("Réalisation"); }
  if (set.has("Incrustation")) sous.push("Incrustation");
  if (set.has("Diffusion")) branches.push("Diffusion");
  ["Régisseurs", "Animation", "Production", "Coordination", "Supervision"].forEach((p) => set.has(p) && branches.push(p));
  return { branches, sous_branches: sous };
}

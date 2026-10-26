
export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Name-case display transform applied to assigned names — pure CSS
// text-transform, so it's view-only and never mutates the stored value
// (typing/autocomplete still work against the real name). Names in this
// roster are single words in practice, so CSS "capitalize" (first letter of
// each word) reads the same as "first letter only".
export const NAME_CASE_CSS = {
  normal: "none",
  upper: "uppercase",
  lower: "lowercase",
  capitalize: "capitalize",
};

// Same transform, applied directly to the string — used by the PNG export
// path (SVG rasterized via <img>/canvas), where relying on the browser to
// honor a CSS text-transform on foreign-object-free SVG <text> is less
// predictable than just rendering the already-cased string.
export function applyNameCase(value, nameCase) {
  if (!value) return value;
  switch (nameCase) {
    case "upper":
      return value.toUpperCase();
    case "lower":
      return value.toLowerCase();
    case "capitalize":
      return value.replace(
        /\S+/g,
        (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      );
    default:
      return value;
  }
}

export const MOIS_NOMS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// Nomenclature courte des feuilles Excel (V-JANV-2026 / D-JANV-2026) — sans
// accents pour rester compatible avec tous les tableurs (Excel/LibreOffice/
// Google Sheets acceptent les accents dans un nom d'onglet, mais certains
// outils tiers d'import bronchent dessus).
export const MOIS_ABBR = [
  "JANV",
  "FEVR",
  "MARS",
  "AVR",
  "MAI",
  "JUIN",
  "JUIL",
  "AOUT",
  "SEPT",
  "OCT",
  "NOV",
  "DEC",
];

export const YEARS = [
  2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038,
  2039, 2040,
];

// Le planning ne remonte pas avant août 2026 (mise en service de l'app) et
// ne va pas au-delà de 2040 — les mois/années hors de cette plage ne sont
// pas sélectionnables.
export const MIN_YEAR = 2026;

export const MIN_MONTH_IN_MIN_YEAR = 8;

// Août
export const MAX_YEAR = 2040;

export const THEME = {
  vendredi: {
    band: "bg-[#BDD7EE] text-[#1F4E78]",
    title: "text-[#1F4E78]",
    // Fix 28/09/2026 (retour utilisateur) : le texte "RDV à partir de..."
    // passe en noir, comme les prénoms, au lieu de la couleur du thème —
    // seul le fond du bandeau garde la couleur.
    subtitle: "bg-[#BDD7EE] text-black",
    tab: "data-[state=active]:bg-blue-500 data-[state=active]:text-white",
  },
  dimanche: {
    band: "bg-[#FCE4D6] text-[#C55A11]",
    title: "text-[#C55A11]",
    subtitle: "bg-[#FCE4D6] text-black",
    tab: "data-[state=active]:bg-orange-500 data-[state=active]:text-white",
  },
};

// Canonical poste taxonomy — mirrors the backend's POSTES list. Used to
// figure out, for any given role cell in the table, which "poste" category
// it belongs to, so the assignment dropdown can be filtered to only the
// people qualified for it (per their fiche Effectif) rather than showing
// the entire staff roster on every single cell.
export function stripAccents(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function canonPoste(sectionName, label) {
  if (!label) return null;
  const lu = stripAccents(label).toUpperCase().trim();
  if (lu.startsWith("CAMERA")) return "Cadreur (Caméra)";
  if (/^POSTE \d+$/.test(lu)) return "Régisseur";
  if (lu === "SUPERVISION") {
    if (sectionName === "REGISSEURS") return "Supervision Régisseurs";
    if (sectionName === "DIFFUSION") return "Supervision Diffusion";
    return "Supervision Régie";
  }
  if (lu.startsWith("OPERATEUR VDO")) return "Opérateur VDO";
  if (lu.startsWith("OPERATEUR INCRUSTATION")) return "Opérateur Incrustation";
  if (
    lu === "SANCTUAIRE" ||
    lu.startsWith("SALLE") ||
    lu === "GYMNASE" ||
    lu === "POLY 3"
  )
    return "Diffusion (Salles)";
  const compact = lu.replace(/[^A-Z]/g, "");
  if (compact === "REALISATEUR") return "Réalisateur";
  if (compact === "ASSISTANTREALISATEURTRUQUISTE")
    return "Assistant réalisateur / truquiste";
  if (compact === "ETALONNEUR") return "Étalonneur";
  if (compact === "ANIMATEURVDOVFX") return "Animateur VDO / VFX";
  if (compact === "INTERCOMENREGISTREMENTFCP")
    return "Intercom / Enregistrement FCP";
  // Custom/renamed roles: use the label itself as its own poste category —
  // nobody will be pre-tagged for it, so the fallback below shows everyone.
  return label.trim();
}

// Delimiter-group key — decides where a BOLD separator line is drawn
// between consecutive postes in the table (user request 27/09/2026:
// "delimitations en gras entre les lignes qui separent les postes").
// Deliberately coarser than canonPoste in places (e.g. Réalisateur +
// Assistant réalisateur share one group "réal/ass") and finer in others
// (each Caméra N is its own group so cameras get separated too).
export function delimiterGroup(sectionName, label) {
  if (!label) return null;
  const lu = stripAccents(label).toUpperCase().trim();
  if (lu.startsWith("CAMERA")) return `camera:${lu}`;
  if (/^POSTE \d+$/.test(lu)) return "postes";
  if (lu === "SUPERVISION") return `supervision:${sectionName}`;
  if (lu.startsWith("OPERATEUR VDO")) return "op-vdo";
  if (lu.startsWith("OPERATEUR INCRUSTATION")) return "op-incrustation";
  if (lu === "SANCTUAIRE") return "sanctuaire";
  if (lu.startsWith("SALLE") || lu === "GYMNASE" || lu === "POLY 3")
    return "salles";
  const compact = lu.replace(/[^A-Z]/g, "");
  if (compact === "REALISATEUR" || compact === "ASSISTANTREALISATEURTRUQUISTE")
    return "real-ass";
  if (compact === "ETALONNEUR") return "etalonneur";
  if (compact === "ANIMATEURVDOVFX" || compact === "APPRENTIANIMATEURVDO")
    return "animateurs";
  if (compact === "INTERCOMENREGISTREMENTFCP") return "intercom";
  return `custom:${lu}`;
}

export function slugPoste(poste) {
  return stripAccents(poste || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Default planning structure — mirrors the reference paper planning exactly:
// two tables per day (REGIE+CADREURS, then REGISSEURS+DIFFUSION), with a
// standalone "Supervision" row above the REGIE band on the first table.
// À partir de novembre 2026, le planning du dimanche a une « Caméra 7 », identique à la Caméra 6 (2 postes).
// Appliqué à la lecture (plannings existants) et à la création : la structure enregistrée n'est jamais modifiée avant.
export const withCamera7 = (sections, annee, mois) => {
  if (!sections || !sections.dimanche || Number(annee) * 100 + Number(mois) < 202611) return sections;
  const next = JSON.parse(JSON.stringify(sections));
  ["table1", "table2"].forEach((tk) => {
    (next.dimanche[tk] || []).forEach((sec) => {
      const roles = sec.roles || [];
      const keys = roles.map((r) => r.key);
      if (keys.includes("camera_6") && !keys.includes("camera_7")) {
        roles.splice(keys.indexOf("camera_6") + 1, 0, { key: "camera_7", label: "Caméra 7", slots: 2 });
        sec.roles = roles;
      }
    });
  });
  return next;
};

// Caméra 8 : identique à la 7, juste après elle (novembre 2026 et après). Appliquée UNIQUEMENT à un planning créé depuis le modèle par
// défaut ; pour les plannings déjà enregistrés, une migration unique côté serveur l'ajoute, et une ligne supprimée ensuite reste supprimée.
export const withCamera8 = (sections, annee, mois) => {
  if (!sections || !sections.dimanche || Number(annee) * 100 + Number(mois) < 202611) return sections;
  const next = JSON.parse(JSON.stringify(sections));
  ["table1", "table2"].forEach((tk) => {
    (next.dimanche[tk] || []).forEach((sec) => {
      const roles = sec.roles || [];
      const keys = roles.map((r) => r.key);
      if (keys.includes("camera_7") && !keys.includes("camera_8")) {
        roles.splice(keys.indexOf("camera_7") + 1, 0, { key: "camera_8", label: "Caméra 8", slots: 2 });
        sec.roles = roles;
      }
    });
  });
  return next;
};

export const DEFAULT_SECTIONS = {
  dimanche: {
    table1: [
      {
        name: "SUPERVISION",
        standalone: true,
        roles: [{ key: "supervision", label: "Supervision", slots: 1 }],
      },
      {
        name: "REGIE",
        roles: [
          { key: "realisateur", label: "Réalisateur", slots: 1 },
          {
            key: "assistant_realisateur",
            label: "Assistant réalisateur / truquiste",
            slots: 1,
          },
          { key: "etalonneur", label: "Étalonneur", slots: 1 },
          { key: "operateur_vdo_a", label: "Opérateur VDO A", slots: 1 },
          { key: "operateur_vdo_b", label: "Opérateur VDO B", slots: 1 },
          { key: "operateur_vdo_c", label: "Opérateur VDO C", slots: 1 },
          {
            key: "operateur_incrustation_a",
            label: "Opérateur Incrustation A",
            slots: 1,
          },
          {
            key: "operateur_incrustation_b",
            label: "Opérateur Incrustation B",
            slots: 1,
          },
          {
            key: "operateur_incrustation_c",
            label: "Opérateur Incrustation C",
            slots: 1,
          },
          { key: "animateur_vfx_1", label: "Animateur VDO / VFX", slots: 1 },
          { key: "animateur_vfx_2", label: "Animateur VDO / VFX", slots: 1 },
          { key: "animateur_vfx_3", label: "Animateur VDO / VFX", slots: 1 },
          {
            key: "animateur_vfx_apprenti",
            label: "Apprenti Animateur VDO",
            slots: 1,
          },
          {
            key: "intercom_fcp",
            label: "Intercom / Enregistrement FCP",
            slots: 1,
          },
        ],
      },
      {
        name: "CADREURS",
        roles: [
          { key: "camera_1", label: "Caméra 1", slots: 2 },
          { key: "camera_2", label: "Caméra 2", slots: 2 },
          { key: "camera_3", label: "Caméra 3", slots: 2 },
          { key: "camera_4", label: "Caméra 4", slots: 2 },
          { key: "camera_5", label: "Caméra 5", slots: 2 },
          { key: "camera_6", label: "Caméra 6", slots: 2 },
        ],
      },
    ],
    table2: [
      {
        name: "REGISSEURS",
        roles: [
          { key: "regisseur_supervision", label: "Supervision", slots: 1 },
          { key: "regisseur_poste_1", label: "Poste 1", slots: 1 },
          { key: "regisseur_poste_2", label: "Poste 2", slots: 1 },
          { key: "regisseur_poste_3", label: "Poste 3", slots: 1 },
          { key: "regisseur_poste_4", label: "Poste 4", slots: 1 },
        ],
      },
      {
        name: "DIFFUSION",
        roles: [
          { key: "diffusion_supervision", label: "Supervision", slots: 1 },
          { key: "diffusion_sanctuaire_1", label: "Sanctuaire", slots: 1 },
          { key: "diffusion_sanctuaire_2", label: "Sanctuaire", slots: 1 },
          { key: "diffusion_sanctuaire_3", label: "Sanctuaire", slots: 1 },
          {
            key: "diffusion_salle_annexe_1",
            label: "Salle Annexe 1",
            slots: 1,
          },
          {
            key: "diffusion_salle_annexe_2",
            label: "Salle Annexe 2",
            slots: 1,
          },
          { key: "diffusion_poly_3", label: "Poly 3", slots: 1, blocked: true },
          {
            key: "diffusion_gymnase",
            label: "Gymnase",
            slots: 1,
            blocked: true,
          },
        ],
      },
    ],
  },
  vendredi: {
    table1: [
      {
        name: "SUPERVISION",
        standalone: true,
        roles: [{ key: "v_supervision", label: "Supervision", slots: 1 }],
      },
      {
        name: "REGIE",
        roles: [
          { key: "v_realisateur", label: "Réalisateur", slots: 1 },
          {
            key: "v_assistant_realisateur",
            label: "Assistant réalisateur / truquiste",
            slots: 1,
          },
          { key: "v_etalonneur", label: "Étalonneur", slots: 1 },
          { key: "v_operateur_vdo_a", label: "Opérateur VDO A", slots: 1 },
          { key: "v_operateur_vdo_b", label: "Opérateur VDO B", slots: 1 },
          { key: "v_operateur_vdo_c", label: "Opérateur VDO C", slots: 1 },
          {
            key: "v_operateur_incrustation_a",
            label: "Opérateur Incrustation A",
            slots: 1,
          },
          {
            key: "v_operateur_incrustation_b",
            label: "Opérateur Incrustation B",
            slots: 1,
          },
          {
            key: "v_operateur_incrustation_c",
            label: "Opérateur Incrustation C",
            slots: 1,
          },
          { key: "v_animateur_vfx_1", label: "Animateur VDO / VFX", slots: 1 },
          { key: "v_animateur_vfx_2", label: "Animateur VDO / VFX", slots: 1 },
          { key: "v_animateur_vfx_3", label: "Animateur VDO / VFX", slots: 1 },
          {
            key: "v_animateur_vfx_apprenti",
            label: "Apprenti Animateur VDO",
            slots: 1,
          },
          {
            key: "v_intercom_fcp",
            label: "Intercom / Enregistrement FCP",
            slots: 1,
          },
        ],
      },
      {
        name: "CADREURS",
        roles: [
          { key: "v_camera_1", label: "Caméra 1", slots: 2 },
          { key: "v_camera_2", label: "Caméra 2", slots: 2 },
          { key: "v_camera_3", label: "Caméra 3", slots: 2 },
          { key: "v_camera_4", label: "Caméra 4", slots: 2 },
          { key: "v_camera_5", label: "Caméra 5", slots: 2 },
          { key: "v_camera_6_7", label: "Caméra 6 et 7", slots: 3 },
        ],
      },
    ],
    table2: [
      {
        name: "REGISSEURS",
        roles: [
          { key: "v_regisseur_supervision", label: "Supervision", slots: 1 },
          { key: "v_regisseur_poste_1", label: "Poste 1", slots: 1 },
          { key: "v_regisseur_poste_2", label: "Poste 2", slots: 1 },
          { key: "v_regisseur_poste_3", label: "Poste 3", slots: 1 },
          { key: "v_regisseur_poste_4", label: "Poste 4", slots: 1 },
        ],
      },
      {
        name: "DIFFUSION",
        roles: [
          { key: "v_diffusion_supervision", label: "Supervision", slots: 1 },
          { key: "v_diffusion_sanctuaire_1", label: "Sanctuaire", slots: 1 },
          { key: "v_diffusion_sanctuaire_2", label: "Sanctuaire", slots: 1 },
          { key: "v_diffusion_sanctuaire_3", label: "Sanctuaire", slots: 1 },
          {
            key: "v_diffusion_salle_poly_1",
            label: "Salle Poly 1",
            slots: 1,
            blocked: true,
          },
          {
            key: "v_diffusion_salle_poly_2",
            label: "Salle Poly 2",
            slots: 1,
            blocked: true,
          },
          {
            key: "v_diffusion_gymnase",
            label: "Gymnase",
            slots: 1,
            blocked: true,
          },
        ],
      },
    ],
  },
};

export function countRows(sections) {
  // Standalone sections (e.g. the Supervision row) never render a separate
  // band row, so they don't contribute the "+1" a normal section does.
  return sections.reduce(
    (acc, s) =>
      acc + s.roles.reduce((a, r) => a + r.slots, 0) + (s.standalone ? 0 : 1),
    0,
  );
}

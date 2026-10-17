
export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// The 3-step approval chain, used to render the pipeline/stepper UI.
export const STEPS = [
  { key: "demande", label: "Demande" },
  { key: "coordination", label: "Coordination" },
  { key: "direction", label: "Validation finale" },
  { key: "valide", label: "Validée" },
];

export function stepIndexFor(statut) {
  if (statut === "En attente Coordination") return 0;
  if (statut === "En attente validation finale") return 1;
  if (statut === "Validée") return 3;
  if (statut === "Refusée") return -1; // handled separately
  return 0;
}

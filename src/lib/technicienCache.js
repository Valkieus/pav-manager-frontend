// Shared module-level cache for the /techniciens list, used by Planning.js
// to avoid re-fetching the full roster on every navigation. Effectif.js
// invalidates this cache after any mutation (create/edit/archive/delete a
// technicien, or add/rename/delete a poste) so that changes made there show
// up immediately in Planning's name list/dropdowns instead of waiting out
// the cache window.
let cachedTechniciens = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function getCachedTechniciens() {
  if (cachedTechniciens && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    return cachedTechniciens;
  }
  return null;
}

export function setCachedTechniciens(data) {
  cachedTechniciens = data;
  cacheTimestamp = Date.now();
}

export function invalidateTechniciensCache() {
  cachedTechniciens = null;
  cacheTimestamp = 0;
}

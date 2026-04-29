/** kg — avg giveaway above this value flags drift (bars + maintenance insight). */
export const SPOUT_DRIFT_THRESHOLD_KG = 0.2

/**
 * Spouts sorted by worst avg giveaway first (maintenance priority).
 * @param {Array<{ spout_id?: number, avg_giveaway?: number }>} points
 */
export function getFlaggedSpouts(points, thresholdKg = SPOUT_DRIFT_THRESHOLD_KG) {
  const list = Array.isArray(points) ? points : []
  return list
    .filter((p) => Number(p.avg_giveaway) > thresholdKg)
    .sort((a, b) => Number(b.avg_giveaway) - Number(a.avg_giveaway))
}

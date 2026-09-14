// Formats a distance in metres for traveler-friendly display (e.g. 850 -> "850 公尺", 1423 -> "1.4 公里").
export function formatDistance(distanceMeter?: number): string {
  if (distanceMeter === undefined) return '距離未知';
  if (distanceMeter < 1000) return `${Math.round(distanceMeter)} 公尺`;
  return `${(distanceMeter / 1000).toFixed(1)} 公里`;
}

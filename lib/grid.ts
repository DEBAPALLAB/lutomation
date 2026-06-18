export interface GridCell {
  lat: number;
  lng: number;
  radiusM: number;
}

/**
 * Calculates the distance between two points using the Haversine formula.
 */
export function getDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generates grid cells to cover a given search radius around a center.
 */
export function generateGridCells(centerLat: number, centerLng: number, radiusM: number): GridCell[] {
  // If the radius is small, a single cell is sufficient and avoids mirror load.
  if (radiusM <= 1500) {
    return [
      {
        lat: centerLat,
        lng: centerLng,
        radiusM: radiusM,
      },
    ];
  }

  const cells: GridCell[] = [];
  const cellRadius = Math.round(radiusM * 0.55); // 55% cell size for overlap

  // 1. Center cell
  cells.push({
    lat: centerLat,
    lng: centerLng,
    radiusM: cellRadius,
  });

  // 2. Six surrounding cells in a hexagon
  const d = radiusM * 0.55; // Offset distance
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;

    // Displacement in meters
    const dn = d * Math.sin(angle);
    const de = d * Math.cos(angle);

    // Convert displacement to lat/lng offsets
    const dLat = dn / 111000;
    const dLng = de / (111000 * Math.cos((centerLat * Math.PI) / 180));

    cells.push({
      lat: centerLat + dLat,
      lng: centerLng + dLng,
      radiusM: cellRadius,
    });
  }

  return cells;
}

export function meteredPer100(consumptionPer100: number, lossPercent: number | null) {
  if (lossPercent == null || lossPercent === 0) return consumptionPer100;
  return consumptionPer100 / (1 - lossPercent / 100);
}

export function energyCost(consumptionPer100: number, price: number, distanceKm: number) {
  return (distanceKm / 100) * consumptionPer100 * price;
}

export function chargeStops(distanceKm: number, usableRangeKm: number) {
  if (distanceKm <= usableRangeKm) return 0;
  return Math.ceil((distanceKm - usableRangeKm) / usableRangeKm);
}

export function arrivalReserveKm(distanceKm: number, usableRangeKm: number) {
  if (distanceKm <= usableRangeKm) return usableRangeKm - distanceKm;
  const stops = chargeStops(distanceKm, usableRangeKm);
  const lastLeg = distanceKm - usableRangeKm - (stops - 1) * usableRangeKm;
  return usableRangeKm - lastLeg;
}

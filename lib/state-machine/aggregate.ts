import type { OrderStatus } from './statuses.ts';
import type { OrderSnapshot, Roll, Shipment } from './types.ts';

const SHIPMENT_TERMINAL: Shipment['status'][] = ['FAILED', 'CANCELLED'];

export function activeInboundShipment(snapshot: OrderSnapshot): Shipment | null {
  const inbound = snapshot.shipments
    .filter((s) => s.direction === 'INBOUND' && !SHIPMENT_TERMINAL.includes(s.status))
    .sort((a, b) => a.id.localeCompare(b.id));
  return inbound.at(-1) ?? null;
}

export function photosForRoll(snapshot: OrderSnapshot, rollId: string) {
  return snapshot.photos.filter((p) => p.rollId === rollId);
}

export function allRollsReady(rolls: Roll[]): boolean {
  return rolls.length > 0 && rolls.every((roll) => roll.status === 'READY');
}

export function anyRollProcessing(rolls: Roll[]): boolean {
  return rolls.some((roll) =>
    ['DEVELOPING', 'DEVELOPED', 'SCANNING', 'UPLOADING', 'READY'].includes(roll.status),
  );
}

/** Order status is an aggregate. Never infer AT_LAB from shipment DELIVERED. */
export function deriveOrderStatusAfterRollChange(
  current: OrderStatus,
  rolls: Roll[],
): OrderStatus {
  if (current === 'CANCELLED' || current === 'CLOSED' || current === 'RESULTS_READY') {
    return current;
  }
  if (allRollsReady(rolls)) {
    return 'RESULTS_READY';
  }
  if (anyRollProcessing(rolls) && (current === 'AT_LAB' || current === 'PROCESSING')) {
    return 'PROCESSING';
  }
  return current;
}

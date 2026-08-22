import { activeInboundShipment } from './aggregate.ts';
import type { OrderSnapshot } from './types.ts';

export type ActionRequired =
  | { code: 'PICKUP_BOOKING_REQUIRED'; orderId: string }
  | { code: 'PICKUP_SCHEDULE_REQUIRED'; orderId: string }
  | { code: 'SHIPMENT_FAILED'; orderId: string; shipmentId: string }
  | { code: 'LAB_RECEIPT_DELAY'; orderId: string; shipmentId: string }
  | { code: 'OPEN_ISSUE'; orderId: string; issueId: string }
  | { code: 'FILE_DELETION_FAILURE'; orderId: string };

export function actionRequired(
  snapshot: OrderSnapshot,
  now = new Date(),
  labReceiptDelayMs = 24 * 60 * 60 * 1000,
): ActionRequired[] {
  const actions: ActionRequired[] = [];
  const inbound = activeInboundShipment(snapshot);
  const failed = snapshot.shipments.find(
    (shipment) => shipment.direction === 'INBOUND' && shipment.status === 'FAILED',
  );

  if (snapshot.order.status === 'PICKUP_PENDING' && inbound?.status === 'PENDING') {
    actions.push({ code: 'PICKUP_BOOKING_REQUIRED', orderId: snapshot.order.id });
  }

  if (snapshot.order.status === 'PICKUP_PENDING' && inbound?.status === 'BOOKED') {
    actions.push({ code: 'PICKUP_SCHEDULE_REQUIRED', orderId: snapshot.order.id });
  }

  if (failed) {
    actions.push({
      code: 'SHIPMENT_FAILED',
      orderId: snapshot.order.id,
      shipmentId: failed.id,
    });
  }

  const delivered = snapshot.shipments.find(
    (shipment) => shipment.direction === 'INBOUND' && shipment.status === 'DELIVERED',
  );
  if (
    delivered?.deliveredAt &&
    !snapshot.order.labReceivedAt &&
    now.getTime() - Date.parse(delivered.deliveredAt) > labReceiptDelayMs
  ) {
    actions.push({
      code: 'LAB_RECEIPT_DELAY',
      orderId: snapshot.order.id,
      shipmentId: delivered.id,
    });
  }

  for (const issue of snapshot.issues) {
    if (issue.status !== 'RESOLVED') {
      actions.push({ code: 'OPEN_ISSUE', orderId: snapshot.order.id, issueId: issue.id });
    }
  }

  if (
    snapshot.order.photosExpiresAt &&
    Date.parse(snapshot.order.photosExpiresAt) < now.getTime() &&
    !snapshot.order.filesDeletedAt
  ) {
    actions.push({ code: 'FILE_DELETION_FAILURE', orderId: snapshot.order.id });
  }

  return actions;
}

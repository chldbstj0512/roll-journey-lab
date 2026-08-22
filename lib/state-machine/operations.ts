import { activeInboundShipment, allRollsReady, photosForRoll } from './aggregate.ts';
import { DomainError } from './errors.ts';
import { actorId, assertLabMemberForOrder, assertUserOwnsOrder, iso, plusDays } from './guards.ts';
import {
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  PHOTO_TRANSITIONS,
  ROLL_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
  assertTransition,
} from './transitions.ts';
import type {
  Actor,
  Clock,
  Issue,
  OrderSnapshot,
  Roll,
  TransitionResult,
} from './types.ts';
import { emptyResult } from './types.ts';
import { RETENTION_DAYS } from './statuses.ts';

const defaultClock: Clock = () => new Date();

function requirePayment(snapshot: OrderSnapshot, paymentId: string) {
  const payment = snapshot.payments.find((item) => item.id === paymentId);
  if (!payment) throw new DomainError('NOT_FOUND', `Payment ${paymentId} not found`);
  return payment;
}

function requireShipment(snapshot: OrderSnapshot, shipmentId: string) {
  const shipment = snapshot.shipments.find((item) => item.id === shipmentId);
  if (!shipment) throw new DomainError('NOT_FOUND', `Shipment ${shipmentId} not found`);
  return shipment;
}

function requireRoll(snapshot: OrderSnapshot, rollId: string) {
  const roll = snapshot.rolls.find((item) => item.id === rollId);
  if (!roll) throw new DomainError('NOT_FOUND', `Roll ${rollId} not found`);
  return roll;
}

function requirePhoto(snapshot: OrderSnapshot, photoId: string) {
  const photo = snapshot.photos.find((item) => item.id === photoId);
  if (!photo) throw new DomainError('NOT_FOUND', `Photo ${photoId} not found`);
  return photo;
}

function activePaymentConflict(snapshot: OrderSnapshot, exceptId?: string) {
  return snapshot.payments.some(
    (payment) =>
      payment.id !== exceptId &&
      (payment.status === 'PENDING' || payment.status === 'PROCESSING'),
  );
}

export function startPayment(
  snapshot: OrderSnapshot,
  paymentId: string,
  actor: Actor,
): TransitionResult {
  assertUserOwnsOrder(actor, snapshot.order);
  const payment = requirePayment(snapshot, paymentId);
  assertTransition(PAYMENT_TRANSITIONS, payment.status, 'PROCESSING', actor, 'Payment');
  if (snapshot.order.status !== 'PAYMENT_PENDING') {
    throw new DomainError('PRECONDITION_FAILED', 'Payment can only start while order is PAYMENT_PENDING');
  }
  if (payment.amountKrw !== snapshot.order.subtotalKrw) {
    throw new DomainError('PRECONDITION_FAILED', 'Payment amount must match order.subtotalKrw');
  }
  if (activePaymentConflict(snapshot, payment.id)) {
    throw new DomainError('CONFLICT', 'Another payment is already in progress');
  }

  const result = emptyResult();
  result.paymentPatches.push({ id: payment.id, patch: { status: 'PROCESSING' } });
  return result;
}

export function confirmPayment(
  snapshot: OrderSnapshot,
  paymentId: string,
  actor: Actor,
  clock: Clock = defaultClock,
): TransitionResult {
  if (actor.type !== 'SYSTEM') {
    throw new DomainError('UNAUTHORIZED', 'Frontend can never set PAID');
  }
  const payment = requirePayment(snapshot, paymentId);

  if (payment.status === 'PAID' && snapshot.order.status !== 'PAYMENT_PENDING') {
    return emptyResult();
  }

  assertTransition(PAYMENT_TRANSITIONS, payment.status, 'PAID', actor, 'Payment');
  if (payment.amountKrw !== snapshot.order.subtotalKrw) {
    throw new DomainError('PRECONDITION_FAILED', 'PG amount must match order.subtotalKrw');
  }
  assertTransition(ORDER_TRANSITIONS, snapshot.order.status, 'PICKUP_PENDING', actor, 'Order');

  const now = iso(clock);
  const result = emptyResult();
  result.paymentPatches.push({
    id: payment.id,
    patch: { status: 'PAID', approvedAt: now },
  });
  result.orderPatch = {
    status: 'PICKUP_PENDING',
    paidAt: now,
  };
  result.newShipments.push({
    orderId: snapshot.order.id,
    direction: 'INBOUND',
    status: 'PENDING',
    carrier: null,
    trackingNo: null,
    pickupScheduledAt: null,
    pickedUpAt: null,
    deliveredAt: null,
  });
  result.events.push({
    type: 'PAYMENT_COMPLETED',
    orderId: snapshot.order.id,
    fromStatus: snapshot.order.status,
    toStatus: 'PICKUP_PENDING',
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { paymentId: payment.id },
  });
  return result;
}

export function failPayment(
  snapshot: OrderSnapshot,
  paymentId: string,
  actor: Actor,
): TransitionResult {
  if (actor.type !== 'SYSTEM') {
    throw new DomainError('UNAUTHORIZED', 'Only SYSTEM can fail a payment');
  }
  const payment = requirePayment(snapshot, paymentId);
  assertTransition(PAYMENT_TRANSITIONS, payment.status, 'FAILED', actor, 'Payment');

  const result = emptyResult();
  result.paymentPatches.push({ id: payment.id, patch: { status: 'FAILED' } });
  result.events.push({
    type: 'PAYMENT_FAILED',
    orderId: snapshot.order.id,
    actorType: actor.type,
    actorId: null,
    metadata: { paymentId: payment.id },
  });
  return result;
}

export function refundPayment(
  snapshot: OrderSnapshot,
  paymentId: string,
  actor: Actor,
  mode: 'full' | 'partial',
): TransitionResult {
  if (actor.type !== 'R&J_ADMIN') {
    throw new DomainError('UNAUTHORIZED', 'Only R&J_ADMIN can refund');
  }
  const payment = requirePayment(snapshot, paymentId);
  const to = mode === 'full' ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  assertTransition(PAYMENT_TRANSITIONS, payment.status, to, actor, 'Payment');

  const result = emptyResult();
  result.paymentPatches.push({ id: payment.id, patch: { status: to } });
  return result;
}

export function bookShipment(
  snapshot: OrderSnapshot,
  shipmentId: string,
  actor: Actor,
  input: { carrier: string; trackingNo: string },
): TransitionResult {
  if (actor.type !== 'R&J_ADMIN') {
    throw new DomainError('UNAUTHORIZED', 'Only R&J_ADMIN can book a shipment');
  }
  const shipment = requireShipment(snapshot, shipmentId);
  assertTransition(SHIPMENT_TRANSITIONS, shipment.status, 'BOOKED', actor, 'Shipment');

  const result = emptyResult();
  result.shipmentPatches.push({
    id: shipment.id,
    patch: { status: 'BOOKED', carrier: input.carrier, trackingNo: input.trackingNo },
  });
  result.events.push({
    type: 'PICKUP_BOOKED',
    orderId: snapshot.order.id,
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { shipmentId: shipment.id, ...input },
  });
  return result;
}

export function schedulePickup(
  snapshot: OrderSnapshot,
  shipmentId: string,
  actor: Actor,
  pickupScheduledAt: string,
): TransitionResult {
  if (actor.type !== 'R&J_ADMIN') {
    throw new DomainError('UNAUTHORIZED', 'Only R&J_ADMIN can schedule pickup');
  }
  const shipment = requireShipment(snapshot, shipmentId);
  assertTransition(SHIPMENT_TRANSITIONS, shipment.status, 'PICKUP_SCHEDULED', actor, 'Shipment');

  const result = emptyResult();
  result.shipmentPatches.push({
    id: shipment.id,
    patch: { status: 'PICKUP_SCHEDULED', pickupScheduledAt },
  });
  result.events.push({
    type: 'PICKUP_SCHEDULED',
    orderId: snapshot.order.id,
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { shipmentId: shipment.id, pickupScheduledAt },
  });
  return result;
}

export function markShipmentPickedUp(
  snapshot: OrderSnapshot,
  shipmentId: string,
  actor: Actor,
  clock: Clock = defaultClock,
): TransitionResult {
  const shipment = requireShipment(snapshot, shipmentId);
  assertTransition(SHIPMENT_TRANSITIONS, shipment.status, 'PICKED_UP', actor, 'Shipment');
  if (shipment.direction !== 'INBOUND') {
    throw new DomainError('PRECONDITION_FAILED', 'MVP only implements INBOUND pickup');
  }

  const now = iso(clock);
  const result = emptyResult();
  result.shipmentPatches.push({
    id: shipment.id,
    patch: { status: 'PICKED_UP', pickedUpAt: now },
  });

  if (snapshot.order.status === 'PICKUP_PENDING') {
    assertTransition(ORDER_TRANSITIONS, snapshot.order.status, 'IN_TRANSIT', actor, 'Order');
    result.orderPatch = { status: 'IN_TRANSIT' };
  }

  result.events.push({
    type: 'PICKED_UP',
    orderId: snapshot.order.id,
    fromStatus: snapshot.order.status,
    toStatus: result.orderPatch?.status ?? snapshot.order.status,
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { shipmentId: shipment.id },
  });
  return result;
}

export function markShipmentInTransit(
  snapshot: OrderSnapshot,
  shipmentId: string,
  actor: Actor,
): TransitionResult {
  const shipment = requireShipment(snapshot, shipmentId);
  assertTransition(SHIPMENT_TRANSITIONS, shipment.status, 'IN_TRANSIT', actor, 'Shipment');

  const result = emptyResult();
  result.shipmentPatches.push({ id: shipment.id, patch: { status: 'IN_TRANSIT' } });
  result.events.push({
    type: 'SHIPMENT_IN_TRANSIT',
    orderId: snapshot.order.id,
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { shipmentId: shipment.id },
  });
  return result;
}

export function markShipmentDelivered(
  snapshot: OrderSnapshot,
  shipmentId: string,
  actor: Actor,
  clock: Clock = defaultClock,
): TransitionResult {
  const shipment = requireShipment(snapshot, shipmentId);
  assertTransition(SHIPMENT_TRANSITIONS, shipment.status, 'DELIVERED', actor, 'Shipment');

  const result = emptyResult();
  result.shipmentPatches.push({
    id: shipment.id,
    patch: { status: 'DELIVERED', deliveredAt: iso(clock) },
  });
  result.events.push({
    type: 'SHIPMENT_DELIVERED',
    orderId: snapshot.order.id,
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { shipmentId: shipment.id },
  });
  return result;
}

export function failShipment(
  snapshot: OrderSnapshot,
  shipmentId: string,
  actor: Actor,
  openIssue = true,
): TransitionResult {
  const shipment = requireShipment(snapshot, shipmentId);
  if (shipment.status === 'FAILED') {
    return emptyResult();
  }
  assertTransition(SHIPMENT_TRANSITIONS, shipment.status, 'FAILED', actor, 'Shipment');

  const result = emptyResult();
  result.shipmentPatches.push({ id: shipment.id, patch: { status: 'FAILED' } });
  result.events.push({
    type: 'SHIPMENT_FAILED',
    orderId: snapshot.order.id,
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { shipmentId: shipment.id },
  });
  const hasOpenShipping = snapshot.issues.some(
    (issue) => issue.type === 'SHIPPING' && issue.status === 'OPEN',
  );
  if (openIssue && !hasOpenShipping) {
    result.newIssues.push({
      orderId: snapshot.order.id,
      rollId: null,
      type: 'SHIPPING',
      status: 'OPEN',
    });
    result.events.push({
      type: 'ISSUE_OPENED',
      orderId: snapshot.order.id,
      actorType: actor.type,
      actorId: actorId(actor),
      metadata: { type: 'SHIPPING', shipmentId: shipment.id },
    });
  }
  return result;
}

export function confirmLabReceipt(
  snapshot: OrderSnapshot,
  actor: Actor,
  input: {
    actuals?: {
      rollId: string;
      actualFilmType?: string;
      actualProcessType?: string;
    }[];
    receivedRollCount?: number;
  } = {},
  clock: Clock = defaultClock,
): TransitionResult {
  assertLabMemberForOrder(actor, snapshot.order);

  if (snapshot.order.status === 'AT_LAB' || snapshot.order.labReceivedAt) {
    return emptyResult();
  }

  assertTransition(ORDER_TRANSITIONS, snapshot.order.status, 'AT_LAB', actor, 'Order');

  const now = iso(clock);
  const result = emptyResult();
  result.orderPatch = { status: 'AT_LAB', labReceivedAt: now };

  for (const roll of snapshot.rolls) {
    if (roll.status !== 'EXPECTED') continue;
    assertTransition(ROLL_TRANSITIONS, roll.status, 'RECEIVED', actor, 'Roll');
    const actual = input.actuals?.find((item) => item.rollId === roll.id);
    const patch: Partial<Roll> = { status: 'RECEIVED', receivedAt: now };
    if (actual?.actualFilmType) patch.actualFilmType = actual.actualFilmType;
    if (actual?.actualProcessType) patch.actualProcessType = actual.actualProcessType;
    result.rollPatches.push({ id: roll.id, patch });

    const actualFilm = actual?.actualFilmType;
    const actualProcess = actual?.actualProcessType;
    if (
      (actualFilm && actualFilm !== roll.expectedFilmType) ||
      (actualProcess && actualProcess !== roll.expectedProcessType)
    ) {
      result.newIssues.push({
        orderId: snapshot.order.id,
        rollId: roll.id,
        type: 'FILM_TYPE_MISMATCH',
        status: 'OPEN',
      });
    }
  }

  if (
    input.receivedRollCount != null &&
    input.receivedRollCount !== snapshot.order.rollCount
  ) {
    result.newIssues.push({
      orderId: snapshot.order.id,
      rollId: null,
      type: 'ROLL_COUNT_MISMATCH',
      status: 'OPEN',
    });
  }

  result.events.push({
    type: 'LAB_RECEIVED',
    orderId: snapshot.order.id,
    fromStatus: snapshot.order.status,
    toStatus: 'AT_LAB',
    actorType: actor.type,
    actorId: actorId(actor),
  });
  return result;
}

function advanceRoll(
  snapshot: OrderSnapshot,
  rollId: string,
  actor: Actor,
  to: Roll['status'],
  clock: Clock,
  eventType: TransitionResult['events'][number]['type'],
  timestamps: Partial<Roll>,
): TransitionResult {
  assertLabMemberForOrder(actor, snapshot.order);
  const roll = requireRoll(snapshot, rollId);
  assertTransition(ROLL_TRANSITIONS, roll.status, to, actor, 'Roll');

  const result = emptyResult();
  result.rollPatches.push({
    id: roll.id,
    patch: { status: to, ...timestamps },
  });

  if (to === 'DEVELOPING' && snapshot.order.status === 'AT_LAB') {
    assertTransition(ORDER_TRANSITIONS, snapshot.order.status, 'PROCESSING', actor, 'Order');
    result.orderPatch = { status: 'PROCESSING' };
  }

  result.events.push({
    type: eventType,
    orderId: snapshot.order.id,
    fromStatus: result.orderPatch ? snapshot.order.status : null,
    toStatus: result.orderPatch?.status ?? null,
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { rollId: roll.id, from: roll.status, to },
  });
  return result;
}

export function startRollDevelopment(
  snapshot: OrderSnapshot,
  rollId: string,
  actor: Actor,
  clock: Clock = defaultClock,
): TransitionResult {
  return advanceRoll(snapshot, rollId, actor, 'DEVELOPING', clock, 'DEVELOPMENT_STARTED', {
    developmentStartedAt: iso(clock),
  });
}

export function completeRollDevelopment(
  snapshot: OrderSnapshot,
  rollId: string,
  actor: Actor,
  clock: Clock = defaultClock,
): TransitionResult {
  return advanceRoll(snapshot, rollId, actor, 'DEVELOPED', clock, 'DEVELOPMENT_COMPLETED', {
    developmentCompletedAt: iso(clock),
  });
}

export function startRollScanning(
  snapshot: OrderSnapshot,
  rollId: string,
  actor: Actor,
  clock: Clock = defaultClock,
): TransitionResult {
  return advanceRoll(snapshot, rollId, actor, 'SCANNING', clock, 'SCAN_STARTED', {
    scanStartedAt: iso(clock),
  });
}

export function startRollUploading(
  snapshot: OrderSnapshot,
  rollId: string,
  actor: Actor,
  clock: Clock = defaultClock,
): TransitionResult {
  return advanceRoll(snapshot, rollId, actor, 'UPLOADING', clock, 'UPLOAD_STARTED', {});
}

export function releaseRoll(
  snapshot: OrderSnapshot,
  rollId: string,
  actor: Actor,
  clock: Clock = defaultClock,
): TransitionResult {
  assertLabMemberForOrder(actor, snapshot.order);
  const roll = requireRoll(snapshot, rollId);
  if (roll.status === 'READY') {
    return emptyResult();
  }
  assertTransition(ROLL_TRANSITIONS, roll.status, 'READY', actor, 'Roll');

  const photos = photosForRoll(snapshot, roll.id);
  const live = photos.filter((photo) => photo.uploadStatus !== 'DELETED');
  if (live.length === 0) {
    throw new DomainError('PRECONDITION_FAILED', 'A roll needs at least one photo to become READY');
  }
  if (live.some((photo) => photo.uploadStatus !== 'UPLOADED')) {
    throw new DomainError('PRECONDITION_FAILED', 'All required photos must be UPLOADED');
  }

  const nowDate = clock();
  const now = nowDate.toISOString();
  const nextRolls = snapshot.rolls.map((item) =>
    item.id === roll.id ? { ...item, status: 'READY' as const, photoCount: live.length } : item,
  );

  const result = emptyResult();
  result.rollPatches.push({
    id: roll.id,
    patch: {
      status: 'READY',
      photoCount: live.length,
      scanCompletedAt: now,
      releasedAt: now,
    },
  });
  result.events.push({
    type: 'ROLL_READY',
    orderId: snapshot.order.id,
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { rollId: roll.id, photoCount: live.length },
  });

  if (!allRollsReady(nextRolls)) {
    return result;
  }

  if (snapshot.order.status === 'RESULTS_READY') {
    return result;
  }

  assertTransition(ORDER_TRANSITIONS, snapshot.order.status, 'RESULTS_READY', actor, 'Order');
  const expiresAt = plusDays(nowDate, RETENTION_DAYS);
  result.orderPatch = {
    status: 'RESULTS_READY',
    photosReadyAt: now,
    photosExpiresAt: expiresAt,
  };
  result.events.push({
    type: 'PHOTOS_RELEASED',
    orderId: snapshot.order.id,
    fromStatus: snapshot.order.status,
    toStatus: 'RESULTS_READY',
    actorType: actor.type,
    actorId: actorId(actor),
  });
  result.sideEffects.push({
    kind: 'NOTIFY',
    notificationType: 'PHOTOS_READY',
    orderId: snapshot.order.id,
    userId: snapshot.order.userId,
  });
  result.sideEffects.push({
    kind: 'SCHEDULE_EXPIRY_NOTIFICATIONS',
    orderId: snapshot.order.id,
    userId: snapshot.order.userId,
    photosExpiresAt: expiresAt,
  });
  return result;
}

export function startPhotoUpload(
  snapshot: OrderSnapshot,
  photoId: string,
  actor: Actor,
): TransitionResult {
  assertLabMemberForOrder(actor, snapshot.order);
  const photo = requirePhoto(snapshot, photoId);
  assertTransition(PHOTO_TRANSITIONS, photo.uploadStatus, 'UPLOADING', actor, 'Photo');
  const result = emptyResult();
  result.photoPatches.push({ id: photo.id, patch: { uploadStatus: 'UPLOADING' } });
  return result;
}

export function completePhotoUpload(
  snapshot: OrderSnapshot,
  photoId: string,
  actor: Actor,
): TransitionResult {
  if (actor.type !== 'LAB_MEMBER' && actor.type !== 'SYSTEM') {
    throw new DomainError('UNAUTHORIZED', 'Photo upload completion requires LAB_MEMBER or SYSTEM');
  }
  if (actor.type === 'LAB_MEMBER') assertLabMemberForOrder(actor, snapshot.order);
  const photo = requirePhoto(snapshot, photoId);
  assertTransition(PHOTO_TRANSITIONS, photo.uploadStatus, 'UPLOADED', actor, 'Photo');
  const result = emptyResult();
  result.photoPatches.push({ id: photo.id, patch: { uploadStatus: 'UPLOADED' } });
  return result;
}

export function failPhotoUpload(
  snapshot: OrderSnapshot,
  photoId: string,
  actor: Actor,
): TransitionResult {
  if (actor.type !== 'LAB_MEMBER' && actor.type !== 'SYSTEM') {
    throw new DomainError('UNAUTHORIZED', 'Photo fail requires LAB_MEMBER or SYSTEM');
  }
  const photo = requirePhoto(snapshot, photoId);
  assertTransition(PHOTO_TRANSITIONS, photo.uploadStatus, 'FAILED', actor, 'Photo');
  const result = emptyResult();
  result.photoPatches.push({ id: photo.id, patch: { uploadStatus: 'FAILED' } });
  return result;
}

export function cancelOrder(
  snapshot: OrderSnapshot,
  actor: Actor,
): TransitionResult {
  const shipment = activeInboundShipment(snapshot);
  const pickedUp = shipment && ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(shipment.status);
  const developing = snapshot.rolls.some((roll) => roll.status !== 'EXPECTED' && roll.status !== 'RECEIVED');

  if (actor.type === 'USER') {
    assertUserOwnsOrder(actor, snapshot.order);
    if (snapshot.order.status !== 'PAYMENT_PENDING') {
      throw new DomainError('PRECONDITION_FAILED', 'User can cancel only before payment');
    }
  } else if (actor.type === 'R&J_ADMIN') {
    if (pickedUp || developing || snapshot.order.status === 'IN_TRANSIT' || snapshot.order.status === 'AT_LAB' || snapshot.order.status === 'PROCESSING' || snapshot.order.status === 'RESULTS_READY') {
      throw new DomainError(
        'PRECONDITION_FAILED',
        'Cancellation is not allowed after physical pickup or development',
      );
    }
    const unpaidResolved = snapshot.payments.every(
      (payment) =>
        payment.status === 'PENDING' ||
        payment.status === 'PROCESSING' ||
        payment.status === 'FAILED' ||
        payment.status === 'REFUNDED',
    );
    if (!unpaidResolved) {
      throw new DomainError(
        'PRECONDITION_FAILED',
        'REFUND_REQUIRED: refundPayment() must succeed before cancelOrder() when a payment is PAID',
      );
    }
  } else {
    throw new DomainError('UNAUTHORIZED', 'Only USER or R&J_ADMIN can cancel');
  }

  assertTransition(ORDER_TRANSITIONS, snapshot.order.status, 'CANCELLED', actor, 'Order');
  const result = emptyResult();
  result.orderPatch = { status: 'CANCELLED' };
  result.events.push({
    type: 'ORDER_CANCELLED',
    orderId: snapshot.order.id,
    fromStatus: snapshot.order.status,
    toStatus: 'CANCELLED',
    actorType: actor.type,
    actorId: actorId(actor),
  });
  return result;
}

export function closeExpiredOrder(
  snapshot: OrderSnapshot,
  actor: Actor,
  clock: Clock = defaultClock,
): TransitionResult {
  if (actor.type !== 'SYSTEM') {
    throw new DomainError('UNAUTHORIZED', 'Only SYSTEM can close expired orders');
  }
  if (snapshot.order.status === 'CLOSED' && snapshot.order.filesDeletedAt) {
    return emptyResult();
  }
  assertTransition(ORDER_TRANSITIONS, snapshot.order.status, 'CLOSED', actor, 'Order');
  if (!snapshot.order.photosExpiresAt || Date.parse(snapshot.order.photosExpiresAt) > clock().getTime()) {
    throw new DomainError('PRECONDITION_FAILED', 'Retention has not expired');
  }
  if (snapshot.order.filesDeletedAt) {
    throw new DomainError('PRECONDITION_FAILED', 'Files already deleted');
  }

  const now = iso(clock);
  const result = emptyResult();
  result.orderPatch = { status: 'CLOSED', filesDeletedAt: now };
  for (const photo of snapshot.photos) {
    if (photo.uploadStatus === 'DELETED' || photo.deletedAt) continue;
    result.photoPatches.push({
      id: photo.id,
      patch: { uploadStatus: 'DELETED', deletedAt: now },
    });
  }
  result.events.push({
    type: 'FILES_DELETED',
    orderId: snapshot.order.id,
    fromStatus: snapshot.order.status,
    toStatus: 'CLOSED',
    actorType: 'SYSTEM',
    actorId: null,
  });
  result.sideEffects.push({ kind: 'DELETE_R2_OBJECTS', orderId: snapshot.order.id });
  return result;
}

export function createIssue(
  snapshot: OrderSnapshot,
  actor: Actor,
  input: { type: Issue['type']; rollId?: string | null; description?: string },
): TransitionResult {
  if (actor.type === 'LAB_MEMBER') {
    assertLabMemberForOrder(actor, snapshot.order);
  } else if (actor.type !== 'R&J_ADMIN') {
    throw new DomainError('UNAUTHORIZED', 'Only LAB_MEMBER or R&J_ADMIN can create issues');
  }
  if (input.rollId) {
    requireRoll(snapshot, input.rollId);
  }
  if (
    input.type === 'SHIPPING' &&
    snapshot.issues.some((issue) => issue.type === 'SHIPPING' && issue.status === 'OPEN')
  ) {
    throw new DomainError('CONFLICT', 'An OPEN SHIPPING issue already exists for this order');
  }

  const result = emptyResult();
  result.newIssues.push({
    orderId: snapshot.order.id,
    rollId: input.rollId ?? null,
    type: input.type,
    status: 'OPEN',
  });
  result.events.push({
    type: 'ISSUE_OPENED',
    orderId: snapshot.order.id,
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { type: input.type, rollId: input.rollId ?? null, description: input.description },
  });
  return result;
}

export function updateIssueStatus(
  snapshot: OrderSnapshot,
  issueId: string,
  actor: Actor,
  to: 'OPEN' | 'WAITING_CUSTOMER' | 'WAITING_LAB',
): TransitionResult {
  if (actor.type !== 'R&J_ADMIN') {
    throw new DomainError('UNAUTHORIZED', 'Only R&J_ADMIN can update issue status');
  }
  const issue = snapshot.issues.find((item) => item.id === issueId);
  if (!issue) throw new DomainError('NOT_FOUND', `Issue ${issueId} not found`);
  if (issue.status === 'RESOLVED') {
    throw new DomainError('PRECONDITION_FAILED', 'Resolved issues cannot change status');
  }
  if (issue.status === to) return emptyResult();

  const result = emptyResult();
  result.issuePatches.push({ id: issue.id, patch: { status: to } });
  result.events.push({
    type: 'ISSUE_STATUS_CHANGED',
    orderId: snapshot.order.id,
    fromStatus: issue.status,
    toStatus: to,
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { issueId },
  });
  return result;
}

export function resolveIssue(
  snapshot: OrderSnapshot,
  issueId: string,
  actor: Actor,
  clock: Clock = defaultClock,
): TransitionResult {
  if (actor.type !== 'R&J_ADMIN') {
    throw new DomainError('UNAUTHORIZED', 'Only R&J_ADMIN can resolve issues');
  }
  const issue = snapshot.issues.find((item) => item.id === issueId);
  if (!issue) throw new DomainError('NOT_FOUND', `Issue ${issueId} not found`);
  if (issue.status === 'RESOLVED') return emptyResult();

  const result = emptyResult();
  result.issuePatches.push({ id: issue.id, patch: { status: 'RESOLVED' } });
  result.events.push({
    type: 'ISSUE_RESOLVED',
    orderId: snapshot.order.id,
    fromStatus: issue.status,
    toStatus: 'RESOLVED',
    actorType: actor.type,
    actorId: actorId(actor),
    metadata: { issueId, resolvedAt: iso(clock) },
  });
  return result;
}

export const operations = {
  startPayment,
  confirmPayment,
  failPayment,
  refundPayment,
  bookShipment,
  schedulePickup,
  markShipmentPickedUp,
  markShipmentInTransit,
  markShipmentDelivered,
  failShipment,
  confirmLabReceipt,
  startRollDevelopment,
  completeRollDevelopment,
  startRollScanning,
  startRollUploading,
  releaseRoll,
  startPhotoUpload,
  completePhotoUpload,
  failPhotoUpload,
  cancelOrder,
  closeExpiredOrder,
  createIssue,
  resolveIssue,
  updateIssueStatus,
} as const;

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { actionRequired } from './action-required.ts';
import { DomainError } from './errors.ts';
import {
  bookShipment,
  cancelOrder,
  closeExpiredOrder,
  completePhotoUpload,
  confirmLabReceipt,
  confirmPayment,
  createIssue,
  failShipment,
  markShipmentDelivered,
  markShipmentInTransit,
  markShipmentPickedUp,
  releaseRoll,
  resolveIssue,
  schedulePickup,
  startPayment,
  startPhotoUpload,
  startRollDevelopment,
} from './operations.ts';
import type { Actor, OrderSnapshot, Photo, Roll, TransitionResult } from './types.ts';

const user: Actor = { type: 'USER', profileId: 'user-1' };
const lab: Actor = { type: 'LAB_MEMBER', profileId: 'lab-staff', labId: 'lab-1' };
const admin: Actor = { type: 'R&J_ADMIN', profileId: 'admin-1' };
const system: Actor = { type: 'SYSTEM' };
const otherLab: Actor = { type: 'LAB_MEMBER', profileId: 'other', labId: 'lab-2' };

function baseSnapshot(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    order: {
      id: 'order-1',
      userId: 'user-1',
      labId: 'lab-1',
      status: 'PAYMENT_PENDING',
      rollCount: 3,
      subtotalKrw: 30000,
      paidAt: null,
      labReceivedAt: null,
      photosReadyAt: null,
      photosExpiresAt: null,
      filesDeletedAt: null,
    },
    payments: [
      {
        id: 'pay-1',
        orderId: 'order-1',
        status: 'PENDING',
        amountKrw: 30000,
        approvedAt: null,
      },
    ],
    shipments: [],
    rolls: [1, 2, 3].map((seq) => ({
      id: `roll-${seq}`,
      orderId: 'order-1',
      seq,
      status: 'EXPECTED',
      expectedFilmType: '35mm',
      expectedProcessType: 'c41',
      actualFilmType: null,
      actualProcessType: null,
      photoCount: 0,
      receivedAt: null,
      developmentStartedAt: null,
      developmentCompletedAt: null,
      scanStartedAt: null,
      scanCompletedAt: null,
      releasedAt: null,
    })),
    photos: [],
    issues: [],
    ...overrides,
  };
}

function apply(snapshot: OrderSnapshot, result: TransitionResult): OrderSnapshot {
  const order = result.orderPatch ? { ...snapshot.order, ...result.orderPatch } : snapshot.order;
  const payments = snapshot.payments.map((item) => {
    const patch = result.paymentPatches.find((p) => p.id === item.id);
    return patch ? { ...item, ...patch.patch } : item;
  });
  let shipments = snapshot.shipments.map((item) => {
    const patch = result.shipmentPatches.find((p) => p.id === item.id);
    return patch ? { ...item, ...patch.patch } : item;
  });
  shipments = [
    ...shipments,
    ...result.newShipments.map((s, i) => ({
      id: s.id ?? `ship-new-${shipments.length + i}`,
      orderId: s.orderId,
      direction: s.direction,
      status: s.status,
      carrier: s.carrier,
      trackingNo: s.trackingNo,
      pickupScheduledAt: s.pickupScheduledAt,
      pickedUpAt: s.pickedUpAt,
      deliveredAt: s.deliveredAt,
    })),
  ];
  const rolls = snapshot.rolls.map((item) => {
    const patch = result.rollPatches.find((p) => p.id === item.id);
    return patch ? { ...item, ...patch.patch } : item;
  });
  const photos = snapshot.photos.map((item) => {
    const patch = result.photoPatches.find((p) => p.id === item.id);
    return patch ? { ...item, ...patch.patch } : item;
  });
  const patchedIssues = snapshot.issues.map((item) => {
    const patch = result.issuePatches.find((p) => p.id === item.id);
    return patch ? { ...item, ...patch.patch } : item;
  });
  const issues = [
    ...patchedIssues,
    ...result.newIssues.map((issue, i) => ({
      id: issue.id ?? `issue-${snapshot.issues.length + i}`,
      orderId: issue.orderId,
      rollId: issue.rollId,
      type: issue.type,
      status: issue.status,
    })),
  ];
  return { order, payments, shipments, rolls, photos, issues };
}

function uploadingRoll(snapshot: OrderSnapshot, rollId: string, photos: Photo[]): OrderSnapshot {
  return {
    ...snapshot,
    rolls: snapshot.rolls.map((roll) =>
      roll.id === rollId ? { ...roll, status: 'UPLOADING' } : roll,
    ),
    photos: [...snapshot.photos.filter((p) => p.rollId !== rollId), ...photos],
  };
}

function uploadedPhoto(id: string, rollId: string): Photo {
  return { id, rollId, uploadStatus: 'UPLOADED', deletedAt: null };
}

describe('payment', () => {
  test('USER cannot confirm PAID', () => {
    const snapshot = apply(baseSnapshot(), startPayment(baseSnapshot(), 'pay-1', user));
    assert.throws(() => confirmPayment(snapshot, 'pay-1', user), DomainError);
  });

  test('PAID moves order to PICKUP_PENDING and creates INBOUND shipment', () => {
    let snapshot = apply(baseSnapshot(), startPayment(baseSnapshot(), 'pay-1', user));
    const result = confirmPayment(snapshot, 'pay-1', system, () => new Date('2026-08-21T00:00:00Z'));
    snapshot = apply(snapshot, result);
    assert.equal(snapshot.payments[0].status, 'PAID');
    assert.equal(snapshot.order.status, 'PICKUP_PENDING');
    assert.equal(snapshot.order.paidAt, '2026-08-21T00:00:00.000Z');
    assert.equal(snapshot.shipments[0].direction, 'INBOUND');
    assert.equal(snapshot.shipments[0].status, 'PENDING');
    assert.ok(result.events.some((e) => e.type === 'PAYMENT_COMPLETED'));
  });

  test('confirmPayment is idempotent after PAID', () => {
    let snapshot = apply(baseSnapshot(), startPayment(baseSnapshot(), 'pay-1', user));
    snapshot = apply(snapshot, confirmPayment(snapshot, 'pay-1', system));
    const second = confirmPayment(snapshot, 'pay-1', system);
    assert.equal(second.orderPatch, undefined);
    assert.equal(second.newShipments.length, 0);
  });
});

describe('shipment', () => {
  function paid(): OrderSnapshot {
    let snapshot = apply(baseSnapshot(), startPayment(baseSnapshot(), 'pay-1', user));
    snapshot = apply(snapshot, confirmPayment(snapshot, 'pay-1', system));
    snapshot = {
      ...snapshot,
      shipments: snapshot.shipments.map((s, i) => (i === 0 ? { ...s, id: 'ship-1' } : s)),
    };
    return snapshot;
  }

  test('DELIVERED does not move order to AT_LAB', () => {
    let snapshot = paid();
    snapshot = apply(
      snapshot,
      bookShipment(snapshot, 'ship-1', admin, { carrier: 'cj', trackingNo: 'T1' }),
    );
    snapshot = apply(snapshot, schedulePickup(snapshot, 'ship-1', admin, '2026-08-22T01:00:00Z'));
    snapshot = apply(snapshot, markShipmentPickedUp(snapshot, 'ship-1', admin));
    assert.equal(snapshot.order.status, 'IN_TRANSIT');
    snapshot = apply(snapshot, markShipmentInTransit(snapshot, 'ship-1', admin));
    snapshot = apply(snapshot, markShipmentDelivered(snapshot, 'ship-1', admin));
    assert.equal(snapshot.shipments[0].status, 'DELIVERED');
    assert.equal(snapshot.order.status, 'IN_TRANSIT');
    assert.equal(snapshot.order.labReceivedAt, null);
    assert.ok(snapshot.rolls.every((r) => r.status === 'EXPECTED'));
  });
});

describe('lab receipt and rolls', () => {
  function inTransit(): OrderSnapshot {
    let snapshot = apply(baseSnapshot(), startPayment(baseSnapshot(), 'pay-1', user));
    snapshot = apply(snapshot, confirmPayment(snapshot, 'pay-1', system));
    snapshot = {
      ...snapshot,
      shipments: [{ ...snapshot.shipments[0], id: 'ship-1' }],
    };
    snapshot = apply(
      snapshot,
      bookShipment(snapshot, 'ship-1', admin, { carrier: 'cj', trackingNo: 'T1' }),
    );
    snapshot = apply(snapshot, schedulePickup(snapshot, 'ship-1', admin, '2026-08-22T01:00:00Z'));
    return apply(snapshot, markShipmentPickedUp(snapshot, 'ship-1', admin));
  }

  test('other lab cannot confirm receipt', () => {
    assert.throws(() => confirmLabReceipt(inTransit(), otherLab), DomainError);
  });

  test('explicit receipt sets AT_LAB and rolls RECEIVED', () => {
    const start = inTransit();
    const result = confirmLabReceipt(start, lab, {}, () => new Date('2026-08-23T00:00:00Z'));
    const snapshot = apply(start, result);
    assert.equal(snapshot.order.status, 'AT_LAB');
    assert.equal(snapshot.order.labReceivedAt, '2026-08-23T00:00:00.000Z');
    assert.ok(snapshot.rolls.every((r) => r.status === 'RECEIVED'));
  });

  test('first development moves order to PROCESSING', () => {
    const start = inTransit();
    const received = apply(start, confirmLabReceipt(start, lab));
    const snapshot = apply(received, startRollDevelopment(received, 'roll-1', lab));
    assert.equal(snapshot.order.status, 'PROCESSING');
    assert.equal(snapshot.rolls.find((r) => r.id === 'roll-1')?.status, 'DEVELOPING');
  });

  test('2 of 3 READY keeps order PROCESSING', () => {
    const start = inTransit();
    let snapshot = apply(start, confirmLabReceipt(start, lab));
    snapshot = apply(snapshot, startRollDevelopment(snapshot, 'roll-1', lab));
    snapshot = {
      ...snapshot,
      order: { ...snapshot.order, status: 'PROCESSING' },
      rolls: snapshot.rolls.map((roll) =>
        roll.id === 'roll-3' ? roll : { ...roll, status: 'UPLOADING' },
      ) as Roll[],
    };
    snapshot = uploadingRoll(snapshot, 'roll-1', [uploadedPhoto('p1', 'roll-1')]);
    snapshot = uploadingRoll(snapshot, 'roll-2', [uploadedPhoto('p2', 'roll-2')]);
    snapshot = apply(snapshot, releaseRoll(snapshot, 'roll-1', lab));
    snapshot = apply(snapshot, releaseRoll(snapshot, 'roll-2', lab));
    assert.equal(snapshot.rolls.filter((r) => r.status === 'READY').length, 2);
    assert.equal(snapshot.order.status, 'PROCESSING');
    assert.equal(snapshot.order.photosReadyAt, null);
  });

  test('last READY is idempotent RESULTS_READY with 30-day expiry', () => {
    const clock = () => new Date('2026-08-21T00:00:00Z');
    const start = inTransit();
    let snapshot = apply(start, confirmLabReceipt(start, lab));
    snapshot = {
      ...snapshot,
      order: { ...snapshot.order, status: 'PROCESSING' },
      rolls: snapshot.rolls.map((roll) => ({ ...roll, status: 'UPLOADING' as const })),
    };
    snapshot = uploadingRoll(snapshot, 'roll-1', [uploadedPhoto('p1', 'roll-1')]);
    snapshot = uploadingRoll(snapshot, 'roll-2', [uploadedPhoto('p2', 'roll-2')]);
    snapshot = uploadingRoll(snapshot, 'roll-3', [uploadedPhoto('p3', 'roll-3')]);
    snapshot = apply(snapshot, releaseRoll(snapshot, 'roll-1', lab, clock));
    snapshot = apply(snapshot, releaseRoll(snapshot, 'roll-2', lab, clock));
    const last = releaseRoll(snapshot, 'roll-3', lab, clock);
    snapshot = apply(snapshot, last);
    assert.equal(snapshot.order.status, 'RESULTS_READY');
    assert.equal(snapshot.order.photosReadyAt, '2026-08-21T00:00:00.000Z');
    assert.equal(snapshot.order.photosExpiresAt, '2026-09-20T00:00:00.000Z');
    assert.ok(last.events.some((e) => e.type === 'PHOTOS_RELEASED'));
    assert.ok(last.sideEffects.some((s) => s.kind === 'NOTIFY'));

    const again = releaseRoll(snapshot, 'roll-3', lab, () => new Date('2026-08-22T00:00:00Z'));
    assert.equal(again.orderPatch, undefined);
    assert.equal(snapshot.order.photosExpiresAt, '2026-09-20T00:00:00.000Z');
  });

  test('READY requires uploaded photos', () => {
    const start = inTransit();
    let snapshot = apply(start, confirmLabReceipt(start, lab));
    snapshot = {
      ...snapshot,
      rolls: snapshot.rolls.map((roll) =>
        roll.id === 'roll-1' ? { ...roll, status: 'UPLOADING' as const } : roll,
      ),
    };
    assert.throws(() => releaseRoll(snapshot, 'roll-1', lab), DomainError);
  });
});

describe('cancel and close', () => {
  test('user can cancel only before payment', () => {
    const pending = cancelOrder(baseSnapshot(), user);
    assert.equal(pending.orderPatch?.status, 'CANCELLED');
    let paid = apply(baseSnapshot(), startPayment(baseSnapshot(), 'pay-1', user));
    paid = apply(paid, confirmPayment(paid, 'pay-1', system));
    assert.throws(() => cancelOrder(paid, user), DomainError);
  });

  test('closeExpiredOrder sets CLOSED and photo DELETED', () => {
    const snapshot = baseSnapshot({
      order: {
        ...baseSnapshot().order,
        status: 'RESULTS_READY',
        photosReadyAt: '2026-07-01T00:00:00.000Z',
        photosExpiresAt: '2026-07-31T00:00:00.000Z',
      },
      photos: [uploadedPhoto('p1', 'roll-1')],
    });
    const result = closeExpiredOrder(snapshot, system, () => new Date('2026-08-21T00:00:00Z'));
    assert.equal(result.orderPatch?.status, 'CLOSED');
    assert.equal(result.photoPatches[0].patch.uploadStatus, 'DELETED');
    assert.ok(result.events.some((e) => e.type === 'FILES_DELETED'));
  });
});

describe('action required', () => {
  test('pickup booking required when shipment still PENDING', () => {
    let snapshot = apply(baseSnapshot(), startPayment(baseSnapshot(), 'pay-1', user));
    snapshot = apply(snapshot, confirmPayment(snapshot, 'pay-1', system));
    const actions = actionRequired(snapshot);
    assert.ok(actions.some((a) => a.code === 'PICKUP_BOOKING_REQUIRED'));
  });
});

describe('photo retry', () => {
  test('FAILED can return to UPLOADING', () => {
    const snapshot = baseSnapshot({
      order: { ...baseSnapshot().order, status: 'PROCESSING' },
      photos: [{ id: 'p1', rollId: 'roll-1', uploadStatus: 'FAILED', deletedAt: null }],
    });
    const result = startPhotoUpload(snapshot, 'p1', lab);
    assert.equal(result.photoPatches[0].patch.uploadStatus, 'UPLOADING');
    const uploaded = completePhotoUpload(apply(snapshot, result), 'p1', lab);
    assert.equal(uploaded.photoPatches[0].patch.uploadStatus, 'UPLOADED');
  });
});

describe('issues', () => {
  test('createIssue does not change order status', () => {
    const snapshot = baseSnapshot({
      order: { ...baseSnapshot().order, status: 'PROCESSING' },
    });
    const result = createIssue(snapshot, lab, { type: 'DAMAGED_FILM', rollId: 'roll-1' });
    const next = apply(snapshot, result);
    assert.equal(next.order.status, 'PROCESSING');
    assert.equal(next.issues[0].status, 'OPEN');
    assert.equal(next.issues[0].type, 'DAMAGED_FILM');
  });

  test('USER cannot create issues', () => {
    assert.throws(
      () => createIssue(baseSnapshot(), user, { type: 'OTHER' }),
      DomainError,
    );
  });

  test('resolveIssue is idempotent and does not change order status', () => {
    const snapshot = baseSnapshot({
      order: { ...baseSnapshot().order, status: 'PROCESSING' },
      issues: [
        {
          id: 'issue-1',
          orderId: 'order-1',
          rollId: 'roll-1',
          type: 'SCAN',
          status: 'OPEN',
        },
      ],
    });
    const first = resolveIssue(snapshot, 'issue-1', admin);
    const next = apply(snapshot, first);
    assert.equal(next.issues[0].status, 'RESOLVED');
    assert.equal(next.order.status, 'PROCESSING');
    const second = resolveIssue(next, 'issue-1', admin);
    assert.equal(second.issuePatches.length, 0);
  });
});

describe('failShipment and cancel', () => {
  test('failShipment does not open a second SHIPPING issue', () => {
    let snapshot = apply(baseSnapshot(), startPayment(baseSnapshot(), 'pay-1', user));
    snapshot = apply(snapshot, confirmPayment(snapshot, 'pay-1', system));
    snapshot = {
      ...snapshot,
      shipments: [{ ...snapshot.shipments[0], id: 'ship-1', status: 'IN_TRANSIT' }],
    };
    snapshot = apply(snapshot, failShipment(snapshot, 'ship-1', admin));
    assert.equal(snapshot.issues.filter((i) => i.type === 'SHIPPING').length, 1);
    const again = failShipment(snapshot, 'ship-1', admin);
    assert.equal(again.newIssues.length, 0);
    assert.equal(again.shipmentPatches.length, 0);
  });

  test('admin cannot cancel PAID order before refund', () => {
    let snapshot = apply(baseSnapshot(), startPayment(baseSnapshot(), 'pay-1', user));
    snapshot = apply(snapshot, confirmPayment(snapshot, 'pay-1', system));
    assert.throws(() => cancelOrder(snapshot, admin), DomainError);
  });
});

import { DomainError } from './errors.ts';
import type {
  ActorType,
  OrderStatus,
  PaymentStatus,
  PhotoUploadStatus,
  RollStatus,
  ShipmentStatus,
} from './statuses.ts';
import type { Actor } from './types.ts';

export type Transition<S extends string> = {
  from: S;
  to: S;
  actors: ActorType[];
};

export const PAYMENT_TRANSITIONS: Transition<PaymentStatus>[] = [
  { from: 'PENDING', to: 'PROCESSING', actors: ['USER'] },
  { from: 'PROCESSING', to: 'PAID', actors: ['SYSTEM'] },
  { from: 'PROCESSING', to: 'FAILED', actors: ['SYSTEM'] },
  { from: 'PAID', to: 'PARTIALLY_REFUNDED', actors: ['R&J_ADMIN'] },
  { from: 'PAID', to: 'REFUNDED', actors: ['R&J_ADMIN'] },
  { from: 'PARTIALLY_REFUNDED', to: 'REFUNDED', actors: ['R&J_ADMIN'] },
];

export const SHIPMENT_TRANSITIONS: Transition<ShipmentStatus>[] = [
  { from: 'PENDING', to: 'BOOKED', actors: ['R&J_ADMIN'] },
  { from: 'BOOKED', to: 'PICKUP_SCHEDULED', actors: ['R&J_ADMIN'] },
  { from: 'PICKUP_SCHEDULED', to: 'PICKED_UP', actors: ['R&J_ADMIN', 'SYSTEM'] },
  { from: 'PICKED_UP', to: 'IN_TRANSIT', actors: ['R&J_ADMIN', 'SYSTEM'] },
  { from: 'IN_TRANSIT', to: 'DELIVERED', actors: ['R&J_ADMIN', 'SYSTEM'] },
  { from: 'PENDING', to: 'FAILED', actors: ['R&J_ADMIN', 'SYSTEM'] },
  { from: 'BOOKED', to: 'FAILED', actors: ['R&J_ADMIN', 'SYSTEM'] },
  { from: 'PICKUP_SCHEDULED', to: 'FAILED', actors: ['R&J_ADMIN', 'SYSTEM'] },
  { from: 'PICKED_UP', to: 'FAILED', actors: ['R&J_ADMIN', 'SYSTEM'] },
  { from: 'IN_TRANSIT', to: 'FAILED', actors: ['R&J_ADMIN', 'SYSTEM'] },
  { from: 'PENDING', to: 'CANCELLED', actors: ['R&J_ADMIN'] },
  { from: 'BOOKED', to: 'CANCELLED', actors: ['R&J_ADMIN'] },
  { from: 'PICKUP_SCHEDULED', to: 'CANCELLED', actors: ['R&J_ADMIN'] },
];

export const ROLL_TRANSITIONS: Transition<RollStatus>[] = [
  { from: 'EXPECTED', to: 'RECEIVED', actors: ['LAB_MEMBER'] },
  { from: 'RECEIVED', to: 'DEVELOPING', actors: ['LAB_MEMBER'] },
  { from: 'DEVELOPING', to: 'DEVELOPED', actors: ['LAB_MEMBER'] },
  { from: 'DEVELOPED', to: 'SCANNING', actors: ['LAB_MEMBER'] },
  { from: 'SCANNING', to: 'UPLOADING', actors: ['LAB_MEMBER'] },
  { from: 'UPLOADING', to: 'READY', actors: ['LAB_MEMBER'] },
];

export const PHOTO_TRANSITIONS: Transition<PhotoUploadStatus>[] = [
  { from: 'PENDING', to: 'UPLOADING', actors: ['LAB_MEMBER', 'SYSTEM'] },
  { from: 'UPLOADING', to: 'UPLOADED', actors: ['LAB_MEMBER', 'SYSTEM'] },
  { from: 'UPLOADING', to: 'FAILED', actors: ['LAB_MEMBER', 'SYSTEM'] },
  { from: 'FAILED', to: 'UPLOADING', actors: ['LAB_MEMBER', 'SYSTEM'] },
  { from: 'UPLOADED', to: 'DELETED', actors: ['SYSTEM'] },
];

export const ORDER_TRANSITIONS: Transition<OrderStatus>[] = [
  { from: 'PAYMENT_PENDING', to: 'PICKUP_PENDING', actors: ['SYSTEM'] },
  { from: 'PICKUP_PENDING', to: 'IN_TRANSIT', actors: ['R&J_ADMIN', 'SYSTEM'] },
  { from: 'IN_TRANSIT', to: 'AT_LAB', actors: ['LAB_MEMBER'] },
  { from: 'AT_LAB', to: 'PROCESSING', actors: ['LAB_MEMBER'] },
  { from: 'PROCESSING', to: 'RESULTS_READY', actors: ['LAB_MEMBER', 'SYSTEM'] },
  { from: 'RESULTS_READY', to: 'CLOSED', actors: ['SYSTEM'] },
  { from: 'PAYMENT_PENDING', to: 'CANCELLED', actors: ['USER', 'R&J_ADMIN'] },
  { from: 'PICKUP_PENDING', to: 'CANCELLED', actors: ['R&J_ADMIN'] },
];

export function assertTransition<S extends string>(
  graph: Transition<S>[],
  from: S,
  to: S,
  actor: Actor,
  label: string,
): Transition<S> {
  const edge = graph.find((item) => item.from === from && item.to === to);
  if (!edge) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `${label}: ${from} → ${to} is not allowed`,
    );
  }
  if (!edge.actors.includes(actor.type)) {
    throw new DomainError(
      'UNAUTHORIZED',
      `${label}: ${actor.type} cannot perform ${from} → ${to}`,
    );
  }
  return edge;
}

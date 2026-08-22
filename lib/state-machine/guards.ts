import { DomainError } from './errors.ts';
import type { Actor } from './types.ts';
import type { Order } from './types.ts';

export function actorId(actor: Actor): string | null {
  return actor.type === 'SYSTEM' ? null : actor.profileId;
}

export function assertLabMemberForOrder(actor: Actor, order: Order) {
  if (actor.type !== 'LAB_MEMBER') {
    throw new DomainError('UNAUTHORIZED', 'LAB_MEMBER required');
  }
  if (actor.labId !== order.labId) {
    throw new DomainError('UNAUTHORIZED', 'Lab member cannot access another lab order');
  }
}

export function assertUserOwnsOrder(actor: Actor, order: Order) {
  if (actor.type !== 'USER' || actor.profileId !== order.userId) {
    throw new DomainError('UNAUTHORIZED', 'User does not own this order');
  }
}

export function iso(clock: () => Date): string {
  return clock().toISOString();
}

export function plusDays(from: Date, days: number): string {
  const next = new Date(from.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

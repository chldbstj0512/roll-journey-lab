/** Source: roll-journey/state-machines.md — do not add states here without updating that doc. */

export const ACTOR_TYPES = ['USER', 'LAB_MEMBER', 'R&J_ADMIN', 'SYSTEM'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SHIPMENT_STATUSES = [
  'PENDING',
  'BOOKED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const ROLL_STATUSES = [
  'EXPECTED',
  'RECEIVED',
  'DEVELOPING',
  'DEVELOPED',
  'SCANNING',
  'UPLOADING',
  'READY',
] as const;
export type RollStatus = (typeof ROLL_STATUSES)[number];

export const PHOTO_UPLOAD_STATUSES = [
  'PENDING',
  'UPLOADING',
  'UPLOADED',
  'FAILED',
  'DELETED',
] as const;
export type PhotoUploadStatus = (typeof PHOTO_UPLOAD_STATUSES)[number];

export const ORDER_STATUSES = [
  'PAYMENT_PENDING',
  'PICKUP_PENDING',
  'IN_TRANSIT',
  'AT_LAB',
  'PROCESSING',
  'RESULTS_READY',
  'CLOSED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ISSUE_STATUSES = [
  'OPEN',
  'WAITING_CUSTOMER',
  'WAITING_LAB',
  'RESOLVED',
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_TYPES = [
  'ROLL_COUNT_MISMATCH',
  'FILM_TYPE_MISMATCH',
  'DAMAGED_FILM',
  'SHIPPING',
  'SCAN',
  'OTHER',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const EVENT_TYPES = [
  'ORDER_CREATED',
  'PAYMENT_COMPLETED',
  'PAYMENT_FAILED',
  'PICKUP_BOOKED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'SHIPMENT_IN_TRANSIT',
  'SHIPMENT_DELIVERED',
  'SHIPMENT_FAILED',
  'LAB_RECEIVED',
  'DEVELOPMENT_STARTED',
  'DEVELOPMENT_COMPLETED',
  'SCAN_STARTED',
  'UPLOAD_STARTED',
  'ROLL_READY',
  'PHOTOS_RELEASED',
  'FILES_DELETED',
  'ORDER_CANCELLED',
  'ISSUE_OPENED',
  'ISSUE_STATUS_CHANGED',
  'ISSUE_RESOLVED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const SHIPMENT_DIRECTIONS = ['INBOUND', 'RETURN'] as const;
export type ShipmentDirection = (typeof SHIPMENT_DIRECTIONS)[number];

export const USER_ORDER_LABELS: Record<OrderStatus, string> = {
  PAYMENT_PENDING: '결제 대기',
  PICKUP_PENDING: '수거 준비 중',
  IN_TRANSIT: '현상소로 이동 중',
  AT_LAB: '현상소 도착',
  PROCESSING: '현상 · 스캔 중',
  RESULTS_READY: '사진이 도착했어요',
  CLOSED: '보관 기간 종료',
  CANCELLED: '주문 취소',
};

export const LAB_ROLL_LABELS: Record<RollStatus, string> = {
  EXPECTED: '입고 대기',
  RECEIVED: '현상 대기',
  DEVELOPING: '현상 중',
  DEVELOPED: '스캔 대기',
  SCANNING: '스캔 중',
  UPLOADING: '업로드 중',
  READY: '완료',
};

export const RETENTION_DAYS = 30;
export const EXPIRY_REMINDER_DAYS = [10, 3, 1] as const;

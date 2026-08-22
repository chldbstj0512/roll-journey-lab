import type {
  ActorType,
  EventType,
  IssueStatus,
  IssueType,
  OrderStatus,
  PaymentStatus,
  PhotoUploadStatus,
  RollStatus,
  ShipmentDirection,
  ShipmentStatus,
} from './statuses.ts';

export type Actor =
  | { type: 'USER'; profileId: string }
  | { type: 'LAB_MEMBER'; profileId: string; labId: string }
  | { type: 'R&J_ADMIN'; profileId: string }
  | { type: 'SYSTEM' };

export type Payment = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  amountKrw: number;
  approvedAt: string | null;
};

export type Shipment = {
  id: string;
  orderId: string;
  direction: ShipmentDirection;
  status: ShipmentStatus;
  carrier: string | null;
  trackingNo: string | null;
  pickupScheduledAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
};

export type Roll = {
  id: string;
  orderId: string;
  seq: number;
  status: RollStatus;
  expectedFilmType: string;
  expectedProcessType: string;
  actualFilmType: string | null;
  actualProcessType: string | null;
  photoCount: number;
  receivedAt: string | null;
  developmentStartedAt: string | null;
  developmentCompletedAt: string | null;
  scanStartedAt: string | null;
  scanCompletedAt: string | null;
  releasedAt: string | null;
};

export type Photo = {
  id: string;
  rollId: string;
  uploadStatus: PhotoUploadStatus;
  deletedAt: string | null;
};

export type Issue = {
  id: string;
  orderId: string;
  rollId: string | null;
  type: IssueType;
  status: IssueStatus;
};

export type Order = {
  id: string;
  userId: string;
  labId: string;
  status: OrderStatus;
  rollCount: number;
  subtotalKrw: number;
  paidAt: string | null;
  labReceivedAt: string | null;
  photosReadyAt: string | null;
  photosExpiresAt: string | null;
  filesDeletedAt: string | null;
};

export type OrderSnapshot = {
  order: Order;
  payments: Payment[];
  shipments: Shipment[];
  rolls: Roll[];
  photos: Photo[];
  issues: Issue[];
};

export type OrderEventInput = {
  type: EventType;
  orderId: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorType: ActorType;
  actorId: string | null;
  metadata?: Record<string, unknown>;
};

export type SideEffect =
  | { kind: 'NOTIFY'; notificationType: 'PHOTOS_READY'; orderId: string; userId: string }
  | {
      kind: 'SCHEDULE_EXPIRY_NOTIFICATIONS';
      orderId: string;
      userId: string;
      photosExpiresAt: string;
    }
  | { kind: 'DELETE_R2_OBJECTS'; orderId: string };

export type NewShipment = Omit<Shipment, 'id'> & { id?: string };
export type NewIssue = Omit<Issue, 'id'> & { id?: string };

export type TransitionResult = {
  orderPatch?: Partial<Order>;
  paymentPatches: { id: string; patch: Partial<Payment> }[];
  shipmentPatches: { id: string; patch: Partial<Shipment> }[];
  rollPatches: { id: string; patch: Partial<Roll> }[];
  photoPatches: { id: string; patch: Partial<Photo> }[];
  issuePatches: { id: string; patch: Partial<Issue> }[];
  newShipments: NewShipment[];
  newIssues: NewIssue[];
  events: OrderEventInput[];
  sideEffects: SideEffect[];
};

export function emptyResult(): TransitionResult {
  return {
    paymentPatches: [],
    shipmentPatches: [],
    rollPatches: [],
    photoPatches: [],
    issuePatches: [],
    newShipments: [],
    newIssues: [],
    events: [],
    sideEffects: [],
  };
}

export type Clock = () => Date;

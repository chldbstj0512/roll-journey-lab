export interface Lab {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  created_at: string;
}

export interface Order {
  id: string;
  lab_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  film_type: string;
  roll_count: number;
  status: 'pending' | 'processing' | 'scanning' | 'completed' | 'delivered';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  order_id: string;
  filename: string;
  url: string;
  size: number;
  width?: number;
  height?: number;
  created_at: string;
}

export type OrderStatus = Order['status'];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '접수 대기',
  processing: '현상 중',
  scanning: '스캔 중',
  completed: '완료',
  delivered: '전달 완료',
};

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

export interface OrderItemResponse {
  bookId: string;
  bookSlug: string;
  bookTitle: string;
  unitPriceMinorUnits: number;
  quantity: number;
  currency: string;
}

export interface OrderResponse {
  id: string;
  status: OrderStatus;
  totalMinorUnits: number;
  currency: string;
  checkoutUrl?: string;
  items: OrderItemResponse[];
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

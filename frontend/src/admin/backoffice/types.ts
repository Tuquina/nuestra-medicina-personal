export type ReportingRange = '7d' | '30d' | 'year' | 'all';

export type SaleDisplayStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface AdminSale {
  id: string;
  createdAt: string;
  paidAt: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  bookId: string;
  bookSlug: string;
  bookTitle: string;
  amountMinorUnits: number;
  currency: string;
  orderStatus: string;
  paymentStatus: string | null;
  paymentProvider: string | null;
  providerPaymentId: string | null;
  displayStatus: SaleDisplayStatus;
}

export interface AdminSalesPage {
  items: AdminSale[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardResponse {
  range: ReportingRange;
  currency: string;
  kpis: {
    approvedSalesCount: number;
    revenueMinorUnits: number;
    buyersCount: number;
    averageOrderMinorUnits: number;
  };
  books: { publishedCount: number; draftCount: number };
  trend: Array<{ periodStart: string; salesCount: number; revenueMinorUnits: number }>;
  topBooks: Array<{
    bookId: string;
    bookSlug: string;
    bookTitle: string;
    salesCount: number;
    revenueMinorUnits: number;
  }>;
  paymentStatuses: Array<{ status: string; count: number }>;
  recentSales: AdminSale[];
  generatedAt: string;
}

export interface PurchasedBook {
  id: string;
  slug: string;
  title: string;
  purchasedAt: string;
}

export interface AdminCustomer {
  id: string;
  displayName: string;
  email: string;
  pictureUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  paidOrdersCount: number;
  booksPurchasedCount: number;
  totalSpentMinorUnits: number;
  currency: string;
  lastPurchaseAt: string | null;
  purchasedBooks: PurchasedBook[];
}

export interface AdminCustomersPage {
  items: AdminCustomer[];
  total: number;
  limit: number;
  offset: number;
}

export interface EditableSiteSettings {
  siteName: string;
  siteDescription: string;
  supportEmail: string;
  newsletterEmail: string;
  senderName: string;
  seoTitle: string;
  seoDescription: string;
  seoIndexable: boolean;
}

export interface SiteSettings extends EditableSiteSettings {
  integrations: {
    google: { configured: boolean };
    mercadoPago: { configured: boolean };
    email: { configured: boolean };
  };
  updatedAt: string;
}

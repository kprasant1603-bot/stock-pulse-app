/**
 * Domain Types for StockPulse Inventory & Reorder Management
 */

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  currentStock: number;
  minThreshold: number; // Minimum Required Stock (Reorder Point)
  unit: string; // e.g. "units", "bottles", "boxes", "kg"
  price: number; // retail/sale price
  costPrice?: number; // wholesale cost
  supplierName: string;
  supplierEmail: string;
  lastScannedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'pending_approval' | 'approved' | 'sent' | 'cancelled';

export interface ReorderOrder {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  supplierName: string;
  supplierEmail: string;
  currentStockAtTrigger: number;
  minThreshold: number;
  suggestedQuantity: number;
  approvedQuantity?: number;
  status: OrderStatus;
  createdAt: string;
  approvedAt?: string;
  sentAt?: string;
  poNumber: string;
  notes?: string;
}

export interface ScanLogItem {
  id: string;
  timestamp: string;
  barcode: string;
  productId?: string;
  productName?: string;
  sku?: string;
  quantityChange: number; // usually -1
  previousStock?: number;
  newStock?: number;
  minThreshold?: number;
  status: 'success' | 'unknown_barcode' | 'out_of_stock_error' | 'reorder_triggered';
  reorderOrderId?: string;
  message?: string;
}

export interface EmailMessage {
  id: string;
  to: string;
  from: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  createdAt: string;
  type: 'draft_approval_request' | 'supplier_order_placed';
  orderId: string;
  status: 'draft_sent_to_owner' | 'order_dispatched_to_supplier' | 'failed';
  approvalToken?: string;
}

export interface EmailConfig {
  provider: 'simulated' | 'gmail' | 'resend' | 'custom_smtp';
  ownerEmail: string;
  businessName: string;
  senderEmail: string;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
}

export interface ReorderAssessment {
  product: Product;
  currentStock: number;
  minRequiredStock: number;
  deficit: number;
  action: string; // "Reorder [Quantity]"
  reorderQuantity: number;
  hasActivePendingOrder: boolean;
  activeOrderId?: string;
}

export interface HealthyAssessment {
  product: Product;
  currentStock: number;
  minRequiredStock: number;
  surplus: number;
  action: 'No reorder';
}

/**
 * ScannerQueue: Serialized Transaction Queue for Barcode Scans
 *
 * Ensures rapid consecutive scans are executed deterministically and sequentially
 * with zero race conditions, no dropped scans, and no duplicate pending orders.
 */

import { Product, ReorderOrder, ScanLogItem, EmailMessage, EmailConfig } from './types';
import { decrementStock } from './inventory';
import { evaluateAndCreateReorderDraft } from './reorder';

export interface ScanResult {
  scanId: string;
  success: boolean;
  barcode: string;
  product?: Product;
  quantityDecremented: number;
  previousStock?: number;
  newStock?: number;
  thresholdReached: boolean;
  reorderCreated?: ReorderOrder;
  emailDraftCreated?: EmailMessage;
  logItem: ScanLogItem;
  error?: string;
}

export type StateSnapshot = {
  products: Product[];
  orders: ReorderOrder[];
  logs: ScanLogItem[];
  emails: EmailMessage[];
};

export class ScannerQueue {
  private queue: Promise<any> = Promise.resolve();
  private pendingQueueLength = 0;

  /**
   * Enqueue a scan job to run in strict FIFO sequence.
   * Resolves only after all preceding scans have executed and committed their state.
   */
  public enqueue(
    barcode: string,
    getState: () => StateSnapshot,
    commitState: (updated: {
      products: Product[];
      orders: ReorderOrder[];
      logs: ScanLogItem[];
      emails: EmailMessage[];
    }) => void,
    config: EmailConfig
  ): Promise<ScanResult> {
    this.pendingQueueLength++;

    // Chain the task onto the current tail of the queue
    const task = this.queue.then(() => {
      try {
        const state = getState();
        const result = this.processScan(barcode, state, config);
        
        // Commit state changes
        commitState({
          products: result.updatedProducts,
          orders: result.updatedOrders,
          logs: [result.result.logItem, ...state.logs],
          emails: result.result.emailDraftCreated
            ? [result.result.emailDraftCreated, ...state.emails]
            : state.emails,
        });

        return result.result;
      } finally {
        this.pendingQueueLength--;
      }
    });

    // Advance the queue tail, ensuring errors do not break subsequent queued scans
    this.queue = task.catch((err) => {
      console.error('Scan processing error in queue:', err);
    });

    return task;
  }

  public getPendingCount(): number {
    return this.pendingQueueLength;
  }

  /**
   * Synchronous core scan processing given an atomic state snapshot
   */
  public processScan(
    barcode: string,
    state: StateSnapshot,
    config: EmailConfig
  ): {
    result: ScanResult;
    updatedProducts: Product[];
    updatedOrders: ReorderOrder[];
  } {
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cleanBarcode = barcode.trim();
    const now = new Date().toISOString();

    // 1. Locate product by barcode (case-insensitive trim)
    const productIndex = state.products.findIndex(
      (p) => p.barcode.trim().toLowerCase() === cleanBarcode.toLowerCase()
    );

    if (productIndex === -1) {
      // Unknown barcode handled gracefully
      const unknownLog: ScanLogItem = {
        id: scanId,
        timestamp: now,
        barcode: cleanBarcode,
        quantityChange: 0,
        status: 'unknown_barcode',
        message: `Unknown barcode scanned: "${cleanBarcode}". Product not found in database.`,
      };

      return {
        result: {
          scanId,
          success: false,
          barcode: cleanBarcode,
          quantityDecremented: 0,
          thresholdReached: false,
          logItem: unknownLog,
          error: 'unknown_barcode',
        },
        updatedProducts: state.products,
        updatedOrders: state.orders,
      };
    }

    const currentProduct = state.products[productIndex];

    // 2. Decrement stock atomically
    const decrementResult = decrementStock(currentProduct, 1);
    const updatedProduct = decrementResult.updatedProduct;

    // 3. Create updated products array
    const updatedProducts = [...state.products];
    updatedProducts[productIndex] = updatedProduct;

    // 4. Evaluate low-stock threshold and reorder trigger
    const reorderOutcome = evaluateAndCreateReorderDraft(
      updatedProduct,
      state.orders,
      {
        ownerEmail: config.ownerEmail,
        businessName: config.businessName,
        senderEmail: config.senderEmail,
      }
    );

    const updatedOrders = reorderOutcome.order
      ? [reorderOutcome.order, ...state.orders]
      : state.orders;

    // 5. Generate structured log item
    const logItem: ScanLogItem = {
      id: scanId,
      timestamp: now,
      barcode: cleanBarcode,
      productId: updatedProduct.id,
      productName: updatedProduct.name,
      sku: updatedProduct.sku,
      quantityChange: -1,
      previousStock: decrementResult.previousStock,
      newStock: decrementResult.newStock,
      minThreshold: updatedProduct.minThreshold,
      status: reorderOutcome.triggered ? 'reorder_triggered' : 'success',
      reorderOrderId: reorderOutcome.order?.id,
      message: reorderOutcome.triggered
        ? `Stock reached threshold (${decrementResult.newStock}/${updatedProduct.minThreshold}). Draft reorder request generated.`
        : `Stock updated: ${decrementResult.previousStock} -> ${decrementResult.newStock}`,
    };

    return {
      result: {
        scanId,
        success: true,
        barcode: cleanBarcode,
        product: updatedProduct,
        quantityDecremented: 1,
        previousStock: decrementResult.previousStock,
        newStock: decrementResult.newStock,
        thresholdReached: reorderOutcome.triggered,
        reorderCreated: reorderOutcome.order,
        emailDraftCreated: reorderOutcome.emailDraft,
        logItem,
      },
      updatedProducts,
      updatedOrders,
    };
  }
}

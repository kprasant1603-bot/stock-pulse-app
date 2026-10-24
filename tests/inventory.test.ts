import { describe, it, expect } from 'vitest';
import {
  decrementStock,
  isAtOrBelowThreshold,
  calculateReorderQuantity,
  categorizeProducts,
} from '../src/core/inventory';
import {
  evaluateAndCreateReorderDraft,
  approveAndDispatchOrder,
  hasPendingApproval,
} from '../src/core/reorder';
import { ScannerQueue, StateSnapshot } from '../src/core/scannerQueue';
import { Product, ReorderOrder, EmailConfig } from '../src/core/types';

const mockProduct: Product = {
  id: 'prod_1',
  sku: 'COF-ETH-001',
  barcode: '793573192014',
  name: 'Ethiopian Yirgacheffe Beans (1kg)',
  category: 'Coffee Beans',
  currentStock: 10,
  minThreshold: 5,
  unit: 'bags',
  price: 24.5,
  supplierName: 'Atlas Coffee Importers',
  supplierEmail: 'orders@atlascoffee.example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockConfig: EmailConfig = {
  provider: 'simulated',
  ownerEmail: 'kprasant1603@gmail.com',
  businessName: 'Roast & Revel Coffee Co.',
  senderEmail: 'orders@roastrevel.com',
};

describe('Inventory & Stock Arithmetic', () => {
  it('decrements stock by 1 unit accurately without mutating original object', () => {
    const result = decrementStock(mockProduct, 1);
    expect(result.success).toBe(true);
    expect(result.previousStock).toBe(10);
    expect(result.newStock).toBe(9);
    expect(result.updatedProduct.currentStock).toBe(9);
    expect(mockProduct.currentStock).toBe(10); // immutable
  });

  it('prevents stock from dropping below zero', () => {
    const lowStockProduct: Product = { ...mockProduct, currentStock: 0 };
    const result = decrementStock(lowStockProduct, 1);
    expect(result.success).toBe(true);
    expect(result.previousStock).toBe(0);
    expect(result.newStock).toBe(0);
  });

  it('correctly calculates reorder deficit when stock < minThreshold', () => {
    const deficitProduct: Product = { ...mockProduct, currentStock: 2, minThreshold: 8 };
    const calc = calculateReorderQuantity(deficitProduct);
    expect(calc.isDeficit).toBe(true);
    expect(calc.reorderQuantity).toBe(6); // 8 - 2 = 6
    expect(calc.action).toBe('Reorder 6');
  });

  it('returns No reorder when currentStock >= minThreshold', () => {
    const healthyProduct: Product = { ...mockProduct, currentStock: 12, minThreshold: 8 };
    const calc = calculateReorderQuantity(healthyProduct);
    expect(calc.isDeficit).toBe(false);
    expect(calc.reorderQuantity).toBe(0);
    expect(calc.action).toBe('No reorder');
  });

  it('correctly categorizes products into Items to Reorder Today and Items in Healthy Stock', () => {
    const products: Product[] = [
      { ...mockProduct, id: 'p1', name: 'Almond Milk', currentStock: 2, minThreshold: 6 },
      { ...mockProduct, id: 'p2', name: 'Oat Milk', currentStock: 8, minThreshold: 5 },
      { ...mockProduct, id: 'p3', name: 'Paper Cups', currentStock: 50, minThreshold: 100 },
      { ...mockProduct, id: 'p4', name: 'Espresso Roast', currentStock: 20, minThreshold: 10 },
    ];

    const { toReorder, healthy } = categorizeProducts(products);

    // toReorder should have items where stock < minThreshold
    expect(toReorder).toHaveLength(2);
    expect(toReorder.map((item) => item.product.id)).toEqual(['p3', 'p1']); // p3 deficit 50, p1 deficit 4
    expect(toReorder[0].reorderQuantity).toBe(50);
    expect(toReorder[0].action).toBe('Reorder 50');
    expect(toReorder[1].reorderQuantity).toBe(4);
    expect(toReorder[1].action).toBe('Reorder 4');

    // healthy should have items where stock >= minThreshold
    expect(healthy).toHaveLength(2);
    expect(healthy.every((item) => item.action === 'No reorder')).toBe(true);
  });
});

describe('Low-Stock Reorder Flow & Duplicate Prevention', () => {
  it('triggers reorder draft when stock reaches or drops below threshold', () => {
    const triggeredProduct: Product = { ...mockProduct, currentStock: 5, minThreshold: 5 };
    const outcome = evaluateAndCreateReorderDraft(triggeredProduct, [], mockConfig);

    expect(outcome.triggered).toBe(true);
    expect(outcome.order).toBeDefined();
    expect(outcome.order?.status).toBe('pending_approval');
    expect(outcome.emailDraft).toBeDefined();

    // MUST be sent to owner, NEVER supplier at this stage
    expect(outcome.emailDraft?.to).toBe(mockConfig.ownerEmail);
    expect(outcome.emailDraft?.to).not.toBe(triggeredProduct.supplierEmail);
    expect(outcome.emailDraft?.type).toBe('draft_approval_request');
  });

  it('does NOT trigger reorder if stock is above threshold', () => {
    const safeProduct: Product = { ...mockProduct, currentStock: 9, minThreshold: 5 };
    const outcome = evaluateAndCreateReorderDraft(safeProduct, [], mockConfig);

    expect(outcome.triggered).toBe(false);
    expect(outcome.order).toBeUndefined();
    expect(outcome.emailDraft).toBeUndefined();
  });

  it('PREVENTS duplicate pending requests while one is already awaiting approval', () => {
    const product: Product = { ...mockProduct, currentStock: 3, minThreshold: 5 };

    const existingPendingOrder: ReorderOrder = {
      id: 'ord_existing',
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      barcode: product.barcode,
      supplierName: product.supplierName,
      supplierEmail: product.supplierEmail,
      currentStockAtTrigger: 4,
      minThreshold: 5,
      suggestedQuantity: 2,
      status: 'pending_approval',
      createdAt: '2026-10-24T00:00:00.000Z',
      poNumber: 'PO-TEST-1',
    };

    expect(hasPendingApproval([existingPendingOrder], product.id)).toBe(true);

    // Attempt to trigger another reorder for the same product
    const outcome = evaluateAndCreateReorderDraft(product, [existingPendingOrder], mockConfig);

    expect(outcome.triggered).toBe(false);
    expect(outcome.order).toBeUndefined();
    expect(outcome.skippedReason).toContain('already exists');
  });
});

describe('Approval and Supplier Order Dispatch', () => {
  it('dispatches email to supplier with EXACT subject "ORDER PLACED" upon owner approval', () => {
    const pendingOrder: ReorderOrder = {
      id: 'ord_123',
      productId: mockProduct.id,
      productName: mockProduct.name,
      sku: mockProduct.sku,
      barcode: mockProduct.barcode,
      supplierName: mockProduct.supplierName,
      supplierEmail: mockProduct.supplierEmail,
      currentStockAtTrigger: 3,
      minThreshold: 5,
      suggestedQuantity: 2,
      status: 'pending_approval',
      createdAt: '2026-10-24T00:00:00.000Z',
      poNumber: 'PO-2026-100',
    };

    // Owner approves with an edited quantity (e.g., changes 2 -> 5)
    const { approvedOrder, supplierEmail } = approveAndDispatchOrder(
      pendingOrder,
      mockProduct,
      {
        ownerEmail: mockConfig.ownerEmail,
        businessName: mockConfig.businessName,
      },
      5, // Edited quantity
      'Please expedite via morning delivery.'
    );

    expect(approvedOrder.status).toBe('sent');
    expect(approvedOrder.approvedQuantity).toBe(5);
    expect(approvedOrder.approvedAt).toBeDefined();

    // Exact subject line check
    expect(supplierEmail.subject).toBe('ORDER PLACED');
    expect(supplierEmail.to).toBe(mockProduct.supplierEmail);
    expect(supplierEmail.type).toBe('supplier_order_placed');
    expect(supplierEmail.bodyText).toContain('ORDER PLACED');
    expect(supplierEmail.bodyText).toContain('PO-2026-100');
    expect(supplierEmail.bodyText).toContain('Quantity Ordered: 5 bags');
  });

  it('builds valid base64url encoded RFC 2822 multipart email for Gmail API', async () => {
    const { buildRawEmail } = await import('../src/services/googleAuth');
    const rawBase64 = buildRawEmail(
      'supplier@example.com',
      'owner@gmail.com',
      'ORDER PLACED',
      'Plain text order summary',
      '<div>HTML order summary</div>'
    );

    expect(typeof rawBase64).toBe('string');
    expect(rawBase64.length).toBeGreaterThan(20);
    // base64url characters only (no +, no /, no =)
    expect(rawBase64).not.toContain('+');
    expect(rawBase64).not.toContain('/');
    expect(rawBase64).not.toContain('=');
  });
});

describe('ScannerQueue Concurrency & Race Condition Protection', () => {
  it('handles 10 rapid concurrent scans on the same product sequentially without losing scans or duplicating pending orders', async () => {
    let state: StateSnapshot = {
      products: [{ ...mockProduct, currentStock: 10, minThreshold: 5 }],
      orders: [],
      logs: [],
      emails: [],
    };

    const getState = () => state;
    const commitState = (updated: StateSnapshot) => {
      state = { ...updated };
    };

    const queue = new ScannerQueue();

    // Fire 10 parallel scan calls simultaneously (simulating 10 rapid scanner inputs in the same event tick)
    const promises: Promise<any>[] = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        queue.enqueue(mockProduct.barcode, getState, commitState, mockConfig)
      );
    }

    const results = await Promise.all(promises);

    // Verify all 10 scans succeeded
    expect(results).toHaveLength(10);
    expect(results.every((r) => r.success)).toBe(true);

    // Final stock must be exactly 10 - 10 = 0 (no dropped decrements)
    expect(state.products[0].currentStock).toBe(0);

    // Exactly 10 scan logs recorded
    expect(state.logs).toHaveLength(10);

    // Exactly 1 pending reorder order should have been created (when stock hit threshold of 5)
    // Subsequent scans (4, 3, 2, 1, 0) must NOT have generated duplicate pending orders!
    expect(state.orders).toHaveLength(1);
    expect(state.orders[0].status).toBe('pending_approval');
    expect(state.orders[0].productId).toBe(mockProduct.id);

    // Exactly 1 draft email was sent to the owner
    expect(state.emails).toHaveLength(1);
    expect(state.emails[0].to).toBe(mockConfig.ownerEmail);
  });

  it('handles unknown barcodes gracefully without crashing queue', async () => {
    let state: StateSnapshot = {
      products: [mockProduct],
      orders: [],
      logs: [],
      emails: [],
    };

    const getState = () => state;
    const commitState = (updated: StateSnapshot) => {
      state = { ...updated };
    };

    const queue = new ScannerQueue();
    const result = await queue.enqueue('UNKNOWN_12345', getState, commitState, mockConfig);

    expect(result.success).toBe(false);
    expect(result.error).toBe('unknown_barcode');
    expect(state.logs[0].status).toBe('unknown_barcode');
    expect(state.products[0].currentStock).toBe(10); // unchanged
  });
});

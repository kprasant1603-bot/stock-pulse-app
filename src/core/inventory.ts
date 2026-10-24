/**
 * Core Inventory & Stock Arithmetic Logic
 * Pure, tested business functions.
 */

import { Product, ReorderAssessment, HealthyAssessment } from './types';

/**
 * Decrement stock by a specified quantity (default: 1)
 * Pure function: does not mutate the original product.
 */
export function decrementStock(
  product: Product,
  quantity = 1
): {
  success: boolean;
  updatedProduct: Product;
  previousStock: number;
  newStock: number;
  error?: string;
} {
  if (quantity <= 0) {
    return {
      success: false,
      updatedProduct: product,
      previousStock: product.currentStock,
      newStock: product.currentStock,
      error: 'Quantity to decrement must be greater than zero',
    };
  }

  const previousStock = product.currentStock;
  const newStock = Math.max(0, previousStock - quantity);

  const updatedProduct: Product = {
    ...product,
    currentStock: newStock,
    lastScannedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    success: true,
    updatedProduct,
    previousStock,
    newStock,
  };
}

/**
 * Check whether product is at or below its reorder threshold
 * Rule: Sale brings available quantity to or below minimum threshold
 */
export function isAtOrBelowThreshold(product: Product): boolean {
  return product.currentStock <= product.minThreshold;
}

/**
 * Calculate exact replenishment needs based on Business Rule 1:
 * - If Current Stock < Minimum Required Stock:
 *     Reorder Quantity = Minimum Required Stock - Current Stock
 *     Action = "Reorder [Quantity]"
 * - If Current Stock >= Minimum Required Stock:
 *     Reorder Quantity = 0
 *     Action = "No reorder"
 */
export function calculateReorderQuantity(product: Product): {
  reorderQuantity: number;
  action: string;
  isDeficit: boolean;
} {
  const current = product.currentStock;
  const minRequired = product.minThreshold;

  if (current < minRequired) {
    // Exact arithmetic deficit, never hallucinate beyond deficit
    const deficit = minRequired - current;
    return {
      reorderQuantity: deficit,
      action: `Reorder ${deficit}`,
      isDeficit: true,
    };
  }

  return {
    reorderQuantity: 0,
    action: 'No reorder',
    isDeficit: false,
  };
}

/**
 * Group products into two distinct sections per Business Rule 2:
 * 1. "Items to Reorder Today" (Stock < Minimum)
 * 2. "Items in Healthy Stock" (Stock >= Minimum)
 */
export function categorizeProducts(
  products: Product[],
  pendingProductIds: Set<string> = new Set()
): {
  toReorder: ReorderAssessment[];
  healthy: HealthyAssessment[];
} {
  const toReorder: ReorderAssessment[] = [];
  const healthy: HealthyAssessment[] = [];

  for (const product of products) {
    const current = product.currentStock;
    const minRequired = product.minThreshold;

    if (current < minRequired) {
      const deficit = minRequired - current;
      toReorder.push({
        product,
        currentStock: current,
        minRequiredStock: minRequired,
        deficit,
        action: `Reorder ${deficit}`,
        reorderQuantity: deficit,
        hasActivePendingOrder: pendingProductIds.has(product.id),
      });
    } else {
      const surplus = current - minRequired;
      healthy.push({
        product,
        currentStock: current,
        minRequiredStock: minRequired,
        surplus,
        action: 'No reorder',
      });
    }
  }

  // Sort "Items to Reorder Today" by highest deficit first (most urgent)
  toReorder.sort((a, b) => b.deficit - a.deficit);

  // Sort "Items in Healthy Stock" by product name
  healthy.sort((a, b) => a.product.name.localeCompare(b.product.name));

  return { toReorder, healthy };
}

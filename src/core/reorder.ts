/**
 * Core Reorder Workflow & Approval Logic
 * Pure, tested business functions.
 */

import { Product, ReorderOrder, EmailMessage, EmailConfig } from './types';
import { calculateReorderQuantity, isAtOrBelowThreshold } from './inventory';

/**
 * Check if a product currently has an active pending approval order.
 * Requirement: Prevent the same product from generating duplicate pending requests
 * while one is already awaiting approval.
 */
export function hasPendingApproval(orders: ReorderOrder[], productId: string): boolean {
  return orders.some(
    (order) => order.productId === productId && order.status === 'pending_approval'
  );
}

/**
 * Generate a unique Purchase Order number
 */
export function generatePoNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PO-${timestamp}-${randomSuffix}`;
}

/**
 * Evaluates whether a product needs a reorder workflow triggered.
 * If triggered:
 * 1. Checks if duplicate pending request already exists -> if so, skips creation.
 * 2. Creates a ReorderOrder in 'pending_approval' state.
 * 3. Creates a draft email sent strictly to the OWNER's email (supplier is NOT contacted).
 */
export function evaluateAndCreateReorderDraft(
  product: Product,
  existingOrders: ReorderOrder[],
  config: {
    ownerEmail: string;
    businessName: string;
    senderEmail?: string;
    appUrl?: string;
  },
  customQuantity?: number
): {
  triggered: boolean;
  order?: ReorderOrder;
  emailDraft?: EmailMessage;
  skippedReason?: string;
} {
  // Check if stock is at or below minimum threshold
  if (!isAtOrBelowThreshold(product)) {
    return {
      triggered: false,
      skippedReason: `Stock (${product.currentStock}) is above minimum threshold (${product.minThreshold})`,
    };
  }

  // Check duplicate pending order guard
  if (hasPendingApproval(existingOrders, product.id)) {
    return {
      triggered: false,
      skippedReason: `Active pending approval order already exists for product ${product.sku}`,
    };
  }

  // Calculate suggested order quantity
  const calculation = calculateReorderQuantity(product);
  // If at threshold (currentStock == minThreshold), deficit is 0, so suggested min replenishment is at least 1 or safety lot
  const suggestedQty = customQuantity !== undefined 
    ? customQuantity 
    : (calculation.reorderQuantity > 0 ? calculation.reorderQuantity : Math.max(1, Math.round(product.minThreshold * 0.5)));

  const now = new Date().toISOString();
  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const poNumber = generatePoNumber();
  const approvalToken = `tok_${Math.random().toString(36).substring(2, 12)}`;

  const order: ReorderOrder = {
    id: orderId,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    barcode: product.barcode,
    supplierName: product.supplierName,
    supplierEmail: product.supplierEmail,
    currentStockAtTrigger: product.currentStock,
    minThreshold: product.minThreshold,
    suggestedQuantity: suggestedQty,
    status: 'pending_approval',
    createdAt: now,
    poNumber,
  };

  const senderEmail = config.senderEmail || 'inventory-alerts@stockpulse.local';
  const appUrl = config.appUrl || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:3000');
  const approvalUrl = `${appUrl}?tab=orders&action=approve&orderId=${orderId}&token=${approvalToken}`;

  // Draft email addressed strictly to owner for approval
  const emailDraft: EmailMessage = {
    id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    to: config.ownerEmail, // SENT TO OWNER ONLY - DO NOT CONTACT SUPPLIER YET
    from: senderEmail,
    subject: `[Reorder Request Draft] Replenishment needed for ${product.name} (${product.sku})`,
    createdAt: now,
    type: 'draft_approval_request',
    orderId,
    status: 'draft_sent_to_owner',
    approvalToken,
    bodyText: [
      `REORDER APPROVAL REQUEST - DRAFT`,
      `------------------------------------------`,
      `Business: ${config.businessName}`,
      `PO Number: ${poNumber}`,
      `Created: ${new Date(now).toLocaleString()}`,
      ``,
      `A recent sale brought inventory to or below the minimum threshold.`,
      `Please review and approve before this order is dispatched to the supplier.`,
      ``,
      `PRODUCT DETAILS:`,
      `- Product: ${product.name}`,
      `- SKU: ${product.sku}`,
      `- Barcode: ${product.barcode}`,
      `- Current Available Stock: ${product.currentStock} ${product.unit}`,
      `- Minimum Required Threshold: ${product.minThreshold} ${product.unit}`,
      `- Suggested Order Quantity: ${suggestedQty} ${product.unit}`,
      ``,
      `SUPPLIER INFORMATION:`,
      `- Supplier: ${product.supplierName}`,
      `- Supplier Email: ${product.supplierEmail}`,
      ``,
      `ACTION REQUIRED:`,
      `You can approve this order directly in your dashboard or click below:`,
      `Approval Link: ${approvalUrl}`,
      ``,
      `Note: The supplier will NOT be contacted until you approve this draft.`,
    ].join('\n'),
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Draft Reorder Request for Approval</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">PO: <strong>${poNumber}</strong> · ${config.businessName}</p>
        </div>

        <p style="font-size: 14px; color: #334155;">
          A recent sale brought <strong>${product.name}</strong> to or below its minimum inventory threshold.
          Review the details below and approve dispatch to supplier.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Product:</td>
              <td style="font-weight: 600; color: #0f172a;">${product.name}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 6px 0;">SKU / Barcode:</td>
              <td style="font-family: monospace; color: #0f172a;">${product.sku} · ${product.barcode}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Current Available Stock:</td>
              <td style="color: #dc2626; font-weight: 600;">${product.currentStock} ${product.unit}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Minimum Threshold:</td>
              <td style="color: #0f172a;">${product.minThreshold} ${product.unit}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="color: #0f172a; font-weight: 600; padding: 8px 0;">Suggested Order Quantity:</td>
              <td style="font-size: 15px; font-weight: 700; color: #0284c7;">${suggestedQty} ${product.unit}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Target Supplier:</td>
              <td style="color: #0f172a;">${product.supplierName} (${product.supplierEmail})</td>
            </tr>
          </table>
        </div>

        <div style="margin: 24px 0; text-align: center;">
          <a href="${approvalUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
            Approve & Dispatch to Supplier
          </a>
        </div>

        <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          🔒 <em>Safety rule: The supplier (${product.supplierEmail}) has not been contacted. This email is sent exclusively to you for authorization.</em>
        </p>
      </div>
    `,
  };

  return {
    triggered: true,
    order,
    emailDraft,
  };
}

/**
 * Approve an order draft and generate the supplier dispatch email with exact subject line:
 * Subject: "ORDER PLACED"
 */
export function approveAndDispatchOrder(
  order: ReorderOrder,
  product: Product,
  config: {
    ownerEmail: string;
    businessName: string;
    deliveryAddress?: string;
  },
  approvedQuantity?: number,
  notes?: string
): {
  approvedOrder: ReorderOrder;
  supplierEmail: EmailMessage;
} {
  const finalQuantity = approvedQuantity !== undefined && approvedQuantity > 0
    ? approvedQuantity
    : order.suggestedQuantity;

  const now = new Date().toISOString();

  const approvedOrder: ReorderOrder = {
    ...order,
    status: 'sent',
    approvedQuantity: finalQuantity,
    approvedAt: now,
    sentAt: now,
    notes: notes || order.notes,
  };

  const deliveryAddress = config.deliveryAddress || '104 Commerce Blvd, Suite 2B, Warehouse Dock A';

  // EXACT REQUIREMENT: Subject line must be "ORDER PLACED"
  const supplierEmail: EmailMessage = {
    id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    to: order.supplierEmail, // Now sent to supplier!
    from: config.ownerEmail,
    subject: 'ORDER PLACED',
    createdAt: now,
    type: 'supplier_order_placed',
    orderId: order.id,
    status: 'order_dispatched_to_supplier',
    bodyText: [
      `ORDER PLACED`,
      `------------------------------------------`,
      `Business: ${config.businessName}`,
      `Purchase Order: ${order.poNumber}`,
      `Date: ${new Date(now).toLocaleString()}`,
      ``,
      `Dear ${order.supplierName} Sales Team,`,
      ``,
      `Please process the following purchase order for our account:`,
      ``,
      `ORDER ITEMS:`,
      `- Item: ${product.name}`,
      `- SKU: ${product.sku}`,
      `- Barcode: ${product.barcode}`,
      `- Quantity Ordered: ${finalQuantity} ${product.unit}`,
      ``,
      `DELIVERY INSTRUCTIONS:`,
      `Ship to: ${deliveryAddress}`,
      `Attn: Receiving Dept / ${config.businessName}`,
      `PO Reference on Bol/Packing Slip: ${order.poNumber}`,
      notes ? `Special Notes: ${notes}` : '',
      ``,
      `Please reply with order confirmation and estimated delivery date.`,
      ``,
      `Best regards,`,
      `${config.businessName} Operations`,
      `Contact: ${config.ownerEmail}`,
    ].filter(Boolean).join('\n'),
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <div style="border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 20px;">
          <h1 style="color: #0f172a; margin: 0; font-size: 22px;">ORDER PLACED</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">PO: <strong>${order.poNumber}</strong> · ${config.businessName}</p>
        </div>

        <p style="font-size: 14px; color: #334155;">
          Dear <strong>${order.supplierName}</strong> Sales & Fulfillment Team,
        </p>
        <p style="font-size: 14px; color: #334155;">
          Please accept and process this official purchase order from <strong>${config.businessName}</strong>.
        </p>

        <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 10px 12px; font-weight: 600; color: #475569;">Description</th>
                <th style="padding: 10px 12px; font-weight: 600; color: #475569;">SKU / Barcode</th>
                <th style="padding: 10px 12px; font-weight: 600; color: #475569; text-align: right;">Qty Ordered</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 12px; color: #0f172a; font-weight: 600;">${product.name}</td>
                <td style="padding: 12px; font-family: monospace; color: #475569;">${product.sku}<br><span style="font-size: 11px; color: #94a3b8;">${product.barcode}</span></td>
                <td style="padding: 12px; font-size: 16px; font-weight: 700; color: #16a34a; text-align: right;">${finalQuantity} ${product.unit}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; font-size: 13px; color: #475569; margin-bottom: 20px;">
          <p style="margin: 0 0 6px 0;"><strong>Shipping Destination:</strong> ${deliveryAddress}</p>
          <p style="margin: 0 0 6px 0;"><strong>Purchase Order Ref:</strong> ${order.poNumber}</p>
          ${notes ? `<p style="margin: 0; color: #0f172a;"><strong>Order Notes:</strong> ${notes}</p>` : ''}
        </div>

        <p style="font-size: 13px; color: #334155;">
          Please confirm receipt of this order and reply to <a href="mailto:${config.ownerEmail}" style="color: #0284c7;">${config.ownerEmail}</a> with estimated shipment schedule and tracking.
        </p>

        <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
          Best regards,<br>
          <strong>${config.businessName} Operations</strong>
        </p>
      </div>
    `,
  };

  return {
    approvedOrder,
    supplierEmail,
  };
}

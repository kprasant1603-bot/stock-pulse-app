import React, { useState } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  Send,
  Eye,
  AlertCircle,
  Truck,
  Edit3,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { ReorderOrder, Product, EmailMessage, EmailConfig } from '../core/types';

interface ReordersViewProps {
  orders: ReorderOrder[];
  products: Product[];
  emails: EmailMessage[];
  config: EmailConfig;
  onApproveOrder: (orderId: string, approvedQuantity?: number, notes?: string) => Promise<void>;
  onCancelOrder: (orderId: string) => void;
  onPreviewEmail: (email: EmailMessage) => void;
}

export const ReordersView: React.FC<ReordersViewProps> = ({
  orders,
  products,
  emails,
  config,
  onApproveOrder,
  onCancelOrder,
  onPreviewEmail,
}) => {
  // State for editable suggested quantities per pending order
  const [editableQuantities, setEditableQuantities] = useState<Record<string, number>>({});
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

  const pendingOrders = orders.filter((o) => o.status === 'pending_approval');
  const dispatchedOrders = orders.filter((o) => o.status === 'sent' || o.status === 'approved');

  const getProduct = (productId: string) => {
    return products.find((p) => p.id === productId);
  };

  const getAssociatedDraftEmail = (orderId: string) => {
    return emails.find(
      (e) => e.orderId === orderId && e.type === 'draft_approval_request'
    );
  };

  const [confirmModalOrder, setConfirmModalOrder] = useState<{
    order: ReorderOrder;
    qty: number;
    notes?: string;
  } | null>(null);

  const getAssociatedDispatchedEmail = (orderId: string) => {
    return emails.find(
      (e) => e.orderId === orderId && e.type === 'supplier_order_placed'
    );
  };

  const handleQuantityChange = (orderId: string, value: number) => {
    setEditableQuantities((prev) => ({
      ...prev,
      [orderId]: Math.max(1, value),
    }));
  };

  const handleNotesChange = (orderId: string, text: string) => {
    setOrderNotes((prev) => ({
      ...prev,
      [orderId]: text,
    }));
  };

  const handleOpenApproveConfirm = (order: ReorderOrder) => {
    const qty = editableQuantities[order.id] !== undefined
      ? editableQuantities[order.id]
      : order.suggestedQuantity;
    const notes = orderNotes[order.id];
    setConfirmModalOrder({ order, qty, notes });
  };

  const handleConfirmApprove = async () => {
    if (!confirmModalOrder) return;
    const { order, qty, notes } = confirmModalOrder;
    setIsSubmitting((prev) => ({ ...prev, [order.id]: true }));
    try {
      await onApproveOrder(order.id, qty, notes);
      setConfirmModalOrder(null);
    } finally {
      setIsSubmitting((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* View Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">
          Purchase Orders & Supplier Replenishment
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Review automated draft reorders, edit order quantities, and authorize purchase order dispatch to suppliers.
        </p>
      </div>

      {/* PENDING APPROVAL SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
              Draft Reorders Awaiting Your Approval
            </h2>
            <span className="text-xs font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold tabular-nums border border-amber-200">
              {pendingOrders.length} pending
            </span>
          </div>
          <span className="text-xs text-neutral-500">
            🔒 Suppliers are not contacted until you approve
          </span>
        </div>

        {pendingOrders.length === 0 ? (
          <div className="p-8 bg-white border border-neutral-200 rounded-lg text-center text-xs text-neutral-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="font-semibold text-neutral-800">No reorders awaiting approval</p>
            <p className="text-[11px] mt-0.5">
              When sales bring any product to or below its minimum threshold, draft reorder requests will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendingOrders.map((order) => {
              const product = getProduct(order.productId);
              const draftEmail = getAssociatedDraftEmail(order.id);
              const currentEditQty =
                editableQuantities[order.id] !== undefined
                  ? editableQuantities[order.id]
                  : order.suggestedQuantity;

              return (
                <div
                  key={order.id}
                  className="p-5 bg-white border border-amber-300 rounded-lg shadow-xs flex flex-col justify-between"
                >
                  <div>
                    {/* Header: PO & Product */}
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3">
                      <div>
                        <span className="text-[11px] font-mono text-amber-800 font-bold tracking-wider">
                          {order.poNumber}
                        </span>
                        <h3 className="text-base font-bold text-neutral-900 mt-0.5">
                          {order.productName}
                        </h3>
                        <div className="text-xs font-mono text-neutral-500 mt-0.5 flex items-center gap-2">
                          <span>SKU: {order.sku}</span>
                          <span>·</span>
                          <span>Barcode: {order.barcode}</span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-800 rounded">
                        Awaiting Owner Approval
                      </span>
                    </div>

                    {/* Stock & Threshold Snapshot */}
                    <div className="grid grid-cols-3 gap-2 my-4 p-3 bg-neutral-50 rounded-md border border-neutral-200 text-center">
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                          Stock at Trigger
                        </span>
                        <span className="text-sm font-bold font-mono text-red-600 tabular-nums">
                          {order.currentStockAtTrigger} {product?.unit || 'units'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                          Min Threshold
                        </span>
                        <span className="text-sm font-bold font-mono text-neutral-800 tabular-nums">
                          {order.minThreshold} {product?.unit || 'units'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-800 uppercase tracking-wider font-semibold block">
                          Suggested Deficit
                        </span>
                        <span className="text-sm font-bold font-mono text-amber-700 tabular-nums">
                          {order.suggestedQuantity} {product?.unit || 'units'}
                        </span>
                      </div>
                    </div>

                    {/* Editable Quantity (Requirement: Make suggested order quantity editable by owner) */}
                    <div className="space-y-3 p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                            <Edit3 className="w-3.5 h-3.5 text-neutral-700" />
                            <span>Approved Order Quantity (Editable):</span>
                          </label>
                          <span className="text-[11px] text-neutral-500 block">
                            Fine-tune the final quantity before dispatching to supplier
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-white border border-neutral-300 rounded-lg p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(order.id, Math.max(1, currentEditQty - 1))
                              }
                              className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 font-bold text-sm transition-colors"
                              title="Decrease quantity"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={currentEditQty}
                              onChange={(e) =>
                                handleQuantityChange(order.id, parseInt(e.target.value) || 1)
                              }
                              className="w-16 px-1 py-1 text-sm font-mono font-bold text-center text-neutral-900 border-0 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(order.id, currentEditQty + 1)
                              }
                              className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 font-bold text-sm transition-colors"
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs font-semibold text-neutral-700">
                            {product?.unit || 'units'}
                          </span>
                        </div>
                      </div>

                      {/* Optional Notes for Supplier */}
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                          Delivery Instructions or Notes (Optional):
                        </label>
                        <input
                          type="text"
                          value={orderNotes[order.id] || ''}
                          onChange={(e) => handleNotesChange(order.id, e.target.value)}
                          placeholder="e.g. Please expedite morning delivery to loading bay 2"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Target Supplier Details */}
                    <div className="mt-4 pt-3 border-t border-neutral-100 text-xs text-neutral-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Target Supplier:</span>
                        <strong className="text-neutral-900">{order.supplierName}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Supplier Email:</span>
                        <span className="font-mono text-neutral-800">{order.supplierEmail}</span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                        <span>Draft Sent To Owner:</span>
                        <span className="font-mono">{config.ownerEmail}</span>
                      </div>
                    </div>

                    {/* Duplicate Prevention Guard Notice */}
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <AlertCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>Duplicate Protection: Subsequent sales cannot create duplicate requests while this is pending.</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-3 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-2">
                    {draftEmail ? (
                      <button
                        type="button"
                        onClick={() => onPreviewEmail(draftEmail)}
                        className="text-xs text-neutral-600 hover:text-neutral-900 flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview Draft Email</span>
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-400">Draft recorded</span>
                    )}

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => onCancelOrder(order.id)}
                        className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-md transition-colors"
                      >
                        Dismiss
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenApproveConfirm(order)}
                        disabled={isSubmitting[order.id]}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isSubmitting[order.id]
                            ? 'Dispatching...'
                            : 'Approve & Dispatch to Supplier'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DISPATCHED & SENT ORDERS SECTION */}
      <div className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
              Dispatched Purchase Orders (Orders Placed)
            </h2>
            <span className="text-xs font-mono text-neutral-500 tabular-nums">
              ({dispatchedOrders.length} orders)
            </span>
          </div>
          <span className="text-xs text-neutral-500">
            Subject: &quot;ORDER PLACED&quot; sent directly to supplier
          </span>
        </div>

        {dispatchedOrders.length === 0 ? (
          <div className="p-8 bg-white border border-neutral-200 rounded-lg text-center text-xs text-neutral-500">
            No dispatched purchase orders yet. Approving a pending draft will place the order with the supplier.
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                  <th className="py-2.5 px-4 font-semibold">PO Number</th>
                  <th className="py-2.5 px-4 font-semibold">Dispatched At</th>
                  <th className="py-2.5 px-4 font-semibold">Product & SKU</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Ordered Qty</th>
                  <th className="py-2.5 px-4 font-semibold">Supplier & Recipient</th>
                  <th className="py-2.5 px-4 font-semibold">Email Subject</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {dispatchedOrders.map((order) => {
                  const product = getProduct(order.productId);
                  const dispatchedEmail = getAssociatedDispatchedEmail(order.id);

                  return (
                    <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-neutral-900 tabular-nums">
                        {order.poNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-500 tabular-nums">
                        {order.sentAt ? new Date(order.sentAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900">{order.productName}</div>
                        <div className="font-mono text-[11px] text-neutral-500">{order.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {order.approvedQuantity ?? order.suggestedQuantity}{' '}
                        <span className="font-normal text-neutral-500">
                          {product?.unit || 'units'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-neutral-900">{order.supplierName}</div>
                        <div className="font-mono text-[11px] text-neutral-500">
                          {order.supplierEmail}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ORDER PLACED
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {dispatchedEmail ? (
                          <button
                            type="button"
                            onClick={() => onPreviewEmail(dispatchedEmail)}
                            className="px-2.5 py-1 text-xs text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-100 rounded inline-flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Email</span>
                          </button>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explicit User Confirmation Modal for Mutating Email Dispatch */}
      {confirmModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Confirm Purchase Order Dispatch
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  This action will authorize and dispatch an official purchase order email to the supplier.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">From Account:</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {config.ownerEmail} {config.provider === 'gmail' && '(Your Gmail ID)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Supplier Recipient:</span>
                <span className="font-mono text-neutral-800">
                  {confirmModalOrder.order.supplierEmail}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Item & Quantity:</span>
                <span className="font-semibold text-neutral-900">
                  {confirmModalOrder.order.productName} ({confirmModalOrder.qty} units)
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-200/60 pt-1.5">
                <span className="text-neutral-500">Subject Line:</span>
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1 rounded">
                  ORDER PLACED
                </span>
              </div>
            </div>

            {config.provider === 'gmail' ? (
              <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                🔒 The email will be sent directly through your authenticated Google Gmail account and will be visible in your Gmail Sent mailbox.
              </p>
            ) : (
              <p className="text-[11px] text-neutral-500">
                Dispatched via {config.provider} transactional delivery.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setConfirmModalOrder(null)}
                className="px-3.5 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isSubmitting[confirmModalOrder.order.id]}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isSubmitting[confirmModalOrder.order.id]
                    ? 'Sending...'
                    : 'Confirm & Send Email'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

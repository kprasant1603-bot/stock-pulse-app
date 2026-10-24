import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { InventoryView } from './components/InventoryView';
import { SalesScannerView } from './components/SalesScannerView';
import { ReordersView } from './components/ReordersView';
import { EmailOutboxView } from './components/EmailOutboxView';
import { SystemTestsView } from './components/SystemTestsView';
import { ProductModal } from './components/ProductModal';
import { EmailPreviewModal } from './components/EmailPreviewModal';
import {
  Product,
  ReorderOrder,
  ScanLogItem,
  EmailMessage,
  EmailConfig,
} from './core/types';
import {
  loadProducts,
  saveProducts,
  loadOrders,
  saveOrders,
  loadLogs,
  saveLogs,
  loadEmails,
  saveEmails,
  loadConfig,
  saveConfig,
  resetDemoData,
} from './services/storage';
import { ScannerQueue, ScanResult, StateSnapshot } from './core/scannerQueue';
import { evaluateAndCreateReorderDraft, approveAndDispatchOrder } from './core/reorder';
import { TransactionalEmailService } from './services/emailService';
import { RotateCcw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'inventory' | 'scanner' | 'reorders' | 'outbox' | 'tests'
  >('inventory');

  // Application State
  const [products, setProducts] = useState<Product[]>(loadProducts);
  const [orders, setOrders] = useState<ReorderOrder[]>(loadOrders);
  const [logs, setLogs] = useState<ScanLogItem[]>(loadLogs);
  const [emails, setEmails] = useState<EmailMessage[]>(loadEmails);
  const [config, setConfig] = useState<EmailConfig>(loadConfig);

  // Modals & Drawers
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [initialBarcodeForModal, setInitialBarcodeForModal] = useState('');
  const [previewEmail, setPreviewEmail] = useState<EmailMessage | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scanner Queue Instance
  const scannerQueueRef = useRef<ScannerQueue>(new ScannerQueue());

  // Save to persistence on updates
  useEffect(() => {
    saveProducts(products);
  }, [products]);

  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

  useEffect(() => {
    saveLogs(logs);
  }, [logs]);

  useEffect(() => {
    saveEmails(emails);
  }, [emails]);

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // Handle URL email approval links (e.g., ?tab=reorders&action=approve&orderId=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const actionParam = params.get('action');
      const orderIdParam = params.get('orderId');

      if (tabParam === 'orders' || tabParam === 'reorders') {
        setActiveTab('reorders');
      }

      if (actionParam === 'approve' && orderIdParam) {
        setActiveTab('reorders');
        showToast(`Approval link opened for order #${orderIdParam}`);
      }
    } catch {
      // URL parsing fallback
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Provide state getter and commit for ScannerQueue
  const getStateSnapshot = (): StateSnapshot => ({
    products,
    orders,
    logs,
    emails,
  });

  const commitState = (updated: {
    products: Product[];
    orders: ReorderOrder[];
    logs: ScanLogItem[];
    emails: EmailMessage[];
  }) => {
    setProducts(updated.products);
    setOrders(updated.orders);
    setLogs(updated.logs);
    setEmails(updated.emails);
  };

  // Expose scan execution to SalesScannerView
  (scannerQueueRef.current as any)._runScan = (barcode: string): Promise<ScanResult> => {
    return scannerQueueRef.current.enqueue(
      barcode,
      getStateSnapshot,
      commitState,
      config
    );
  };

  // Product CRUD Handlers
  const handleOpenAddProduct = () => {
    setProductToEdit(null);
    setInitialBarcodeForModal('');
    setIsProductModalOpen(true);
  };

  const handleOpenAddProductWithBarcode = (barcode: string) => {
    setProductToEdit(null);
    setInitialBarcodeForModal(barcode);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setProductToEdit(product);
    setInitialBarcodeForModal(product.barcode);
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = (productId: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      showToast('Product removed from catalog.');
    }
  };

  const handleSaveProduct = (
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    const now = new Date().toISOString();

    if (existingId) {
      // Update
      setProducts((prev) =>
        prev.map((p) =>
          p.id === existingId
            ? {
                ...p,
                ...data,
                updatedAt: now,
              }
            : p
        )
      );
      showToast(`Updated "${data.name}"`);
    } else {
      // Create new
      const newProduct: Product = {
        id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      setProducts((prev) => [newProduct, ...prev]);
      showToast(`Added "${newProduct.name}" to inventory`);
    }
  };

  // Manual Trigger for low-stock reorder draft from Inventory View
  const handleManualReorderTrigger = (product: Product) => {
    const outcome = evaluateAndCreateReorderDraft(
      product,
      orders,
      {
        ownerEmail: config.ownerEmail,
        businessName: config.businessName,
        senderEmail: config.senderEmail,
      }
    );

    if (outcome.triggered && outcome.order && outcome.emailDraft) {
      setOrders((prev) => [outcome.order!, ...prev]);
      setEmails((prev) => [outcome.emailDraft!, ...prev]);
      showToast(`Draft reorder request sent to ${config.ownerEmail}`);
    } else {
      showToast(outcome.skippedReason || 'Reorder not triggered.');
    }
  };

  // Approve and Dispatch Purchase Order to Supplier (Requirement 4)
  const handleApproveOrder = async (
    orderId: string,
    approvedQuantity?: number,
    notes?: string
  ) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const product = products.find((p) => p.id === order.productId);
    if (!product) return;

    const { approvedOrder, supplierEmail } = approveAndDispatchOrder(
      order,
      product,
      {
        ownerEmail: config.ownerEmail,
        businessName: config.businessName,
      },
      approvedQuantity,
      notes
    );

    // Update order status to 'sent'
    setOrders((prev) => prev.map((o) => (o.id === orderId ? approvedOrder : o)));

    // Send email to supplier
    await TransactionalEmailService.dispatch(supplierEmail, config);

    // Add dispatched email to outbox
    setEmails((prev) => [supplierEmail, ...prev]);

    showToast(`Order approved! Email with subject "ORDER PLACED" sent to ${order.supplierEmail}`);
  };

  const handleCancelOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o))
    );
    showToast('Draft order dismissed.');
  };

  const handleResetData = () => {
    if (confirm('Reset inventory and orders back to initial sample state?')) {
      const reset = resetDemoData();
      setProducts(reset.products);
      setOrders(reset.orders);
      setLogs(reset.logs);
      setEmails(reset.emails);
      setConfig(reset.config);
      showToast('Sample data restored.');
    }
  };

  const handleAuthChange = (user: any, token: string | null) => {
    if (user && user.email) {
      setConfig((prev) => ({
        ...prev,
        ownerEmail: user.email,
        senderEmail: user.email,
        provider: 'gmail',
      }));
      showToast(`Gmail connected (${user.email}). StockPulse will now send purchase orders using your Gmail ID.`);
    }
  };

  const pendingApprovalsCount = useMemo(() => {
    return orders.filter((o) => o.status === 'pending_approval').length;
  }, [orders]);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-neutral-900 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-neutral-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar Contract (Wordmark - Navigation Links - Primary CTA) */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAddProduct={handleOpenAddProduct}
        pendingApprovalsCount={pendingApprovalsCount}
        onAuthChange={handleAuthChange}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'inventory' && (
          <InventoryView
            products={products}
            orders={orders}
            config={config}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onManualReorderTrigger={handleManualReorderTrigger}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'scanner' && (
          <SalesScannerView
            products={products}
            orders={orders}
            logs={logs}
            config={config}
            scannerQueue={scannerQueueRef.current}
            onScanResult={(res) => {
              if (res.thresholdReached) {
                showToast(`Threshold reached for ${res.product?.name}! Draft reorder sent to your email.`);
              }
            }}
            onClearSessionLogs={() => setLogs([])}
            onOpenAddProductWithBarcode={handleOpenAddProductWithBarcode}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'reorders' && (
          <ReordersView
            orders={orders}
            products={products}
            emails={emails}
            config={config}
            onApproveOrder={handleApproveOrder}
            onCancelOrder={handleCancelOrder}
            onPreviewEmail={setPreviewEmail}
          />
        )}

        {activeTab === 'outbox' && (
          <EmailOutboxView
            emails={emails}
            config={config}
            onUpdateConfig={setConfig}
            onPreviewEmail={setPreviewEmail}
            onClearEmails={() => setEmails([])}
          />
        )}

        {activeTab === 'tests' && <SystemTestsView />}
      </main>

      {/* Footer with Reset & Info */}
      <footer className="border-t border-neutral-200 bg-white py-4 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <div>
            <span>StockPulse Inventory & Barcode Replenishment System</span>
            <span className="mx-2">·</span>
            <span>Owner: <strong className="text-neutral-700">{config.ownerEmail}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetData}
              className="text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Sample Data</span>
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              className="text-neutral-600 hover:text-neutral-900 font-medium"
            >
              11 Automated Unit Tests
            </button>
          </div>
        </div>
      </footer>

      {/* Product Creation / Edit Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        productToEdit={productToEdit}
        initialBarcode={initialBarcodeForModal}
      />

      {/* Email Preview Modal */}
      <EmailPreviewModal
        email={previewEmail}
        onClose={() => setPreviewEmail(null)}
        onApproveIfPending={(orderId) => {
          handleApproveOrder(orderId);
        }}
      />
    </div>
  );
}

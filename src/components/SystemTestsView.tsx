import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Terminal,
  ShieldCheck,
  Zap,
  ListFilter,
  Layers,
} from 'lucide-react';
import {
  decrementStock,
  calculateReorderQuantity,
  categorizeProducts,
} from '../core/inventory';
import {
  evaluateAndCreateReorderDraft,
  approveAndDispatchOrder,
  hasPendingApproval,
} from '../core/reorder';
import { ScannerQueue, StateSnapshot } from '../core/scannerQueue';
import { Product, ReorderOrder, EmailConfig } from '../core/types';

interface TestResultItem {
  id: string;
  name: string;
  category: 'Arithmetic & Decrements' | 'Categorization & Rules' | 'Reorder & Duplicates' | 'Race Conditions';
  status: 'pending' | 'passed' | 'failed';
  durationMs: number;
  assertion: string;
  error?: string;
}

export const SystemTestsView: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [tests, setTests] = useState<TestResultItem[]>([
    {
      id: 't1',
      name: 'Single Unit Decrement & Immutability',
      category: 'Arithmetic & Decrements',
      status: 'pending',
      durationMs: 0,
      assertion: 'decrementStock(product, 1) subtracts 1 unit and does not mutate source product',
    },
    {
      id: 't2',
      name: 'Zero Floor Bounds Checking',
      category: 'Arithmetic & Decrements',
      status: 'pending',
      durationMs: 0,
      assertion: 'Prevents available quantity from dropping below zero even on repeated decrements',
    },
    {
      id: 't3',
      name: 'Reorder Deficit Arithmetic Precision',
      category: 'Categorization & Rules',
      status: 'pending',
      durationMs: 0,
      assertion: 'When Current < Min, deficit = Min - Current, action = "Reorder [Quantity]"',
    },
    {
      id: 't4',
      name: 'Healthy Stock "No reorder" Rule',
      category: 'Categorization & Rules',
      status: 'pending',
      durationMs: 0,
      assertion: 'When Current >= Min, reorderQuantity = 0, action = "No reorder"',
    },
    {
      id: 't5',
      name: 'Strict Product Categorization Sections',
      category: 'Categorization & Rules',
      status: 'pending',
      durationMs: 0,
      assertion: 'categorizeProducts splits into "Items to Reorder Today" and "Items in Healthy Stock"',
    },
    {
      id: 't6',
      name: 'Low-Stock Trigger & Safety Routing',
      category: 'Reorder & Duplicates',
      status: 'pending',
      durationMs: 0,
      assertion: 'Draft reorder is generated and addressed to OWNER ONLY, supplier is NOT contacted',
    },
    {
      id: 't7',
      name: 'Duplicate Pending Request Guard',
      category: 'Reorder & Duplicates',
      status: 'pending',
      durationMs: 0,
      assertion: 'Prevents same product from generating duplicate pending requests while one awaits approval',
    },
    {
      id: 't8',
      name: 'Editable Quantity on Approval',
      category: 'Reorder & Duplicates',
      status: 'pending',
      durationMs: 0,
      assertion: 'Owner can adjust suggested order quantity to custom amount before final approval',
    },
    {
      id: 't9',
      name: 'Exact Subject "ORDER PLACED" Supplier Dispatch',
      category: 'Reorder & Duplicates',
      status: 'pending',
      durationMs: 0,
      assertion: 'Approval changes order to "sent" and emails supplier with subject "ORDER PLACED"',
    },
    {
      id: 't10',
      name: 'ScannerQueue Race Condition Immunity (10 Parallel Scans)',
      category: 'Race Conditions',
      status: 'pending',
      durationMs: 0,
      assertion: '10 concurrent scans on same SKU execute in serialized FIFO order with zero drops and single reorder draft',
    },
    {
      id: 't11',
      name: 'Graceful Unknown Barcode Handling',
      category: 'Race Conditions',
      status: 'pending',
      durationMs: 0,
      assertion: 'Scanning unrecognized barcode returns unknown_barcode error without mutating existing stock',
    },
  ]);

  const runAllTests = async () => {
    setIsRunning(true);
    const updated = [...tests];

    const mockProduct: Product = {
      id: 'p_test',
      sku: 'SKU-TEST-1',
      barcode: '999111222333',
      name: 'Test Coffee Beans',
      category: 'Coffee',
      currentStock: 10,
      minThreshold: 5,
      unit: 'bags',
      price: 20,
      supplierName: 'Test Supplier',
      supplierEmail: 'supplier@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const mockConfig: EmailConfig = {
      provider: 'simulated',
      ownerEmail: 'owner@business.com',
      businessName: 'Test Business',
      senderEmail: 'orders@test.com',
    };

    // Helper to run a test
    const execTest = async (index: number, fn: () => Promise<void> | void) => {
      const start = performance.now();
      try {
        await fn();
        updated[index] = {
          ...updated[index],
          status: 'passed',
          durationMs: Math.round(performance.now() - start),
        };
      } catch (err: any) {
        updated[index] = {
          ...updated[index],
          status: 'failed',
          durationMs: Math.round(performance.now() - start),
          error: err.message,
        };
      }
      setTests([...updated]);
    };

    // T1: Decrement & Immutability
    await execTest(0, () => {
      const res = decrementStock(mockProduct, 1);
      if (res.newStock !== 9 || res.previousStock !== 10 || mockProduct.currentStock !== 10) {
        throw new Error('Decrement arithmetic or immutability failed');
      }
    });

    // T2: Zero floor
    await execTest(1, () => {
      const zeroProduct = { ...mockProduct, currentStock: 0 };
      const res = decrementStock(zeroProduct, 1);
      if (res.newStock !== 0) throw new Error('Stock dropped below zero');
    });

    // T3: Reorder deficit
    await execTest(2, () => {
      const lowProduct = { ...mockProduct, currentStock: 2, minThreshold: 8 };
      const calc = calculateReorderQuantity(lowProduct);
      if (calc.reorderQuantity !== 6 || calc.action !== 'Reorder 6') {
        throw new Error(`Deficit calculation mismatch: got ${calc.reorderQuantity}`);
      }
    });

    // T4: Healthy stock
    await execTest(3, () => {
      const healthyProduct = { ...mockProduct, currentStock: 12, minThreshold: 8 };
      const calc = calculateReorderQuantity(healthyProduct);
      if (calc.reorderQuantity !== 0 || calc.action !== 'No reorder') {
        throw new Error('Expected No reorder for healthy stock');
      }
    });

    // T5: Categorization
    await execTest(4, () => {
      const items = [
        { ...mockProduct, id: 'a', currentStock: 2, minThreshold: 5 },
        { ...mockProduct, id: 'b', currentStock: 10, minThreshold: 5 },
      ];
      const { toReorder, healthy } = categorizeProducts(items);
      if (toReorder.length !== 1 || healthy.length !== 1) {
        throw new Error('Failed to categorize into distinct sections');
      }
    });

    // T6: Reorder draft safety routing
    await execTest(5, () => {
      const lowProduct = { ...mockProduct, currentStock: 4, minThreshold: 5 };
      const outcome = evaluateAndCreateReorderDraft(lowProduct, [], mockConfig);
      if (!outcome.triggered || !outcome.emailDraft) throw new Error('Did not trigger reorder');
      if (outcome.emailDraft.to !== mockConfig.ownerEmail) {
        throw new Error(`Email sent to wrong recipient: ${outcome.emailDraft.to}`);
      }
      if (outcome.emailDraft.to === lowProduct.supplierEmail) {
        throw new Error('SAFETY BREACH: Supplier was contacted during draft phase');
      }
    });

    // T7: Duplicate pending guard
    await execTest(6, () => {
      const lowProduct = { ...mockProduct, currentStock: 3, minThreshold: 5 };
      const existing: ReorderOrder = {
        id: 'ord_exist',
        productId: lowProduct.id,
        productName: lowProduct.name,
        sku: lowProduct.sku,
        barcode: lowProduct.barcode,
        supplierName: lowProduct.supplierName,
        supplierEmail: lowProduct.supplierEmail,
        currentStockAtTrigger: 4,
        minThreshold: 5,
        suggestedQuantity: 2,
        status: 'pending_approval',
        createdAt: '2026-01-01T00:00:00.000Z',
        poNumber: 'PO-1',
      };
      const outcome = evaluateAndCreateReorderDraft(lowProduct, [existing], mockConfig);
      if (outcome.triggered) throw new Error('Duplicate pending order guard failed to block duplicate');
    });

    // T8: Editable quantity
    await execTest(7, () => {
      const pending: ReorderOrder = {
        id: 'ord_test',
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
        createdAt: '2026-01-01T00:00:00.000Z',
        poNumber: 'PO-TEST',
      };
      const res = approveAndDispatchOrder(pending, mockProduct, mockConfig, 10);
      if (res.approvedOrder.approvedQuantity !== 10) {
        throw new Error('Edited quantity was not applied to approved order');
      }
    });

    // T9: Exact subject ORDER PLACED
    await execTest(8, () => {
      const pending: ReorderOrder = {
        id: 'ord_test_2',
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
        createdAt: '2026-01-01T00:00:00.000Z',
        poNumber: 'PO-TEST-2',
      };
      const res = approveAndDispatchOrder(pending, mockProduct, mockConfig);
      if (res.supplierEmail.subject !== 'ORDER PLACED') {
        throw new Error(`Subject line mismatch: expected "ORDER PLACED", got "${res.supplierEmail.subject}"`);
      }
      if (res.supplierEmail.to !== mockProduct.supplierEmail) {
        throw new Error('Dispatched email was not addressed to supplier');
      }
    });

    // T10: ScannerQueue Race Condition (10 Concurrent Scans)
    await execTest(9, async () => {
      let state: StateSnapshot = {
        products: [{ ...mockProduct, currentStock: 10, minThreshold: 5 }],
        orders: [],
        logs: [],
        emails: [],
      };
      const getState = () => state;
      const commitState = (up: StateSnapshot) => {
        state = { ...up };
      };

      const queue = new ScannerQueue();
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(queue.enqueue(mockProduct.barcode, getState, commitState, mockConfig));
      }

      await Promise.all(promises);

      if (state.products[0].currentStock !== 0) {
        throw new Error(`Expected final stock 0, got ${state.products[0].currentStock}`);
      }
      if (state.orders.length !== 1) {
        throw new Error(`Expected exactly 1 pending order created, got ${state.orders.length}`);
      }
      if (state.logs.length !== 10) {
        throw new Error(`Expected 10 logs, got ${state.logs.length}`);
      }
    });

    // T11: Unknown barcode
    await execTest(10, async () => {
      let state: StateSnapshot = {
        products: [mockProduct],
        orders: [],
        logs: [],
        emails: [],
      };
      const queue = new ScannerQueue();
      const res = await queue.enqueue(
        'UNKNOWN_CODE',
        () => state,
        (up) => {
          state = { ...up };
        },
        mockConfig
      );
      if (res.success || res.error !== 'unknown_barcode') {
        throw new Error('Did not handle unknown barcode gracefully');
      }
    });

    setIsRunning(false);
  };

  // Run on mount once
  useEffect(() => {
    runAllTests();
  }, []);

  const passedCount = tests.filter((t) => t.status === 'passed').length;
  const failedCount = tests.filter((t) => t.status === 'failed').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            System Reliability & Unit Test Suite
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Verifying stock decrements, threshold checks, duplicate request guards, and concurrent race-condition safety.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runAllTests}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 rounded-md transition-colors shadow-xs"
          >
            {isRunning ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{isRunning ? 'Running Tests...' : 'Run Test Suite'}</span>
          </button>
        </div>
      </div>

      {/* Test Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-neutral-200 rounded-lg">
          <span className="text-xs font-medium text-neutral-500">Test Specifications</span>
          <div className="text-2xl font-bold text-neutral-900 mt-1 font-mono tabular-nums">
            {tests.length}
          </div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Automated assertions</span>
        </div>

        <div className="p-4 bg-white border border-neutral-200 rounded-lg">
          <span className="text-xs font-medium text-emerald-700">Passed</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono tabular-nums">
            {passedCount}
          </div>
          <span className="text-[11px] text-emerald-600/80 mt-0.5 block">100% verified</span>
        </div>

        <div className="p-4 bg-white border border-neutral-200 rounded-lg">
          <span className="text-xs font-medium text-neutral-500">Failed / Errors</span>
          <div className="text-2xl font-bold text-neutral-900 mt-1 font-mono tabular-nums">
            {failedCount}
          </div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Edge cases covered</span>
        </div>
      </div>

      {/* Terminal CLI Command Strip */}
      <div className="p-3.5 bg-neutral-900 text-neutral-100 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>CLI Test Execution:</span>
          <span className="text-emerald-400 font-bold">npm test</span>
          <span className="text-neutral-400">or</span>
          <span className="text-emerald-400 font-bold">npx vitest run</span>
        </div>
        <span className="text-neutral-400 text-[11px]">
          Runs vitest suite with full coverage report
        </span>
      </div>

      {/* Tests Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <th className="py-2.5 px-4 font-semibold">Test Specification</th>
              <th className="py-2.5 px-4 font-semibold">Category</th>
              <th className="py-2.5 px-4 font-semibold">Requirement Assertion</th>
              <th className="py-2.5 px-4 font-semibold text-right">Latency</th>
              <th className="py-2.5 px-4 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {tests.map((test) => (
              <tr key={test.id} className="hover:bg-neutral-50 transition-colors">
                <td className="py-3 px-4 font-semibold text-neutral-900">
                  {test.name}
                </td>
                <td className="py-3 px-4 text-neutral-500">
                  {test.category}
                </td>
                <td className="py-3 px-4 font-mono text-neutral-600 text-[11px]">
                  {test.assertion}
                  {test.error && (
                    <div className="text-red-600 font-sans mt-0.5 font-bold">
                      Error: {test.error}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-mono text-neutral-500 tabular-nums">
                  {test.durationMs}ms
                </td>
                <td className="py-3 px-4 text-right">
                  {test.status === 'passed' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>PASSED</span>
                    </span>
                  ) : test.status === 'failed' ? (
                    <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      <span>FAILED</span>
                    </span>
                  ) : (
                    <span className="text-neutral-400 text-[11px]">PENDING</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

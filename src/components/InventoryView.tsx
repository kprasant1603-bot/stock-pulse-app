import React, { useState, useMemo } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Trash2,
  Send,
  Mail,
  Clock,
  ArrowRight,
  Filter,
  ScanBarcode,
  FileText,
  LayoutGrid,
  Table as TableIcon,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { Product, ReorderOrder, EmailConfig } from '../core/types';
import { categorizeProducts } from '../core/inventory';

interface InventoryViewProps {
  products: Product[];
  orders: ReorderOrder[];
  config: EmailConfig;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onManualReorderTrigger: (product: Product) => void;
  onNavigateToTab: (tab: 'inventory' | 'scanner' | 'reorders' | 'outbox' | 'tests') => void;
}

/**
 * Subtle visual status badge for product inventory levels.
 * Renders 'Low Stock' (amber/red) if stock is below threshold,
 * or 'Optimal' (emerald) if stock is at or above threshold.
 */
export const StockStatusBadge: React.FC<{
  current: number;
  min: number;
  size?: 'sm' | 'md';
}> = ({ current, min, size = 'md' }) => {
  const isLow = current < min;
  const isCritical = current === 0;

  if (isLow) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-md border transition-colors shrink-0 ${
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        } bg-amber-50/90 text-amber-900 border-amber-300/80 shadow-2xs`}
        title={`Current stock (${current}) is below required minimum (${min})`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <span>Low Stock</span>
        {isCritical && (
          <span className="text-[9px] font-mono text-red-700 font-semibold">(0 Left)</span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-md border transition-colors shrink-0 ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      } bg-emerald-50/90 text-emerald-900 border-emerald-200/90 shadow-2xs`}
      title={`Current stock (${current}) meets or exceeds required minimum (${min})`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span>Optimal</span>
    </span>
  );
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  orders,
  config,
  onEditProduct,
  onDeleteProduct,
  onManualReorderTrigger,
  onNavigateToTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low_stock' | 'optimal'>('all');
  const [viewMode, setViewMode] = useState<'sections' | 'table'>('sections');

  const pendingProductIds = useMemo(() => {
    return new Set(
      orders
        .filter((o) => o.status === 'pending_approval')
        .map((o) => o.productId)
    );
  }, [orders]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filter products by search & category & status
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.includes(searchTerm) ||
        p.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;

      const isLow = p.currentStock < p.minThreshold;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'low_stock' && isLow) ||
        (statusFilter === 'optimal' && !isLow);

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [products, searchTerm, selectedCategory, statusFilter]);

  // Core Business Rule 2: Group into two distinct sections
  const { toReorder, healthy } = useMemo(() => {
    return categorizeProducts(filteredProducts, pendingProductIds);
  }, [filteredProducts, pendingProductIds]);

  // Counts across entire catalog for badges and KPI
  const catalogStats = useMemo(() => {
    let lowCount = 0;
    let optimalCount = 0;
    products.forEach((p) => {
      if (p.currentStock < p.minThreshold) lowCount++;
      else optimalCount++;
    });
    return { lowCount, optimalCount };
  }, [products]);

  return (
    <div className="space-y-8 pb-12">
      {/* Visual Operations Hero Banner */}
      <div className="relative rounded-xl overflow-hidden border border-neutral-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] bg-neutral-950 text-white min-h-[180px] flex items-center">
        <img
          src="/src/assets/images/fulfillment_studio_hero_1792829147685.jpg"
          alt="Fulfillment studio and stockroom"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-30 select-none pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent" />

        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
          <div className="max-w-xl space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-neutral-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Supply Chain AI Live Console</span>
              <span>·</span>
              <span className="font-mono text-[11px] text-neutral-300">7 Active SKUs Connected</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Inventory & Replenishment
            </h1>
            <p className="text-xs md:text-sm text-neutral-300 font-normal leading-relaxed">
              Automated threshold monitoring for small business operations. Identifies inventory deficits, prevents stockouts, and drafts supplier purchase orders with 1-click owner approval.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateToTab('scanner')}
              className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-white hover:bg-neutral-100 rounded-lg transition-all shadow-sm flex items-center gap-2 active:translate-y-px"
            >
              <ScanBarcode className="w-3.5 h-3.5" />
              <span>Open Sales Scanner</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToTab('reorders')}
              className="px-4 py-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-lg transition-all flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Review Draft POs ({orders.filter(o => o.status === 'pending_approval').length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control bar: Search, Filters, and View Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-neutral-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64 md:w-72">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search SKU, item name, barcode..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50/50 hover:bg-white border border-neutral-300/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 shadow-2xs placeholder:text-neutral-400 transition-colors"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs bg-neutral-50/50 hover:bg-white border border-neutral-300/80 rounded-lg text-neutral-700 focus:outline-hidden focus:ring-1 focus:ring-neutral-900 shadow-2xs font-medium cursor-pointer"
          >
            <option value="all">All Categories ({products.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/80">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              All Statuses
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('low_stock')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                statusFilter === 'low_stock'
                  ? 'bg-white text-amber-900 shadow-2xs border border-amber-200'
                  : 'text-neutral-600 hover:text-amber-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Low Stock ({catalogStats.lowCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('optimal')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                statusFilter === 'optimal'
                  ? 'bg-white text-emerald-900 shadow-2xs border border-emerald-200'
                  : 'text-neutral-600 hover:text-emerald-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Optimal ({catalogStats.optimalCount})</span>
            </button>
          </div>
        </div>

        {/* View Layout Switcher */}
        <div className="flex items-center gap-2 self-end lg:self-center">
          <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/80">
            <button
              type="button"
              onClick={() => setViewMode('sections')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'sections'
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Grouped sections by replenishment rule"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Categorized View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Full inventory rows with status badges"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Catalog Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-neutral-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Total Catalog
            </span>
            <Package className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 mt-1 font-mono tabular-nums">
            {products.length}
          </div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Active Inventory SKUs</span>
        </div>

        <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Items to Reorder Today
            </span>
            <StockStatusBadge current={0} min={1} size="sm" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1 font-mono tabular-nums">
            {toReorder.length}
          </div>
          <span className="text-[11px] text-amber-700/80 mt-0.5 block font-medium">Stock &lt; Minimum required</span>
        </div>

        <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              Healthy Stock Items
            </span>
            <StockStatusBadge current={10} min={10} size="sm" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono tabular-nums">
            {healthy.length}
          </div>
          <span className="text-[11px] text-emerald-700/80 mt-0.5 block font-medium">Stock &ge; Minimum required</span>
        </div>

        <div className="p-4 bg-white border border-neutral-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Pending Approval
            </span>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 mt-1 font-mono tabular-nums">
            {pendingProductIds.size}
          </div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Draft POs awaiting approval</span>
        </div>
      </div>

      {/* VIEW MODE 1: UNIFIED CATALOG TABLE WITH PROMINENT STATUS BADGES */}
      {viewMode === 'table' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-200/80 pb-2">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-neutral-700" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                Complete Inventory Catalog
              </h2>
              <span className="text-xs font-mono text-neutral-500 tabular-nums">
                ({filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'})
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Low Stock ({toReorder.length})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Optimal ({healthy.length})</span>
              </span>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-8 bg-white border border-neutral-200 rounded-xl text-center text-xs text-neutral-500">
              No products found matching your search and filter criteria.
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/90 border-b border-neutral-200 text-neutral-600 select-none">
                      <th className="py-2.5 px-4 font-semibold">Product & SKU</th>
                      <th className="py-2.5 px-3 font-semibold">Barcode</th>
                      <th className="py-2.5 px-3 font-semibold">Stock Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Available</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Min Required</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Net Balance</th>
                      <th className="py-2.5 px-4 font-semibold">Action Required</th>
                      <th className="py-2.5 px-4 font-semibold">Supplier</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredProducts.map((product) => {
                      const isLow = product.currentStock < product.minThreshold;
                      const deficit = isLow ? product.minThreshold - product.currentStock : 0;
                      const surplus = !isLow ? product.currentStock - product.minThreshold : 0;
                      const hasActivePendingOrder = pendingProductIds.has(product.id);
                      const actionLabel = isLow ? `Reorder ${deficit}` : 'No reorder';

                      return (
                        <tr
                          key={product.id}
                          className={`transition-colors ${
                            isLow ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-neutral-50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-neutral-900">{product.name}</div>
                            <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 mt-0.5">
                              <span className="text-neutral-700">{product.sku}</span>
                              {product.category && (
                                <>
                                  <span>·</span>
                                  <span className="text-neutral-400 uppercase text-[10px]">{product.category}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-neutral-600 tabular-nums">
                            {product.barcode}
                          </td>
                          <td className="py-3 px-3">
                            <StockStatusBadge
                              current={product.currentStock}
                              min={product.minThreshold}
                              size="sm"
                            />
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold tabular-nums">
                            <span className={isLow ? 'text-amber-700' : 'text-neutral-900'}>
                              {product.currentStock}
                            </span>{' '}
                            <span className="font-normal text-neutral-400 text-[11px]">{product.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-neutral-600 tabular-nums">
                            {product.minThreshold}{' '}
                            <span className="text-neutral-400 text-[11px]">{product.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums">
                            {isLow ? (
                              <span className="text-amber-700 font-bold">-{deficit} {product.unit}</span>
                            ) : (
                              <span className="text-emerald-700">+{surplus} {product.unit}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isLow ? (
                              hasActivePendingOrder ? (
                                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-100/80 text-amber-900 rounded-md text-[11px] font-semibold border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  <span>Pending Approval</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onManualReorderTrigger(product)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-md transition-all shadow-2xs active:translate-y-px"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>{actionLabel}</span>
                                </button>
                              )
                            ) : (
                              <div className="inline-flex items-center gap-1.5 text-neutral-600 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{actionLabel}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-neutral-900 font-medium truncate max-w-[140px]">
                              {product.supplierName}
                            </div>
                            <div className="text-[11px] font-mono text-neutral-500 truncate max-w-[150px]">
                              {product.supplierEmail}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => onEditProduct(product)}
                                className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded-md hover:bg-neutral-100 transition-colors"
                                title="Edit product & threshold"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteProduct(product.id)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                title="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VIEW MODE 2: GROUPED SECTIONS (Core Business Rule 2) */
        <div className="space-y-8">
          {/* SECTION 1: ITEMS TO REORDER TODAY (Stock < Minimum) */}
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                  Items to Reorder Today
                </h2>
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full tabular-nums">
                  {toReorder.length} in deficit
                </span>
              </div>
              <span className="text-xs text-neutral-500">
                Rule: Current Stock &lt; Minimum Required Stock &rarr; Reorder Deficit
              </span>
            </div>

            {toReorder.length === 0 ? (
              <div className="p-6 bg-white border border-neutral-200 rounded-xl text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-neutral-800">
                  No replenishment needed today
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  All inventory levels are at or above their minimum threshold requirements.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {toReorder.map(({ product, currentStock, minRequiredStock, deficit, action, hasActivePendingOrder }) => (
                  <div
                    key={product.id}
                    className="p-4 bg-white border border-amber-200/90 hover:border-amber-400/80 rounded-xl shadow-[0_2px_8px_-2px_rgba(217,119,6,0.08)] flex flex-col justify-between transition-all"
                  >
                    <div>
                      {/* Card Top: Category and subtle Low Stock Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                          {product.category || 'Supplies'}
                        </span>
                        <StockStatusBadge current={currentStock} min={minRequiredStock} size="sm" />
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-neutral-900 line-clamp-1">
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono mt-0.5">
                            <span className="text-neutral-700 font-medium">{product.sku}</span>
                            <span>·</span>
                            <span>{product.barcode}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onEditProduct(product)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded-md hover:bg-neutral-100 transition-colors"
                            title="Edit product threshold"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProduct(product.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Stock Metrics Grid */}
                      <div className="grid grid-cols-3 gap-2 mt-3.5 p-2.5 bg-neutral-50/80 rounded-lg border border-neutral-150 text-center">
                        <div>
                          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium block">
                            Available
                          </span>
                          <span className="text-base font-bold font-mono text-red-600 tabular-nums">
                            {currentStock}
                          </span>
                          <span className="text-[10px] text-neutral-400 block -mt-0.5">{product.unit}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium block">
                            Minimum
                          </span>
                          <span className="text-base font-bold font-mono text-neutral-800 tabular-nums">
                            {minRequiredStock}
                          </span>
                          <span className="text-[10px] text-neutral-400 block -mt-0.5">{product.unit}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-800 uppercase tracking-wider font-bold block">
                            Deficit
                          </span>
                          <span className="text-base font-bold font-mono text-amber-700 tabular-nums">
                            -{deficit}
                          </span>
                          <span className="text-[10px] text-amber-600/80 font-medium block -mt-0.5">{product.unit}</span>
                        </div>
                      </div>

                      {/* Stock Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] text-neutral-500 mb-1">
                          <span>Stock fill level</span>
                          <span className="font-mono font-semibold tabular-nums text-neutral-700">
                            {Math.min(100, Math.round((currentStock / minRequiredStock) * 100))}% of min
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/50">
                          <div
                            className="h-full bg-gradient-to-r from-red-500 to-amber-500 rounded-full"
                            style={{
                              width: `${Math.min(100, (currentStock / minRequiredStock) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Supplier Info */}
                      <div className="mt-3 pt-2.5 border-t border-neutral-100 text-xs">
                        <div className="flex items-center justify-between text-neutral-500">
                          <span>Supplier:</span>
                          <span className="font-medium text-neutral-900 truncate max-w-[160px]">
                            {product.supplierName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-neutral-500 mt-0.5">
                          <span>Email:</span>
                          <span className="font-mono text-neutral-600 truncate max-w-[180px] text-[11px]">
                            {product.supplierEmail}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Reorder Action Button / Status */}
                    <div className="mt-4 pt-3 border-t border-neutral-100">
                      {hasActivePendingOrder ? (
                        <div className="flex items-center justify-between bg-amber-50/90 border border-amber-200/90 px-3 py-2 rounded-lg">
                          <div className="flex items-center gap-1.5 text-xs text-amber-900 font-semibold">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Pending Owner Approval</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigateToTab('reorders')}
                            className="text-xs font-bold text-neutral-950 hover:underline flex items-center gap-0.5"
                          >
                            <span>Review</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onManualReorderTrigger(product)}
                          className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-lg transition-all shadow-xs active:translate-y-px"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{action} (Generate Draft)</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: ITEMS IN HEALTHY STOCK (Stock >= Minimum) */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                  Items in Healthy Stock
                </h2>
                <span className="text-xs font-mono text-neutral-500 tabular-nums">
                  ({healthy.length} {healthy.length === 1 ? 'item' : 'items'})
                </span>
              </div>
              <span className="text-xs text-neutral-500">
                Rule: Current Stock &ge; Minimum Required Stock &rarr; No reorder
              </span>
            </div>

            {healthy.length === 0 ? (
              <div className="p-6 bg-white border border-neutral-200 rounded-lg text-center text-xs text-neutral-500">
                No healthy items matching the current filter.
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                        <th className="py-2.5 px-4 font-semibold">Product & SKU</th>
                        <th className="py-2.5 px-4 font-semibold">Barcode</th>
                        <th className="py-2.5 px-4 font-semibold">Stock Status</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Available</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Min Threshold</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Surplus</th>
                        <th className="py-2.5 px-4 font-semibold">Action</th>
                        <th className="py-2.5 px-4 font-semibold">Supplier & Contact</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {healthy.map(({ product, currentStock, minRequiredStock, surplus, action }) => (
                        <tr key={product.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-neutral-900">{product.name}</div>
                            <div className="font-mono text-[11px] text-neutral-500">{product.sku}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-600 tabular-nums">
                            {product.barcode}
                          </td>
                          <td className="py-3 px-4">
                            <StockStatusBadge
                              current={currentStock}
                              min={minRequiredStock}
                              size="sm"
                            />
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 tabular-nums">
                            {currentStock} <span className="font-normal text-neutral-500">{product.unit}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-neutral-600 tabular-nums">
                            {minRequiredStock} <span className="text-neutral-400">{product.unit}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold tabular-nums">
                            +{surplus} {product.unit}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-neutral-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{action}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-neutral-900 font-medium truncate max-w-[150px]">
                              {product.supplierName}
                            </div>
                            <div className="text-[11px] font-mono text-neutral-500 truncate max-w-[170px]">
                              {product.supplierEmail}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onEditProduct(product)}
                                className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors"
                                title="Edit product"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteProduct(product.id)}
                                className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors"
                                title="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Barcode, AlertCircle } from 'lucide-react';
import { Product } from '../core/types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string) => void;
  productToEdit?: Product | null;
  initialBarcode?: string;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  initialBarcode = '',
}) => {
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Coffee Beans');
  const [currentStock, setCurrentStock] = useState<number>(10);
  const [minThreshold, setMinThreshold] = useState<number>(5);
  const [unit, setUnit] = useState('units');
  const [price, setPrice] = useState<number>(15.0);
  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productToEdit) {
      setSku(productToEdit.sku);
      setBarcode(productToEdit.barcode);
      setName(productToEdit.name);
      setCategory(productToEdit.category);
      setCurrentStock(productToEdit.currentStock);
      setMinThreshold(productToEdit.minThreshold);
      setUnit(productToEdit.unit);
      setPrice(productToEdit.price);
      setSupplierName(productToEdit.supplierName);
      setSupplierEmail(productToEdit.supplierEmail);
    } else {
      setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
      setBarcode(initialBarcode || `${Math.floor(100000000000 + Math.random() * 900000000000)}`);
      setName('');
      setCategory('Coffee Beans');
      setCurrentStock(10);
      setMinThreshold(5);
      setUnit('units');
      setPrice(12.5);
      setSupplierName('');
      setSupplierEmail('');
    }
    setError(null);
  }, [productToEdit, initialBarcode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!barcode.trim()) {
      setError('Barcode is required for scanning.');
      return;
    }
    if (!supplierEmail.trim() || !supplierEmail.includes('@')) {
      setError('Valid supplier contact email is required for reorders.');
      return;
    }
    if (minThreshold < 0 || currentStock < 0) {
      setError('Stock and minimum threshold cannot be negative.');
      return;
    }

    onSave(
      {
        sku: sku.trim(),
        barcode: barcode.trim(),
        name: name.trim(),
        category: category.trim(),
        currentStock: Number(currentStock),
        minThreshold: Number(minThreshold),
        unit: unit.trim() || 'units',
        price: Number(price) || 0,
        supplierName: supplierName.trim() || 'Direct Supplier',
        supplierEmail: supplierEmail.trim(),
      },
      productToEdit ? productToEdit.id : undefined
    );
    onClose();
  };

  const generateRandomBarcode = () => {
    const random12Digits = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    setBarcode(random12Digits);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              {productToEdit ? 'Edit Product' : 'Register New Product'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Set available stock, reorder point threshold, and supplier contact
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ethiopian Yirgacheffe Beans (1kg)"
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                SKU Identifier *
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="COF-ETH-001"
                className="w-full px-3 py-2 text-sm font-mono border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-neutral-700">
                  Barcode (UPC / EAN / 128) *
                </label>
                <button
                  type="button"
                  onClick={generateRandomBarcode}
                  className="text-[11px] text-neutral-500 hover:text-neutral-900 flex items-center gap-1"
                >
                  <Barcode className="w-3 h-3" />
                  <span>Generate code</span>
                </button>
              </div>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="793573192014"
                className="w-full px-3 py-2 text-sm font-mono border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Whole Bean Coffee, Packaging, Dairy"
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Unit of Measure
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="units, bags, cartons, boxes"
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
              />
            </div>

            {/* Inventory Thresholds */}
            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-md md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Current Available Stock *
                </label>
                <input
                  type="number"
                  min="0"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums font-semibold bg-white border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                  required
                />
                <span className="text-[11px] text-neutral-500 mt-1 block">Live shelf count</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Min Threshold (Reorder Point) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums font-semibold bg-white border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                  required
                />
                <span className="text-[11px] text-neutral-500 mt-1 block">Triggers draft below this</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Sale Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                />
                <span className="text-[11px] text-neutral-500 mt-1 block">Unit price</span>
              </div>
            </div>

            {/* Supplier Information */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Supplier Company Name *
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Atlas Coffee Importers"
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Supplier Contact Email *
              </label>
              <input
                type="email"
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
                placeholder="orders@supplier.example.com"
                className="w-full px-3 py-2 text-sm font-mono border border-neutral-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                required
              />
              <span className="text-[11px] text-neutral-500 mt-0.5 block">
                Target for official purchase orders upon your approval
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800 transition-colors shadow-xs"
            >
              {productToEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

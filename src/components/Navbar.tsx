import React from 'react';
import { Package, ScanBarcode, FileText, Mail, CheckCircle2, Plus } from 'lucide-react';
import { GmailConnectButton } from './GmailConnectButton';
import { User } from 'firebase/auth';

interface NavbarProps {
  activeTab: 'inventory' | 'scanner' | 'reorders' | 'outbox' | 'tests';
  onSelectTab: (tab: 'inventory' | 'scanner' | 'reorders' | 'outbox' | 'tests') => void;
  onOpenAddProduct: () => void;
  pendingApprovalsCount: number;
  onAuthChange?: (user: User | null, token: string | null) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenAddProduct,
  pendingApprovalsCount,
  onAuthChange,
}) => {
  return (
    <header className="flex items-center justify-between gap-6 px-6 py-3 bg-white/90 backdrop-blur-md border-b border-neutral-200/70 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all">
      {/* Zone 1: Brand Wordmark (one line, single element) */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-neutral-950 text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-xs ring-1 ring-white/20">
          SP
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-neutral-900 whitespace-nowrap leading-tight">
            StockPulse
          </span>
          <span className="text-[10px] text-neutral-400 font-medium tracking-wide">
            Inventory & Supply Chain
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation Links (single-line, segmented control) */}
      <nav className="flex items-center gap-1 p-1 bg-neutral-100/80 rounded-lg border border-neutral-200/50">
        <button
          type="button"
          onClick={() => onSelectTab('inventory')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'inventory'
              ? 'bg-white text-neutral-950 shadow-xs font-semibold'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Inventory</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('scanner')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'scanner'
              ? 'bg-white text-neutral-950 shadow-xs font-semibold'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
          }`}
        >
          <ScanBarcode className="w-3.5 h-3.5" />
          <span>Barcode Sales</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('reorders')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 relative ${
            activeTab === 'reorders'
              ? 'bg-white text-neutral-950 shadow-xs font-semibold'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Reorders & POs</span>
          {pendingApprovalsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-white rounded-full tabular-nums shadow-xs">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('outbox')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'outbox'
              ? 'bg-white text-neutral-950 shadow-xs font-semibold'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Email Outbox</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('tests')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'tests'
              ? 'bg-white text-neutral-950 shadow-xs font-semibold'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Unit Tests</span>
        </button>
      </nav>

      {/* Zone 3: Actions - Connect Gmail & Add Product */}
      <div className="flex items-center gap-2.5 shrink-0">
        <GmailConnectButton onAuthChange={onAuthChange} />

        <button
          type="button"
          onClick={onOpenAddProduct}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-950 rounded-md hover:bg-neutral-800 transition-all whitespace-nowrap shrink-0 shadow-xs hover:shadow-sm active:translate-y-px"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Product</span>
        </button>
      </div>
    </header>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScanBarcode,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Zap,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Product, ScanLogItem, ReorderOrder, EmailConfig } from '../core/types';
import { ScannerQueue, ScanResult } from '../core/scannerQueue';
import { sounds } from '../utils/audio';

interface SalesScannerViewProps {
  products: Product[];
  orders: ReorderOrder[];
  logs: ScanLogItem[];
  config: EmailConfig;
  scannerQueue: ScannerQueue;
  onScanResult: (result: ScanResult) => void;
  onClearSessionLogs: () => void;
  onOpenAddProductWithBarcode: (barcode: string) => void;
  onNavigateToTab: (tab: 'inventory' | 'scanner' | 'reorders' | 'outbox' | 'tests') => void;
}

export const SalesScannerView: React.FC<SalesScannerViewProps> = ({
  products,
  orders,
  logs,
  config,
  scannerQueue,
  onScanResult,
  onClearSessionLogs,
  onOpenAddProductWithBarcode,
  onNavigateToTab,
}) => {
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState<ScanResult | null>(null);
  const [unknownBarcodeAlert, setUnknownBarcodeAlert] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraScanIntervalRef = useRef<any>(null);

  // USB/Bluetooth Barcode Scanner Hardware Keyboard Intercept Buffer
  const keyBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Focus barcode input on mount and on clicks
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Execute scan through ScannerQueue
  const handleScanBarcode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      setIsProcessing(true);
      try {
        // Enqueue through the serialized queue
        const result = await (scannerQueue as any)._runScan(code);
        setLastScannedResult(result);

        if (result.success) {
          setUnknownBarcodeAlert(null);
          if (result.thresholdReached) {
            sounds.playThresholdAlert();
          } else {
            sounds.playScanBeep();
          }
        } else {
          // Unknown barcode
          sounds.playErrorBeep();
          setUnknownBarcodeAlert(code);
        }

        onScanResult(result);
      } catch (err) {
        console.error('Scan error:', err);
      } finally {
        setIsProcessing(false);
        setManualInput('');
        inputRef.current?.focus();
      }
    },
    [scannerQueue, onScanResult]
  );

  // Listen to rapid keystroke bursts from USB / Bluetooth handheld scanners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in regular text inputs other than barcode input
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (isInput && target !== inputRef.current) {
        return;
      }

      const now = Date.now();
      const timeDelta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (keyBufferRef.current.length >= 3) {
          const barcode = keyBufferRef.current;
          keyBufferRef.current = '';
          e.preventDefault();
          handleScanBarcode(barcode);
        }
      } else if (e.key.length === 1) {
        // Typical barcode scanners type characters in rapid succession (< 50ms)
        if (timeDelta > 80 && keyBufferRef.current.length > 0 && target !== inputRef.current) {
          // Reset buffer if delay too long (manual human typing outside input)
          keyBufferRef.current = '';
        }
        keyBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleScanBarcode]);

  // Form submit for manual input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScanBarcode(manualInput.trim());
    }
  };

  // Camera Barcode Scanning using native BarcodeDetector API
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);

      // Check for native BarcodeDetector API
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
        });

        cameraScanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const detectedCode = barcodes[0].rawValue;
                if (detectedCode && !isProcessing) {
                  handleScanBarcode(detectedCode);
                }
              }
            } catch (err) {
              // Frame scan error
            }
          }
        }, 350);
      }
    } catch (err: any) {
      console.warn('Camera initiation failed:', err);
      setCameraError(err.message || 'Could not open camera stream. Ensure camera permissions are granted.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraScanIntervalRef.current) {
      clearInterval(cameraScanIntervalRef.current);
      cameraScanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const toggleSound = () => {
    const next = sounds.toggleSound();
    setSoundEnabled(next);
  };

  // Test Rapid 5-Scan Burst to demonstrate race condition protection
  const runRapidBurstTest = async (barcode: string) => {
    setIsProcessing(true);
    for (let i = 0; i < 5; i++) {
      handleScanBarcode(barcode);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            Barcode Sales & Stock Decrements
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Scan items to mark as sold. Every scan subtracts 1 unit and triggers supplier reorder drafts if stock hits threshold.
          </p>
        </div>

        {/* Top Controls: Sound & Camera */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${
              soundEnabled
                ? 'bg-neutral-100 border-neutral-300 text-neutral-800'
                : 'bg-white border-neutral-200 text-neutral-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Beep On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={isCameraActive ? stopCamera : startCamera}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${
              isCameraActive
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {isCameraActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
            <span>{isCameraActive ? 'Close Camera' : 'Use Camera'}</span>
          </button>
        </div>
      </div>

      {/* Camera Viewfinder (if active) */}
      {isCameraActive && (
        <div className="p-4 bg-neutral-900 rounded-lg text-white relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-neutral-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Camera Scanner Active
            </span>
            <button
              type="button"
              onClick={stopCamera}
              className="text-xs text-neutral-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="relative max-w-md mx-auto aspect-video bg-black rounded overflow-hidden flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-2 border-emerald-400/60 rounded pointer-events-none m-8 flex items-center justify-center">
              <div className="w-full h-0.5 bg-red-500/80 shadow-md animate-pulse" />
            </div>
          </div>
          <p className="text-[11px] text-neutral-400 text-center mt-2">
            Center product barcode inside the frame. Automatic detection supported on modern devices.
          </p>
        </div>
      )}

      {cameraError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{cameraError} You can also use the USB scanner listener or click the quick scan buttons below.</span>
        </div>
      )}

      {/* Main Scanner Input Box - Sleek Precision Terminal */}
      <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-xl shadow-xl text-white relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20" />
            <span className="text-xs font-mono font-semibold tracking-wider uppercase text-neutral-200">
              POS Scanner Terminal Active
            </span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            USB / Bluetooth / Camera Mode
          </span>
        </div>

        <form onSubmit={handleManualSubmit} className="space-y-4 relative z-10">
          <div className="flex flex-col md:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <div className="absolute left-4 top-3.5 text-neutral-400 flex items-center gap-2">
                <ScanBarcode className="w-5 h-5 text-emerald-400" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Scan barcode with handheld scanner or type digits and press Enter..."
                className="w-full pl-12 pr-4 py-3.5 text-base font-mono bg-neutral-900/90 border border-neutral-700/80 text-white placeholder:text-neutral-500 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 shadow-inner"
                disabled={isProcessing}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing || !manualInput.trim()}
              className="px-6 py-3.5 text-xs md:text-sm font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 rounded-lg transition-all shadow-md hover:shadow-lg whitespace-nowrap shrink-0 flex items-center justify-center gap-2 active:translate-y-px"
            >
              <Zap className="w-4 h-4 fill-neutral-950" />
              <span>Mark Sold (-1 Stock)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-neutral-400 gap-2 pt-1 font-mono">
            <span className="flex items-center gap-1.5 text-neutral-300">
              <span>Auto-capture: Hardware handheld scanners trigger immediately on any screen.</span>
            </span>
            <span className="text-[11px] text-emerald-400/90">
              Atomic Serializer: Zero dropped scans
            </span>
          </div>
        </form>
      </div>

      {/* UNKNOWN BARCODE ALERT (Requirement 2: Handle unknown barcodes gracefully) */}
      {unknownBarcodeAlert && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Unknown Barcode Scanned: <span className="font-mono">{unknownBarcodeAlert}</span>
              </h3>
              <p className="text-xs text-red-700 mt-0.5">
                This barcode does not match any product in your inventory database. Would you like to register it now?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setUnknownBarcodeAlert(null)}
              className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                const code = unknownBarcodeAlert;
                setUnknownBarcodeAlert(null);
                onOpenAddProductWithBarcode(code);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register This Product Now</span>
            </button>
          </div>
        </div>
      )}

      {/* LAST SCAN FEEDBACK CARD */}
      {lastScannedResult && lastScannedResult.success && lastScannedResult.product && (
        <div
          className={`p-4 rounded-lg border transition-all ${
            lastScannedResult.thresholdReached
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {lastScannedResult.thresholdReached ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {lastScannedResult.thresholdReached
                      ? 'Threshold Reached! Draft Reorder Created'
                      : 'Sale Logged Successfully'}
                  </span>
                  <span className="text-xs text-neutral-500 font-mono">
                    · {lastScannedResult.product.sku}
                  </span>
                </div>
                <h4 className="text-base font-bold text-neutral-900 mt-0.5">
                  {lastScannedResult.product.name}
                </h4>
                <div className="flex items-center gap-3 text-xs mt-1 text-neutral-700 font-mono">
                  <span>Quantity Sold: -1</span>
                  <span>·</span>
                  <span>
                    Stock: {lastScannedResult.previousStock} &rarr;{' '}
                    <strong className="text-neutral-900">{lastScannedResult.newStock} {lastScannedResult.product.unit}</strong>
                  </span>
                  <span>·</span>
                  <span>Min Threshold: {lastScannedResult.product.minThreshold}</span>
                </div>
              </div>
            </div>

            {lastScannedResult.thresholdReached && lastScannedResult.reorderCreated && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigateToTab('reorders')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-md transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <span>Review Draft PO ({lastScannedResult.reorderCreated.poNumber})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUICK TEST BARCODE PALETTE */}
      <div className="p-4 bg-white border border-neutral-200 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Quick Barcode Test Palette (Click to Simulate Scan)
            </h3>
            <p className="text-[11px] text-neutral-500">
              Test instant stock decrements and threshold triggers without needing a physical barcode scanner
            </p>
          </div>
          <span className="text-[11px] text-neutral-400 font-mono">
            {products.length} products loaded
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {products.map((p) => {
            const isLow = p.currentStock <= p.minThreshold;
            return (
              <div
                key={p.id}
                className="p-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-md flex items-center justify-between gap-2 transition-colors"
              >
                <div className="truncate flex-1">
                  <div className="text-xs font-semibold text-neutral-900 truncate">{p.name}</div>
                  <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-1.5">
                    <span>{p.barcode}</span>
                    <span>·</span>
                    <span className={isLow ? 'text-amber-700 font-bold' : 'text-neutral-700'}>
                      Stock: {p.currentStock}/{p.minThreshold}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleScanBarcode(p.barcode)}
                    disabled={isProcessing}
                    className="px-2 py-1 text-xs font-medium bg-white hover:bg-neutral-200 border border-neutral-300 rounded text-neutral-800 transition-colors shadow-2xs"
                    title="Simulate 1 Scan"
                  >
                    Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => runRapidBurstTest(p.barcode)}
                    disabled={isProcessing}
                    className="px-2 py-1 text-[11px] font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded transition-colors shadow-2xs"
                    title="Test 5 rapid consecutive scans simultaneously"
                  >
                    5x Burst
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RUNNING SESSION SCAN LOG (Requirement 2: Show a running list of scans in the session) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Running Scan Session Log
            </h3>
            <span className="text-xs font-mono text-neutral-500 tabular-nums">
              ({logs.length} entries)
            </span>
          </div>

          {logs.length > 0 && (
            <button
              type="button"
              onClick={onClearSessionLogs}
              className="text-xs text-neutral-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Session Log</span>
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="p-8 bg-white border border-neutral-200 rounded-lg text-center text-xs text-neutral-500">
            <ScanBarcode className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="font-semibold text-neutral-700">No scans logged in this session yet</p>
            <p className="text-[11px] mt-0.5">
              Scan a product barcode or click one of the quick test buttons above to start logging sales.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Scanned Barcode</th>
                  <th className="py-2.5 px-4 font-semibold">Product Name & SKU</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Change</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Remaining Stock</th>
                  <th className="py-2.5 px-4 font-semibold">Threshold Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono">
                {logs.map((log) => {
                  const isThresholdTrigger = log.status === 'reorder_triggered';
                  const isUnknown = log.status === 'unknown_barcode';

                  return (
                    <tr
                      key={log.id}
                      className={
                        isThresholdTrigger
                          ? 'bg-amber-50/60 hover:bg-amber-50 transition-colors'
                          : isUnknown
                          ? 'bg-red-50/50 hover:bg-red-50 transition-colors'
                          : 'hover:bg-neutral-50 transition-colors'
                      }
                    >
                      <td className="py-2.5 px-4 text-neutral-500 tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-neutral-900">
                        {log.barcode}
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        {log.productName ? (
                          <div>
                            <span className="font-semibold text-neutral-900">{log.productName}</span>
                            <span className="text-[11px] font-mono text-neutral-500 ml-2">
                              {log.sku}
                            </span>
                          </div>
                        ) : (
                          <span className="text-red-600 italic">Unknown Product</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-neutral-900 tabular-nums">
                        {log.quantityChange !== 0 ? log.quantityChange : '0'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                        {log.newStock !== undefined ? (
                          <span className={log.newStock <= (log.minThreshold || 0) ? 'text-amber-700' : 'text-neutral-900'}>
                            {log.newStock} (min: {log.minThreshold})
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        {isThresholdTrigger ? (
                          <span className="inline-flex items-center gap-1 text-amber-800 font-semibold text-[11px]">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Low Stock &bull; Draft PO Triggered</span>
                          </span>
                        ) : isUnknown ? (
                          <span className="text-red-600 font-medium text-[11px]">
                            Unknown Barcode
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium text-[11px]">
                            Stock Nominal
                          </span>
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
    </div>
  );
};

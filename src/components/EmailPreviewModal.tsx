import React, { useState } from 'react';
import { X, Mail, Send, Copy, Check, ExternalLink } from 'lucide-react';
import { EmailMessage } from '../core/types';

interface EmailPreviewModalProps {
  email: EmailMessage | null;
  onClose: () => void;
  onApproveIfPending?: (orderId: string) => void;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  email,
  onClose,
  onApproveIfPending,
}) => {
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  const [copied, setCopied] = useState(false);

  if (!email) return null;

  const isDraftToOwner = email.type === 'draft_approval_request';

  const copyText = () => {
    navigator.clipboard.writeText(email.bodyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-neutral-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-neutral-600" />
            <h3 className="text-sm font-bold text-neutral-900">
              {isDraftToOwner
                ? 'Draft Approval Request (Sent to Owner)'
                : 'Purchase Order (Sent to Supplier)'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-neutral-200 p-0.5 rounded text-xs">
              <button
                type="button"
                onClick={() => setViewMode('html')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === 'html'
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Rendered HTML
              </button>
              <button
                type="button"
                onClick={() => setViewMode('text')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === 'text'
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Plain Text
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Envelope Metadata */}
        <div className="px-6 py-3 border-b border-neutral-200 bg-white text-xs space-y-1.5 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500 font-sans">To:</span>
            <span className="font-semibold text-neutral-900">{email.to}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500 font-sans">From:</span>
            <span className="text-neutral-700">{email.from}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500 font-sans">Subject:</span>
            <span className="font-bold text-neutral-900 font-sans">{email.subject}</span>
          </div>
          <div className="flex items-center justify-between text-neutral-400 text-[11px]">
            <span className="font-sans">Timestamp:</span>
            <span>{new Date(email.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Email Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-neutral-100">
          {viewMode === 'html' ? (
            <div
              className="bg-white rounded border border-neutral-200 p-6 shadow-xs"
              dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
            />
          ) : (
            <pre className="bg-neutral-900 text-neutral-100 p-4 rounded text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {email.bodyText}
            </pre>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-neutral-200 bg-white">
          <button
            type="button"
            onClick={copyText}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 bg-neutral-50 border border-neutral-200 rounded transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Content'}</span>
          </button>

          <div className="flex items-center gap-2">
            {isDraftToOwner && onApproveIfPending && (
              <button
                type="button"
                onClick={() => {
                  onApproveIfPending(email.orderId);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Approve & Dispatch Now</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

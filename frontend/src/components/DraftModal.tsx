import { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, Mail } from 'lucide-react';
import axios from 'axios';
import type { Job } from '../types';

interface DraftModalProps {
  job: Job;
  onClose: () => void;
}

export function DraftModal({ job, onClose }: DraftModalProps) {
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(
    job.draft_email ?? null
  );
  const [isLoading, setIsLoading] = useState(!job.draft_email);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'subject' | 'body' | 'all' | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (job.draft_email) return;

    setIsLoading(true);
    setError(null);

    axios
      .post<{ subject: string; body: string }>(`/api/jobs/${job.id}/draft`)
      .then((res) => {
        setDraft(res.data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail ?? 'Failed to generate draft');
        setIsLoading(false);
      });
  }, [job.id, job.draft_email]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function copyToClipboard(text: string, field: 'subject' | 'body' | 'all') {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md"
      onClick={handleOverlayClick}
      id="draft-modal-overlay"
    >
      <div
        className="relative bg-[#0d0d12]/95 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col job-card-animate"
        id="draft-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Email Draft"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
              <Mail size={14} className="pulse-health" />
            </div>
            <span className="text-base font-bold text-white font-display">Email Draft Pitch</span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-xs text-gray-500 font-mono truncate max-w-[240px]">
              {job.title} @ {job.company}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white hover:bg-white/5 transition-all p-1.5 rounded-xl border border-transparent hover:border-white/5"
            id="close-draft-modal"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4.5">
          {isLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-4.5 bg-white/5 rounded-lg w-1/4" />
              <div className="h-12 bg-white/5 rounded-lg" />
              <div className="h-4.5 bg-white/5 rounded-lg w-1/3 mt-6" />
              <div className="h-56 bg-white/5 rounded-lg" />
            </div>
          )}

          {error && (
            <div className="p-4.5 bg-red-500/10 border border-red-500/15 text-red-400 text-xs font-semibold rounded-xl uppercase tracking-wider font-mono">
              ⚠ {error}
            </div>
          )}

          {draft && !isLoading && (
            <>
              {/* Subject Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="draft-subject"
                    className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono"
                  >
                    Subject Line
                  </label>
                  <button
                    className="text-xs font-bold text-gray-500 hover:text-white flex items-center gap-1 transition-colors font-mono uppercase tracking-wider bg-white/5 border border-white/5 px-2.5 py-1 rounded"
                    onClick={() => copyToClipboard(draft.subject, 'subject')}
                    id="copy-subject-btn"
                  >
                    {copiedField === 'subject' ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                    {copiedField === 'subject' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <textarea
                  id="draft-subject"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  rows={2}
                  className="w-full bg-black/45 border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-200 font-mono focus:outline-none focus:border-white/15 resize-none leading-relaxed"
                />
              </div>

              {/* Email Body Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="draft-body"
                    className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono"
                  >
                    Draft Body
                  </label>
                  <button
                    className="text-xs font-bold text-gray-500 hover:text-white flex items-center gap-1 transition-colors font-mono uppercase tracking-wider bg-white/5 border border-white/5 px-2.5 py-1 rounded"
                    onClick={() => copyToClipboard(draft.body, 'body')}
                    id="copy-body-btn"
                  >
                    {copiedField === 'body' ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                    {copiedField === 'body' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <textarea
                  id="draft-body"
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={11}
                  className="w-full bg-black/45 border border-white/5 rounded-xl px-4 py-4 text-sm text-gray-300 font-sans leading-relaxed focus:outline-none focus:border-white/15 resize-y font-medium selection:bg-blue-500/30 selection:text-white"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer controls */}
        {draft && !isLoading && (
          <div className="px-6 py-4.5 border-t border-white/5 bg-white/[0.01] flex items-center justify-between gap-3">
            <button
              onClick={() =>
                copyToClipboard(
                  `Subject: ${draft.subject}\n\n${draft.body}`,
                  'all'
                )
              }
              className="flex items-center gap-2 px-4.5 py-2.5 text-sm font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/15 rounded-xl transition-all"
              id="copy-all-btn"
            >
              {copiedField === 'all' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copiedField === 'all' ? 'Copied All' : 'Copy Full Draft'}
            </button>
            
            <button
              onClick={onClose}
              className="px-4.5 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-300 transition-colors"
              id="close-draft-footer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

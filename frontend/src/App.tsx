import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilterBar } from './components/FilterBar';
import { JobCard } from './components/JobCard';
import { DraftModal } from './components/DraftModal';
import { useJobs } from './hooks/useJobs';
import { useRefresh } from './hooks/useRefresh';
import type { Job, FilterState } from './types';

const DEFAULT_FILTERS: FilterState = {
  verdict: 'all',
  sources: [],
  minScore: 6,
  status: 'all',
  showHidden: false,
  q: '',
};

function Dashboard() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draftJob, setDraftJob] = useState<Job | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    return !sessionStorage.getItem('jr_demo_dismissed');
  });

  const [setupTab, setSetupTab] = useState<'pipeline' | 'mlx'>('pipeline');

  const { jobs, stats, isLoading, error } = useJobs(filters);
  const { isRefreshing, triggerRefresh } = useRefresh();

  const isShowcase = (import.meta as any).env.VITE_SHOWCASE_MODE === 'true';

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        totalVisible={jobs.length}
        stats={stats}
        isRefreshing={isRefreshing}
        onRefresh={triggerRefresh}
        isShowcase={isShowcase}
        onShowDemoInfo={() => setShowWelcomeModal(true)}
      />

      <main className="max-w-5xl mx-auto px-6 py-6">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#141414] border border-[#222] rounded-xl p-4 animate-pulse h-40"
              />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
            <p className="text-red-400 text-sm mb-2">Failed to load jobs</p>
            <p className="text-gray-600 text-xs">
              Make sure the backend is running at localhost:8000
            </p>
          </div>
        )}

        {!isLoading && !error && jobs.length === 0 && (
          <div className="py-24 text-center">
            <p className="text-gray-600 text-sm mb-2">No jobs match your filters</p>
            <button
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              id="reset-filters-btn"
            >
              Reset filters
            </button>
          </div>
        )}

        {!isLoading && !error && jobs.length > 0 && (
          <div className="space-y-4">
            {jobs.map((job, index) => (
              <div
                key={job.id}
                className="job-card-animate"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <JobCard
                  job={job}
                  onDraftEmail={setDraftJob}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Premium Footer */}
      <footer className="bg-[#070709] border-t border-[hsl(240,6%,14%)] mt-24 py-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_center,rgba(16,185,129,0.02),transparent_70%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-xs text-gray-500 relative z-10">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <p className="text-gray-200 font-extrabold text-base tracking-wide font-display flex items-center justify-center md:justify-start gap-2">
              JobRadar <span className="text-emerald-400 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 font-mono">V2.1</span>
            </p>
            <p className="max-w-sm text-gray-500 leading-relaxed text-[11px]">
              AI-powered local web scraping & scoring pipeline for developer job hunting. Completely local-first, customizable, and respects your privacy.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 font-semibold text-gray-400">
            <a
              href="https://github.com/Haamid-syed/Job-Scraper"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 group"
            >
              <span>GitHub Repository</span>
              <span className="text-gray-600 group-hover:text-emerald-400 transition-colors">↗</span>
            </a>
            <a
              href="https://www.linkedin.com/in/haamidsyed/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 group"
            >
              <span>LinkedIn</span>
              <span className="text-gray-600 group-hover:text-emerald-400 transition-colors">↗</span>
            </a>
            <button
              onClick={() => {
                setShowWelcomeModal(false);
                setShowSetupModal(true);
              }}
              className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer font-semibold bg-transparent border-0 p-0"
            >
              <span>Setup Guide</span>
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-10 pt-8 border-t border-[#121216]/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-gray-600 relative z-10">
          <p>© {new Date().getFullYear()} JobRadar. Developed by Haamid.</p>
          {isShowcase && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Static Demo Mode Active</span>
            </div>
          )}
        </div>
      </footer>

      {/* Draft email modal portal */}
      {draftJob && (
        <DraftModal
          job={draftJob}
          onClose={() => setDraftJob(null)}
        />
      )}

      {/* Run Locally Guide Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all duration-300">
          <div className="bg-[#111] border border-[#222] rounded-2xl max-w-xl w-full p-6 relative shadow-2xl animate-scale-up">
            <button
              onClick={() => setShowSetupModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors text-sm cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-gray-200 mb-2 flex items-center gap-2">
              Run JobRadar Locally
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              JobRadar is designed to run completely offline on your own machine. Configure your custom tech stack, skills, and calibrations for a private, zero-cost job tracker!
            </p>

            {/* Tab Navigation */}
            <div className="flex border-b border-[#222] mb-5">
              <button
                onClick={() => setSetupTab('pipeline')}
                className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${setupTab === 'pipeline'
                    ? 'border-emerald-500 text-emerald-400 font-bold'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
              >
                1. Core Pipeline Setup
              </button>
              <button
                onClick={() => setSetupTab('mlx')}
                className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${setupTab === 'mlx'
                    ? 'border-emerald-500 text-emerald-400 font-bold'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
              >
                2. Apple Silicon Local LLM Scorer (MLX)
              </button>
            </div>

            {setupTab === 'pipeline' ? (
              <div className="space-y-4 text-sm max-h-[380px] overflow-y-auto pr-1">
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">1. Clone & Set Up Configuration</h3>
                  <pre className="bg-[#181818] border border-[#2c2c2c] rounded-lg p-2.5 text-[11px] font-mono text-gray-300 overflow-x-auto">
                    <code>{`git clone https://github.com/Haamid-syed/Job-Scraper.git
cd Job-Scraper
cp config.yaml config.local.yaml`}</code>
                  </pre>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Open <code>config.yaml</code> to add your tech stack, skills, and custom calibrations.
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">2. Spin up FastAPI Backend</h3>
                  <pre className="bg-[#181818] border border-[#2c2c2c] rounded-lg p-2.5 text-[11px] font-mono text-gray-300 overflow-x-auto">
                    <code>{`cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python main.py`}</code>
                  </pre>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">3. Spin up Frontend UI</h3>
                  <pre className="bg-[#181818] border border-[#2c2c2c] rounded-lg p-2.5 text-[11px] font-mono text-gray-300 overflow-x-auto">
                    <code>{`cd frontend
npm install
npm run dev`}</code>
                  </pre>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm max-h-[380px] overflow-y-auto pr-1">
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5 text-xs text-gray-400 mb-2 leading-relaxed">
                  <strong className="text-emerald-400 font-bold block mb-1">Zero-Cost Offline Scoring</strong>
                  JobRadar features a specialized, fully offline fallback tier that scores scraped jobs directly inside Apple Silicon Unified Memory using highly efficient, quantized MLX models (Phi-4-mini & Qwen3.5-4B).
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">1. Install MLX LM Engine</h3>
                  <p className="text-[11px] text-gray-500 mb-2">Inside your backend virtual environment, run the following to install Apple Silicon MLX bindings:</p>
                  <pre className="bg-[#181818] border border-[#2c2c2c] rounded-lg p-2.5 text-[11px] font-mono text-gray-300 overflow-x-auto">
                    <code>{`pip install mlx-lm`}</code>
                  </pre>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">2. Pre-Download Local Models</h3>
                  <p className="text-[11px] text-gray-500 mb-2">Download the lightweight instruct models to your local device (one-time setup, ~5GB total):</p>
                  <pre className="bg-[#181818] border border-[#2c2c2c] rounded-lg p-2.5 text-[11px] font-mono text-gray-300 overflow-x-auto">
                    <code>{`python -m intelligence.local_scorer --setup`}</code>
                  </pre>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">3. Enable Fallback in Configuration</h3>
                  <p className="text-[11px] text-gray-500 mb-2">Open <code>config.yaml</code> and make sure <code>local_fallback</code> is set to <code>true</code>:</p>
                  <pre className="bg-[#181818] border border-[#2c2c2c] rounded-lg p-2.5 text-[11px] font-mono text-gray-300 overflow-x-auto">
                    <code>{`llm:
  local_fallback:
    enabled: true
    models:
      - "mlx-community/Phi-4-mini-instruct-4bit"
      - "mlx-community/Qwen3.5-4B-MLX-4bit"`}</code>
                  </pre>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-[#222] flex justify-end">
              <button
                onClick={() => setShowSetupModal(false)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer border-none shadow-md shadow-emerald-500/10"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome / Demo Showcase Modal on Entry */}
      {isShowcase && showWelcomeModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-all duration-300">
          <div className="bg-[#111]/90 border border-white/10 rounded-2xl max-w-md w-full p-8 relative shadow-[0_0_50px_rgba(16,185,129,0.1)] animate-scale-up text-center backdrop-blur-xl">
            <button
              onClick={() => {
                sessionStorage.setItem('jr_demo_dismissed', 'true');
                setShowWelcomeModal(false);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors text-sm cursor-pointer p-1.5 rounded-full hover:bg-white/5 bg-transparent border-none"
              aria-label="Close dialog"
            >
              ✕
            </button>

            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 mb-5 border border-emerald-500/20 text-lg font-mono font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              JR
            </div>

            <h2 className="text-xl font-bold text-gray-100 mb-2">
              Welcome to JobRadar
            </h2>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4">
              Automated Developer Job Pipeline
            </p>
            <div className="text-xs text-gray-400 leading-relaxed mb-6 text-left bg-[#161616] p-4 rounded-xl border border-white/5 space-y-3.5">
              <p>
                This deployment is a <strong>static showcase</strong> displaying a curated snapshot of developer positions scored and matched by Gemini against the custom credentials inside <code>config.yaml</code>.
              </p>
              
              <div className="border-t border-white/5 pt-3">
                <strong className="text-gray-200 font-bold block mb-1.5 uppercase tracking-wider text-[10px]">Showcase Target Profile (config.yaml):</strong>
                <ul className="list-disc pl-4 space-y-1 text-gray-400">
                  <li><strong>Candidate Name:</strong> Alex Developer (1 Year of Experience)</li>
                  <li><strong>Primary Stack:</strong> React.js, Next.js, Node.js, TypeScript, Python</li>
                  <li><strong>Niche Stack:</strong> Solidity, Rust, Smart Contracts, EVM, Cryptography</li>
                </ul>
              </div>

              <div className="border-t border-white/5 pt-3">
                <strong className="text-red-400 font-bold block mb-1.5 uppercase tracking-wider text-[10px]">Automated Red Flag Bullet Points:</strong>
                <ul className="list-disc pl-4 space-y-1 text-gray-400">
                  <li><strong>Experience Mismatch:</strong> Jobs demanding 2+, 3+, or 5+ years of experience trigger a red flag bullet point (since Alex has 1 YOE).</li>
                  <li><strong>Location Bounds:</strong> Local or hybrid restrictions (e.g. London, Los Angeles) trigger a red flag bullet point against Alex's preference for Remote work.</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  sessionStorage.setItem('jr_demo_dismissed', 'true');
                  setShowWelcomeModal(false);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-all shadow-md shadow-emerald-500/10 flex-1 cursor-pointer border-none"
              >
                Explore Demo
              </button>
              <button
                onClick={() => {
                  setShowWelcomeModal(false);
                  setShowSetupModal(true);
                }}
                className="bg-[#222] hover:bg-[#2c2c2c] text-gray-300 text-xs font-semibold px-5 py-2.5 rounded-lg border border-[#333] transition-all flex-1 cursor-pointer"
              >
                Setup Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

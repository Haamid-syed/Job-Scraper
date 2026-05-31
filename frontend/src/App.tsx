import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatsBar } from './components/StatsBar';
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

  const { jobs, stats, isLoading, error } = useJobs(filters);
  const { isRefreshing, triggerRefresh } = useRefresh();

  const isShowcase = (import.meta as any).env.VITE_SHOWCASE_MODE === 'true';

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {isShowcase && (
        <div className="bg-[#111] border-b border-[#222] py-4 px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                PROD DEMO DASHBOARD
              </span>
            </div>
            <h1 className="text-sm font-bold text-gray-200">
              JobRadar: AI-Powered Local Web Scraping & Job Scoring Pipeline
            </h1>
            <p className="text-xs text-gray-400 leading-relaxed">
              This hosted site is a <strong>static showcase</strong> displaying 10 real scraped jobs from each of the 12 active sources (LinkedIn, Glassdoor, Indeed, YC, HN, Lever/Greenhouse boards, etc.). To start scraping and scoring jobs privately with your own Gemini API key, you can run this tool natively on your own machine.
            </p>
          </div>
          <button
            onClick={() => setShowSetupModal(true)}
            className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-4 py-2.5 rounded-lg border border-emerald-500/20 transition-all duration-200 flex items-center gap-2"
          >
            <span>💻</span> View Setup & Clone Guide
          </button>
        </div>
      )}

      <StatsBar
        stats={stats}
        isRefreshing={isRefreshing}
        onRefresh={triggerRefresh}
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        totalVisible={jobs.length}
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
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors text-sm"
            >
              ✕
            </button>
            
            <h2 className="text-lg font-bold text-gray-200 mb-2 flex items-center gap-2">
              <span>💻</span> Run JobRadar Locally
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              JobRadar is designed to run completely offline on your own machine. Configure your custom tech stack, skills, and scoring calibrations for a private, zero-cost job tracker!
            </p>
            
            <div className="space-y-5 text-sm">
              <div>
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">1. Clone & Set Up Configuration</h3>
                <pre className="bg-[#181818] border border-[#2c2c2c] rounded-lg p-2.5 text-[11px] font-mono text-gray-300 overflow-x-auto">
                  <code>{`git clone https://github.com/haamidsyed/Job_Scraper.git
cd Job_Scraper
cp config.yaml config.local.yaml`}</code>
                </pre>
                <p className="text-[10px] text-gray-500 mt-1">
                  Add your Gemini API key inside <code>config.yaml</code>.
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

            <div className="mt-6 pt-4 border-t border-[#222] flex justify-end">
              <button
                onClick={() => setShowSetupModal(false)}
                className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all"
              >
                Got it
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

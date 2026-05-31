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

  const { jobs, stats, isLoading, error } = useJobs(filters);
  const { isRefreshing, triggerRefresh } = useRefresh();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
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

import { useState, useEffect, useRef } from 'react';
import type { FilterState, JobStats } from '../types';
import { Search, SlidersHorizontal, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { SourceHealthBar } from './SourceHealthBar';
import jobsSnapshot from '../jobs_snapshot.json';

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalVisible: number;
  stats: JobStats | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  isShowcase?: boolean;
  onShowDemoInfo?: () => void;
}

const VERDICTS = [
  { value: 'all', label: 'All' },
  { value: 'apply', label: 'Apply', color: 'hsl(160, 84%, 58%)' },
  { value: 'maybe', label: 'Maybe', color: 'hsl(38, 100%, 62%)' },
  { value: 'skip', label: 'Skip', color: 'hsl(350, 85%, 60%)' },
] as const;

const SOURCES = [
  { value: 'hn', label: 'HN', dot: 'hsl(25, 95%, 55%)' },
  { value: 'yc', label: 'YC', dot: 'hsl(5, 85%, 55%)' },
  { value: 'wellfound', label: 'WF', dot: 'hsl(155, 70%, 50%)' },
  { value: 'linkedin', label: 'LI', dot: 'hsl(210, 85%, 55%)' },
  { value: 'remotive', label: 'RM', dot: 'hsl(270, 65%, 60%)' },
  { value: 'ats_boards', label: 'ATS', dot: 'hsl(190, 85%, 50%)' },
  { value: 'remoteok', label: 'ROK', dot: 'hsl(170, 60%, 45%)' },
  { value: 'indeed', label: 'IND', dot: 'hsl(230, 65%, 55%)' },
  { value: 'devto', label: 'DEV', dot: 'hsl(80, 65%, 50%)' },
  { value: 'glassdoor', label: 'GD', dot: 'hsl(200, 80%, 55%)' },
  { value: 'remotehunter', label: 'RH', dot: 'hsl(330, 70%, 55%)' },
  { value: 'sourcingxpress', label: 'SX', dot: 'hsl(38, 85%, 55%)' },
] as const;

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
] as const;

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function FilterBar({
  filters,
  onChange,
  totalVisible,
  stats,
  isRefreshing,
  onRefresh,
  isShowcase,
  onShowDemoInfo,
}: FilterBarProps) {
  const isShowcaseMode = (import.meta as any).env.VITE_SHOWCASE_MODE === 'true';
  const snapshotSources = isShowcaseMode
    ? Array.from(new Set((jobsSnapshot.jobs as any[]).map(j => j.source)))
    : [];

  const visibleSources = SOURCES.filter(s => !isShowcaseMode || snapshotSources.includes(s.value));

  const [localQ, setLocalQ] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = useRef(filters);
  const onChangeRef = useRef(onChange);
  filtersRef.current = filters;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (localQ !== filtersRef.current.q) {
        onChangeRef.current({ ...filtersRef.current, q: localQ });
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localQ]);

  function toggleSource(src: string) {
    const isSelected = filters.sources.includes(src);
    const next = isSelected ? [] : [src];
    onChange({ ...filters, sources: next });
  }

  const activeFilterCount = [
    filters.verdict !== 'all',
    filters.status !== 'all',
    filters.minScore > 0,
    filters.showHidden,
  ].filter(Boolean).length;

  return (
    <div className="sticky top-0 z-30 border-b border-[hsl(240,6%,14%)] px-6 py-2.5 bg-[hsl(240,12%,3%)]/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto space-y-3">
        
        {/* Unified Top Navbar Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          
          {/* Left: Branding */}
          <div className="flex items-center justify-between w-full md:w-auto gap-3.5 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center border border-[hsl(160,84%,58%)]/15 overflow-hidden">
                  <img
                    src="/favicon.png"
                    className="w-9 h-9 object-contain scale-[1.3] active:scale-[1.1] transition-transform select-none"
                    alt="JobRadar Logo"
                  />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[hsl(160,84%,58%)] border-2 border-[hsl(240,12%,3%)]" />
              </div>
              <div>
                <h1 className="text-lg font-display tracking-tight text-white flex items-center gap-2.5">
                  <span className="italic font-extrabold">JobRadar</span>
                  <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[hsl(240,5%,48%)] not-italic">
                    V2.1
                  </span>
                  {isShowcase && (
                    <button
                      onClick={onShowDemoInfo}
                      className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-[hsl(38,100%,62%)]/8 border border-[hsl(38,100%,62%)]/20 text-[hsl(38,100%,62%)] hover:bg-[hsl(38,100%,62%)]/15 transition-all flex items-center gap-1 select-none cursor-pointer"
                    >
                      DEMO
                    </button>
                  )}
                </h1>
                {stats && (
                  <p className="text-[10px] text-[hsl(240,5%,35%)] font-medium mt-0.5">
                    Synced <span className="font-mono">{timeAgo(stats.last_refresh)}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Mobile Only: Sync & Health grouped together in the top-right */}
            <div className="flex items-center gap-2 md:hidden">
              <SourceHealthBar />
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-[hsl(240,6%,14%)] hover:border-[hsl(240,6%,22%)] text-[hsl(240,5%,48%)] hover:text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.97]"
              >
                <RefreshCw
                  size={12}
                  className={`transition-transform duration-700 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                {isRefreshing ? 'Syncing...' : 'Sync'}
              </button>
            </div>
          </div>

          {/* Center (Top Mid): Stats Pills (Left) and Search / Refine (Right) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-1 w-full md:w-auto">
            {/* Stats Metrics pills next to it in center row */}
            {stats && (
              <div className="flex items-center gap-1 justify-center shrink-0">
                <MetricPill label="Today" value={stats.new_today} color="hsl(210, 100%, 66%)" />
                <MetricPill label="Niche" value={stats.niche_matches} color="hsl(250, 80%, 68%)" />
                <MetricPill label="Apply" value={stats.by_verdict.apply ?? 0} color="hsl(160, 84%, 58%)" />
                <MetricPill label="Total" value={stats.total_jobs} color="hsl(240, 5%, 52%)" />
              </div>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              {/* Search */}
              <div className="relative w-full sm:w-[160px]">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[hsl(240,5%,30%)]">
                  <Search size={12} />
                </span>
                <input
                  type="text"
                  placeholder="Search..."
                  value={localQ}
                  onChange={(e) => setLocalQ(e.target.value)}
                  className="w-full bg-[hsl(240,8%,7%)] border border-[hsl(240,6%,14%)] focus:border-[hsl(240,6%,22%)] rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-[hsl(0,0%,93%)] placeholder-[hsl(240,5%,30%)] focus:outline-none transition-colors duration-200"
                  id="search-input"
                />
              </div>

              {/* Refine Toggle */}
              <button
                onClick={() => setShowFilters(e => !e)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 shrink-0 ${showFilters
                    ? 'bg-[hsl(210,100%,66%)]/8 border-[hsl(210,100%,66%)]/20 text-[hsl(210,100%,66%)]'
                    : 'bg-white/[0.02] border-[hsl(240,6%,14%)] text-[hsl(240,5%,48%)] hover:text-white hover:border-[hsl(240,6%,22%)]'
                  }`}
              >
                <SlidersHorizontal size={12} />
                <span>Refine</span>
                {activeFilterCount > 0 && (
                  <span className="w-3.5 h-3.5 rounded-full bg-[hsl(210,100%,66%)]/15 text-[hsl(210,100%,66%)] text-[8px] font-mono font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Right: Health & Sync button (Desktop Only) */}
          <div className="hidden md:flex items-center justify-end gap-3 shrink-0">
            <SourceHealthBar />
            <button
              id="refresh-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-[hsl(240,6%,14%)] hover:border-[hsl(240,6%,22%)] text-[hsl(240,5%,48%)] hover:text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.97]"
            >
              <RefreshCw
                size={12}
                className={`transition-transform duration-700 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              {isRefreshing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {/* Expandable filters panel */}
        <div className={`transition-all duration-300 ease-out overflow-hidden ${showFilters ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
          }`}>
          <div className="pt-3 pb-1 border-t border-[hsl(240,6%,14%)]/50 space-y-4">
            {/* Filter groups row */}
            <div className="flex flex-wrap gap-5 items-end">
              {/* Verdict */}
              <div className="space-y-1.5">
                <span className="serif-heading text-[11px]">Verdict</span>
                <div className="flex items-center bg-[hsl(240,8%,5%)] border border-[hsl(240,6%,14%)] rounded-lg p-0.5">
                  {VERDICTS.map((v) => {
                    const isActive = filters.verdict === v.value;
                    return (
                      <button
                        key={v.value}
                        id={`verdict-${v.value}`}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${isActive
                            ? 'bg-white/[0.06] text-white shadow-sm'
                            : 'text-[hsl(240,5%,38%)] hover:text-[hsl(240,5%,60%)]'
                          }`}
                        style={isActive && 'color' in v ? { color: v.color } : undefined}
                        onClick={() => onChange({ ...filters, verdict: v.value as FilterState['verdict'] })}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <span className="serif-heading text-[11px]">Status</span>
                <div className="flex items-center bg-[hsl(240,8%,5%)] border border-[hsl(240,6%,14%)] rounded-lg p-0.5">
                  {STATUSES.map((s) => {
                    const isActive = filters.status === s.value;
                    return (
                      <button
                        key={s.value}
                        id={`status-${s.value}`}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${isActive
                            ? 'bg-white/[0.06] text-white shadow-sm'
                            : 'text-[hsl(240,5%,38%)] hover:text-[hsl(240,5%,60%)]'
                          }`}
                        onClick={() => onChange({ ...filters, status: s.value as FilterState['status'] })}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Min Score */}
              <div className="space-y-1.5">
                <span className="serif-heading text-[11px]">Min Score</span>
                <div className="flex items-center gap-2.5 bg-[hsl(240,8%,5%)] border border-[hsl(240,6%,14%)] rounded-lg px-3.5 py-1.5 h-[36px]">
                  <input
                    type="range"
                    min={0}
                    max={12}
                    value={filters.minScore}
                    onChange={(e) => onChange({ ...filters, minScore: parseInt(e.target.value) })}
                    className="w-20 accent-[hsl(210,100%,66%)] h-1 bg-[hsl(240,6%,14%)] rounded-lg cursor-pointer"
                    id="min-score-slider"
                  />
                  <span className="text-xs font-mono font-bold text-[hsl(210,100%,66%)] w-4 text-center">{filters.minScore}</span>
                </div>
              </div>

              {/* Show Hidden */}
              <div className="space-y-1.5">
                <span className="serif-heading text-[11px]">Skipped</span>
                <button
                  onClick={() => onChange({ ...filters, showHidden: !filters.showHidden })}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border h-[36px] transition-all duration-200 ${filters.showHidden
                      ? 'bg-[hsl(210,100%,66%)]/8 border-[hsl(210,100%,66%)]/20 text-[hsl(210,100%,66%)]'
                      : 'bg-[hsl(240,8%,5%)] border-[hsl(240,6%,14%)] text-[hsl(240,5%,38%)] hover:text-[hsl(240,5%,60%)]'
                    }`}
                  id="show-hidden-toggle"
                >
                  {filters.showHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>{filters.showHidden ? 'Visible' : 'Hidden'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Source chips list — full row width */}
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-[hsl(240,6%,14%)]/20">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="serif-heading text-[11px] mr-1">Sources</span>
            {visibleSources.map((s) => {
              const isSelected = filters.sources.includes(s.value);
              const isNoneSelected = filters.sources.length === 0;

              return (
                <button
                  key={s.value}
                  id={`source-${s.value}`}
                  className={`flex items-center gap-1.5 border rounded-md transition-all duration-200 py-1 px-2.5 text-[10px] font-mono font-semibold tracking-wider uppercase ${isNoneSelected
                      ? 'border-[hsl(240,6%,14%)] text-[hsl(240,5%,48%)] bg-transparent hover:bg-white/[0.03] hover:border-[hsl(240,6%,22%)]'
                      : isSelected
                        ? 'border-[hsl(240,6%,22%)] text-white bg-white/[0.04] shadow-sm'
                        : 'border-transparent text-[hsl(240,5%,25%)] bg-transparent hover:text-[hsl(240,5%,40%)]'
                    }`}
                  onClick={() => toggleSource(s.value)}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: s.dot,
                      opacity: isNoneSelected ? 0.6 : isSelected ? 1 : 0.25,
                    }}
                  />
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Results count text indicator */}
          <span className="text-[10px] font-mono font-bold text-[hsl(240,5%,38%)] tracking-wider uppercase px-2.5 py-1 bg-white/[0.01] rounded-md border border-[hsl(240,6%,14%)]/50 select-none">
            {totalVisible} <span className="text-[hsl(240,5%,25%)]">results</span>
          </span>
        </div>

      </div>
    </div>
  );
}

function MetricPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/[0.02] border border-[hsl(240,6%,14%)] rounded-lg px-2 py-0.5 min-w-[50px] text-[10px] select-none">
      <span className="font-mono font-semibold uppercase tracking-wider text-[hsl(240,5%,38%)]">{label}</span>
      <span className="font-bold font-mono text-xs" style={{ color }}>{value}</span>
    </div>
  );
}

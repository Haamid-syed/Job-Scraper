import { useState, useEffect, useRef } from 'react';
import type { FilterState } from '../types';
import { Search, SlidersHorizontal, Eye, EyeOff } from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalVisible: number;
}

const VERDICTS = [
  { value: 'all', label: 'All Fits' },
  { value: 'apply', label: 'Apply', colorClass: 'hover:border-green-500/30 hover:bg-green-500/5' },
  { value: 'maybe', label: 'Maybe', colorClass: 'hover:border-amber-500/30 hover:bg-amber-500/5' },
  { value: 'skip', label: 'Skip', colorClass: 'hover:border-red-500/30 hover:bg-red-500/5' },
] as const;

const SOURCES = [
  { value: 'hn', label: 'HN', color: 'text-orange-400 border-orange-500/15 bg-orange-500/10 hover:border-orange-400/40' },
  { value: 'yc', label: 'YC', color: 'text-red-400 border-red-500/15 bg-red-500/10 hover:border-red-400/40' },
  { value: 'wellfound', label: 'WF', color: 'text-emerald-400 border-emerald-500/15 bg-emerald-500/10 hover:border-emerald-400/40' },
  { value: 'linkedin', label: 'LI', color: 'text-blue-400 border-blue-500/15 bg-blue-500/10 hover:border-blue-400/40' },
  { value: 'remotive', label: 'RM', color: 'text-purple-400 border-purple-500/15 bg-purple-500/10 hover:border-purple-400/40' },
  { value: 'ats_boards', label: 'ATS', color: 'text-cyan-400 border-cyan-500/15 bg-cyan-500/10 hover:border-cyan-400/40' },
  { value: 'remoteok', label: 'ROK', color: 'text-teal-400 border-teal-500/15 bg-teal-500/10 hover:border-teal-400/40' },
  { value: 'indeed', label: 'IND', color: 'text-indigo-400 border-indigo-500/15 bg-indigo-500/10 hover:border-indigo-400/40' },
  { value: 'devto', label: 'DEV', color: 'text-lime-400 border-lime-500/15 bg-lime-500/10 hover:border-lime-400/40' },
  { value: 'glassdoor', label: 'GD', color: 'text-sky-400 border-sky-500/15 bg-sky-500/10 hover:border-sky-400/40' },
  { value: 'remotehunter', label: 'RH', color: 'text-pink-400 border-pink-500/15 bg-pink-500/10 hover:border-pink-400/40' },
  { value: 'sourcingxpress', label: 'SX', color: 'text-amber-400 border-amber-500/15 bg-amber-500/10 hover:border-amber-400/40' },
] as const;

const STATUSES = [
  { value: 'all', label: 'All Jobs' },
  { value: 'new', label: 'New' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
] as const;

export function FilterBar({ filters, onChange, totalVisible }: FilterBarProps) {
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
    const next = filters.sources.includes(src)
      ? filters.sources.filter((s) => s !== src)
      : [...filters.sources, src];
    onChange({ ...filters, sources: next });
  }

  return (
    <div className="sticky top-[81px] sm:top-[85px] z-20 bg-black/35 backdrop-blur-lg border-b border-white/5 px-6 py-4">
      <div className="max-w-5xl mx-auto space-y-4">
        
        {/* Row 1: Search, Toggle filters dropdown, visible count */}
        <div className="flex items-center gap-3">
          {/* Search box with Icon */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Filter by position, skills or company..."
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              className="w-full bg-[#121216]/65 border border-white/5 focus:border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none transition-all duration-300 font-medium"
              id="search-input"
            />
          </div>

          {/* Toggle Filters Button */}
          <button
            onClick={() => setShowFilters(e => !e)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
              showFilters 
                ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' 
                : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Refine</span>
          </button>

          {/* Result count */}
          <span className="text-xs font-bold text-gray-500 font-mono tracking-wide uppercase px-3 py-2 bg-white/5 rounded-lg border border-white/5 select-none">
            {totalVisible} jobs
          </span>
        </div>

        {/* Expandable Advanced Filters (Glass container) */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden space-y-4 ${
          showFilters ? 'max-h-[300px] opacity-100 py-1' : 'max-h-0 opacity-0 pointer-events-none'
        }`}>
          
          {/* Verdict Toggles & Status filters */}
          <div className="flex flex-wrap gap-5 items-center">
            {/* Verdict Filter */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 font-mono uppercase tracking-wider">Score Verdict</span>
              <div className="flex items-center bg-black/30 border border-white/5 rounded-xl p-0.5">
                {VERDICTS.map((v) => {
                  const isActive = filters.verdict === v.value;
                  const activeStyle = v.value === 'apply' 
                    ? 'bg-green-500/15 border-green-500/20 text-green-400'
                    : v.value === 'maybe'
                    ? 'bg-amber-500/15 border-amber-500/20 text-amber-400'
                    : v.value === 'skip'
                    ? 'bg-red-500/15 border-red-500/20 text-red-400'
                    : 'bg-white/10 border-white/10 text-white';

                  return (
                    <button
                      key={v.value}
                      id={`verdict-${v.value}`}
                      className={`px-4 py-2 text-sm font-semibold rounded-lg border border-transparent transition-all duration-300 ${
                        isActive 
                          ? `${activeStyle}`
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                      onClick={() => onChange({ ...filters, verdict: v.value as FilterState['verdict'] })}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 font-mono uppercase tracking-wider">Job Status</span>
              <div className="flex items-center bg-black/30 border border-white/5 rounded-xl p-0.5">
                {STATUSES.map((s) => {
                  const isActive = filters.status === s.value;
                  return (
                    <button
                      key={s.value}
                      id={`status-${s.value}`}
                      className={`px-4 py-2 text-sm font-semibold rounded-lg border border-transparent transition-all duration-300 ${
                        isActive
                          ? 'bg-white/10 border-white/10 text-white'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                      onClick={() => onChange({ ...filters, status: s.value as FilterState['status'] })}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Score Slider */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 font-mono uppercase tracking-wider">Min Score</span>
              <div className="flex items-center gap-3 bg-black/20 border border-white/5 rounded-xl px-4 py-2 h-[40px]">
                <input
                  type="range"
                  min={0}
                  max={12}
                  value={filters.minScore}
                  onChange={(e) => onChange({ ...filters, minScore: parseInt(e.target.value) })}
                  className="w-24 accent-blue-500 h-1 bg-white/10 rounded-lg cursor-pointer"
                  id="min-score-slider"
                />
                <span className="text-sm font-mono font-bold text-blue-400 w-4">{filters.minScore}</span>
              </div>
            </div>

            {/* Show Hidden */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 font-mono uppercase tracking-wider">Skipped Roles</span>
              <button
                onClick={() => onChange({ ...filters, showHidden: !filters.showHidden })}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border h-[40px] transition-all duration-300 ${
                  filters.showHidden 
                    ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
                    : 'bg-black/20 border-white/5 text-gray-500 hover:text-gray-300'
                }`}
                id="show-hidden-toggle"
              >
                {filters.showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                <span>{filters.showHidden ? 'Show Skipped' : 'Hide Skipped'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sources Chip Bar */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-gray-500 font-mono uppercase tracking-wider block">Job Sources</span>
          <div className="flex items-center gap-2 flex-wrap">
            {SOURCES.map((s) => {
              const isSelected = filters.sources.includes(s.value);
              const isNoneSelected = filters.sources.length === 0;

              return (
                <button
                  key={s.value}
                  id={`source-${s.value}`}
                  className={`source-chip border transition-all duration-300 py-1.5 px-3.5 text-xs rounded-xl ${
                    isNoneSelected
                      ? `${s.color} opacity-60 hover:opacity-100 hover:translate-y-[-1px]`
                      : isSelected
                      ? `${s.color} hover:translate-y-[-1px] shadow-sm`
                      : 'border-white/5 text-gray-600 bg-transparent hover:text-gray-400 hover:bg-white/5'
                  }`}
                  onClick={() => toggleSource(s.value)}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

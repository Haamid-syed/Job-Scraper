import { RefreshCw, Radar } from 'lucide-react';
import type { JobStats } from '../types';
import { SourceHealthBar } from './SourceHealthBar';

interface StatsBarProps {
  stats: JobStats | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

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

export function StatsBar({ stats, isRefreshing, onRefresh }: StatsBarProps) {
  return (
    <header className="bg-black/10 border-b border-white/5 px-6 py-5 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        
        {/* Main row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 relative">
              <Radar size={18} className="pulse-health text-blue-400" />
              <div className="absolute inset-0 rounded-xl bg-blue-500/5 blur-sm" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide font-display flex items-center gap-2">
                JobRadar
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white/5 border border-white/5 text-gray-500 font-mono">
                  v2.1
                </span>
              </h1>
              {stats && (
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Refreshed <span className="text-gray-400 font-mono">{timeAgo(stats.last_refresh)}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <SourceHealthBar />
            
            <button
              id="refresh-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-gray-300 hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.97]"
            >
              <RefreshCw
                size={14}
                className={`transition-transform duration-700 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Quick Metrics display bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2.5 border-t border-white/5">
            <div className="bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
              <div className="text-xs font-bold text-gray-500 font-mono uppercase tracking-wider">New Today</div>
              <div className="text-2xl font-bold font-display text-blue-400 mt-0.5">{stats.new_today}</div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
              <div className="text-xs font-bold text-gray-500 font-mono uppercase tracking-wider">Niche Fits</div>
              <div className="text-2xl font-bold font-display text-cyan-400 mt-0.5">{stats.niche_matches}</div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
              <div className="text-xs font-bold text-gray-500 font-mono uppercase tracking-wider">Apply Matches</div>
              <div className="text-2xl font-bold font-display text-green-400 mt-0.5">{stats.by_verdict.apply ?? 0}</div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
              <div className="text-xs font-bold text-gray-500 font-mono uppercase tracking-wider">Total Scraped</div>
              <div className="text-2xl font-bold font-display text-gray-300 mt-0.5">{stats.total_jobs}</div>
            </div>
          </div>
        )}

      </div>
    </header>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { HealthResponse, SourceHealth } from '../types';

const SOURCE_LABELS: Record<string, string> = {
  hn: 'HN',
  yc: 'YC',
  wellfound: 'WF',
  linkedin: 'LI',
  remotive: 'RM',
  google: 'GG',
  ats_boards: 'ATS',
  remoteok: 'ROK',
  indeed: 'IND',
  devto: 'DEV',
  glassdoor: 'GD',
  remotehunter: 'RH',
  sourcingxpress: 'SX',
};

function HealthDot({ health }: { health: SourceHealth }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const dotColorClass = health.is_circuit_broken
    ? 'bg-red-500 text-red-500'
    : health.consecutive_failures > 0
    ? 'bg-amber-400 text-amber-400'
    : 'bg-green-500 text-green-500';

  const label = SOURCE_LABELS[health.source] ?? health.source.toUpperCase();

  function formatDate(dt: string | null): string {
    if (!dt) return 'never';
    const d = new Date(dt);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div
      className="relative flex items-center gap-1.5 cursor-pointer py-1 px-1.5 rounded-md hover:bg-white/5 transition-colors"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      id={`health-${health.source}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full pulse-health ${dotColorClass}`} />
      <span className="text-[10px] text-gray-500 font-semibold font-mono tracking-tight">{label}</span>

      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 min-w-[200px] bg-[#0d0d11]/95 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl text-xs space-y-1.5 pointer-events-none">
          <div className="font-bold text-gray-200 border-b border-white/5 pb-1 mb-1 font-mono tracking-wider text-[10px] uppercase">
            {health.source}
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-gray-500">Last success</span>
            <span className="text-gray-300 font-mono">{formatDate(health.last_success_at)}</span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-gray-500">Failures</span>
            <span className={`font-mono font-semibold ${health.consecutive_failures > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
              {health.consecutive_failures}
            </span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span className="text-gray-500">Jobs found</span>
            <span className="text-gray-300 font-mono">{health.jobs_found_last_run}</span>
          </div>
          {health.is_circuit_broken && (
            <div className="text-red-400 text-[10px] border-t border-red-500/10 pt-1 mt-1 font-semibold font-mono uppercase tracking-wider">
              ⚡ Circuit broken
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SourceHealthBar() {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await axios.get<HealthResponse>('/api/health');
      return data;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (!data) return null;

  const overallColor = data.overall === 'healthy'
    ? 'text-green-400 bg-green-400/5 border border-green-500/10'
    : data.overall === 'degraded'
    ? 'text-amber-400 bg-amber-400/5 border border-amber-500/10'
    : 'text-red-400 bg-red-400/5 border border-red-500/10';

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <div className="flex items-center gap-1 bg-black/20 rounded-lg p-0.5 border border-white/5">
        {data.sources.map((h) => (
          <HealthDot key={h.source} health={h} />
        ))}
      </div>
      <span
        className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded uppercase tracking-wider select-none ${overallColor}`}
      >
        {data.overall}
      </span>
    </div>
  );
}

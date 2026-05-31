import type { Job } from '../types';

interface ScoreBadgeProps {
  job: Job;
  compact?: boolean;
}

const DIMENSION_COLORS = {
  role_match: { filled: '#3b82f6', label: 'Role', max: 3, glow: 'rgba(59, 130, 246, 0.25)' },
  seniority_fit: { filled: '#8b5cf6', label: 'Seniority', max: 3, glow: 'rgba(139, 92, 246, 0.25)' },
  reply_odds: { filled: '#06b6d4', label: 'Reply Odds', max: 2, glow: 'rgba(6, 182, 212, 0.25)' },
  recency: { filled: '#f59e0b', label: 'Recency', max: 2, glow: 'rgba(245, 158, 11, 0.25)' },
  niche_bonus: { filled: '#10b981', label: 'Niche Bonus', max: 2, glow: 'rgba(16, 185, 129, 0.25)' },
} as const;

type DimensionKey = keyof typeof DIMENSION_COLORS;

const DIMENSIONS: { key: DimensionKey; field: keyof Job }[] = [
  { key: 'role_match', field: 'score_role_match' },
  { key: 'seniority_fit', field: 'score_seniority' },
  { key: 'reply_odds', field: 'score_reply_odds' },
  { key: 'recency', field: 'score_recency' },
  { key: 'niche_bonus', field: 'score_niche_bonus' },
];

function getVerdictStyle(verdict: Job['score_verdict']) {
  switch (verdict) {
    case 'apply': return 'text-green-400 bg-green-500/10 border-green-500/20 shadow-[0_0_12px_rgba(34,197,94,0.06)]';
    case 'maybe': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'skip': return 'text-red-400 bg-red-500/10 border-red-500/20';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
}

function getTotalColor(total: number): string {
  if (total >= 9) return 'text-green-400';
  if (total >= 6) return 'text-amber-400';
  return 'text-red-400';
}

export function ScoreBadge({ job, compact = false }: ScoreBadgeProps) {
  const verdictStyle = getVerdictStyle(job.score_verdict);
  const totalColor = getTotalColor(job.score_total);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`font-mono text-base font-bold ${totalColor}`}>
          {job.score_total}
        </span>
        <span className={`verdict-badge text-[10px] ${verdictStyle}`}>
          {job.score_verdict}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5 bg-black/20 border border-white/5 rounded-xl p-4 select-none w-fit">
      {/* Core score circle */}
      <div className="flex flex-col items-center justify-center pr-4 border-r border-white/5">
        <div className="text-3xl font-bold font-display leading-none tracking-tight flex items-baseline gap-0.5">
          <span className={totalColor}>{job.score_total}</span>
          <span className="text-xs text-gray-500 font-mono">/12</span>
        </div>
        <span className={`verdict-badge mt-2.5 text-[10px] ${verdictStyle}`}>
          {job.score_verdict}
        </span>
      </div>

      {/* Visual score bars */}
      <div className="flex items-end gap-2.5 h-[52px]">
        {DIMENSIONS.map(({ key, field }) => {
          const dim = DIMENSION_COLORS[key];
          const value = job[field] as number;
          const pct = Math.round((value / dim.max) * 100);

          return (
            <div key={key} className="flex flex-col items-center gap-1 group relative">
              <div className="w-6 h-[40px] bg-white/5 rounded-md overflow-hidden flex flex-col justify-end border border-white/[0.03]">
                <div
                  className="w-full rounded-b-sm transition-all duration-700 ease-out"
                  style={{
                    height: `${pct}%`,
                    backgroundColor: dim.filled,
                    boxShadow: value > 0 ? `0 0 10px ${dim.glow}` : 'none',
                    opacity: value === 0 ? 0.15 : 1,
                  }}
                />
              </div>
              <span className="text-[9px] text-gray-500 font-bold font-mono tracking-tight select-none">
                {dim.label.split(' ')[0][0]}
              </span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                <div className="bg-[#0b0b0e] border border-white/10 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-2xl space-y-1 font-mono">
                  <div className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">{dim.label}</div>
                  <div className="font-bold flex justify-between gap-3 mt-0.5">
                    <span className="text-gray-500">Value</span>
                    <span style={{ color: dim.filled }}>{value} / {dim.max}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

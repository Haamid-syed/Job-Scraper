import { useState } from 'react';
import { ExternalLink, Mail, Bookmark, Check, EyeOff, AlertTriangle, Target, ChevronDown, ChevronUp } from 'lucide-react';
import type { Job } from '../types';
import { ScoreBadge } from './ScoreBadge';
import { useUpdateJobStatus } from '../hooks/useJobs';

interface JobCardProps {
  job: Job;
  onDraftEmail: (job: Job) => void;
}

const SOURCE_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  hn: { label: 'HN', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  yc: { label: 'YC', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  wellfound: { label: 'WF', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  linkedin: { label: 'LI', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  remotive: { label: 'RM', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  ats_boards: { label: 'ATS', bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  remoteok: { label: 'ROK', bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
  indeed: { label: 'IND', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  devto: { label: 'DEV', bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-lime-500/20' },
  glassdoor: { label: 'GD', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  remotehunter: { label: 'RH', bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  sourcingxpress: { label: 'SX', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
};

const STATUS_OVERLAYS: Record<string, string> = {
  saved: 'border-blue-500/25 bg-blue-500/[0.02] shadow-[0_0_24px_rgba(59,130,246,0.03)]',
  applied: 'border-green-500/25 bg-green-500/[0.02] shadow-[0_0_24px_rgba(34,197,94,0.03)]',
  skipped: 'opacity-35 hover:opacity-85 filter grayscale-[30%] scale-[0.99] border-white/5 bg-transparent',
};

const KNOWN_SKILLS = new Set([
  'react', 'next.js', 'node.js', 'express.js', 'typescript', 'python',
  'postgresql', 'docker', 'aws', 'fastapi', 'prisma', 'tailwind css',
  'webrtc', 'websockets', 'socket.io', 'livekit', 'real-time systems',
  'sfu', 'mediasoup',
]);

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'unknown';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export function JobCard({ job, onDraftEmail }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const updateStatus = useUpdateJobStatus();
  const source = SOURCE_STYLES[job.source] ?? { label: job.source.toUpperCase(), bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' };
  const overlayClass = STATUS_OVERLAYS[job.status] ?? '';

  function handleStatus(newStatus: Job['status']) {
    updateStatus.mutate({ jobId: job.id, status: newStatus });
  }

  const isKnownSkill = (skill: string) => KNOWN_SKILLS.has(skill.toLowerCase());

  return (
    <article
      className={`glass-panel glass-panel-hover p-6 relative overflow-hidden transition-all duration-300 ${overlayClass}`}
      id={`job-${job.id}`}
    >
      {/* Absolute status glowing stripes */}
      {job.status === 'applied' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500/20 via-green-500/80 to-green-500/20 opacity-80" />
      )}
      {job.status === 'saved' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/20 via-blue-500/80 to-blue-500/20 opacity-80" />
      )}

      {/* Layout split grid (details left, scoring right) */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
        
        {/* Left Block: Basic details */}
        <div className="flex-1 space-y-3.5 min-w-0">
          {/* Header tags row */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className={`source-chip border ${source.bg} ${source.text} ${source.border}`}>{source.label}</span>
            <span className="text-gray-400 font-bold tracking-tight">{job.company}</span>
            
            {job.job_type === 'internship' && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider font-mono select-none">
                Intern
              </span>
            )}
            
            <span className="text-gray-600 font-semibold font-mono text-xs">{timeAgo(job.posted_at)}</span>
          </div>

          {/* Title */}
          <h2
            className="text-lg sm:text-xl font-bold text-white tracking-wide leading-snug cursor-pointer hover:text-blue-400 transition-colors duration-200"
            onClick={() => setExpanded((e) => !e)}
          >
            {job.title}
          </h2>

          {/* Geographical + Financial tags */}
          <div className="flex items-center gap-2 flex-wrap">
            {job.location && (
              <span className="text-xs font-semibold text-gray-400 bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-lg">
                📍 {job.location}
              </span>
            )}
            {job.salary_range && (
              <span className="text-xs font-semibold text-gray-400 bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-lg">
                💰 {job.salary_range}
              </span>
            )}
            {job.company_size && (
              <span className="text-xs font-semibold text-gray-400 bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-lg">
                👥 {job.company_size}
              </span>
            )}
          </div>
        </div>

        {/* Right Block: Scoring Badges & tags */}
        <div className="flex flex-col items-start md:items-end gap-2 flex-shrink-0">
          {/* Scoring platform badge tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {job.scoring_method === 'heuristic' && (
              <span title="Heuristic score (LLM unavailable)" className="text-[10px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/5 tracking-wider uppercase font-mono">
                ⚡ rules
              </span>
            )}
            {job.scoring_method === 'openrouter' && (
              <span title="Scored via OpenRouter free models" className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 tracking-wider uppercase font-mono">
                ☁ openrouter
              </span>
            )}
            {job.scoring_method === 'local_mlx' && (
              <span title="Scored via local MLX model" className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 tracking-wider uppercase font-mono">
                🖥 local
              </span>
            )}
            {job.score_niche_bonus >= 1 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                <Target size={10} className="pulse-health" />
                Niche
              </span>
            )}
          </div>

          {/* High end Score visualizer chart */}
          <ScoreBadge job={job} />
        </div>

      </div>

      {/* Highlight Score Reason & Red Flags */}
      <div className="mt-4 space-y-2.5">
        {job.score_reason && (
          <p className="text-xs text-gray-500 leading-relaxed italic border-l-2 border-white/10 pl-2.5">
            {job.score_reason}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {/* Red flags */}
          {job.score_red_flags.map((flag, i) => (
            <span
              key={i}
              className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg font-mono uppercase select-none"
            >
              <AlertTriangle size={10} />
              {flag}
            </span>
          ))}

          {/* Stack highlight chips */}
          {job.stack_mentioned.map((tech) => {
            const matchesProfile = isKnownSkill(tech);
            return (
              <span
                key={tech}
                className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg border transition-all duration-300 ${
                  matchesProfile
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/25 shadow-[0_0_8px_rgba(59,130,246,0.06)]'
                    : 'bg-white/[0.02] text-gray-600 border-white/[0.03]'
                }`}
              >
                {tech}
              </span>
            );
          })}
        </div>
      </div>

      {/* Collapsible Full description section */}
      {expanded && job.description && (
        <div className="mt-4 p-4.5 bg-black/45 rounded-xl border border-white/5 job-card-animate">
          <h4 className="text-[11px] font-bold text-gray-500 font-mono uppercase tracking-wider mb-2">Detailed Description</h4>
          <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap font-sans font-medium selection:bg-blue-500/30 selection:text-white">
            {job.description.slice(0, 1500)}
            {job.description.length > 1500 && '...'}
          </p>
        </div>
      )}

      {/* Footer actions row */}
      <div className="flex items-center gap-2 flex-wrap pt-3.5 border-t border-white/5 mt-4">
        <a
          href={job.apply_url}
          target="_blank"
          rel="noopener noreferrer"
          className="action-btn bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 hover:border-white/15 px-4 py-2.5 text-sm"
          id={`apply-${job.id}`}
        >
          <ExternalLink size={14} />
          Apply →
        </a>

        <button
          className="action-btn bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/15 px-4 py-2.5 text-sm"
          onClick={() => onDraftEmail(job)}
          id={`draft-${job.id}`}
        >
          <Mail size={14} />
          Draft Pitch
        </button>

        {/* Inline Action Triggers */}
        <div className="flex items-center gap-2 ml-auto">
          {job.status !== 'saved' && (
            <button
              className="action-btn bg-transparent hover:bg-blue-500/5 text-gray-500 hover:text-blue-400 border border-transparent hover:border-blue-500/10 px-3 py-2 text-sm font-semibold"
              onClick={() => handleStatus('saved')}
              id={`save-${job.id}`}
            >
              <Bookmark size={12} />
              Save
            </button>
          )}
          {job.status !== 'applied' && (
            <button
              className="action-btn bg-transparent hover:bg-green-500/5 text-gray-500 hover:text-green-400 border border-transparent hover:border-green-500/10 px-3 py-2 text-sm font-semibold"
              onClick={() => handleStatus('applied')}
              id={`applied-${job.id}`}
            >
              <Check size={12} />
              Applied
            </button>
          )}
          {job.status !== 'skipped' && (
            <button
              className="action-btn bg-transparent hover:bg-red-500/5 text-gray-500 hover:text-red-400 border border-transparent hover:border-red-500/10 px-3 py-2 text-sm font-semibold"
              onClick={() => handleStatus('skipped')}
              id={`skip-${job.id}`}
            >
              <EyeOff size={12} />
              Skip
            </button>
          )}
          {job.status !== 'new' && (
            <button
              className="text-xs font-bold text-gray-600 hover:text-gray-400 transition-colors font-mono uppercase tracking-wider ml-1.5"
              onClick={() => handleStatus('new')}
              id={`reset-${job.id}`}
            >
              Reset
            </button>
          )}

          <button
            onClick={() => setExpanded(e => !e)}
            className="action-btn bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 px-3 py-2 text-sm"
            aria-label="Expand description"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

    </article>
  );
}

import { useState } from 'react';
import { ExternalLink, Mail, Bookmark, Check, EyeOff, Target, ChevronDown, ChevronUp } from 'lucide-react';
import type { Job } from '../types';
import { ScoreBadge } from './ScoreBadge';
import { useUpdateJobStatus } from '../hooks/useJobs';

interface JobCardProps {
  job: Job;
  onDraftEmail: (job: Job) => void;
}

const SOURCE_META: Record<string, { label: string; dot: string }> = {
  hn: { label: 'HN', dot: 'hsl(25, 95%, 55%)' },
  yc: { label: 'YC', dot: 'hsl(5, 85%, 55%)' },
  wellfound: { label: 'WF', dot: 'hsl(155, 70%, 50%)' },
  linkedin: { label: 'LI', dot: 'hsl(210, 85%, 55%)' },
  remotive: { label: 'RM', dot: 'hsl(270, 65%, 60%)' },
  ats_boards: { label: 'ATS', dot: 'hsl(190, 85%, 50%)' },
  remoteok: { label: 'ROK', dot: 'hsl(170, 60%, 45%)' },
  indeed: { label: 'IND', dot: 'hsl(230, 65%, 55%)' },
  devto: { label: 'DEV', dot: 'hsl(80, 65%, 50%)' },
  glassdoor: { label: 'GD', dot: 'hsl(200, 80%, 55%)' },
  remotehunter: { label: 'RH', dot: 'hsl(330, 70%, 55%)' },
  sourcingxpress: { label: 'SX', dot: 'hsl(38, 85%, 55%)' },
};

const VERDICT_ACCENT: Record<string, string> = {
  apply: 'hsl(160, 84%, 58%)',
  maybe: 'hsl(38, 100%, 62%)',
  skip: 'hsl(350, 85%, 60%)',
  unscored: 'hsl(240, 5%, 30%)',
};

const STATUS_OVERLAYS: Record<string, string> = {
  saved: 'ring-1 ring-[hsl(210,100%,66%)]/12 bg-[hsl(210,100%,66%)]/[0.01]',
  applied: 'ring-1 ring-[hsl(160,84%,58%)]/12 bg-[hsl(160,84%,58%)]/[0.01]',
  skipped: 'opacity-30 hover:opacity-75 grayscale-[25%]',
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
  const source = SOURCE_META[job.source] ?? { label: job.source.toUpperCase(), dot: 'hsl(240, 5%, 40%)' };
  const accentColor = VERDICT_ACCENT[job.score_verdict] ?? VERDICT_ACCENT.unscored;
  const overlayClass = STATUS_OVERLAYS[job.status] ?? '';

  function handleStatus(newStatus: Job['status']) {
    updateStatus.mutate({ jobId: job.id, status: newStatus });
  }

  const isKnownSkill = (skill: string) => KNOWN_SKILLS.has(skill.toLowerCase());

  return (
    <article
      className={`card relative overflow-hidden transition-all duration-300 ${overlayClass}`}
      id={`job-${job.id}`}
    >
      {/* Left accent strip — verdict color */}
      <div
        className="absolute top-0 left-0 w-[3px] h-full rounded-l-xl"
        style={{ backgroundColor: accentColor, opacity: 0.7 }}
      />

      <div className="pl-5 pr-5 py-5">
        {/* Top row: metadata */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Left block */}
          <div className="flex-1 space-y-3 min-w-0">
            {/* Meta tags row */}
            <div className="flex items-center gap-2.5 flex-wrap text-xs">
              {/* Source chip with dot */}
              <span className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-[hsl(240,5%,48%)]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: source.dot }} />
                {source.label}
              </span>

              <span className="text-[hsl(240,6%,18%)]">·</span>

              {/* Company — editorial serif */}
              <span className="font-display italic text-[hsl(0,0%,93%)] text-sm tracking-tight">
                {job.company}
              </span>

              {job.job_type === 'internship' && (
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-[hsl(250,80%,68%)]/8 text-[hsl(250,80%,68%)] border border-[hsl(250,80%,68%)]/15 uppercase tracking-wider select-none">
                  Intern
                </span>
              )}

              <span className="text-[hsl(240,5%,28%)] font-mono text-[11px]">{timeAgo(job.posted_at)}</span>
            </div>

            {/* Title */}
            <h2
              className="text-base sm:text-lg font-semibold text-white tracking-tight leading-snug cursor-pointer hover:text-[hsl(210,100%,66%)] transition-colors duration-200"
              onClick={() => setExpanded((e) => !e)}
            >
              {job.title}
            </h2>

            {/* Location + salary + size — clean inline */}
            <div className="flex items-center gap-2 flex-wrap text-[11px] font-medium text-[hsl(240,5%,42%)]">
              {job.location && (
                <span className="flex items-center gap-1">
                  <span className="text-[hsl(240,5%,28%)]">↗</span> {job.location}
                </span>
              )}
              {job.salary_range && (
                <>
                  <span className="text-[hsl(240,6%,18%)]">·</span>
                  <span>{job.salary_range}</span>
                </>
              )}
              {job.company_size && (
                <>
                  <span className="text-[hsl(240,6%,18%)]">·</span>
                  <span>{job.company_size}</span>
                </>
              )}
            </div>
          </div>

          {/* Right block: scoring badges + visualizer */}
          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            {/* Scoring method + niche badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {job.scoring_method === 'heuristic' && (
                <span title="Heuristic score" className="text-[9px] font-mono font-bold text-[hsl(240,5%,38%)] bg-white/[0.03] px-2 py-0.5 rounded-md border border-[hsl(240,6%,14%)] tracking-wider uppercase">
                  rules
                </span>
              )}
              {job.scoring_method === 'openrouter' && (
                <span title="OpenRouter" className="text-[9px] font-mono font-bold text-[hsl(250,80%,68%)] bg-[hsl(250,80%,68%)]/8 px-2 py-0.5 rounded-md border border-[hsl(250,80%,68%)]/15 tracking-wider uppercase">
                  openrouter
                </span>
              )}
              {job.scoring_method === 'local_mlx' && (
                <span title="Local MLX" className="text-[9px] font-mono font-bold text-[hsl(190,85%,50%)] bg-[hsl(190,85%,50%)]/8 px-2 py-0.5 rounded-md border border-[hsl(190,85%,50%)]/15 tracking-wider uppercase">
                  local
                </span>
              )}
              {job.score_niche_bonus >= 1 && (
                <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-[hsl(160,84%,58%)] bg-[hsl(160,84%,58%)]/8 border border-[hsl(160,84%,58%)]/15 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  <Target size={9} className="pulse-dot" />
                  niche
                </span>
              )}
            </div>

            <ScoreBadge job={job} />
          </div>
        </div>

        {/* Score reason + red flags + tech stack */}
        <div className="mt-4 space-y-2.5">
          {job.score_reason && (
            <p className="text-[11px] text-[hsl(240,5%,42%)] leading-relaxed border-l-2 border-[hsl(240,6%,16%)] pl-3 italic">
              {job.score_reason}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {/* Red flags — inline with rose dot */}
            {job.score_red_flags.map((flag, i) => (
              <span
                key={i}
                className="flex items-center gap-1 text-[10px] font-mono font-semibold text-[hsl(350,85%,60%)] bg-[hsl(350,85%,60%)]/6 border border-[hsl(350,85%,60%)]/12 px-2 py-0.5 rounded-md uppercase tracking-wider select-none"
              >
                <span className="w-1 h-1 rounded-full bg-[hsl(350,85%,60%)]" />
                {flag}
              </span>
            ))}

            {/* Stack chips — minimal outlined pills */}
            {job.stack_mentioned.map((tech) => {
              const matches = isKnownSkill(tech);
              return (
                <span
                  key={tech}
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border transition-colors duration-200 ${matches
                      ? 'bg-[hsl(210,100%,66%)]/6 text-[hsl(210,100%,66%)] border-[hsl(210,100%,66%)]/15'
                      : 'bg-transparent text-[hsl(240,5%,32%)] border-[hsl(240,6%,14%)]'
                    }`}
                >
                  {tech}
                </span>
              );
            })}
          </div>
        </div>

        {/* Expandable description */}
        {expanded && job.description && (
          <div className="mt-4 p-4 bg-[hsl(240,8%,5%)] rounded-lg border border-[hsl(240,6%,14%)] card-animate">
            <h4 className="text-[10px] font-mono font-bold text-[hsl(240,5%,30%)] uppercase tracking-wider mb-2">Description</h4>
            <p className="text-sm text-[hsl(240,5%,52%)] leading-relaxed whitespace-pre-wrap selection:bg-[hsl(160,84%,58%)]/20 selection:text-white">
              {job.description.slice(0, 1500)}
              {job.description.length > 1500 && '...'}
            </p>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center gap-1.5 flex-wrap pt-3.5 border-t border-[hsl(240,6%,14%)]/50 mt-4">
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn bg-white/[0.03] hover:bg-white/[0.06] text-[hsl(240,5%,52%)] hover:text-white border border-[hsl(240,6%,14%)] hover:border-[hsl(240,6%,22%)]"
            id={`apply-${job.id}`}
          >
            <ExternalLink size={12} />
            Apply
          </a>

          <button
            className="action-btn bg-[hsl(210,100%,66%)]/5 hover:bg-[hsl(210,100%,66%)]/10 text-[hsl(210,100%,66%)] border border-transparent hover:border-[hsl(210,100%,66%)]/15"
            onClick={() => onDraftEmail(job)}
            id={`draft-${job.id}`}
          >
            <Mail size={12} />
            Pitch
          </button>

          {/* Status actions — ghost style */}
          <div className="flex items-center gap-1 ml-auto">
            {job.status !== 'saved' && (
              <button
                className="action-btn bg-transparent hover:bg-[hsl(210,100%,66%)]/5 text-[hsl(240,5%,32%)] hover:text-[hsl(210,100%,66%)] border border-transparent"
                onClick={() => handleStatus('saved')}
                id={`save-${job.id}`}
              >
                <Bookmark size={11} />
                <span className="hidden sm:inline">Save</span>
              </button>
            )}
            {job.status !== 'applied' && (
              <button
                className="action-btn bg-transparent hover:bg-[hsl(160,84%,58%)]/5 text-[hsl(240,5%,32%)] hover:text-[hsl(160,84%,58%)] border border-transparent"
                onClick={() => handleStatus('applied')}
                id={`applied-${job.id}`}
              >
                <Check size={11} />
                <span className="hidden sm:inline">Applied</span>
              </button>
            )}
            {job.status !== 'skipped' && (
              <button
                className="action-btn bg-transparent hover:bg-[hsl(350,85%,60%)]/5 text-[hsl(240,5%,32%)] hover:text-[hsl(350,85%,60%)] border border-transparent"
                onClick={() => handleStatus('skipped')}
                id={`skip-${job.id}`}
              >
                <EyeOff size={11} />
                <span className="hidden sm:inline">Skip</span>
              </button>
            )}
            {job.status !== 'new' && (
              <button
                className="text-[10px] font-mono font-bold text-[hsl(240,5%,28%)] hover:text-[hsl(240,5%,50%)] transition-colors uppercase tracking-wider ml-1"
                onClick={() => handleStatus('new')}
                id={`reset-${job.id}`}
              >
                Reset
              </button>
            )}

            <button
              onClick={() => setExpanded(e => !e)}
              className="action-btn bg-transparent hover:bg-white/[0.03] text-[hsl(240,5%,32%)] hover:text-white border border-transparent"
              aria-label="Expand description"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

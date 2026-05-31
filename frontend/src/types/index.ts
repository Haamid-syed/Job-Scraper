export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  job_type: string;
  description: string;
  apply_url: string;
  source: string;  // 'hn' | 'yc' | 'wellfound' | 'linkedin' | 'remotive' | 'google' | 'ats_boards' | 'remoteok' | 'indeed' | 'devto' | 'glassdoor' | 'remotehunter' | 'sourcingxpress'
  posted_at: string | null;
  scraped_at: string;
  salary_range: string;
  company_size: string;
  stack_mentioned: string[];
  score_role_match: number;
  score_seniority: number;
  score_reply_odds: number;
  score_recency: number;
  score_niche_bonus: number;
  score_total: number;
  score_verdict: 'apply' | 'maybe' | 'skip' | 'unscored';
  score_reason: string;
  score_red_flags: string[];
  scoring_method: 'llm' | 'openrouter' | 'local_mlx' | 'heuristic';
  status: 'new' | 'saved' | 'applied' | 'skipped';
  notes: string;
  draft_email: { subject: string; body: string } | null;
}

export interface SourceHealth {
  source: string;
  last_run_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
  is_circuit_broken: boolean;
  circuit_broken_until: string | null;
  jobs_found_last_run: number;
}

export interface JobStats {
  total_jobs: number;
  new_today: number;
  applied: number;
  by_source: Record<string, number>;
  by_verdict: Record<string, number>;
  niche_matches: number;
  last_refresh: string | null;
}

export interface JobsResponse {
  jobs: Job[];
  total: number;
  stats: JobStats;
}

export interface RefreshStatus {
  is_running: boolean;
  last_run_at: string | null;
  last_run_stats: Record<string, unknown>;
}

export interface HealthResponse {
  sources: SourceHealth[];
  overall: 'healthy' | 'degraded' | 'error';
}

export interface FilterState {
  verdict: 'all' | 'apply' | 'maybe' | 'skip';
  sources: string[];
  minScore: number;
  status: 'all' | 'new' | 'saved' | 'applied' | 'skipped';
  showHidden: boolean;
  q: string;
}

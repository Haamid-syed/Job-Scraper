import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import axios from 'axios';
import type { Job, JobsResponse, FilterState } from '../types';
import jobsSnapshot from '../jobs_snapshot.json';

async function fetchJobs(filters: FilterState): Promise<JobsResponse> {
  const params: Record<string, string | number | boolean> = {};

  if (filters.verdict !== 'all') params.verdict = filters.verdict;
  if (filters.minScore > 0) params.min_score = filters.minScore;
  if (filters.status !== 'all') params.status = filters.status;
  if (filters.showHidden) params.show_hidden = true;
  if (filters.q.trim()) params.q = filters.q.trim();

  const { data } = await axios.get<JobsResponse>('/api/jobs', { params });
  return data;
}

function apiQueryKey(filters: FilterState) {
  return ['jobs', filters.verdict, filters.minScore, filters.status, filters.showHidden, filters.q, filters.sources.join(',')];
}

export function useJobs(filters: FilterState) {
  const isShowcase = (import.meta as any).env.VITE_SHOWCASE_MODE === 'true';

  const query = useQuery({
    queryKey: apiQueryKey(filters),
    queryFn: () => fetchJobs(filters),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: !isShowcase, // Disable query in showcase mode
  });

  // Load either the static jobs snapshot or the API response
  const rawJobs = isShowcase ? (jobsSnapshot.jobs as any as Job[]) : (query.data?.jobs ?? []);
  const stats = isShowcase 
    ? { ...jobsSnapshot.stats, last_refresh: new Date().toISOString() } 
    : (query.data?.stats ?? null);

  // Client-side filtering logic for static showcase mode
  const jobs = useMemo(() => {
    let list = rawJobs;

    if (isShowcase) {
      // 1. Filter by verdict
      if (filters.verdict !== 'all') {
        list = list.filter(j => j.score_verdict === filters.verdict);
      }
      // 2. Filter by min score
      if (filters.minScore > 0) {
        list = list.filter(j => j.score_total >= filters.minScore);
      }
      // 3. Filter by status
      if (filters.status !== 'all') {
        list = list.filter(j => j.status === filters.status);
      }
      // 4. Filter by skipped/hidden
      if (!filters.showHidden) {
        list = list.filter(j => j.status !== 'skipped');
      }
      // 5. Filter by text search query
      if (filters.q.trim()) {
        const queryText = filters.q.trim().toLowerCase();
        list = list.filter(j => 
          j.title.toLowerCase().includes(queryText) || 
          j.company.toLowerCase().includes(queryText) || 
          (j.description && j.description.toLowerCase().includes(queryText))
        );
      }
    }

    if (filters.sources.length === 0) return list;
    return list.filter((j) => filters.sources.includes(j.source));
  }, [rawJobs, filters, isShowcase]);

  return {
    jobs,
    stats,
    isLoading: isShowcase ? false : query.isLoading,
    error: isShowcase ? null : query.error,
    refetch: isShowcase ? () => {} : query.refetch,
  };
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();
  const isShowcase = (import.meta as any).env.VITE_SHOWCASE_MODE === 'true';

  return useMutation({
    mutationFn: async ({
      jobId,
      status,
      notes,
    }: {
      jobId: string;
      status: Job['status'];
      notes?: string;
    }) => {
      if (isShowcase) {
        return { success: true };
      }
      const { data } = await axios.patch(`/api/jobs/${jobId}/status`, { status, notes });
      return data;
    },
    onSuccess: () => {
      if (!isShowcase) {
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
      }
    },
  });
}

export function useDraftEmail(jobId: string) {
  const isShowcase = (import.meta as any).env.VITE_SHOWCASE_MODE === 'true';

  return useQuery({
    queryKey: ['draft', jobId],
    queryFn: async () => {
      if (isShowcase) {
        return {
          subject: "Application for Developer Role - Haamid",
          body: "Hi Team,\n\nI saw your job opening and would love to apply. As a fullstack developer specialized in WebRTC and real-time systems, I have built Social Square and Carbonly. Looking forward to speaking!\n\nBest,\nHaamid"
        };
      }
      const { data } = await axios.post<{ subject: string; body: string }>(
        `/api/jobs/${jobId}/draft`
      );
      return data;
    },
    enabled: false,
    retry: 1,
  });
}

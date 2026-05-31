import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import axios from 'axios';
import type { Job, JobsResponse, FilterState } from '../types';

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

// Only include API-relevant fields in the query key.
// Sources are filtered client-side, so changing source selection
// should NOT trigger a new API call.
function apiQueryKey(filters: FilterState) {
  return ['jobs', filters.verdict, filters.minScore, filters.status, filters.showHidden, filters.q];
}

export function useJobs(filters: FilterState) {
  const query = useQuery({
    queryKey: apiQueryKey(filters),
    queryFn: () => fetchJobs(filters),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Client-side source filter — only re-runs when data or sources change
  const jobs = useMemo(() => {
    if (!query.data?.jobs) return [];
    if (filters.sources.length === 0) return query.data.jobs;
    return query.data.jobs.filter((j) => filters.sources.includes(j.source));
  }, [query.data?.jobs, filters.sources]);

  return {
    jobs,
    stats: query.data?.stats ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();
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
      const { data } = await axios.patch(`/api/jobs/${jobId}/status`, { status, notes });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useDraftEmail(jobId: string) {
  return useQuery({
    queryKey: ['draft', jobId],
    queryFn: async () => {
      const { data } = await axios.post<{ subject: string; body: string }>(
        `/api/jobs/${jobId}/draft`
      );
      return data;
    },
    enabled: false, // only fetch when explicitly triggered
    retry: 1,
  });
}

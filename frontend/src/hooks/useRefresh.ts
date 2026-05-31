import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import type { RefreshStatus } from '../types';

export function useRefresh() {
  const queryClient = useQueryClient();
  const isShowcase = (import.meta as any).env.VITE_SHOWCASE_MODE === 'true';
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRefreshingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(() => {
    stopPolling();
    if (isShowcase) {
      setTimeout(() => {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }, 3000);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await axios.get<RefreshStatus>('/api/refresh/status');
        if (!data.is_running) {
          stopPolling();
          isRefreshingRef.current = false;
          setIsRefreshing(false);
          // Refetch jobs after pipeline completes
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
        }
      } catch {
        stopPolling();
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    }, 3000);
  }, [queryClient, stopPolling, isShowcase]);

  const triggerRefresh = useCallback(async () => {
    // Use ref for synchronous guard — avoids stale closure from useState
    if (isRefreshingRef.current) return;

    if (isShowcase) {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      setRunId("showcase-run-id");
      pollStatus();
      return;
    }

    try {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      const { data } = await axios.post<{ message: string; run_id: string | null }>(
        '/api/refresh'
      );
      setRunId(data.run_id);
      pollStatus();
    } catch (err) {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      console.error('Failed to trigger refresh:', err);
    }
  }, [pollStatus, isShowcase]);

  return { isRefreshing, runId, triggerRefresh };
}

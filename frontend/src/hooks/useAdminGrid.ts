import { useState, useEffect, useCallback } from 'react';
import { AdminGridResponse } from '../types/availabilityTypes';
import { getAdminGrid } from '../services/availabilityService';
import { useWebSocket } from './useWebSocket';
import { WSMessage } from '../types/task';

export function useAdminGrid() {
  const [data, setData] = useState<AdminGridResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminGrid();
      setData(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const silentRefetch = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await getAdminGrid();
      setData(result);
    } catch {
      // Silent failure for background sync
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Subscribe to WebSocket updates
  useWebSocket({
    enabled: true,
    onMessage: useCallback((msg: WSMessage) => {
      if (msg.type === 'availability:updated') {
        silentRefetch();
      }
    }, [silentRefetch])
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { 
    data, 
    loading, 
    isSyncing,
    error, 
    refetch: fetchData 
  };
}

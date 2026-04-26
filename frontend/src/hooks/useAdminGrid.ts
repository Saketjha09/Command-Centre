import { useState, useEffect, useCallback } from 'react';
import { AdminGridResponse } from '../types/availabilityTypes';
import { getAdminGrid } from '../services/availabilityService';

export function useAdminGrid() {
  const [data, setData] = useState<AdminGridResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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
      // Note: data is NOT cleared on failure, preserving previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { 
    data, 
    loading, 
    error, 
    refetch: fetchData 
  };
}

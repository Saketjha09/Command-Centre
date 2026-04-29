import { useState, useEffect, useCallback, useRef } from 'react';
import * as payrollService from '../services/payrollService';
import type { EditorRate, RunPayrollRequest, PayrollRun, PayrollRunDetail } from '../services/payrollService';

export function useRates() {
  const [rates, setRates] = useState<EditorRate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await payrollService.getRates();
      if (mountedRef.current) {
        setRates(data);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch rates');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const updateRate = useCallback(async (editorId: string, contentType: string, rate: number) => {
    setError(null);
    let rollbackRates: EditorRate[] | null = null;

    setRates((prev) => {
      rollbackRates = prev;
      const existingIdx = prev.findIndex(r => r.editor_id === editorId && r.content_type === contentType);
      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], rate };
        return next;
      } else {
        // Local optimistic insert if it doesn't exist
        return [...prev, { editor_id: editorId, content_type: contentType, rate, updated_at: new Date().toISOString() }];
      }
    });

    try {
      await payrollService.upsertRate(editorId, contentType, rate);
    } catch (err: unknown) {
      if (mountedRef.current && rollbackRates) {
        setRates(rollbackRates);
        setError(err instanceof Error ? err.message : 'Failed to update rate');
      }
      throw err;
    }
  }, []);

  return { rates, loading, error, loadRates, updateRate };
}

export function useRunPayroll() {
  const [preview, setPreview] = useState<PayrollRunDetail | null>(null);
  const [previewing, setPreviewing] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const previewRun = useCallback(async (req: RunPayrollRequest) => {
    setPreviewing(true);
    setError(null);
    try {
      const data = await payrollService.previewPayroll(req);
      if (mountedRef.current) {
        setPreview(data);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to generate preview');
        setPreview(null);
      }
    } finally {
      if (mountedRef.current) {
        setPreviewing(false);
      }
    }
  }, []);

  const confirmRun = useCallback(async (req: RunPayrollRequest): Promise<PayrollRun> => {
    setCreating(true);
    setError(null);
    try {
      const run = await payrollService.createPayrollRun(req);
      if (mountedRef.current) {
        setPreview(null); // Reset preview to null on success
      }
      return run;
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to create payroll run');
      }
      throw err; // Allow the component to catch this if needed
    } finally {
      if (mountedRef.current) {
        setCreating(false);
      }
    }
  }, []);

  return { preview, previewing, creating, error, previewRun, confirmRun, clearPreview: () => setPreview(null) };
}

export function usePayrollHistory() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, PayrollRunDetail>>({});
  const [markingPaid, setMarkingPaid] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await payrollService.getPayrollRuns();
      if (mountedRef.current) {
        setRuns(data);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load payroll history');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const toggleExpand = useCallback(async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }

    setExpandedRunId(runId);
    
    // Load detail on first expand
    if (!runDetails[runId]) {
      try {
        const detail = await payrollService.getPayrollRunDetail(runId);
        if (mountedRef.current) {
          setRunDetails(prev => ({ ...prev, [runId]: detail }));
        }
      } catch (err: unknown) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load run details');
        }
      }
    }
  }, [expandedRunId, runDetails]);

  const markAsPaid = useCallback(async (runId: string) => {
    setError(null);
    let rollbackRuns: PayrollRun[] | null = null;

    setMarkingPaid(prev => ({ ...prev, [runId]: true }));
    setRuns(prev => {
      rollbackRuns = prev;
      return prev.map(r => r.id === runId ? { ...r, status: 'paid', paid_at: new Date().toISOString() } : r);
    });

    try {
      await payrollService.markPaid(runId);
    } catch (err: unknown) {
      if (mountedRef.current && rollbackRuns) {
        setRuns(rollbackRuns);
        setError(err instanceof Error ? err.message : 'Failed to mark run as paid');
      }
    } finally {
      if (mountedRef.current) {
        setMarkingPaid(prev => ({ ...prev, [runId]: false }));
      }
    }
  }, []);

  return { runs, expandedRunId, runDetails, markingPaid, loading, error, loadRuns, toggleExpand, markAsPaid };
}

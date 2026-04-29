const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export interface EditorRate {
  editor_id: string;
  editor_name?: string;
  content_type: string;
  rate: number;
  updated_at: string;
}

export interface PayrollTask {
  task_id: string;
  task_title: string;
  content_type: string;
  rate_applied: number;
  amount: number;
}

export interface PayrollRun {
  id: string;
  editor_id: string;
  editor_name: string;
  period_start: string;
  period_end: string;
  task_count: number;
  total_amount: number;
  status: 'pending' | 'paid';
  paid_at?: string;
  created_at: string;
}

export interface PayrollRunDetail extends PayrollRun {
  tasks: PayrollTask[];
}

export interface RunPayrollRequest {
  editor_id: string;
  period_start: string;
  period_end: string;
}

export async function getRates(): Promise<EditorRate[]> {
  const res = await fetch(`${BASE_URL}/api/v1/payroll/rates`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`getRates: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<EditorRate[]>;
}

export async function getEditorRates(editorId: string): Promise<EditorRate[]> {
  const res = await fetch(`${BASE_URL}/api/v1/payroll/rates/${editorId}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`getEditorRates: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<EditorRate[]>;
}

export async function upsertRate(
  editorId: string,
  contentType: string,
  rate: number
): Promise<EditorRate[]> {
  const res = await fetch(`${BASE_URL}/api/v1/payroll/rates/${editorId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: contentType, rate }),
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`upsertRate: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<EditorRate[]>;
}

export async function previewPayroll(req: RunPayrollRequest): Promise<PayrollRunDetail> {
  const res = await fetch(`${BASE_URL}/api/v1/payroll/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`previewPayroll: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<PayrollRunDetail>;
}

export async function createPayrollRun(req: RunPayrollRequest): Promise<PayrollRun> {
  const res = await fetch(`${BASE_URL}/api/v1/payroll/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`createPayrollRun: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<PayrollRun>;
}

export async function getPayrollRuns(editorId?: string): Promise<PayrollRun[]> {
  const url = new URL(`${BASE_URL}/api/v1/payroll/runs`);
  if (editorId) {
    url.searchParams.set('editor_id', editorId);
  }
  const res = await fetch(url.toString(), {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`getPayrollRuns: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data || [];
}

export async function getPayrollRunDetail(runId: string): Promise<PayrollRunDetail> {
  const res = await fetch(`${BASE_URL}/api/v1/payroll/runs/${runId}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`getPayrollRunDetail: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<PayrollRunDetail>;
}

export async function markPaid(runId: string): Promise<PayrollRun> {
  const res = await fetch(`${BASE_URL}/api/v1/payroll/runs/${runId}/paid`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`markPaid: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<PayrollRun>;
}

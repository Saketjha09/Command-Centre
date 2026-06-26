import { BASE_URL } from './config';
import type { OpsTask, TeamMember, CreateOpsTaskPayload, UpdateOpsStatusPayload } from '../types/ops';

const defaultOptions: RequestInit = { credentials: 'include' };

function getHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...extra };
}

export async function fetchOpsTasks(): Promise<OpsTask[]> {
  const res = await fetch(`${BASE_URL}/api/v1/ops/tasks`, {
    ...defaultOptions,
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchOpsTasks: ${res.status} — ${body}`);
  }
  return res.json() as Promise<OpsTask[]>;
}

export async function createOpsTask(payload: CreateOpsTaskPayload): Promise<OpsTask> {
  const res = await fetch(`${BASE_URL}/api/v1/ops/tasks`, {
    ...defaultOptions,
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `createOpsTask: ${res.status}`);
  }
  return res.json() as Promise<OpsTask>;
}

export async function updateOpsTaskStatus(taskId: string, payload: UpdateOpsStatusPayload): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/ops/tasks/${taskId}/status`, {
    ...defaultOptions,
    method: 'PATCH',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `updateOpsTaskStatus: ${res.status}`);
  }
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch(`${BASE_URL}/api/v1/ops/team-members`, {
    ...defaultOptions,
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchTeamMembers: ${res.status} — ${body}`);
  }
  return res.json() as Promise<TeamMember[]>;
}

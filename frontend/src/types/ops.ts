export type OpsTaskStatus = 'assigned' | 'in_progress' | 'done';

export interface OpsTask {
  id: string;
  brand_id: string | null;
  brand_name: string;
  brief: string;
  sheet_link: string;
  assignee_id: string;
  assignee_name: string;
  assignee_role: string;
  created_by_id: string;
  created_by_name: string;
  status: OpsTaskStatus;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface CreateOpsTaskPayload {
  brand_id?: string;
  brand_name: string;
  brief: string;
  sheet_link: string;
  assignee_id: string;
}

export interface UpdateOpsStatusPayload {
  status: OpsTaskStatus;
}

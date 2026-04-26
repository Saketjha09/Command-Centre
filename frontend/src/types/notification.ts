export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  related_task_id: string | null;
  is_read: boolean;
  created_at: string;
}

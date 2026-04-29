export type UserRole = 'freelancer' | 'admin' | 'superadmin';

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
}

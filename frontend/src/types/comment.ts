// Comment matches the backend Comment struct from tasks/models.go.
export interface Comment {
  id: string
  task_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
}

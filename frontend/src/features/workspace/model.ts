export const statuses = ['pending', 'in_progress', 'done'] as const
export const priorities = ['urgent', 'high', 'medium', 'low'] as const
export type Status = typeof statuses[number]
export type Priority = typeof priorities[number]
export type Role = 'owner' | 'admin' | 'member' | 'viewer'
export type PendingTaskMove = { status: Status; previous: Status }
export type WorkFilters = { query: string; priority: string; status: string; mine: boolean }

export const emptyWorkFilters: WorkFilters = { query: '', priority: '', status: '', mine: false }

export const statusNames: Record<Status, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Done',
}

export const transitions: Record<Status, Status[]> = {
  pending: ['in_progress'],
  in_progress: ['pending', 'done'],
  done: ['in_progress'],
}

export interface User { id: string; name: string; email: string }
export interface Organization { id: string; name: string; slug: string; created_at: string }
export interface Project {
  id: string
  name: string
  description: string | null
  organization_id: string
  created_by: string | null
  created_at: string
  updated_at: string
}
export interface Member { user_id: string; name: string; email: string; role: Role; joined_at: string }
export interface Task {
  id: string
  project_id: string
  key: string
  number: number
  title: string
  description: string | null
  status: Status
  priority: Priority
  assignee_id: string | null
  due_at: string | null
  created_at: string
  updated_at: string
}
export interface Comment { id: string; task_id: string; author_id: string; body: string; created_at: string }
export interface Activity { id: string; action: string; actor_id: string; details: string | null; created_at: string }
export interface Notice {
  id: string
  type: string
  payload: { task_id?: string; project_id?: string; organization_id?: string; task_title?: string } | string | null
  read_at: string | null
  created_at: string
}

export interface Workspace {
  user: User
  organizations: Organization[]
  organization: Organization | undefined
  projects: Project[]
  project: Project | undefined
  orgMembers: Member[]
  projectMembers: Member[]
  tasks: Task[]
}

export function matchesTask(task: Task, query: string) {
  const text = query.trim().toLowerCase()
  return !text || [task.key, task.title, task.description].some(value => value?.toLowerCase().includes(text))
}

export { dueInfo, longDate, shortDate } from '../../shared/lib/date'
export { initials, messageOf } from '../../shared/lib/text'

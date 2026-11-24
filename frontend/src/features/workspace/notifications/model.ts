import type { Notice } from '../model'
import { request } from '../api'

export const notificationPageSize = 25

export function fetchNotifications(offset = 0, unread = false) {
  return request<Notice[]>(`/notifications?limit=${notificationPageSize + 1}&offset=${offset}&unread=${unread}`)
}

export function newestFirst(a: Notice, b: Notice) {
  return b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
}

export function noticeTitle(item: Notice) {
  if (item.type === 'task.assigned') return 'A task was assigned to you'
  if (item.type === 'task.commented') return 'New comment on your task'
  return 'Workspace notification'
}

export function noticeTask(item: Notice) {
  return item.payload && typeof item.payload === 'object' ? item.payload : null
}

export type NotificationAlert = { item: Notice; count: number }

export type BulkReadResult = { notification_ids: string[]; updated_count: number; read_at: string }

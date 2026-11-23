import { CalendarDays, Check, Circle, CircleDashed, Flag } from 'lucide-react'
import { dueInfo } from '../../../shared/lib/date'
import { statusNames } from '../model'
import type { Priority, Status } from '../model'

export const statusIcons = { pending: CircleDashed, in_progress: Circle, done: Check }

export function StatusPill({ status }: { status: Status }) {
  const Icon = statusIcons[status]
  const label = statusNames[status] ?? status
  return <span className={`status-pill ${status}`}>{Icon && <Icon size={13} aria-hidden />} {label}</span>
}

export function PriorityPill({ priority }: { priority: Priority }) {
  return <span className={`priority-pill ${priority}`}><Flag size={13} aria-hidden />{priority}</span>
}

export function DueDate({ value, status }: { value: string | null; status: Status }) {
  if (!value) return <span className="muted">—</span>
  const date = dueInfo(value)
  return <span className={`due-date ${date.overdue && status !== 'done' ? 'overdue' : ''}`}>
    <CalendarDays size={14} aria-hidden />{date.overdue && status !== 'done' ? `${date.label} · Overdue` : date.label}
  </span>
}

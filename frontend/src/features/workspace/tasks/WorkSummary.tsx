import { Check, CircleDot, ClipboardList } from 'lucide-react'
import type { Task } from '../model'

export function WorkSummary({ tasks }: { tasks: Task[] }) {
  const completed = tasks.filter(task => task.status === 'done').length
  const progress = tasks.filter(task => task.status === 'in_progress').length
  const metrics = [
    { value: tasks.length - completed, label: 'Open tasks', tone: 'open', Icon: ClipboardList },
    { value: progress, label: 'In progress', tone: 'progress', Icon: CircleDot },
    { value: completed, label: 'Completed', tone: 'completed', Icon: Check },
  ]
  return (
    <div className="work-summary" role="list" aria-label="Project status totals">
      {metrics.map(({ value, label, tone, Icon }) => (
        <div className="work-summary-item" role="listitem" data-tone={tone} key={tone}>
          <span className="work-summary-icon" aria-hidden><Icon size={18} /></span>
          <dl className="work-summary-copy"><dt>{label}</dt><dd>{value}</dd></dl>
        </div>
      ))}
    </div>
  )
}

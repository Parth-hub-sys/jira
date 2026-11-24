import type { ReactNode } from 'react'
import { Avatar } from '../../../shared/ui'
import type { Member, Task } from '../model'
import { DueDate, PriorityPill } from './TaskIndicators'

export function TaskCardContent({ task, assignee, action, openTask, saving }: {
  task: Task; assignee?: Member; action?: ReactNode; openTask?: (id: string) => void; saving?: boolean
}) {
  return <>
    <div className="card-heading">
      {openTask
        ? <button className="card-title" onClick={() => openTask(task.id)}>{task.title}</button>
        : <span className="card-title">{task.title}</span>}
      {action}
    </div>
    {task.due_at && <DueDate value={task.due_at} status={task.status} />}
    <div className="board-card-footer">
      {saving ? <span className="task-saving"><span className="spinner" />Saving…</span> : <PriorityPill priority={task.priority} />}
      {assignee && <Avatar name={assignee.name} id={assignee.user_id} size="small" />}
    </div>
  </>
}

import type { ReactNode } from 'react'
import { Avatar } from '../../../shared/ui'
import type { Label, Member, Task } from '../model'
import { DueDate, PriorityPill } from './TaskIndicators'

export function TaskCardContent({ task, assignee, labels, action, openTask, saving }: {
  task: Task; assignee?: Member; labels: Label[]; action?: ReactNode; openTask?: (id: string) => void; saving?: boolean
}) {
  const taskLabels = labels.filter(label => task.label_ids.includes(label.id))
  return <>
    <div className="card-heading">
      {openTask
        ? <button className="card-title" onClick={() => openTask(task.id)}>{task.title}</button>
        : <span className="card-title">{task.title}</span>}
      {action}
    </div>
    {(taskLabels.length > 0 || task.due_at) && <div className="card-metadata">
      {taskLabels.length > 0 && <div className="card-labels">
        {taskLabels.map(label => <span className="task-label" key={label.id}>{label.name}</span>)}
      </div>}
      {task.due_at && <DueDate value={task.due_at} status={task.status} />}
    </div>}
    <div className="board-card-footer">
      {saving ? <span className="task-saving"><span className="spinner" />Saving…</span> : <PriorityPill priority={task.priority} />}
      {assignee && <Avatar name={assignee.name} id={assignee.user_id} size="small" />}
    </div>
  </>
}

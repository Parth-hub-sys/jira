import { Plus } from 'lucide-react'
import { Avatar, Empty } from '../../../shared/ui'
import type { Member, Task } from '../model'
import { DueDate, PriorityPill, StatusPill } from './TaskIndicators'

type Props = {
  tasks: Task[]
  members: Member[]
  activeFilter: boolean
  canWrite: boolean
  isMoving(id: string): boolean
  openTask(id: string): void
  onCreate(): void
}

export function TaskList({ tasks, members, activeFilter, canWrite, isMoving, openTask, onCreate }: Props) {
  if (!tasks.length) {
    return (
      <section className="panel task-list" aria-label="Tasks">
        <Empty
          title={activeFilter ? 'No matching tasks' : 'No tasks yet'}
          body={activeFilter ? 'Try a different search or filter.' : 'Create a task to start tracking work here.'}
          action={canWrite && !activeFilter && <button className="button primary" onClick={onCreate}><Plus size={17} />New task</button>}
        />
      </section>
    )
  }

  return (
    <section className="panel task-list" aria-label="Tasks">
      <div className="list-header"><span>Task</span><span>Status</span><span>Priority</span><span>Due date</span><span>Assignee</span></div>
      {tasks.map(task => {
        const assignee = members.find(member => member.user_id === task.assignee_id)
        return (
          <button key={task.id} className="task-list-row" onClick={() => openTask(task.id)}>
            <span className="row-info"><span>{task.key}</span><strong>{task.title}</strong></span>
            <span className="list-task-status"><StatusPill status={task.status} />
              {isMoving(task.id) && <span className="task-saving"><span className="spinner" />Saving…</span>}
            </span>
            <PriorityPill priority={task.priority} />
            <DueDate value={task.due_at} status={task.status} />
            <span className="assignee-cell">
              {assignee ? <><Avatar name={assignee.name} id={assignee.user_id} size="small" /><span>{assignee.name}</span></> : <span className="muted">Unassigned</span>}
            </span>
          </button>
        )
      })}
    </section>
  )
}

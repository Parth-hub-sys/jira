import { Fragment } from 'react'
import { createPortal } from 'react-dom'
import { Ellipsis } from 'lucide-react'
import { Dropdown } from '../../../shared/ui'
import { statusNames, transitions } from '../model'
import type { Label, Member, Status, Task } from '../model'
import { TaskCardContent } from './TaskCardContent'
import { statusIcons } from './TaskIndicators'
import { useBoardDrag } from './useBoardDrag'

type Props = {
  lanes: Status[]; tasks: Task[]; members: Member[]; labels: Label[]; canWrite: boolean
  isMoving(id: string): boolean
  openTask(id: string): void
  moveTask(task: Task, status: Status): void | Promise<void>
}

export function TaskBoard({ lanes, tasks, members, labels, canWrite, isMoving, openTask, moveTask }: Props) {
  const { boardRef, drag, startDrag, attachPreview } = useBoardDrag(moveTask)
  const assignee = (task: Task) => members.find(member => member.user_id === task.assignee_id)

  return <>
    <div ref={boardRef} className="board" role="region" aria-label="Task board" tabIndex={0}>
      {lanes.map(status => {
        const items = tasks.filter(task => (task.id === drag?.task.id ? drag.task.status : task.status) === status)
        const Icon = statusIcons[status]
        const target = drag?.target === status && !items.some(task => task.id === drag.task.id) ? drag : null
        const before = target ? items.find(task => task.number < target.task.number)?.id : undefined
        const slot = target && <div className="board-drop-slot" style={{ minHeight: target.height }} aria-hidden>
          <Icon size={16} />Move to {statusNames[status]}
        </div>

        return <section key={status} data-lane-status={status} className={`lane ${status} ${target ? 'drop-ready' : ''}`}>
          <div className="lane-header"><Icon size={18} /><h2>{statusNames[status]}</h2><span>{items.length}</span></div>
          <div className="lane-cards">
            {items.map(item => {
              const task = item.id === drag?.task.id ? drag.task : item
              const saving = isMoving(task.id)
              return <Fragment key={task.id}>
                {before === task.id && slot}
                <article data-status={task.status} data-movable={canWrite && !saving} aria-busy={saving}
                  className={`board-card ${drag?.task.id === task.id ? 'dragging' : ''}`}
                  onPointerDown={event => {
                    if (canWrite && !saving) startDrag(event, task)
                  }}>
                  <TaskCardContent task={task} assignee={assignee(task)} labels={labels} openTask={openTask} saving={saving}
                    action={canWrite && <Dropdown className="card-menu" label={`Move ${task.title}`} leading={<Ellipsis size={18} />}
                      iconOnly disabled={saving} options={(transitions[task.status] ?? []).map(destination => {
                        const Icon = statusIcons[destination]
                        return { value: destination, label: statusNames[destination], icon: <Icon size={16} /> }
                      })}
                      onChange={destination => { void moveTask(task, destination) }} />} />
                </article>
              </Fragment>
            })}
            {target && !before && slot}
            {!items.length && !target && <div className="lane-empty">No matching tasks</div>}
          </div>
        </section>
      })}
    </div>
    {drag && createPortal(
      <div className="board-drag-preview" ref={attachPreview} style={{ width: drag.width }} aria-hidden>
        <div className="board-card" data-status={drag.target ?? drag.task.status}>
          <TaskCardContent task={drag.task} assignee={assignee(drag.task)} labels={labels} />
        </div>
      </div>,
      document.body,
    )}
  </>
}

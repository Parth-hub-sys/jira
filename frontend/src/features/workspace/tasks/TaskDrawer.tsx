import { useEffect, useState } from 'react'
import { CalendarDays, CircleDot, Flag, MessageSquare } from 'lucide-react'
import { Dialog, Dropdown, FormError } from '../../../shared/ui'
import { messageOf } from '../../../shared/lib/text'
import { request } from '../api'
import { statusNames, transitions } from '../model'
import type { PendingTaskMove, Status, Task, Workspace } from '../model'
import { CommentThread } from './CommentThread'
import { TaskActivity } from './TaskActivity'
import { TaskForm } from './TaskForm'
import { DueDate, PriorityPill, StatusPill, statusIcons } from './TaskIndicators'

export function TaskDrawer({ id, workspace, canWrite, canModerate, pendingMove, onMove, onClose, onUpdate }: {
  id: string; workspace: Workspace; canWrite: boolean; canModerate: boolean
  pendingMove?: PendingTaskMove
  onMove(task: Task, status: Status): Promise<Task | undefined>
  onClose(): void; onUpdate(task: Task, fromRead?: boolean): void
}) {
  const [loaded, setLoaded] = useState<Task>()
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [tab, setTab] = useState<'comments' | 'activity'>('comments')
  const [activityRevision, setActivityRevision] = useState(0)
  const [lastOpenedActivity, setLastOpenedActivity] = useState<string>()
  const [editing, setEditing] = useState(false)
  const [moveError, setMoveError] = useState('')
  const task = workspace.tasks.find(item => item.id === id) ?? loaded
  const writable = canWrite && loaded?.project_id === workspace.project?.id
  const activityKey = `${activityRevision}:${task?.updated_at ?? ''}:${pendingMove?.previous ?? task?.status ?? ''}`
  const people = workspace.projectMembers.length ? workspace.projectMembers : workspace.orgMembers
  const name = (userId: string | null) => people.find(member => member.user_id === userId)?.name
    ?? workspace.orgMembers.find(member => member.user_id === userId)?.name
  const taskPath = `/tasks/${encodeURIComponent(id)}`
  useEffect(() => {
    let active = true
    request<Task>(taskPath)
      .then(item => {
        if (!active) return
        setLoaded(item)
        onUpdate(item, true)
      })
      .catch(failure => { if (active) setLoadError(messageOf(failure)) })
    return () => { active = false }
  }, [taskPath, attempt, onUpdate])
  function update(next: Task) {
    setLoaded(next)
    onUpdate(next)
    setActivityRevision(current => current + 1)
  }
  return <Dialog title="Task details" drawer onClose={onClose}>
    {loadError ? <div className="drawer-body">
      <FormError error={loadError} />
      <button type="button" className="button secondary" onClick={() => { setLoadError(''); setAttempt(current => current + 1) }}>Retry task</button>
    </div> : !task ? <div className="drawer-body"><p className="muted" role="status">Loading task…</p></div> : <div className="drawer-body">
      <h2 className="task-title-large">{task.title}</h2>
      {editing ? <TaskForm task={task} members={workspace.projectMembers} onCancel={() => setEditing(false)} onSave={async values => {
        const fields = Object.keys(values) as Array<keyof typeof values>
        const changed = fields.filter(field => values[field] !== task[field])
        if (changed.length) {
          const data = Object.fromEntries(changed.map(field => [field, values[field]]))
          update(await request<Task>(taskPath, { method: 'PATCH', data }))
        }
        setEditing(false)
      }} /> : <>
        <div className="drawer-task-actions">
          <div className="drawer-status">
            <StatusPill status={task.status} />
            <span className="task-saving" role="status">{pendingMove && <><span className="spinner" />Saving status…</>}</span>
          </div>
          {writable && <button className="button secondary" disabled={!!pendingMove} onClick={() => setEditing(true)}>Edit task</button>}
        </div>
        <FormError error={moveError} />
        <dl className="task-facts">
          <div><dt><Flag size={15} />Priority</dt><dd><PriorityPill priority={task.priority} /></dd></div>
          <div><dt>Assignee</dt><dd>{name(task.assignee_id) ?? 'Unassigned'}</dd></div>
          <div><dt><CalendarDays size={15} />Due date</dt><dd><DueDate value={task.due_at} status={task.status} /></dd></div>
          {writable && <div><dt><CircleDot size={15} />Move to</dt><dd>
            <Dropdown label="Change task status" placeholder="Select status" disabled={!!pendingMove}
              options={(transitions[task.status] ?? []).map(status => {
                const Icon = statusIcons[status]
                return { value: status, label: statusNames[status], icon: <Icon size={16} /> }
              })}
              onChange={async status => {
                setMoveError('')
                try { await onMove(task, status) }
                catch (failure) { setMoveError(`Couldn’t save status. ${messageOf(failure)}`) }
              }} />
          </dd></div>}
        </dl>
        <h3>Description</h3><p className="task-description muted">{task.description || 'No description.'}</p>
      </>}
      <div hidden={editing}>
        <div className="segmented drawer-tabs">
          <button aria-pressed={tab === 'comments'} onClick={() => {
            if (tab === 'activity') setLastOpenedActivity(activityKey)
            setTab('comments')
          }}><MessageSquare size={15} />Comments</button>
          <button aria-pressed={tab === 'activity'} onClick={() => setTab('activity')}>Activity</button>
        </div>
        <div hidden={tab !== 'comments'}>
          <CommentThread taskPath={taskPath} userId={workspace.user.id} writable={writable} canModerate={canModerate} name={name} />
        </div>
        <div hidden={tab !== 'activity'}>
          {(tab === 'activity' || lastOpenedActivity === activityKey) && <TaskActivity key={activityKey} taskPath={taskPath} name={name} />}
        </div>
      </div>
    </div>}
  </Dialog>
}

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Activity, CalendarDays, Check, CircleDot, ClipboardList, Layers, Users } from 'lucide-react'
import { Empty } from '../../../shared/ui'
import { dueInfo } from '../../../shared/lib/date'
import { statuses, statusNames } from '../model'
import type { Status, Workspace } from '../model'
import { PriorityPill, StatusPill } from '../tasks/TaskIndicators'

type OpenTask = (id: string) => void
type ViewWork = (status?: Status | 'open', mine?: boolean) => void

export function Overview({ workspace, openTask, viewWork }: { workspace: Workspace; openTask: OpenTask; viewWork: ViewWork }) {
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const scopedTasks = scope === 'mine' ? workspace.tasks.filter(task => task.assignee_id === workspace.user.id) : workspace.tasks
  const counts = Object.fromEntries(statuses.map(status => [status, scopedTasks.filter(task => task.status === status).length])) as Record<Status, number>
  const done = counts.done
  const total = scopedTasks.length
  const percent = total ? Math.round(done / total * 100) : 0
  const maxBars = Math.max(4, Math.ceil(Math.max(...Object.values(counts)) / 4) * 4)
  const due = scopedTasks
    .filter(task => task.due_at && task.status !== 'done' && new Date(task.due_at).getTime() <= Date.now() + 7 * 86_400_000)
    .sort((first, second) => Date.parse(first.due_at!) - Date.parse(second.due_at!))
    .slice(0, 4)
  const mine = scopedTasks.filter(task => task.assignee_id === workspace.user.id && task.status !== 'done').slice(0, 3)
  const stats = [
    { name: 'Open tasks', count: counts.pending + counts.in_progress, Icon: ClipboardList, color: 'blue', detail: 'Pending and in progress', status: 'open' as const },
    { name: 'In progress', count: counts.in_progress, Icon: CircleDot, color: 'violet', detail: 'Work underway', status: 'in_progress' as const },
    { name: 'Completed', count: done, Icon: Check, color: 'green', detail: 'Tasks marked done', status: 'done' as const },
  ]
  return <>
    <div className="overview-heading appear">
      <div className="page-heading">
        <h1>Project overview</h1>
        <p>Track progress and see what needs attention.</p>
      </div>
      <div className="segmented" aria-label="Task scope">
        <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}><Layers size={16} />All tasks</button>
        <button type="button" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}><Users size={16} />Assigned to me</button>
      </div>
    </div>
    <section className="metrics appear" aria-label="Task totals">
      {stats.map(({ name, count, Icon, color, detail, status }) => (
        <button className="metric panel" key={name} onClick={() => viewWork(status, scope === 'mine')}>
          <span className={`metric-icon ${color}`}><Icon size={22} strokeWidth={1.8} /></span>
          <span className="metric-content"><span className="metric-label">{name}</span><strong>{count}</strong><span className="metric-detail">{detail}</span></span>
        </button>
      ))}
    </section>
    <div className="overview-grid">
      <section className="panel status-panel appear" aria-labelledby="work-status">
        <div className="panel-header"><div><h2 id="work-status">Work by status</h2><p>Task distribution across this project</p></div><span className="panel-icon"><Activity size={19} /></span></div>
        {total ? <div className="chart">
          <div className="chart-labels">
            {statuses.map(status => <button key={status} className="chart-label" onClick={() => viewWork(status, scope === 'mine')}><span className={`chart-dot ${status}`} />{statusNames[status]}</button>)}
          </div>
          <div className="chart-numbers">
            <div className="chart-bars" key={scope}>
              {statuses.map(status => (
                <div key={status} className="chart-row">
                  <div className={`bar ${status}`} style={{ '--bar-width': `${counts[status] / maxBars * 100}%` } as CSSProperties} aria-hidden />
                  <span aria-label={`${statusNames[status]} ${counts[status]}`}>{counts[status]}</span>
                </div>
              ))}
            </div>
            <div className="chart-scale" aria-hidden>{Array.from({ length: 5 }, (_, i) => <span key={i}>{i * maxBars / 4}</span>)}</div>
          </div>
        </div> : <Empty title="No tasks in this view" body="Tasks will appear here when they match this scope." />}
        <div className="chart-footer"><span><span className="chart-total">{total}</span> {total === 1 ? 'task' : 'tasks'} in this view</span><button className="text-button" onClick={() => viewWork(undefined, scope === 'mine')}>View task list</button></div>
      </section>
      <section className="panel due-panel appear">
        <div className="panel-header"><div><h2>Due soon</h2><p>Upcoming deadlines and overdue work</p></div><span className="panel-icon"><CalendarDays size={19} /></span></div>
        {due.length ? <div className="due-list">
          {due.map(task => {
            const date = dueInfo(task.due_at!)
            return <button className="overview-task" key={task.id} onClick={() => openTask(task.id)}>
              <span className={`due-tile ${date.overdue ? 'late-tile' : ''}`}><CalendarDays size={17} /></span>
              <span className="row-info"><strong>{task.title}</strong><span>{task.key} <span aria-hidden>·</span> <span className={date.overdue ? 'overdue' : ''}>{date.overdue ? 'Overdue' : date.label}</span></span></span>
              <PriorityPill priority={task.priority} />
            </button>
          })}
        </div> : <Empty title="No upcoming deadlines" body="Open tasks with due dates will appear here." />}
      </section>
      <section className="panel completion-panel appear">
        <div className="panel-header"><div><h2>Project completion</h2><p>{scope === 'mine' ? 'Tasks assigned to you' : 'Across all project tasks'}</p></div><span className="panel-icon"><Check size={19} /></span></div>
        <div className="completion-content">
          <div className="ring" style={{ '--progress': `${percent}%` } as CSSProperties}>
            <div><strong>{percent}%</strong><span>complete</span></div>
          </div>
          <div className="completion-caption">
            <strong>{done} of {total} tasks</strong>
            <span>{total ? `${total - done} left to complete` : 'No tasks in this view'}</span>
            <button className="text-button" onClick={() => viewWork('done', scope === 'mine')}>View completed</button>
          </div>
        </div>
      </section>
      <section className="panel assigned-panel appear">
        <div className="panel-header"><div><h2>Assigned to me</h2><p>Your open tasks in this project</p></div><span className="panel-icon"><Users size={19} /></span></div>
        {mine.length ? <div>
          {mine.map(task => <button className="overview-task compact-task" key={task.id} onClick={() => openTask(task.id)}>
            <span className="row-info"><strong>{task.title}</strong><span>{task.key}</span></span>
            <StatusPill status={task.status} />
          </button>)}
        </div> : <Empty title="Nothing assigned to you" />}
      </section>
    </div>
  </>
}

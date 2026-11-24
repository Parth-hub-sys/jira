import { FormError } from '../../../shared/ui'
import { longDate } from '../../../shared/lib/date'
import type { Activity } from '../model'
import { useTaskFeed } from './useTaskFeed'

const actionLabels: Record<string, string> = {
  'task.created': 'created this task',
  'task.updated': 'updated this task',
  'task.transitioned': 'changed its status',
  'task.labels_updated': 'updated its labels',
  'task.unassigned': 'removed its assignee',
}

export function TaskActivity({ taskPath, name }: {
  taskPath: string
  name(userId: string): string | undefined
}) {
  const { page, loading, error, loadMore, retry } = useTaskFeed<Activity>(taskPath + '/activity')

  return <div className="activity-list">
    {!page && loading && <p className="muted" role="status">Loading activity…</p>}
    {page && !page.items.length && <p className="muted">No activity recorded yet.</p>}
    {page?.items.map(item => <div className="activity-row" key={item.id}>
      <span className="chart-dot in_progress" />
      <div><strong>{name(item.actor_id) ?? 'Member'}</strong> {actionLabels[item.action] ?? item.action}<time dateTime={item.created_at}>{longDate.format(new Date(item.created_at))}</time></div>
    </div>)}
    <FormError error={error} />
    {!page && error && <button type="button" className="button secondary feed-more" onClick={retry}>Retry activity</button>}
    {page && page.nextOffset !== null && <button type="button" className="button secondary feed-more" disabled={loading} onClick={() => void loadMore()}>{loading ? 'Loading…' : 'Load more activity'}</button>}
  </div>
}

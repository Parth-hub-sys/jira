import { useEffect, useState } from 'react'
import { Bell, Check, Volume2, VolumeX } from 'lucide-react'
import { Dialog, Empty, FormError } from '../../../shared/ui'
import { longDate, messageOf } from '../model'
import type { Notice } from '../model'
import type { Mode } from '../api'
import { fetchNotifications, newestFirst, noticeTask, noticeTitle, notificationPageSize } from './model'

export function NotificationInbox({ mode, unread, readUpdates, sound, onToggleSound, onOpen, onRead, onClose }: {
  mode: Mode; unread: Notice[]; readUpdates: ReadonlyMap<string, Notice>; sound: boolean
  onToggleSound(): void; onOpen(item: Notice): Promise<void>; onRead(item: Notice): Promise<Notice>; onClose(): void
}) {
  const [history, setHistory] = useState<Notice[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [acting, setActing] = useState<string>()

  useEffect(() => {
    let active = true
    fetchNotifications(mode, offset).then(rows => {
      if (!active) return
      setHistory(current => [...current, ...rows.slice(0, notificationPageSize)])
      setHasMore(rows.length > notificationPageSize)
    }).catch(failure => { if (active) setLoadError(messageOf(failure)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [mode, offset, attempt])

  const oldest = history.at(-1)
  const entries = new Map(
    unread.filter(item => !hasMore || !oldest || newestFirst(item, oldest) <= 0).map(item => [item.id, item]),
  )
  for (const item of history) entries.set(item.id, item)
  const items = Array.from(entries.values(), item => readUpdates.get(item.id) ?? item).sort(newestFirst)

  async function act(id: string, action: () => Promise<unknown>) {
    if (acting) return
    setActing(id)
    setError('')
    try { await action() }
    catch (failure) { setError(messageOf(failure)) }
    finally { setActing(undefined) }
  }

  return <Dialog title="Notifications" drawer onClose={onClose}>
    <div className="drawer-body notice-inbox">
      <div className="notice-inbox-toolbar">
        <span className="muted">{unread.length > notificationPageSize ? `${notificationPageSize}+` : unread.length} unread</span>
        <button type="button" className="button secondary notice-sound" aria-label="Notification sound" aria-pressed={sound} onClick={onToggleSound}>
          {sound ? <Volume2 size={16} /> : <VolumeX size={16} />} Sound {sound ? 'on' : 'off'}
        </button>
      </div>
      <FormError error={error} />
      <FormError error={loadError} />
      {items.length > 0 && <ul className="notice-list">
        {items.map(item => {
          const task = noticeTask(item)
          const title = noticeTitle(item)
          return <li className={`notice-row ${item.read_at ? '' : 'unread'}`} key={item.id}>
            <span className="notice-type-icon"><Bell size={17} /></span>
            <div className="row-info">
              <strong>{title}{!item.read_at && <span className="notice-unread" aria-label="Unread" />}</strong>
              {task?.task_title && <span>{task.task_title}</span>}
              <time dateTime={item.created_at}>{longDate.format(new Date(item.created_at))}</time>
            </div>
            <div className="notice-row-actions">
              {task?.task_id && <button type="button" className="button secondary" disabled={!!acting}
                onClick={() => void act(item.id, () => onOpen(item))}>{acting === item.id ? 'Opening…' : 'Open task'}</button>}
              {!item.read_at && <button type="button" className="icon-button" title="Mark as read" aria-label={`Mark as read — ${title}`} disabled={!!acting}
                onClick={() => void act(item.id, () => onRead(item))}><Check size={17} /></button>}
            </div>
          </li>
        })}
      </ul>}
      {loading && <p className="muted" role="status">Loading notifications…</p>}
      {!loading && !loadError && !items.length && <Empty title="You’re all caught up" body="Task assignments and new comments will appear here." />}
      {!loading && loadError && <button className="button secondary feed-more" onClick={() => {
        setLoadError(''); setLoading(true); setAttempt(value => value + 1)
      }}>Refresh notifications</button>}
      {!loading && !loadError && hasMore && <button className="button secondary feed-more" onClick={() => {
        setLoading(true); setOffset(value => value + notificationPageSize)
      }}>Load older notifications</button>}
    </div>
  </Dialog>
}

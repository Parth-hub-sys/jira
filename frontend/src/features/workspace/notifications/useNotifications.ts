import { useCallback, useEffect, useRef, useState } from 'react'
import { request } from '../api'
import type { Notice } from '../model'
import { fetchNotifications, newestFirst } from './model'
import type { BulkReadResult, NotificationAlert } from './model'
import { useNotificationSound } from './useNotificationSound'
import { subscribeToNotifications } from './subscribe'

export function useNotifications(userId: string | undefined) {
  const [unread, setUnread] = useState<Notice[]>([])
  const [readUpdates, setReadUpdates] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [alert, setAlert] = useState<NotificationAlert>()
  const reads = useRef(new Map<string, Promise<Notice>>())
  const revision = useRef(0)
  const bulkOperation = useRef<string | undefined>(undefined)
  const refreshUnread = useRef<() => void>(() => {})
  const sound = useNotificationSound()
  const { play, enabled } = sound
  const soundEnabled = useRef(enabled)
  useEffect(() => { soundEnabled.current = enabled }, [enabled])

  useEffect(() => {
    if (!userId) return
    let active = true
    let running = false
    let initialized = false
    let latest: Notice | undefined
    let pending = false
    let retry: number | undefined
    let retryDelay = 2000

    async function syncUnread() {
      if (!active || !pending || document.hidden || running || retry !== undefined) return
      pending = false
      running = true
      const started = revision.current
      try {
        const items = await fetchNotifications(0, true)
        if (!active) return
        if (document.hidden || started !== revision.current) {
          pending = true
          return
        }
        const baseline = latest
        const arriving = initialized ? items.filter(item => !baseline || newestFirst(item, baseline) < 0) : []
        if (items[0] && (!latest || newestFirst(items[0], latest) < 0)) latest = items[0]
        initialized = true
        retryDelay = 2000
        setUnread(current => current.length === items.length && current.every((item, index) => item.id === items[index].id) ? current : items)
        if (arriving.length) {
          setAlert({ item: arriving[0], count: arriving.length })
          if (soundEnabled.current && document.hasFocus()) play()
        }
      } catch {
        if (active) {
          pending = true
          retry = window.setTimeout(() => {
            retry = undefined
            void syncUnread()
          }, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30_000)
        }
      } finally {
        running = false
        if (pending) void syncUnread()
      }
    }

    const invalidate = () => {
      pending = true
      void syncUnread()
    }
    refreshUnread.current = invalidate
    const stop = subscribeToNotifications(operationId => {
      if (!operationId || operationId !== bulkOperation.current) invalidate()
    }, () => {
      if (!initialized && !running && !pending) invalidate()
    })
    document.addEventListener('visibilitychange', syncUnread)
    return () => {
      active = false
      refreshUnread.current = () => {}
      stop()
      window.clearTimeout(retry)
      document.removeEventListener('visibilitychange', syncUnread)
    }
  }, [userId, play])

  const dismiss = useCallback(() => setAlert(undefined), [])

  function applyReadState(notificationIds: string[], readAt: string) {
    if (!notificationIds.length) return
    revision.current++
    const ids = new Set(notificationIds)
    setReadUpdates(current => {
      const updated = new Map(current)
      for (const id of ids) updated.set(id, readAt)
      return updated
    })
    setUnread(current => current.filter(item => !ids.has(item.id)))
    setAlert(current => current && ids.has(current.item.id) ? undefined : current)
  }

  function markRead(item: Notice) {
    const saved = readUpdates.get(item.id)
    if (item.read_at || saved) return Promise.resolve(saved ? { ...item, read_at: saved } : item)
    const existing = reads.current.get(item.id)
    if (existing) return existing
    const operation = request<Notice>(`/notifications/${encodeURIComponent(item.id)}`, { method: 'PATCH' }).then(updated => {
      if (updated.read_at) applyReadState([item.id], updated.read_at)
      return updated
    }).finally(() => { reads.current.delete(item.id) })
    reads.current.set(item.id, operation)
    return operation
  }

  async function markAllRead() {
    const operationId = crypto.randomUUID()
    bulkOperation.current = operationId
    try {
      const result = await request<BulkReadResult>('/notifications/read-all', {
        method: 'PATCH', data: { operation_id: operationId },
      })
      applyReadState(result.notification_ids, result.read_at)
    } catch (error) {
      refreshUnread.current()
      throw error
    }
  }

  return { unread, readUpdates, alert, dismiss, markRead, markAllRead, sound }
}

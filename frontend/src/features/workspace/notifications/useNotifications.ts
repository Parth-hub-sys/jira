import { useCallback, useEffect, useRef, useState } from 'react'
import { request } from '../api'
import type { Mode } from '../api'
import type { Notice } from '../model'
import { fetchNotifications, newestFirst, notificationPageSize } from './model'
import type { NotificationAlert } from './model'
import { useNotificationSound } from './useNotificationSound'

const pollInterval = 15_000

export function useNotifications(mode: Mode, userId: string | undefined) {
  const [unread, setUnread] = useState<Notice[]>([])
  const [readUpdates, setReadUpdates] = useState<ReadonlyMap<string, Notice>>(() => new Map())
  const [alert, setAlert] = useState<NotificationAlert>()
  const reads = useRef(new Map<string, Promise<Notice>>())
  const revision = useRef(0)
  const refresh = useRef<() => void>(() => {})
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
    let lastRequest = -Infinity
    let retryAt = 0
    let delay = pollInterval

    async function poll() {
      const now = performance.now()
      if (!active || document.hidden || running || now - lastRequest < 1000 || now < retryAt) return
      lastRequest = now
      running = true
      const started = revision.current
      try {
        const items = await fetchNotifications(mode, 0, true)
        if (!active || document.hidden || started !== revision.current) return
        const baseline = latest
        const arriving = initialized ? items.filter(item => !baseline || newestFirst(item, baseline) < 0) : []
        if (items[0] && (!latest || newestFirst(items[0], latest) < 0)) latest = items[0]
        initialized = true
        delay = pollInterval
        retryAt = 0
        setUnread(current => current.length === items.length && current.every((item, index) => item.id === items[index].id) ? current : items)
        if (arriving.length && mode === 'live') {
          setAlert({ item: arriving[0], count: arriving.length })
          if (soundEnabled.current && document.hasFocus()) play()
        }
      } catch {
        retryAt = performance.now() + delay
        delay = Math.min(delay * 2, 60_000)
      } finally {
        running = false
      }
    }

    const run = () => { void poll() }
    refresh.current = run
    run()
    if (mode === 'demo') return () => { active = false; refresh.current = () => {} }
    const timer = window.setInterval(run, pollInterval)
    document.addEventListener('visibilitychange', run)
    window.addEventListener('focus', run)
    return () => {
      active = false
      refresh.current = () => {}
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('focus', run)
    }
  }, [mode, userId, play])

  const dismiss = useCallback(() => setAlert(undefined), [])

  function markRead(item: Notice) {
    const saved = readUpdates.get(item.id)
    if (item.read_at || saved) return Promise.resolve(saved ?? item)
    const existing = reads.current.get(item.id)
    if (existing) return existing
    const operation = request<Notice>(mode, `/notifications/${encodeURIComponent(item.id)}`, { method: 'PATCH' }).then(updated => {
      revision.current++
      setReadUpdates(current => new Map(current).set(item.id, updated))
      setUnread(current => current.filter(entry => entry.id !== item.id))
      setAlert(current => current?.item.id === item.id ? undefined : current)
      if (unread.length > notificationPageSize) refresh.current()
      return updated
    }).finally(() => { reads.current.delete(item.id) })
    reads.current.set(item.id, operation)
    return operation
  }

  return { unread, readUpdates, alert, dismiss, markRead, sound }
}

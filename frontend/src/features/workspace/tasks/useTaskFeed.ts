import { useEffect, useState } from 'react'
import { messageOf } from '../../../shared/lib/text'
import { request } from '../api'
import type { Mode } from '../api'

const pageSize = 30

interface FeedPage<T> {
  items: T[]
  nextOffset: number | null
}

async function readPage<T>(mode: Mode, path: string, offset: number): Promise<FeedPage<T>> {
  const items = await request<T[]>(mode, `${path}?limit=${pageSize + 1}&offset=${offset}`)
  return {
    items: items.slice(0, pageSize),
    nextOffset: items.length > pageSize ? offset + pageSize : null,
  }
}

export function useTaskFeed<T extends { id: string }>(mode: Mode, path: string) {
  const [page, setPage] = useState<FeedPage<T>>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    readPage<T>(mode, path, 0).then(result => {
      if (current) setPage(result)
    }).catch(failure => {
      if (current) setError(messageOf(failure))
    }).finally(() => {
      if (current) setLoading(false)
    })
    return () => { current = false }
  }, [mode, path, attempt])

  async function loadMore() {
    if (loading || !page || page.nextOffset === null) return
    setLoading(true)
    setError('')
    try {
      const next = await readPage<T>(mode, path, page.nextOffset)
      const existing = new Set(page.items.map(item => item.id))
      setPage({ ...next, items: [...page.items, ...next.items.filter(item => !existing.has(item.id))] })
    } catch (failure) { setError(messageOf(failure)) }
    finally { setLoading(false) }
  }

  function retry() {
    setLoading(true)
    setError('')
    setAttempt(current => current + 1)
  }

  return { page, setPage, loading, error, loadMore, retry }
}

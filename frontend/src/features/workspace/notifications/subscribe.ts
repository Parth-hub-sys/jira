import { ApiError, authorizedEventStream } from '../../../shared/api'

export function subscribeToNotifications(onChange: (operationId?: string) => void, onUnavailable: () => void) {
  let stopped = false
  let connection: AbortController | undefined
  let retry: number | undefined
  let delay = 1000

  async function connect() {
    if (stopped) return
    const attempt = new AbortController()
    connection = attempt
    let timeout = window.setTimeout(() => attempt.abort(), 20_000)
    let status: number | undefined
    try {
      const body = await authorizedEventStream('/notifications/stream', attempt.signal)
      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done || stopped) break
          window.clearTimeout(timeout)
          timeout = window.setTimeout(() => attempt.abort(), 60_000)
          buffer += decoder.decode(value, { stream: true })
          let boundary: number
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const [event, data] = buffer.slice(0, boundary).split('\n')
            buffer = buffer.slice(boundary + 2)
            if (event === 'event: ready') {
              delay = 1000
              onChange()
            }
            if (event === 'event: changed') onChange(data === 'data: {}' ? undefined : data?.slice(6))
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      if (error instanceof ApiError) status = error.status
    } finally {
      window.clearTimeout(timeout)
      attempt.abort()
    }
    if (stopped || status === 401) return
    onUnavailable()
    retry = window.setTimeout(() => void connect(), delay)
    delay = Math.min(delay * 2, 30_000)
  }

  void connect()
  return () => {
    stopped = true
    connection?.abort()
    window.clearTimeout(retry)
  }
}

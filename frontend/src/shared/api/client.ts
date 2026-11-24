type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type RequestOptions = { method?: Method; data?: unknown }
type BrowserTokens = { access_token: string }

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api/v1'
const sessionRefreshTimeoutMs = 8000
let session: BrowserTokens | null = null
let generation = 0
let refreshing: Promise<void> | undefined
let authQueue: Promise<unknown> = Promise.resolve()
const sessionListeners = new Set<() => void>()
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('fluztech.auth')

try {
  sessionStorage.removeItem('fluztech.api-session')
  sessionStorage.removeItem('relay.api-session')
} catch { /* This client can run with storage disabled. */ }

function endSession() {
  session = null
  generation += 1
  sessionListeners.forEach(listener => listener())
}

channel?.addEventListener('message', event => {
  if (event.data === 'session-changed') endSession()
})

export function onSessionEnd(listener: () => void) {
  sessionListeners.add(listener)
  return () => { sessionListeners.delete(listener) }
}

async function serializeAuth<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (navigator.locks) return await navigator.locks.request('fluztech.auth', { signal }, operation)
  const result = authQueue.then(operation, operation)
  authQueue = result
  return result
}

async function fetchResponse(path: string, { method = 'GET', data }: RequestOptions = {}, key?: string, browserAuth = false, signal?: AbortSignal, accept?: string): Promise<Response> {
  try {
    return await fetch(base + path, {
      method,
      signal,
      credentials: browserAuth ? 'same-origin' : 'omit',
      ...(browserAuth ? { mode: 'same-origin' as const } : {}),
      headers: {
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accept ? { Accept: accept } : {}),
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(browserAuth ? { 'X-Auth-Mode': 'cookie' } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
  } catch {
    signal?.throwIfAborted()
    throw new ApiError(0, 'Could not reach the workspace server.')
  }
}

async function send<T>(path: string, options?: RequestOptions, key?: string, browserAuth = false, signal?: AbortSignal): Promise<T> {
  const response = await fetchResponse(path, options, key, browserAuth, signal)
  if (response.status === 204) return undefined as T
  const result = await response.json().catch(() => null)
  signal?.throwIfAborted()
  if (!response.ok) {
    const detail = result?.detail
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map(item => item.msg).join('. ')
        : response.status >= 500 ? 'The workspace server is unavailable.' : 'The request could not be completed.'
    throw new ApiError(response.status, message)
  }
  if (result === null) throw new ApiError(0, 'The server did not return workspace data.')
  return result as T
}

export async function signIn(email: string, password: string) {
  await serializeAuth(async () => {
    const response = await send<BrowserTokens>('/auth/login', { method: 'POST', data: { email, password } }, undefined, true)
    generation += 1
    session = { access_token: response.access_token }
    channel?.postMessage('session-changed')
  })
}

export async function signOut() {
  await serializeAuth(async () => {
    await send('/auth/logout', { method: 'POST' }, undefined, true)
    endSession()
    channel?.postMessage('session-changed')
  })
}

async function refreshSession() {
  if (!refreshing) {
    const started = generation
    const signal = AbortSignal.timeout(sessionRefreshTimeoutMs)
    refreshing = serializeAuth(async () => {
      signal.throwIfAborted()
      if (started !== generation) throw new ApiError(401, 'Sign in to continue.')
      try {
        const response = await send<BrowserTokens>('/auth/refresh', { method: 'POST' }, undefined, true, signal)
        if (started === generation) session = { access_token: response.access_token }
      } catch (error) {
        if (started === generation && error instanceof ApiError && error.status === 401) endSession()
        throw error
      }
    }, signal).catch(error => {
      if (signal.aborted) throw new ApiError(0, 'Restoring your session took too long. Try signing in again.')
      throw error
    }).finally(() => { refreshing = undefined })
  }
  await refreshing
}

export async function restoreSession() {
  if (session) return true
  await refreshSession()
  return Boolean(session)
}

async function withAuthorization<T>(operation: (key: string) => Promise<T>): Promise<T> {
  const original = session
  const started = generation
  if (!original) throw new ApiError(401, 'Sign in to continue.')
  try {
    return await operation(original.access_token)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error
    if (started === generation && session === original) await refreshSession()
    if (started !== generation || !session) throw new ApiError(401, 'Your session expired. Sign in to continue.')
    return operation(session.access_token)
  }
}

export function authorizedRequest<T>(path: string, options?: RequestOptions): Promise<T> {
  return withAuthorization(key => send<T>(path, options, key))
}

export function authorizedEventStream(path: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  return withAuthorization(async key => {
    signal.throwIfAborted()
    const response = await fetchResponse(path, undefined, key, false, signal, 'text/event-stream')
    if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('text/event-stream')) {
      await response.body?.cancel()
      throw new ApiError(response.status, 'Could not open the notification stream.')
    }
    return response.body
  })
}

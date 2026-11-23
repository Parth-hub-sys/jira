type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type RequestOptions = { method?: Method; data?: unknown }
type BrowserTokens = { access_token: string }

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api/v1'
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

async function serializeAuth<T>(operation: () => Promise<T>): Promise<T> {
  if (navigator.locks) return await navigator.locks.request('fluztech.auth', operation)
  const result = authQueue.then(operation, operation)
  authQueue = result
  return result
}

async function send<T>(path: string, { method = 'GET', data }: RequestOptions = {}, key?: string, browserAuth = false): Promise<T> {
  let response: Response
  try {
    response = await fetch(base + path, {
      method,
      credentials: browserAuth ? 'same-origin' : 'omit',
      ...(browserAuth ? { mode: 'same-origin' as const } : {}),
      headers: {
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(browserAuth ? { 'X-Auth-Mode': 'cookie' } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the workspace server.')
  }
  if (response.status === 204) return undefined as T
  const result = await response.json().catch(() => null)
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
    refreshing = serializeAuth(async () => {
      if (started !== generation) throw new ApiError(401, 'Sign in to continue.')
      try {
        const response = await send<BrowserTokens>('/auth/refresh', { method: 'POST' }, undefined, true)
        if (started === generation) session = { access_token: response.access_token }
      } catch (error) {
        if (started === generation && error instanceof ApiError && error.status === 401) endSession()
        throw error
      }
    }).finally(() => { refreshing = undefined })
  }
  await refreshing
}

export async function restoreSession() {
  if (session) return true
  await refreshSession()
  return Boolean(session)
}

export async function authorizedRequest<T>(path: string, options?: RequestOptions): Promise<T> {
  const original = session
  const started = generation
  if (!original) throw new ApiError(401, 'Sign in to continue.')
  try {
    return await send<T>(path, options, original.access_token)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error
    if (started === generation && session === original) await refreshSession()
    if (started !== generation || !session) throw new ApiError(401, 'Your session expired. Sign in to continue.')
    return send<T>(path, options, session.access_token)
  }
}

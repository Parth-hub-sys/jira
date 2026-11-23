import { useCallback, useEffect, useState } from 'react'
import type { WorkFilters } from '../features/workspace'

export const workspaceViews = ['overview', 'projects', 'board', 'list', 'members'] as const
export type WorkspaceView = typeof workspaceViews[number]
type View = WorkspaceView | 'sign-in'
export type Route = { view: View; filters: WorkFilters; task: string }

export const blankFilters: WorkFilters = { query: '', priority: '', status: '', label: '', mine: false }

export function viewRoute(view: View, filters = blankFilters): Route {
  return { view, filters, task: '' }
}

function readRoute(): Route {
  const [name, query] = window.location.hash.replace(/^#\/?/, '').split('?')
  const values = new URLSearchParams(query)
  const view = name === 'sign-in' || (!name && window.location.pathname === '/login') ? 'sign-in'
    : workspaceViews.find(item => item === name) ?? 'board'
  return {
    view,
    task: values.get('task') ?? '',
    filters: {
      query: values.get('q') ?? '', priority: values.get('priority') ?? '',
      status: values.get('status') ?? '', label: values.get('label') ?? '', mine: values.get('mine') === '1',
    },
  }
}

function hrefFor(route: Route) {
  const values = new URLSearchParams()
  if (route.task) values.set('task', route.task)
  if (route.filters.query) values.set('q', route.filters.query)
  if (route.filters.priority) values.set('priority', route.filters.priority)
  if (route.filters.status) values.set('status', route.filters.status)
  if (route.filters.label) values.set('label', route.filters.label)
  if (route.filters.mine) values.set('mine', '1')
  return `#/${route.view}${values.size ? '?' + values : ''}`
}

export function useAppRoute() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const sync = () => setRoute(readRoute())
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  const navigate = useCallback((next: Route, replace = false) => {
    const href = hrefFor(next)
    const leaveLoginPath = window.location.pathname === '/login' && next.view !== 'sign-in'
    if (leaveLoginPath || href !== window.location.hash) window.history[replace ? 'replaceState' : 'pushState'](null, '', leaveLoginPath ? '/' + href : href)
    setRoute(next)
  }, [])

  return { route, navigate }
}

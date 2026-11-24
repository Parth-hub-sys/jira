import { useCallback, useEffect, useState } from 'react'
import { SignInPage } from '../features/auth/SignInPage'
import { WorkspacePage } from '../features/workspace/WorkspacePage'
import { ApiError, onSessionEnd, restoreSession, signIn, signOut } from '../shared/api'
import { Brand } from '../shared/ui/Brand'
import { useAppRoute, viewRoute } from './routing'
import { ThemeControl } from './theme/ThemeControl'
import { useTheme } from './theme/useTheme'
import './app.css'

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const [restoreError, setRestoreError] = useState('')
  const { route, navigate } = useAppRoute()
  const { dark, toggleTheme } = useTheme()
  const appearance = <ThemeControl dark={dark} onToggle={toggleTheme} />

  const showSignIn = useCallback(() => {
    setAuthenticated(false)
    navigate(viewRoute('sign-in'), true)
  }, [navigate])

  useEffect(() => {
    if (!restoring) return
    let active = true
    restoreSession().then(restored => {
      if (active && restored) setAuthenticated(true)
    }).catch(error => {
      if (!active || (error instanceof ApiError && error.status === 401)) return
      setRestoreError(error instanceof ApiError && error.status === 0 ? error.message : 'Could not restore your session. Try signing in again.')
    }).finally(() => { if (active) setRestoring(false) })
    return () => { active = false }
  }, [restoring])

  useEffect(() => onSessionEnd(() => {
    if (authenticated) showSignIn()
  }), [authenticated, showSignIn])

  if (restoring) return <main className="app session-loading" role="status"><Brand /><span>Opening workspace…</span></main>

  if (!authenticated || route.view === 'sign-in') {
    return <SignInPage brand={<Brand />} themeControl={appearance} restoreError={restoreError}
      onSignIn={async (email, password) => {
        setRestoreError('')
        await signIn(email, password)
        setAuthenticated(true)
        if (route.view === 'sign-in') navigate(viewRoute('board'), true)
      }}
    />
  }

  return <WorkspacePage route={route} navigate={navigate} appearance={appearance}
    onSignIn={showSignIn}
    onSignOut={signOut}
  />
}

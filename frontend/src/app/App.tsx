import { useCallback, useEffect, useState } from 'react'
import { SignInPage } from '../features/auth/SignInPage'
import { WorkspacePage } from '../features/workspace/WorkspacePage'
import type { Mode } from '../features/workspace/api'
import { onSessionEnd, restoreSession, signIn, signOut } from '../shared/api'
import { Brand } from '../shared/ui/Brand'
import { useAppRoute, viewRoute } from './routing'
import { ThemeControl } from './theme/ThemeControl'
import { useTheme } from './theme/useTheme'
import './app.css'

const demoKey = 'fluztech.demo-active'

function startMode(): Mode | null {
  return sessionStorage.getItem(demoKey) === 'yes' ? 'demo' : null
}

export default function App() {
  const [mode, setMode] = useState(startMode)
  const [restoring, setRestoring] = useState(mode !== 'demo')
  const { route, navigate } = useAppRoute()
  const { dark, toggleTheme } = useTheme()
  const appearance = <ThemeControl dark={dark} onToggle={toggleTheme} />

  const showSignIn = useCallback(() => {
    sessionStorage.removeItem(demoKey)
    setMode(null)
    navigate(viewRoute('sign-in'), true)
  }, [navigate])

  useEffect(() => {
    if (!restoring) return
    let active = true
    restoreSession().then(restored => {
      if (active && restored) setMode('live')
    }).catch(() => {
      // The sign-in form can retry if the backend is unavailable.
    }).finally(() => { if (active) setRestoring(false) })
    return () => { active = false }
  }, [restoring])

  useEffect(() => onSessionEnd(() => {
    if (mode === 'live') showSignIn()
  }), [mode, showSignIn])

  if (restoring) return <main className="app session-loading" role="status"><Brand /><span>Opening workspace…</span></main>

  if (!mode || route.view === 'sign-in') {
    return <SignInPage brand={<Brand />} themeControl={appearance}
      onSignIn={async (email, password) => {
        await signIn(email, password)
        sessionStorage.removeItem(demoKey)
        setMode('live')
        if (route.view === 'sign-in') navigate(viewRoute('board'), true)
      }}
      onDemo={() => {
        sessionStorage.setItem(demoKey, 'yes')
        setMode('demo')
        navigate(viewRoute('board'), true)
      }}
    />
  }

  return <WorkspacePage key={mode} mode={mode} route={route} navigate={navigate} appearance={appearance}
    onSignIn={showSignIn}
    onSignOut={signOut}
  />
}

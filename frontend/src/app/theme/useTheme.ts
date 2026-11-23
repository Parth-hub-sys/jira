import { useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

type Theme = 'light' | 'dark'
const storageKey = 'fluztech.theme'

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === 'dark' || value === 'light') return value
  } catch { /* Fall back to light mode. */ }
  return 'light'
}

export function useTheme() {
  const [theme, chooseTheme] = useState(readTheme)
  const preferred = useRef(theme)
  const transition = useRef<ViewTransition | null>(null)
  const dark = theme === 'dark'
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141714' : '#ebe8de')
  }, [dark])

  function toggleTheme() {
    const next = preferred.current === 'dark' ? 'light' : 'dark'
    preferred.current = next
    try { localStorage.setItem(storageKey, next) } catch { /* Use the preference until this tab closes. */ }
    transition.current?.skipTransition()
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      chooseTheme(next)
      return
    }
    const current = document.startViewTransition(() => {
      flushSync(() => chooseTheme(preferred.current))
    })
    transition.current = current
    void current.finished.catch(() => undefined).then(() => {
      if (transition.current === current) transition.current = null
    })
  }

  return { dark, toggleTheme }
}

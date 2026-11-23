import { useCallback, useEffect, useRef, useState } from 'react'

const preferenceKey = 'fluztech.notification-sound'

export function useNotificationSound() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(preferenceKey) !== 'off' } catch { return true }
  })
  const audio = useRef<AudioContext>(null)

  const play = useCallback(() => {
    const context = audio.current
    if (!context || context.state !== 'running') return
    const start = context.currentTime + .015
    for (const [index, frequency] of [659.25, 880].entries()) {
      const time = start + index * .10
      const note = context.createOscillator()
      const volume = context.createGain()
      note.type = 'sine'
      note.frequency.value = frequency
      volume.gain.setValueAtTime(.001, time)
      volume.gain.exponentialRampToValueAtTime(.065, time + .025)
      volume.gain.exponentialRampToValueAtTime(.001, time + .18)
      note.connect(volume).connect(context.destination)
      note.onended = () => { note.disconnect(); volume.disconnect() }
      note.start(time)
      note.stop(time + .19)
    }
  }, [])

  const unlock = useCallback(async () => {
    try {
      audio.current ??= new AudioContext()
      if (audio.current.state !== 'running') await audio.current.resume()
    } catch { /* Visual alerts remain available. */ }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const gesture = (event: Event) => { if (event.isTrusted && audio.current?.state !== 'running') void unlock() }
    window.addEventListener('click', gesture)
    window.addEventListener('keydown', gesture)
    return () => {
      window.removeEventListener('click', gesture)
      window.removeEventListener('keydown', gesture)
    }
  }, [enabled, unlock])

  useEffect(() => () => {
    void audio.current?.close().catch(() => undefined)
    audio.current = null
  }, [])

  function toggle() {
    const next = !enabled
    setEnabled(next)
    try { localStorage.setItem(preferenceKey, next ? 'on' : 'off') } catch { /* Keep the setting for this session. */ }
    if (next) void unlock().then(play)
  }

  return { enabled, toggle, play }
}

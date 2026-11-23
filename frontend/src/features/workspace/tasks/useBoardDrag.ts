import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { transitions } from '../model'
import type { Status, Task } from '../model'

type DragState = { task: Task; target: Status | null; width: number; height: number }
type Gesture = DragState & {
  id: number; startX: number; startY: number; offsetX: number; offsetY: number
  x: number; y: number; started: boolean; settling: boolean
}

function positionPreview(node: HTMLElement, gesture: Gesture) {
  const x = gesture.x - gesture.offsetX
  const y = gesture.y - gesture.offsetY
  node.style.transform = `translate3d(${x}px, ${y}px, 0)`
}

export function useBoardDrag(moveTask: (task: Task, status: Status) => void | Promise<void>) {
  const boardRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const moveRef = useRef(moveTask)
  const [drag, setDrag] = useState<DragState | null>(null)

  useEffect(() => { moveRef.current = moveTask }, [moveTask])

  useEffect(() => {
    function targetAt(event: PointerEvent, task: Task) {
      const lane = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-lane-status]')
      const status = lane?.dataset.laneStatus as Status | undefined
      return lane && boardRef.current?.contains(lane) && status && transitions[task.status]?.includes(status) ? status : null
    }

    function stop() {
      const gesture = gestureRef.current
      gestureRef.current = null
      if (!gesture?.started) return
      const board = boardRef.current
      if (board?.hasPointerCapture(gesture.id)) board.releasePointerCapture(gesture.id)
      setDrag(null)
    }

    function move(event: PointerEvent) {
      const gesture = gestureRef.current
      if (!gesture || gesture.id !== event.pointerId || gesture.settling) return
      if (!gesture.started) {
        if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 6) return
        boardRef.current?.setPointerCapture(event.pointerId)
        gesture.started = true
        setDrag({ ...gesture })
      }
      event.preventDefault()
      gesture.x = event.clientX
      gesture.y = event.clientY
      const target = targetAt(event, gesture.task)
      if (target !== gesture.target) {
        gesture.target = target
        setDrag({ ...gesture })
      }
      if (previewRef.current) positionPreview(previewRef.current, gesture)
    }

    async function release(event: PointerEvent) {
      const gesture = gestureRef.current
      if (!gesture || gesture.id !== event.pointerId || gesture.settling) return
      const target = gesture.started ? targetAt(event, gesture.task) : null
      if (!target) { stop(); return }

      gesture.settling = true
      const slot = boardRef.current?.querySelector(`[data-lane-status="${target}"] .board-drop-slot`)?.getBoundingClientRect()
      const preview = previewRef.current
      const animation = slot && preview && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? preview.animate([
          { transform: preview.style.transform },
          { transform: `translate3d(${slot.left}px, ${slot.top}px, 0)` },
        ], { duration: 170, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'forwards' })
        : undefined
      void moveRef.current(gesture.task, target)
      await animation?.finished.catch(() => undefined)
      if (gestureRef.current === gesture) stop()
    }

    function cancel(event: PointerEvent) {
      if (gestureRef.current?.id === event.pointerId) stop()
    }

    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') stop()
    }

    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', stop)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', stop)
      window.removeEventListener('keydown', escape)
      gestureRef.current = null
    }
  }, [])

  function startDrag(event: ReactPointerEvent<HTMLElement>, task: Task) {
    if (gestureRef.current || event.button !== 0 || !event.isPrimary || event.pointerType === 'touch') return
    if (event.target instanceof Element && event.target.closest('.dropdown')) return
    const card = event.currentTarget.getBoundingClientRect()
    gestureRef.current = {
      id: event.pointerId, task, target: null, width: card.width, height: card.height, started: false, settling: false,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      offsetX: event.clientX - card.left, offsetY: event.clientY - card.top,
    }
  }

  function attachPreview(node: HTMLDivElement | null) {
    previewRef.current = node
    if (node && gestureRef.current) positionPreview(node, gestureRef.current)
  }

  return { boardRef, drag, startDrag, attachPreview }
}

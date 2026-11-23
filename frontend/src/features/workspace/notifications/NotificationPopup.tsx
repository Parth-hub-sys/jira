import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Bell, MessageSquare, X } from 'lucide-react'
import { noticeTask, noticeTitle } from './model'
import type { NotificationAlert } from './model'

function modalHost() {
  return Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1) ?? document.body
}

export function NotificationPopup({ alert, onOpen, onDismiss }: {
  alert: NotificationAlert; onOpen(): void; onDismiss(): void
}) {
  const [host, setHost] = useState(modalHost)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const popup = useRef<HTMLDivElement>(null)
  const task = noticeTask(alert.item)
  const Icon = alert.item.type === 'task.commented' ? MessageSquare : Bell

  useLayoutEffect(() => {
    const observer = new MutationObserver(() => setHost(modalHost()))
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const element = popup.current
    element?.showPopover()
    return () => {
      if (element?.matches(':popover-open')) element.hidePopover()
    }
  }, [host])

  useEffect(() => {
    if (hovered || focused) return
    const timer = window.setTimeout(onDismiss, 9500)
    return () => window.clearTimeout(timer)
  }, [hovered, focused, onDismiss])

  return createPortal(
    <div className="notice-popup" ref={popup} popover="manual"
      onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <span className="notice-type-icon"><Icon size={20} /></span>
      <div className="notice-popup-content">
        <div role="status">
          <strong>{noticeTitle(alert.item)}</strong>
          {task?.task_title && <p>{task.task_title}</p>}
          {alert.count > 1 && <p>{alert.count - 1} more new {alert.count === 2 ? 'notification' : 'notifications'}</p>}
        </div>
        <button type="button" className="text-button" onClick={onOpen}>Open notifications <ArrowUpRight size={15} /></button>
      </div>
      <button type="button" className="icon-button tiny" aria-label="Dismiss new notification" onClick={onDismiss}><X size={17} /></button>
    </div>, host,
  )
}

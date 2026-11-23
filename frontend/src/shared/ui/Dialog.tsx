import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({ title, onClose, children, drawer = false, className = '' }: {
  title: string; onClose(): void; children: ReactNode; drawer?: boolean; className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-first-focus]')?.focus()
    return () => {
      dialog.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`dialog ${drawer ? 'drawer' : ''} ${className}`}
      aria-label={title}
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()
        if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) onClose()
      }}
    >
      <header className="dialog-header"><h2>{title}</h2><button className="icon-button close" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={20} /></button></header>
      {children}
    </dialog>
  )
}

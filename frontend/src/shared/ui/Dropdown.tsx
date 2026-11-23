import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'

type Option<T> = { value: T; label: string; icon?: ReactNode }

type Props<T extends string> = {
  label: string
  value?: T
  options: readonly Option<T>[]
  onChange(value: T): void
  placeholder?: string
  leading?: ReactNode
  className?: string
  disabled?: boolean
  iconOnly?: boolean
  firstFocus?: boolean
}

export function Dropdown<T extends string>({
  label, value, options, onChange, placeholder = label, leading, className = '',
  disabled = false, iconOnly = false, firstFocus = false,
}: Props<T>) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const startAtEnd = useRef(false)
  const [open, setOpen] = useState(false)
  const selecting = value !== undefined
  const visible = open && !disabled && options.length > 0
  const selected = options.find(option => option.value === value)

  useLayoutEffect(() => {
    if (!visible) return
    const anchor = trigger.current!
    const menu = popup.current!
    function position() {
      const rect = anchor.getBoundingClientRect()
      const gap = 7
      const margin = 8
      const width = Math.min(window.innerWidth - margin * 2, Math.max(rect.width, 184))
      const below = window.innerHeight - rect.bottom - gap - margin
      const above = rect.top - gap - margin
      menu.style.width = `${width}px`
      const upward = below < Math.min(menu.scrollHeight, 280) && above > below
      const left = iconOnly ? rect.right - width : rect.left
      menu.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - width - margin))}px`
      menu.style.maxHeight = `${Math.max(0, Math.min(upward ? above : below, 280))}px`
      menu.style.top = upward ? 'auto' : `${rect.bottom + gap}px`
      menu.style.bottom = upward ? `${window.innerHeight - rect.top + gap}px` : 'auto'
    }
    menu.showPopover()
    position()
    const items = menu.querySelectorAll<HTMLButtonElement>('button')
    const initial = startAtEnd.current ? items[items.length - 1] : menu.querySelector<HTMLButtonElement>('[aria-selected="true"]') ?? items[0]
    initial?.focus()
    function closeOutside(event: Event) {
      if (event.target instanceof Node && !anchor.contains(event.target) && !menu.contains(event.target)) setOpen(false)
    }
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('focusin', closeOutside)
    return () => {
      if (menu.matches(':popover-open')) menu.hidePopover()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('focusin', closeOutside)
    }
  }, [visible, iconOnly])

  function close() {
    setOpen(false)
    trigger.current?.focus()
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      event.preventDefault()
      close()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
    const index = items.findIndex(item => item === document.activeElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  return <div className={`dropdown ${className}`}>
    <button ref={trigger} type="button" className="dropdown-trigger" aria-label={label} aria-expanded={visible}
      aria-describedby={selecting && !iconOnly ? `${id}-value` : undefined}
      aria-haspopup={selecting ? 'listbox' : 'menu'} aria-controls={id} disabled={disabled || !options.length}
      data-first-focus={firstFocus ? '' : undefined}
      onClick={() => { startAtEnd.current = false; setOpen(current => !current) }}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        startAtEnd.current = event.key === 'ArrowUp'
        setOpen(true)
      }}>
      {leading}
      {!iconOnly && <><span className="dropdown-value" id={`${id}-value`}>{selected?.label ?? placeholder}</span><ChevronDown className="dropdown-chevron" size={15} /></>}
    </button>
    <div ref={popup} id={id} popover="manual" className="dropdown-menu" role={selecting ? 'listbox' : 'menu'} aria-label={label} onKeyDown={moveFocus}>
      {visible && options.map(option => <button type="button" key={option.value} tabIndex={-1}
        role={selecting ? 'option' : 'menuitem'} aria-selected={selecting ? option.value === value : undefined}
        onClick={() => { close(); onChange(option.value) }}>
        {option.icon}<span>{option.label}</span>{option.value === value && <Check size={16} />}
      </button>)}
    </div>
  </div>
}

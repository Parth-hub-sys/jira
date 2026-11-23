import { Moon, Sun } from 'lucide-react'

export function ThemeControl({ dark, onToggle }: { dark: boolean; onToggle(): void }) {
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'
  return <button type="button" className="icon-button theme-toggle" aria-label={label} title={label} onClick={onToggle}>
    {dark ? <Moon key="dark" size={18} aria-hidden /> : <Sun key="light" size={19} aria-hidden />}
  </button>
}

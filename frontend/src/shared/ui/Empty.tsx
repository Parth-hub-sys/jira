import type { ReactNode } from 'react'
import { BarChart3 } from 'lucide-react'

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <div className="empty"><span className="empty-icon"><BarChart3 size={22} /></span><strong>{title}</strong>{body && <p>{body}</p>}{action}</div>
}

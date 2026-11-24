import { Aperture } from 'lucide-react'

export function Brand({ onClick }: { onClick?: () => void }) {
  const content = <><span className="brand-mark" aria-hidden><Aperture size={23} strokeWidth={2.3} /></span><span>Fluxtech</span></>
  return onClick
    ? <button type="button" className="brand" onClick={onClick} aria-label="Fluxtech overview">{content}</button>
    : <span className="brand">{content}</span>
}

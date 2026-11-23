import { initials } from '../lib/text'

export function Avatar({ name, id = '', size = '' }: { name: string; id?: string; size?: string }) {
  const hue = [...id || name].reduce((value, character) => value + character.charCodeAt(0), 0) % 4
  return <span className={`avatar avatar-${hue} ${size}`} title={name} aria-label={name}>{initials(name) || '–'}</span>
}

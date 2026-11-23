import { useState } from 'react'
import { Dialog, FormError } from '../../../shared/ui'
import { messageOf } from '../model'

function slugFor(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100).replace(/^-|-$/g, '')
}

export function CreateOrganizationDialog({ onSave, onClose }: {
  onSave(name: string, slug: string): Promise<void>; onClose(): void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  return <Dialog title="Create organization" onClose={onClose}>
    <form className="form" onSubmit={async event => {
      event.preventDefault()
      if (saving) return
      if (!name.trim()) { setError('Enter an organization name.'); return }
      setSaving(true)
      setError('')
      try { await onSave(name.trim(), slug ?? slugFor(name)) }
      catch (failure) { setError(messageOf(failure)) }
      finally { setSaving(false) }
    }}>
      <label>Organization name<input value={name} onChange={event => setName(event.target.value)} required maxLength={255} data-first-focus /></label>
      <label>Organization slug<input value={slug ?? slugFor(name)} onChange={event => setSlug(event.target.value)}
        required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" /><span className="field-note">Use lowercase letters, numbers, and hyphens. You’ll be the owner.</span></label>
      <FormError error={error} />
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={saving}>{saving ? 'Creating…' : 'Create organization'}</button>
      </div>
    </form>
  </Dialog>
}

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '../../shared/ui'

export function ProfileDialog({ name, email, accountId, onSave, onClose }: {
  name: string; email: string; accountId: string; onSave(name: string): Promise<void>; onClose(): void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const updatedName = String(new FormData(event.currentTarget).get('name')).trim()
    if (!updatedName) { setError('Enter your name.'); return }
    setSaving(true)
    setError('')
    try { await onSave(updatedName) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save your profile.') }
    finally { setSaving(false) }
  }

  return <Dialog title="Edit profile" onClose={onClose}>
    <form className="form" onSubmit={submit} aria-busy={saving}>
      <label>Email<input value={email} readOnly /></label>
      <label>Account ID<input value={accountId} readOnly /></label>
      <label>Name<input name="name" defaultValue={name} required maxLength={255} data-first-focus /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save name'}</button>
      </div>
    </form>
  </Dialog>
}

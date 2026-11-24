import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '../../../shared/ui'
import { getOrganization, renameOrganization } from '../api'
import { longDate, messageOf } from '../model'
import type { Organization } from '../model'

type Props = {
  organizationId: string
  canManage: boolean
  onSaved(organization: Organization): void
  onClose(): void
}

export function OrganizationDialog({ organizationId, canManage, onSaved, onClose }: Props) {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    getOrganization(organizationId).then(result => {
      if (!active) return
      setOrganization(result)
      setName(result.name)
    }).catch(failure => { if (active) setError(messageOf(failure)) })
    return () => { active = false }
  }, [organizationId, attempt])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!canManage || saving || !nextName || nextName === organization?.name) return
    setError('')
    setSaving(true)
    try {
      const updated = await renameOrganization(organizationId, nextName)
      setOrganization(updated)
      setName(updated.name)
      onSaved(updated)
      onClose()
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setSaving(false)
    }
  }

  return <Dialog title="Organization details" onClose={onClose}>
    {organization ? <form className="form" onSubmit={submit} aria-busy={saving}>
      <label>Organization name<input required maxLength={255} readOnly={!canManage} value={name} onChange={event => setName(event.target.value)} /></label>
      <dl className="task-facts organization-facts">
        <div><dt>Slug</dt><dd>{organization.slug}</dd></div>
        <div><dt>Created</dt><dd>{longDate.format(new Date(organization.created_at))} IST</dd></div>
        <div><dt>Organization ID</dt><dd>{organization.id}</dd></div>
      </dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onClose}>{canManage ? 'Cancel' : 'Close'}</button>
        {canManage && <button className="button primary" disabled={saving || !name.trim() || name.trim() === organization.name}>{saving ? 'Saving…' : 'Save name'}</button>}
      </div>
    </form> : <div className="form">{error ? <>
      <p className="form-error" role="alert">{error}</p>
      <button className="button secondary" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button>
    </> : <p role="status" className="muted">Loading organization…</p>}</div>}
  </Dialog>
}

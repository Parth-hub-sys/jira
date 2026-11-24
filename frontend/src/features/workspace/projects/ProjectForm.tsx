import { useState } from 'react'
import { Dialog, FormError } from '../../../shared/ui'
import { messageOf } from '../../../shared/lib/text'
import type { Project } from '../model'

export type ProjectValues = { name: string; description: string | null }

export function ProjectFields({ project, readOnly = false }: { project?: Project; readOnly?: boolean }) {
  return <>
    <label>Project name<input name="name" required maxLength={255} placeholder="Engineering" defaultValue={project?.name} readOnly={readOnly} data-first-focus={!project || undefined} /></label>
    <label>Description<textarea name="description" rows={3} maxLength={1000} defaultValue={project?.description ?? ''} readOnly={readOnly} /></label>
  </>
}

export function ProjectForm({ onSave, onClose }: { onSave(values: ProjectValues): Promise<void>; onClose(): void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <Dialog title="New project" onClose={onClose}><form className="form" onSubmit={async event => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    if (!name) { setError('Enter a project name.'); return }
    setBusy(true)
    setError('')
    try { await onSave({ name, description: String(form.get('description')).trim() || null }) }
    catch (failure) { setError(messageOf(failure)) }
    finally { setBusy(false) }
  }}>
    <ProjectFields />
    <FormError error={error} />
    <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Creating…' : 'Create project'}</button></div>
  </form></Dialog>
}

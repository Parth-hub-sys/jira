import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Tag } from 'lucide-react'
import { Dialog, Empty, FormError } from '../../../shared/ui'
import { messageOf } from '../../../shared/lib/text'
import { listLabels, request } from '../api'
import type { Mode } from '../api'
import type { Label } from '../model'

export function LabelDialog({ mode, projectId, labels, canManage, onUpsert, onRemove, onClose }: {
  mode: Mode; projectId: string; labels?: Label[]; canManage: boolean
  onUpsert(label: Label): void; onRemove(projectId: string, id: string): void; onClose(): void
}) {
  const [loaded, setLoaded] = useState<Label[]>()
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<{ id: string; kind: 'edit' | 'delete' }>()
  const records = labels ?? loaded
  const cached = labels !== undefined
  const path = `/projects/${encodeURIComponent(projectId)}/labels`

  useEffect(() => {
    if (cached) return
    let active = true
    listLabels(mode, projectId).then(items => { if (active) setLoaded(items) })
      .catch(failure => { if (active) setError(messageOf(failure)) })
    return () => { active = false }
  }, [mode, projectId, cached, attempt])

  async function change(work: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await work(); setAction(undefined) }
    catch (failure) { setError(messageOf(failure)) }
    finally { setBusy(false) }
  }

  function save(event: FormEvent<HTMLFormElement>, label?: Label) {
    event.preventDefault()
    const form = event.currentTarget
    const name = String(new FormData(form).get('name')).trim()
    if (!name) { setError('Enter a label name.'); return }
    if (name === label?.name) { setAction(undefined); setError(''); return }
    void change(async () => {
      const saved = await request<Label>(mode, label ? `${path}/${label.id}` : path, {
        method: label ? 'PATCH' : 'POST', data: { name },
      })
      setLoaded(current => current && [...current.filter(item => item.id !== saved.id), saved])
      onUpsert(saved)
      form.reset()
    })
  }

  return <Dialog title="Project labels" onClose={onClose}>
    <div className="label-dialog">
      {canManage && records && <form className="label-create" onSubmit={save}>
        <label>Label name<input name="name" required maxLength={50} placeholder="e.g. Customer feedback" disabled={busy || !!action} data-first-focus /></label>
        <button className="button primary" disabled={busy || !!action}><Plus size={16} />Add label</button>
      </form>}
      <FormError error={error} />
      {!records && (error ? <button className="button secondary" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Retry labels</button>
        : <p className="muted" role="status">Loading labels…</p>)}
      {records && (records.length ? <ul className="label-list">
        {[...records].sort((a, b) => a.name.localeCompare(b.name)).map(label => <li key={label.id}>
          <div className="label-row">
            <span className="task-label"><Tag size={14} />{label.name}</span>
            {canManage && <div className="label-actions">
              <button className="button secondary" disabled={busy || !!action} onClick={() => { setError(''); setAction({ id: label.id, kind: 'edit' }) }}>Rename</button>
              <button className="button secondary" disabled={busy || !!action} onClick={() => { setError(''); setAction({ id: label.id, kind: 'delete' }) }}>Delete</button>
            </div>}
          </div>
          {action?.id === label.id && (action.kind === 'edit' ? <form className="label-edit" onSubmit={event => save(event, label)}>
            <label>New label name<input name="name" defaultValue={label.name} required maxLength={50} disabled={busy} autoFocus /></label>
            <div className="label-actions">
              <button className="button secondary" type="button" disabled={busy} onClick={() => { setAction(undefined); setError('') }}>Cancel</button>
              <button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save label'}</button>
            </div>
          </form> : <div className="label-edit">
            <p>Delete this label from the project and its tasks?</p>
            <div className="label-actions">
              <button className="button secondary" disabled={busy} onClick={() => { setAction(undefined); setError('') }}>Cancel</button>
              <button className="button secondary danger" disabled={busy} onClick={() => void change(async () => {
                await request<void>(mode, `${path}/${label.id}`, { method: 'DELETE' })
                setLoaded(current => current?.filter(item => item.id !== label.id))
                onRemove(projectId, label.id)
              })}>{busy ? 'Deleting…' : 'Delete label'}</button>
            </div>
          </div>)}
        </li>)}
      </ul> : <Empty title="No labels yet" />)}
    </div>
  </Dialog>
}

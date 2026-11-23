import { useState } from 'react'
import type { FormEvent } from 'react'
import { Dropdown, FormError } from '../../../shared/ui'
import { messageOf } from '../../../shared/lib/text'
import { priorities } from '../model'
import type { Member, Priority, Task } from '../model'

export type TaskValues = Pick<Task, 'title' | 'description' | 'assignee_id' | 'priority' | 'due_at'>

function inputDue(value: string | null | undefined) {
  if (!value) return ''
  return new Date(Date.parse(value) + 330 * 60_000).toISOString().slice(0, 16)
}

export function TaskForm({ task, members, onSave, onCancel }: {
  task?: Task; members: Member[]; onSave(values: TaskValues): Promise<void>; onCancel(): void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [assignee, setAssignee] = useState(task?.assignee_id ?? '')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const title = String(fields.get('title')).trim()
    if (!title) { setError('Enter a task title.'); return }
    const dueDate = String(fields.get('due_at'))
    setError('')
    setSaving(true)
    try {
      await onSave({
        title, description: String(fields.get('description')).trim() || null,
        priority,
        assignee_id: assignee || null,
        due_at: dueDate === inputDue(task?.due_at) ? task?.due_at ?? null : dueDate ? `${dueDate}:00+05:30` : null,
      })
    } catch (failure) { setError(messageOf(failure)) }
    finally { setSaving(false) }
  }
  return <form className="form" onSubmit={submit}>
    <label>Title<input name="title" defaultValue={task?.title} required maxLength={100} data-first-focus placeholder="What needs to be done?" /></label>
    <label>Description<textarea name="description" defaultValue={task?.description ?? ''} rows={4} maxLength={500} placeholder="Add context for your team" /></label>
    <div className="form-columns">
      <div className="form-field"><span>Priority</span><Dropdown<Priority> label="Priority" value={priority} disabled={saving}
        options={priorities.map(item => ({ value: item, label: item[0].toUpperCase() + item.slice(1) }))} onChange={setPriority} /></div>
      <div className="form-field"><span>Assignee</span><Dropdown label="Assignee" value={assignee} placeholder="Current assignee" disabled={saving}
        options={[{ value: '', label: 'Unassigned' }, ...members.filter(item => item.role !== 'viewer').map(item => ({ value: item.user_id, label: item.name }))]}
        onChange={setAssignee} /></div>
    </div>
    <label>Due date <span className="field-note">India Standard Time</span><input name="due_at" type="datetime-local" defaultValue={inputDue(task?.due_at)} /></label>
    <FormError error={error} />
    <div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button></div>
  </form>
}

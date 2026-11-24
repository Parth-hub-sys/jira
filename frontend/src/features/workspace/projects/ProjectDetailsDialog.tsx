import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Kanban, Users } from 'lucide-react'
import { Dialog } from '../../../shared/ui'
import { getProject, listProjectMembers, patchProject } from '../api'
import type { ProjectChanges } from '../api'
import { longDate, messageOf } from '../model'
import type { Project, Workspace } from '../model'
import { ProjectFields } from './ProjectForm'

type Props = {
  projectId: string
  workspace: Workspace
  manageOrg: boolean
  onSaved(project: Project): void
  onBoard(): void
  onMembers(): void
  onClose(): void
}

function changedFields(form: HTMLFormElement, project: Project): ProjectChanges {
  const values = new FormData(form)
  const name = String(values.get('name')).trim()
  const description = String(values.get('description')).trim() || null
  const changes: ProjectChanges = {}
  if (name && name !== project.name) changes.name = name
  if (description !== project.description) changes.description = description
  return changes
}

export function ProjectDetailsDialog({ projectId, workspace, manageOrg, onSaved, onBoard, onMembers, onClose }: Props) {
  const [project, setProject] = useState<Project | null>(null)
  const [projectAdmin, setProjectAdmin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const canManage = manageOrg || projectAdmin
  const creator = workspace.orgMembers.find(member => member.user_id === project?.created_by)

  useEffect(() => {
    let active = true
    Promise.all([getProject(projectId), manageOrg ? [] : listProjectMembers(projectId)])
      .then(([record, members]) => {
        if (!active) return
        setProject(record)
        setProjectAdmin(members.some(member => member.user_id === workspace.user.id && member.role === 'admin'))
      }).catch(failure => { if (active) setError(messageOf(failure)) })
    return () => { active = false }
  }, [projectId, manageOrg, workspace.user.id, attempt])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project || !canManage || saving) return
    const form = event.currentTarget
    const changes = changedFields(form, project)
    if (!String(new FormData(form).get('name')).trim()) { setError('Enter a project name.'); return }
    if (!Object.keys(changes).length) return
    setError('')
    setSaving(true)
    try {
      const updated = await patchProject(project.id, changes)
      onSaved(updated)
      onClose()
    } catch (failure) { setError(messageOf(failure)) }
    finally { setSaving(false) }
  }

  return <Dialog title="Project details" onClose={onClose}>
    {project ? <form className="form" onSubmit={submit} aria-busy={saving}
      onChange={event => setDirty(Object.keys(changedFields(event.currentTarget, project)).length > 0)}>
      <ProjectFields project={project} readOnly={!canManage} />
      <dl className="task-facts project-facts">
        <div><dt>Created</dt><dd>{longDate.format(new Date(project.created_at))} IST</dd></div>
        <div><dt>Updated</dt><dd>{longDate.format(new Date(project.updated_at))} IST</dd></div>
        <div><dt>Created by</dt><dd>{creator?.name ?? 'Unavailable'}</dd></div>
        <div><dt>Project ID</dt><dd>{project.id}</dd></div>
      </dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="button secondary" type="button" disabled={saving} onClick={onBoard}><Kanban size={16} />Open board</button>
        <button className="button secondary" type="button" disabled={saving} onClick={onMembers}><Users size={16} />{canManage ? 'Manage members' : 'View members'}</button>
        {canManage && <button className="button primary" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save changes'}</button>}
      </div>
    </form> : <div className="form">{error ? <>
      <p className="form-error" role="alert">{error}</p>
      <button className="button secondary" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button>
    </> : <p role="status" className="muted">Loading project…</p>}</div>}
  </Dialog>
}

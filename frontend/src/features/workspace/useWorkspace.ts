import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../shared/api'
import { readWorkspace, request } from './api'
import type { Mode } from './api'
import { messageOf, transitions } from './model'
import type { Label, Member, Organization, PendingTaskMove, Project, Role, Status, Task, User, Workspace } from './model'
import type { ProjectValues, TaskValues } from './index'
import type { OrganizationMemberInput } from './members/MemberForm'

function savedSelection(mode: Mode) {
  try {
    const key = `fluztech.selection.${mode}`
    const saved = sessionStorage.getItem(key) ?? sessionStorage.getItem(`relay.selection.${mode}`)
    if (saved) {
      const selection = JSON.parse(saved)
      return { organizationId: String(selection.organizationId ?? ''), projectId: String(selection.projectId ?? '') }
    }
  } catch { /* Start in the first accessible project. */ }
  return { organizationId: '', projectId: '' }
}

export function useWorkspace(mode: Mode, onExpired: () => void) {
  const [savedWorkspace, setWorkspace] = useState<Workspace | null>(null)
  const [pendingMoves, setPendingMoves] = useState<ReadonlyMap<string, PendingTaskMove>>(() => new Map())
  const movingTasks = useRef(new Set<string>())
  const [selection, setSelection] = useState(() => savedSelection(mode))
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const workspace = useMemo(() => {
    if (!savedWorkspace || !pendingMoves.size) return savedWorkspace
    return { ...savedWorkspace, tasks: savedWorkspace.tasks.map(task => {
      const move = pendingMoves.get(task.id)
      return move ? { ...task, status: move.status } : task
    }) }
  }, [savedWorkspace, pendingMoves])

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    readWorkspace(mode, selection.organizationId, selection.projectId).then(current => {
      if (!active) return
      setWorkspace(current)
      try {
        sessionStorage.setItem(`fluztech.selection.${mode}`, JSON.stringify({
          organizationId: current.organization?.id ?? '',
          projectId: current.project?.id ?? '',
        }))
      } catch { /* Keep the selection for this page. */ }
    }).catch(error => {
      if (!active) return
      if (error instanceof ApiError && error.status === 401) onExpired()
      setWorkspace(null)
      setLoadError(messageOf(error))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [mode, selection, revision, onExpired])

  const orgRole = workspace?.orgMembers.find(member => member.user_id === workspace.user.id)?.role
  const projectRole = workspace?.projectMembers.find(member => member.user_id === workspace.user.id)?.role
  const manageOrg = orgRole === 'owner' || orgRole === 'admin'
  const manageProject = manageOrg || projectRole === 'admin'
  const canWrite = Boolean(workspace?.project && (manageProject || projectRole === 'member'))

  function chooseProject(id: string, organizationId?: string) {
    if (!loading && workspace?.project?.id === id) return
    setLoading(true)
    setSelection(current => ({ organizationId: organizationId ?? current.organizationId, projectId: id }))
  }
  function chooseOrganization(id: string) {
    setLoading(true)
    setSelection({ organizationId: id, projectId: '' })
  }
  function reload() {
    setLoading(true)
    setRevision(value => value + 1)
  }

  function updateOrganization(organization: Organization) {
    setWorkspace(current => current && ({
      ...current,
      organizations: current.organizations.map(item => item.id === organization.id ? organization : item)
        .sort((left, right) => left.name.localeCompare(right.name)),
      organization: current.organization?.id === organization.id ? organization : current.organization,
    }))
  }

  function updateProject(project: Project) {
    setWorkspace(current => {
      if (current?.organization?.id !== project.organization_id) return current
      return {
        ...current,
        projects: current.projects.map(item => item.id === project.id ? project : item)
          .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
        project: current.project?.id === project.id ? project : current.project,
      }
    })
  }

  async function updateProfile(name: string) {
    const user = await request<User>(mode, '/users/me', { method: 'PATCH', data: { name } })
    setWorkspace(current => {
      if (!current) return current
      const updateMember = (member: Member) => member.user_id === user.id ? { ...member, name: user.name } : member
      return { ...current, user, orgMembers: current.orgMembers.map(updateMember), projectMembers: current.projectMembers.map(updateMember) }
    })
  }

  const updateTask = useCallback((next: Task, fromRead = false) => {
    setWorkspace(current => {
      if (current?.project?.id !== next.project_id) return current
      const previous = current.tasks.find(task => task.id === next.id)
      if (fromRead && previous && previous.updated_at > next.updated_at) return current
      return { ...current, tasks: previous ? current.tasks.map(task => task.id === next.id ? next : task) : [next, ...current.tasks] }
    })
  }, [])

  async function moveTask(task: Task, status: Status) {
    if (!canWrite || task.project_id !== savedWorkspace?.project?.id || movingTasks.current.has(task.id) || !transitions[task.status]?.includes(status)) return
    movingTasks.current.add(task.id)
    setPendingMoves(current => new Map(current).set(task.id, { status, previous: task.status }))
    try {
      const updated = await request<Task>(mode, `/tasks/${task.id}/transitions`, { method: 'POST', data: { status } })
      updateTask(updated)
      return updated
    } finally {
      movingTasks.current.delete(task.id)
      setPendingMoves(current => {
        const next = new Map(current)
        next.delete(task.id)
        return next
      })
    }
  }

  async function createTask(values: TaskValues) {
    if (!workspace?.project) throw new Error('Choose a project first.')
    const task = await request<Task>(mode, `/projects/${workspace.project.id}/tasks`, { method: 'POST', data: values })
    updateTask(task)
    return task
  }

  async function createProject(values: ProjectValues) {
    if (!workspace?.organization) throw new Error('Choose an organization first.')
    const project = await request<Project>(mode, `/organizations/${workspace.organization.id}/projects`, { method: 'POST', data: values })
    chooseProject(project.id)
    return project
  }

  async function createOrganization(name: string, slug: string) {
    const organization = await request<Organization>(mode, '/organizations', { method: 'POST', data: { name, slug } })
    chooseOrganization(organization.id)
    return organization
  }

  async function addOrganizationMember(values: OrganizationMemberInput) {
    const orgId = workspace?.organization?.id
    if (!orgId) throw new Error('Choose an organization first.')
    const member = await request<Member>(mode, `/organizations/${orgId}/members`, { method: 'POST', data: values })
    setWorkspace(current => current?.organization?.id === orgId ? {
      ...current, orgMembers: [...current.orgMembers.filter(item => item.user_id !== member.user_id), member]
        .sort((left, right) => left.name.localeCompare(right.name) || left.user_id.localeCompare(right.user_id)),
    } : current)
  }

  async function changeMember(kind: 'project' | 'organization', id: string, role?: Role) {
    const scope = kind === 'project' ? workspace?.project : workspace?.organization
    if (!scope) throw new Error(`Choose a ${kind} first.`)
    const prefix = kind === 'project' ? 'projects' : 'organizations'
    const member = await request<Member | undefined>(mode, `/${prefix}/${scope.id}/members/${encodeURIComponent(id)}`, role
      ? { method: 'PUT', data: { role } } : { method: 'DELETE' })
    if (!member || id === workspace?.user.id || role === 'viewer') {
      reload()
      return
    }
    setWorkspace(current => {
      if (!current) return current
      const activeScope = kind === 'project' ? current.project : current.organization
      if (activeScope?.id !== scope.id) return current
      const key = kind === 'project' ? 'projectMembers' : 'orgMembers'
      const members = [...current[key].filter(item => item.user_id !== id), member]
        .sort((left, right) => left.name.localeCompare(right.name) || left.user_id.localeCompare(right.user_id))
      return { ...current, [key]: members }
    })
  }

  function upsertLabel(label: Label) {
    setWorkspace(current => current?.project?.id === label.project_id ? {
      ...current, labels: [...current.labels.filter(item => item.id !== label.id), label].sort((a, b) => a.name.localeCompare(b.name)),
    } : current)
  }

  function removeLabel(projectId: string, id: string) {
    setWorkspace(current => current?.project?.id === projectId ? {
      ...current,
      labels: current.labels.filter(label => label.id !== id),
      tasks: current.tasks.map(task => task.label_ids.includes(id) ? { ...task, label_ids: task.label_ids.filter(label => label !== id) } : task),
    } : current)
  }

  function updateTaskLabels(task: Task, labels: Label[]) {
    setWorkspace(current => current?.project?.id === task.project_id ? {
      ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, label_ids: labels.map(label => label.id) } : item),
    } : current)
  }

  return {
    workspace, loading, loadError, manageOrg, manageProject, canWrite, pendingMoves, chooseProject, chooseOrganization,
    organizationPickerId: loading && workspace?.organizations.some(item => item.id === selection.organizationId)
      ? selection.organizationId : workspace?.organization?.id,
    reload, createTask, createProject, moveTask, updateTask, updateProfile, updateOrganization, updateProject, changeMember,
    upsertLabel, removeLabel, updateTaskLabels, createOrganization, addOrganizationMember,
  }
}

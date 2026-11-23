import { transitions } from '../../model'
import type { Activity, Comment, Label, Member, Notice, Organization, Priority, Project, Status, Task } from '../../model'
import { daysFromNow, initialLabels, initialMembers, initialProjects, initialTasks, organization, user } from './fixtures'

interface DemoState {
  organization: Organization
  projects: Project[]
  members: Member[]
  projectMembers: Record<string, Member[]>
  tasks: Task[]
  labels: Label[]
  comments: Comment[]
  activity: Record<string, Activity[]>
  notifications: Notice[]
}

const demoKey = 'fluztech.demo.v1'
const legacyDemoKey = 'relay.demo.v1'
const now = () => new Date().toISOString()
function readDemo(): DemoState {
  const saved = localStorage.getItem(demoKey)
  const legacy = localStorage.getItem(legacyDemoKey)
  const stored = saved ?? legacy
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as DemoState
      if (!saved && legacy) {
        localStorage.setItem(demoKey, legacy)
        localStorage.removeItem(legacyDemoKey)
      }
      return {
        ...parsed,
        organization: parsed.organization ?? organization,
        projects: parsed.projects.map(project => ({
          ...project,
          created_by: project.created_by ?? null,
          created_at: project.created_at ?? organization.created_at,
          updated_at: project.updated_at ?? project.created_at ?? organization.created_at,
        })),
      }
    } catch { /* Recreate the sample workspace. */ }
  }
  return {
    organization,
    projects: initialProjects, members: initialMembers,
    projectMembers: Object.fromEntries(initialProjects.map(item => [
      item.id, initialMembers.map(member => member.role === 'owner' ? { ...member, role: 'admin' as const } : member),
    ])),
    tasks: initialTasks, labels: initialLabels,
    comments: [{ id: 'opening-note', task_id: 'platform-42', author_id: 'maya', body: 'The mobile draft is ready for review.', created_at: daysFromNow(-1) }],
    activity: {},
    notifications: [{
      id: 'sample-notice', type: 'task.assigned', payload: { task_id: 'platform-40', project_id: 'platform' },
      read_at: null, created_at: daysFromNow(-0.12),
    }],
  }
}
let state = readDemo()
function persist() { localStorage.setItem(demoKey, JSON.stringify(state)) }

function record(taskId: string, action: string) {
  state.activity[taskId] ??= []
  state.activity[taskId].unshift({ id: crypto.randomUUID(), action, actor_id: user.id, details: null, created_at: now() })
}

export async function demoRequest<T>(path: string, options?: { method?: string; data?: unknown }): Promise<T> {
  const url = new URL(path, 'https://example.com')
  const [, resource, id, nested, child] = url.pathname.split('/')
  const method = options?.method ?? 'GET'
  const data = options?.data as Record<string, unknown> | undefined
  const mutation = method !== 'GET'
  if (mutation) state = structuredClone(state)
  let result: unknown

  if (resource === 'users' && id === 'me') result = user
  if (resource === 'organizations') {
    if (!id) result = [state.organization]
    if (id === state.organization.id && !nested) {
      if (method === 'PATCH') state.organization.name = String(data?.name)
      result = state.organization
    }
    if (nested === 'projects') {
      if (method === 'POST') {
        const key = String(data?.key).toUpperCase()
        if (state.projects.some(project => project.key === key)) throw new Error('A project with this key already exists.')
        const created = now()
        const project: Project = {
          id: crypto.randomUUID(), organization_id: id, key, name: String(data?.name), description: data?.description as string | null,
          created_by: user.id, created_at: created, updated_at: created,
        }
        state.projects.push(project)
        state.projectMembers[project.id] = [{ ...initialMembers[0], role: 'admin' }]
        result = project
      } else result = state.projects
    }
    if (nested === 'members') {
      const member = state.members.find(item => item.user_id === child)
      if (mutation && member?.role === 'owner' && data?.role !== 'owner' &&
          state.members.filter(item => item.role === 'owner').length === 1) {
        throw new Error('The organization must retain an owner.')
      }
      result = updateMembers(state.members, child, method, data?.role as Member['role'])
      if (child && method === 'DELETE') {
        for (const projectId of Object.keys(state.projectMembers)) {
          state.projectMembers[projectId] = state.projectMembers[projectId].filter(item => item.user_id !== child)
        }
        state.tasks = state.tasks.map(task => task.assignee_id === child ? { ...task, assignee_id: null } : task)
      }
    }
  }
  if (resource === 'projects') {
    if (id && !nested) {
      const project = state.projects.find(item => item.id === id)
      if (!project) throw new Error('Project not found.')
      if (method === 'PATCH') {
        if (typeof data?.name === 'string') project.name = data.name
        if (data && 'description' in data) project.description = data.description as string | null
        project.updated_at = now()
      }
      result = project
    }
    if (nested === 'labels') {
      const labels = state.labels.filter(label => label.project_id === id)
      if (!state.projects.some(project => project.id === id)) throw new Error('Project not found.')
      const existing = labels.find(label => label.id === child)
      if (child && !existing) throw new Error('Label not found.')
      if (method === 'POST' || method === 'PATCH') {
        const name = String(data?.name ?? '').trim()
        if (!name || name.length > 50) throw new Error('Enter a label name of up to 50 characters.')
        if (labels.some(label => label.name === name && label.id !== child)) throw new Error('A label with this name already exists in the project.')
        if (existing) {
          existing.name = name
          result = existing
        } else {
          const label = { id: crypto.randomUUID(), project_id: id, name }
          state.labels.push(label)
          result = label
        }
      } else if (method === 'DELETE' && existing) {
        state.labels = state.labels.filter(label => label.id !== existing.id)
        state.tasks = state.tasks.map(task => task.label_ids.includes(existing.id) ? {
          ...task, label_ids: task.label_ids.filter(labelId => labelId !== existing.id),
        } : task)
      } else result = labels.sort((a, b) => a.name.localeCompare(b.name))
    }
    if (nested === 'members') {
      const members = state.projectMembers[id] ??= []
      result = updateMembers(members, child, method, data?.role as Member['role'])
      if (child && (method === 'DELETE' || data?.role === 'viewer')) {
        state.tasks = state.tasks.map(task => task.project_id === id && task.assignee_id === child ? { ...task, assignee_id: null } : task)
      }
    }
    if (nested === 'tasks') {
      const tasks = state.tasks.filter(item => item.project_id === id).sort((a, b) => b.number - a.number)
      if (method === 'POST') {
        const project = state.projects.find(item => item.id === id)
        const number = (tasks[0]?.number ?? 0) + 1
        const task: Task = {
          id: crypto.randomUUID(), project_id: id, number, key: `${project?.key ?? 'TASK'}-${number}`,
          title: String(data?.title), description: data?.description as string | null,
          priority: data?.priority as Priority, assignee_id: data?.assignee_id as string | null,
          due_at: data?.due_at as string | null, status: 'pending', label_ids: [], created_at: now(), updated_at: now(),
        }
        state.tasks.push(task)
        record(task.id, 'task.created')
        result = task
      } else result = tasks
    }
  }
  if (resource === 'tasks') {
    const task = state.tasks.find(item => item.id === id)
    if (!task) throw new Error('Task not found.')
    if (!nested) {
      if (method === 'PATCH') {
        Object.assign(task, data, { updated_at: now() })
        record(id, 'task.updated')
      }
      result = task
    }
    if (nested === 'transitions') {
      const next = data?.status as Status
      if (next !== task.status && !transitions[task.status].includes(next)) throw new Error('This status change is not allowed.')
      task.status = next
      task.updated_at = now()
      record(id, 'task.transitioned')
      result = task
    }
    if (nested === 'comments') {
      if (method === 'POST') {
        const comment = { id: crypto.randomUUID(), task_id: id, author_id: user.id, body: String(data?.body), created_at: now() }
        state.comments.push(comment)
        result = comment
      } else if (child) {
        const index = state.comments.findIndex(comment => comment.task_id === id && comment.id === child)
        if (index === -1) throw new Error('Comment not found.')
        const comment = state.comments[index]
        if (method === 'PATCH') {
          if (comment.author_id !== user.id) throw new Error('Only the comment author can edit it.')
          comment.body = String(data?.body)
          result = comment
        }
        if (method === 'DELETE') state.comments.splice(index, 1)
      } else result = state.comments.filter(comment => comment.task_id === id)
    }
    if (nested === 'activity') result = state.activity[id] ?? []
    if (nested === 'labels' && method === 'PUT') {
      task.label_ids = data?.label_ids as string[]
      record(id, 'task.labels_updated')
      result = state.labels.filter(label => task.label_ids.includes(label.id))
    }
  }
  if (resource === 'notifications') {
    if (method === 'PATCH') {
      const notice = state.notifications.find(item => item.id === id)
      if (!notice) throw new Error('Notification not found.')
      notice.read_at ??= now()
      result = notice
    } else result = state.notifications
      .filter(item => url.searchParams.get('unread') !== 'true' || !item.read_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
  }
  if (mutation) persist()
  if (result === undefined && method !== 'DELETE') throw new Error('This action is unavailable in the sample workspace.')
  if (Array.isArray(result)) {
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? result.length)
    return structuredClone(result.slice(offset, offset + limit)) as T
  }
  return structuredClone(result) as T
}

function updateMembers(members: Member[], userId: string | undefined, method: string, role: Member['role']) {
  if (!userId) return members
  const index = members.findIndex(member => member.user_id === userId)
  if (method === 'DELETE') {
    if (index >= 0) members.splice(index, 1)
    return
  }
  if (method === 'PUT') {
    const account = initialMembers.find(member => member.user_id === userId)
    if (!account) throw new Error('Select an existing workspace member.')
    const entry = { ...account, role, joined_at: members[index]?.joined_at ?? now() }
    if (index >= 0) members[index] = entry
    else members.push(entry)
    return entry
  }
}

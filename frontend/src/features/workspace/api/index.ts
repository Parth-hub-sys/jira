import { authorizedRequest } from '../../../shared/api'
import type { RequestOptions } from '../../../shared/api'
import type { Workspace, User, Organization, Project, Member, Task, Label } from '../model'
import { demoRequest } from './demo/request'

export type Mode = 'demo' | 'live'

export async function request<T>(mode: Mode, path: string, options?: RequestOptions): Promise<T> {
  return mode === 'demo' ? demoRequest<T>(path, options) : authorizedRequest<T>(path, options)
}

export async function all<T>(mode: Mode, path: string): Promise<T[]> {
  const records: T[] = []
  for (let offset = 0; ; offset += 100) {
    const page = await request<T[]>(mode, `${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`)
    records.push(...page)
    if (page.length < 100) return records
  }
}

export function getOrganization(mode: Mode, id: string) {
  return request<Organization>(mode, `/organizations/${encodeURIComponent(id)}`)
}

export function renameOrganization(mode: Mode, id: string, name: string) {
  return request<Organization>(mode, `/organizations/${encodeURIComponent(id)}`, { method: 'PATCH', data: { name } })
}

export type ProjectChanges = Partial<Pick<Project, 'name' | 'description'>>

export function getProject(mode: Mode, id: string) {
  return request<Project>(mode, `/projects/${encodeURIComponent(id)}`)
}

export function patchProject(mode: Mode, id: string, changes: ProjectChanges) {
  return request<Project>(mode, `/projects/${encodeURIComponent(id)}`, { method: 'PATCH', data: changes })
}

export function listProjectMembers(mode: Mode, id: string) {
  return all<Member>(mode, `/projects/${encodeURIComponent(id)}/members`)
}

export function listLabels(mode: Mode, id: string) {
  return all<Label>(mode, `/projects/${encodeURIComponent(id)}/labels`)
}

export async function readWorkspace(mode: Mode, organizationId: string, projectId: string): Promise<Workspace> {
  const [user, organizations] = await Promise.all([
    request<User>(mode, '/users/me'),
    all<Organization>(mode, '/organizations'),
  ])
  const organization = organizations.find(item => item.id === organizationId) ?? organizations[0]
  const [projects, orgMembers] = organization ? await Promise.all([
    all<Project>(mode, `/organizations/${organization.id}/projects`),
    all<Member>(mode, `/organizations/${organization.id}/members`),
  ]) : [[], []]
  const project = projects.find(item => item.id === projectId) ?? projects[0]
  const [tasks, projectMembers, labels] = project ? await Promise.all([
    all<Task>(mode, `/projects/${project.id}/tasks`),
    listProjectMembers(mode, project.id),
    listLabels(mode, project.id),
  ]) : [[], [], []]
  return { user, organizations, organization, projects, project, orgMembers, projectMembers, tasks, labels }
}

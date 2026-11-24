import { authorizedRequest as request } from '../../../shared/api'
import type { Workspace, User, Organization, Project, Member, Task } from '../model'
export { request }

export async function all<T>(path: string): Promise<T[]> {
  const records: T[] = []
  for (let offset = 0; ; offset += 100) {
    const page = await request<T[]>(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`)
    records.push(...page)
    if (page.length < 100) return records
  }
}

export function getOrganization(id: string) {
  return request<Organization>(`/organizations/${encodeURIComponent(id)}`)
}

export function renameOrganization(id: string, name: string) {
  return request<Organization>(`/organizations/${encodeURIComponent(id)}`, { method: 'PATCH', data: { name } })
}

export type ProjectChanges = Partial<Pick<Project, 'name' | 'description'>>

export function getProject(id: string) {
  return request<Project>(`/projects/${encodeURIComponent(id)}`)
}

export function patchProject(id: string, changes: ProjectChanges) {
  return request<Project>(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', data: changes })
}

export function listProjectMembers(id: string) {
  return all<Member>(`/projects/${encodeURIComponent(id)}/members`)
}

export async function readWorkspace(organizationId: string, projectId: string): Promise<Workspace> {
  const [user, organizations] = await Promise.all([
    request<User>('/users/me'),
    all<Organization>('/organizations'),
  ])
  const organization = organizations.find(item => item.id === organizationId) ?? organizations[0]
  const [projects, orgMembers] = organization ? await Promise.all([
    all<Project>(`/organizations/${organization.id}/projects`),
    all<Member>(`/organizations/${organization.id}/members`),
  ]) : [[], []]
  const project = projects.find(item => item.id === projectId) ?? projects[0]
  const [tasks, projectMembers] = project ? await Promise.all([
    all<Task>(`/projects/${project.id}/tasks`),
    listProjectMembers(project.id),
  ]) : [[], []]
  return { user, organizations, organization, projects, project, orgMembers, projectMembers, tasks }
}

import type { Label, Member, Organization, Priority, Project, Status, Task } from '../../model'

export const user = { id: 'alex', name: 'Alex Morgan', email: 'alex@example.com' }
export const organization: Organization = { id: 'studio', name: 'Studio North', slug: 'studio-north', created_at: '2026-09-01T09:00:00+05:30' }
const projectDates = { created_by: user.id, created_at: organization.created_at, updated_at: organization.created_at }
export const initialProjects: Project[] = [
  { id: 'platform', name: 'Product Platform', key: 'PLAT', description: 'Build the foundations for a better product experience.', organization_id: organization.id },
  { id: 'design', name: 'Design System', key: 'DS', description: 'Shared components, patterns and design tokens.', organization_id: organization.id },
  { id: 'customer', name: 'Customer Experience', key: 'CX', description: 'Improve the workflows our customers use every day.', organization_id: organization.id },
].map(project => ({ ...project, ...projectDates }))
const origin = Date.now()
export const daysFromNow = (days: number) => new Date(origin + days * 86_400_000).toISOString()
export const initialMembers: Member[] = [
  { user_id: user.id, name: user.name, email: user.email, role: 'owner', joined_at: daysFromNow(-60) },
  { user_id: 'maya', name: 'Maya Chen', email: 'maya@example.com', role: 'admin', joined_at: daysFromNow(-45) },
  { user_id: 'sam', name: 'Sam Patel', email: 'sam@example.com', role: 'member', joined_at: daysFromNow(-38) },
  { user_id: 'jules', name: 'Jules Rivera', email: 'jules@example.com', role: 'member', joined_at: daysFromNow(-31) },
]
export const initialLabels: Label[] = [
  { id: 'design-label', project_id: 'platform', name: 'Design' },
  { id: 'engineering-label', project_id: 'platform', name: 'Engineering' },
  { id: 'release-label', project_id: 'platform', name: 'Release' },
]
const platformTasks: [string, Status, Priority, string | null, number | null][] = [
  ['Review onboarding flow', 'in_progress', 'high', 'maya', 0],
  ['Update permissions matrix', 'pending', 'urgent', 'sam', 1],
  ['Refine empty states', 'in_progress', 'medium', 'alex', 2],
  ['Validate mobile navigation', 'pending', 'medium', 'jules', 3],
  ['Write release checklist', 'in_progress', 'high', 'alex', 4],
  ['Audit API error messages', 'pending', 'medium', 'sam', 9],
  ['Draft invitation copy', 'in_progress', 'low', 'alex', null],
  ['Review settings page hierarchy', 'pending', 'low', 'maya', null],
  ['Fix project search ordering', 'in_progress', 'medium', 'sam', null],
  ['Update loading indicators', 'pending', 'low', 'jules', null],
  ['Add a keyboard shortcut guide', 'pending', 'low', 'maya', null],
  ['Improve notification grouping', 'pending', 'medium', null, null],
  ['Verify session refresh handling', 'in_progress', 'high', 'sam', null],
  ['Document the release process', 'pending', 'low', null, null],
  ['Test organization switching', 'in_progress', 'medium', 'jules', null],
  ['Review form field validation', 'pending', 'medium', null, null],
  ['Add the project selector', 'done', 'medium', 'maya', null],
  ['Set up shared UI tokens', 'done', 'medium', 'alex', null],
  ['Create the task detail layout', 'done', 'high', 'jules', null],
  ['Review member permissions', 'done', 'high', 'sam', null],
  ['Build the notification list', 'done', 'low', 'alex', null],
  ['Finalize default issue statuses', 'pending', 'medium', 'sam', null],
  ['Set up project navigation', 'done', 'medium', 'jules', null],
  ['Define the project dashboard', 'done', 'low', 'maya', null],
]

function sampleTask(project: Project, number: number, entry: typeof platformTasks[number]): Task {
  const [title, status, priority, assignee_id, due] = entry
  return {
    id: `${project.id}-${number}`, project_id: project.id, key: `${project.key}-${number}`, number, title,
    description: number === 42 ? 'Review the first-run flow on desktop and mobile. Capture feedback before the next product review.' : null,
    status, priority, assignee_id, label_ids: project.id === 'platform' && number > 38 ? [initialLabels[number % 3].id] : [],
    due_at: due === null ? null : daysFromNow(due + 0.25),
    created_at: daysFromNow(-12), updated_at: daysFromNow(-1),
  }
}

export const initialTasks = [
  ...platformTasks.map((task, index) => sampleTask(initialProjects[0], 42 - index, task)),
  sampleTask(initialProjects[1], 8, ['Publish component guidelines', 'in_progress', 'medium', 'maya', 3]),
  sampleTask(initialProjects[1], 7, ['Review typography tokens', 'done', 'medium', 'alex', null]),
  sampleTask(initialProjects[2], 5, ['Review feedback from the pilot', 'pending', 'high', 'jules', 1]),
]

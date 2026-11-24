import { Dialog } from '../../shared/ui'
import { MemberForm, ProjectForm, SearchDialog, TaskDrawer, TaskForm } from './index'
import type { MemberDialog, ProjectValues, TaskValues } from './index'
import type { PendingTaskMove, Role, Status, Task, Workspace } from './model'
import type { OrganizationMemberInput } from './members/MemberForm'

export type WorkspaceDialog = 'search' | 'create-task' | 'create-project'

type Props = {
  workspace: Workspace
  dialog: WorkspaceDialog | null
  memberDialog: MemberDialog | null
  taskId: string
  canWrite: boolean
  canModerate: boolean
  pendingMove?: PendingTaskMove
  closeDialog(): void
  closeTask(): void
  closeMember(): void
  openTask(id: string): void
  createTask(values: TaskValues): Promise<void>
  createProject(values: ProjectValues): Promise<void>
  changeMember(id: string, role?: Role): Promise<void>
  addOrganizationMember(values: OrganizationMemberInput): Promise<void>
  moveTask(task: Task, status: Status): Promise<Task | undefined>
  updateTask(item: Task, fromRead?: boolean): void
}

export function WorkspaceDialogs({
  workspace, dialog, memberDialog, taskId, canWrite, canModerate, closeDialog, closeTask, closeMember, openTask,
  createTask, createProject, changeMember, addOrganizationMember, updateTask, pendingMove, moveTask,
}: Props) {
  if (dialog === 'search') return <SearchDialog tasks={workspace.tasks} onOpen={openTask} onClose={closeDialog} />
  if (dialog === 'create-task' && workspace.project) return <Dialog title="New task" onClose={closeDialog}><TaskForm members={workspace.projectMembers} onSave={createTask} onCancel={closeDialog} /></Dialog>
  if (dialog === 'create-project' && workspace.organization) return <ProjectForm onSave={createProject} onClose={closeDialog} />
  if (memberDialog) return <MemberForm selection={memberDialog} workspace={workspace}
    onSave={changeMember} onAdd={addOrganizationMember} onRemove={id => changeMember(id)} onClose={closeMember} />
  if (taskId) return <TaskDrawer key={taskId} id={taskId} workspace={workspace} canWrite={canWrite} canModerate={canModerate}
    pendingMove={pendingMove} onMove={moveTask} onUpdate={updateTask} onClose={closeTask} />
  return null
}

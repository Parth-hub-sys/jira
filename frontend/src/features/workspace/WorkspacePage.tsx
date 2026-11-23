import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CircleAlert, X } from 'lucide-react'
import { WorkspaceShell } from '../../app/layout/WorkspaceShell'
import { blankFilters, viewRoute } from '../../app/routing'
import type { Route, WorkspaceView } from '../../app/routing'
import { Empty } from '../../shared/ui'
import { ProfileDialog } from '../auth/ProfileDialog'
import { Members, Overview, Projects, WorkView } from './index'
import type { MemberDialog, WorkFilters } from './index'
import { getProject } from './api'
import type { Mode } from './api'
import { messageOf, statusNames } from './model'
import type { Notice, Status, Task } from './model'
import { LabelDialog } from './labels/LabelDialog'
import { NotificationInbox } from './notifications/NotificationInbox'
import { NotificationPopup } from './notifications/NotificationPopup'
import { noticeTask } from './notifications/model'
import { useNotifications } from './notifications/useNotifications'
import { OrganizationDialog } from './organizations/OrganizationDialog'
import { CreateOrganizationDialog } from './organizations/CreateOrganizationDialog'
import { ProjectDetailsDialog } from './projects/ProjectDetailsDialog'
import { WorkspaceDialogs } from './WorkspaceDialogs'
import type { WorkspaceDialog } from './WorkspaceDialogs'
import { useWorkspace } from './useWorkspace'

type Props = {
  mode: Mode; route: Route; appearance: ReactNode
  navigate(route: Route, replace?: boolean): void
  onSignIn(): void
  onSignOut(): Promise<void>
}

export function WorkspacePage({ mode, route, appearance, navigate, onSignIn, onSignOut }: Props) {
  const data = useWorkspace(mode, onSignIn)
  const { workspace, loading, canWrite, pendingMoves } = data
  const notifications = useNotifications(mode, workspace?.user.id)
  const [dialog, setDialog] = useState<WorkspaceDialog | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [labelDialog, setLabelDialog] = useState<{ projectId: string; canManage: boolean }>()
  const [profileOpen, setProfileOpen] = useState(false)
  const [organizationOpen, setOrganizationOpen] = useState(false)
  const [createOrganizationOpen, setCreateOrganizationOpen] = useState(false)
  const [detailsProjectId, setDetailsProjectId] = useState('')
  const [memberDialog, setMemberDialog] = useState<MemberDialog | null>(null)
  const [memberScope, setMemberScope] = useState<'organization' | 'project'>('organization')
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const view = route.view === 'sign-in' ? 'board' : route.view

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && workspace?.project && !loading &&
          !route.task && !memberDialog && !profileOpen && !organizationOpen && !createOrganizationOpen && !detailsProjectId && !notificationsOpen && !labelDialog) {
        event.preventDefault()
        setDialog(current => current === 'search' ? null : current ?? 'search')
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [workspace, loading, route.task, memberDialog, profileOpen, organizationOpen, createOrganizationOpen, detailsProjectId, notificationsOpen, labelDialog])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.error ? 6500 : 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  function go(next: WorkspaceView, filters?: WorkFilters) {
    navigate(viewRoute(next, filters))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  function openTask(id: string) { setDialog(null); navigate({ ...route, task: id }) }
  function openNotifications() {
    notifications.dismiss()
    setNotificationsOpen(true)
  }
  async function openNotificationTask(item: Notice) {
    const link = noticeTask(item)
    if (!workspace || !link?.task_id) return
    const projectId = link.project_id
    const switchingProject = projectId && workspace.project?.id !== projectId
    const organizationId = switchingProject ? link.organization_id
      ?? workspace.projects.find(project => project.id === projectId)?.organization_id
      ?? (await getProject(mode, projectId)).organization_id : undefined
    await notifications.markRead(item)
    setDialog(null)
    setMemberDialog(null)
    setOrganizationOpen(false)
    setCreateOrganizationOpen(false)
    setProfileOpen(false)
    setDetailsProjectId('')
    setLabelDialog(undefined)
    setNotificationsOpen(false)
    if (switchingProject) {
      data.chooseProject(projectId, organizationId)
      navigate({ ...viewRoute('board'), task: link.task_id })
    } else openTask(link.task_id)
  }
  function errorNotice(error: unknown) { setNotice({ text: messageOf(error), error: true }) }
  async function moveTask(task: Task, status: Status) {
    try {
      const updated = await data.moveTask(task, status)
      if (updated) setNotice(current => current?.error ? current : { text: `Task moved to ${statusNames[updated.status]}.` })
    } catch (error) { setNotice({ text: `Couldn’t move the task. ${messageOf(error)}`, error: true }) }
  }

  let content
  if (loading) content = <div className="panel loading-panel" role="status"><span className="spinner" />Loading workspace…</div>
  else if (data.loadError) content = <div className="panel"><Empty title="The workspace is unavailable" body={data.loadError} action={<button className="button primary" onClick={data.reload}>Try again</button>} /></div>
  else if (workspace && !workspace.organization) content = <div className="panel"><Empty title="No organization assigned" body="Ask your company admin to add your account to an organization." /></div>
  else if (workspace && view === 'projects') content = <Projects workspace={workspace} canManage={data.manageOrg}
    onCreate={() => setDialog('create-project')} selectProject={id => { data.chooseProject(id); go('board') }} onDetails={setDetailsProjectId} />
  else if (workspace && view === 'members') content = <Members workspace={workspace} manageOrg={data.manageOrg} manageProject={data.manageProject}
    selectedScope={memberScope} onScopeChange={setMemberScope}
    onCreateOrganization={mode === 'live' ? () => setCreateOrganizationOpen(true) : undefined}
    onMember={(kind, member) => setMemberDialog({ kind, member })} onOrganization={() => setOrganizationOpen(true)} />
  else if (workspace && !workspace.project) content = <section className="panel"><Empty title="No projects available" body="Choose a project to see its work." action={<button className="button primary" onClick={() => go('projects')}>Open Projects</button>} /></section>
  else if (workspace && view === 'overview') content = <Overview key={workspace.project?.id} workspace={workspace} openTask={openTask} viewWork={(status, mine) => go('list', { ...blankFilters, status: status ?? '', mine: Boolean(mine) })} />
  else if (workspace) content = <WorkView key={workspace.project?.id} workspace={workspace} board={view === 'board'}
    filters={route.filters} setFilters={filters => navigate({ ...route, filters }, true)}
    openTask={openTask} moveTask={moveTask} pendingMoves={pendingMoves} onCreate={() => setDialog('create-task')}
    openLabels={() => { if (workspace.project) setLabelDialog({ projectId: workspace.project.id, canManage: data.manageProject }) }}
    canWrite={canWrite && !loading} onViewChange={board => go(board ? 'board' : 'list', route.filters)} />

  return <>
    <WorkspaceShell workspace={workspace} mode={mode} view={view} appearance={appearance} loading={loading} canWrite={canWrite} go={go}
      organizationPickerId={data.organizationPickerId} unread={notifications.unread.length}
      selectOrganization={id => { data.chooseOrganization(id); setMemberScope('organization'); go(view) }}
      selectProject={id => { data.chooseProject(id); navigate({ ...route, filters: blankFilters, task: '' }, true) }}
      openSearch={() => setDialog('search')} openNotifications={openNotifications}
      createTask={() => setDialog('create-task')} openProfile={() => setProfileOpen(true)}
      onAccountAction={() => mode === 'demo' ? onSignIn() : void onSignOut().catch(errorNotice)}>
      {content}
    </WorkspaceShell>
    {workspace && <WorkspaceDialogs mode={mode} workspace={workspace} dialog={dialog} memberDialog={memberDialog}
      taskId={route.task} canWrite={canWrite} canModerate={data.manageProject} pendingMove={pendingMoves.get(route.task)} moveTask={data.moveTask} closeDialog={() => setDialog(null)}
      closeTask={() => navigate({ ...route, task: '' }, true)} closeMember={() => setMemberDialog(null)} openTask={openTask}
      createTask={async values => {
        const task = await data.createTask(values)
        setNotice({ text: 'Task created.' })
        openTask(task.id)
      }}
      createProject={async values => {
        const project = await data.createProject(values)
        setDialog(null)
        go('board')
        setNotice({ text: `${project.name} created.` })
      }}
      changeMember={async (id, role) => {
        if (!memberDialog) return
        await data.changeMember(memberDialog.kind, id, role)
        setMemberDialog(null)
        setNotice({ text: role ? 'Member role saved.' : 'Member removed.' })
      }}
      addOrganizationMember={async values => {
        await data.addOrganizationMember(values)
        setMemberDialog(null)
        setNotice({ text: values.mode === 'existing' ? 'Member added.' : 'Account created and member added.' })
      }}
      updateTask={data.updateTask}
      updateTaskLabels={data.updateTaskLabels}
    />}
    {organizationOpen && workspace?.organization && <OrganizationDialog key={workspace.organization.id} mode={mode}
      organizationId={workspace.organization.id} canManage={data.manageOrg} onClose={() => setOrganizationOpen(false)}
      onSaved={organization => {
        data.updateOrganization(organization)
        setNotice({ text: 'Organization renamed.' })
      }} />}
    {createOrganizationOpen && <CreateOrganizationDialog onClose={() => setCreateOrganizationOpen(false)} onSave={async (name, slug) => {
      const created = await data.createOrganization(name, slug)
      setCreateOrganizationOpen(false)
      setMemberScope('organization')
      go('members')
      setNotice({ text: `${created.name} created.` })
    }} />}
    {detailsProjectId && workspace && <ProjectDetailsDialog key={detailsProjectId} projectId={detailsProjectId}
      mode={mode} workspace={workspace} manageOrg={data.manageOrg} onClose={() => setDetailsProjectId('')}
      onSaved={project => {
        data.updateProject(project)
        setNotice({ text: 'Project updated.' })
      }}
      onBoard={() => { data.chooseProject(detailsProjectId); setDetailsProjectId(''); go('board') }}
      onMembers={() => { data.chooseProject(detailsProjectId); setMemberScope('project'); setDetailsProjectId(''); go('members') }}
      onLabels={canManage => { setLabelDialog({ projectId: detailsProjectId, canManage }); setDetailsProjectId('') }}
    />}
    {labelDialog && workspace && <LabelDialog key={labelDialog.projectId} mode={mode} projectId={labelDialog.projectId}
      labels={workspace.project?.id === labelDialog.projectId ? workspace.labels : undefined} canManage={labelDialog.canManage}
      onUpsert={data.upsertLabel} onRemove={(projectId, id) => {
        data.removeLabel(projectId, id)
        if (workspace.project?.id === projectId && route.filters.label === id) navigate({ ...route, filters: { ...route.filters, label: '' } }, true)
      }} onClose={() => setLabelDialog(undefined)} />}
    {profileOpen && workspace && <ProfileDialog name={workspace.user.name} email={workspace.user.email} accountId={workspace.user.id}
      onClose={() => setProfileOpen(false)} onSave={async name => {
        await data.updateProfile(name)
        setProfileOpen(false)
        setNotice({ text: 'Profile updated.' })
      }} />}
    {notificationsOpen && workspace && <NotificationInbox mode={mode} unread={notifications.unread} readUpdates={notifications.readUpdates}
      sound={notifications.sound.enabled} onToggleSound={notifications.sound.toggle} onOpen={openNotificationTask}
      onRead={notifications.markRead} onClose={() => setNotificationsOpen(false)} />}
    {notifications.alert && <NotificationPopup key={notifications.alert.item.id} alert={notifications.alert}
      onOpen={openNotifications} onDismiss={notifications.dismiss} />}
    {notice && <div className={`toast ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}>
      {notice.error && <CircleAlert size={19} />}<span>{notice.text}</span>
      <button className="icon-button tiny" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={16} /></button>
    </div>}
  </>
}

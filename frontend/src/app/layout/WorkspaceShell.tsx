import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Bell, ChevronDown, Folder, Kanban, LayoutDashboard, ListTodo, LogOut, Plus, Search, UserRound, Users } from 'lucide-react'
import type { Workspace } from '../../features/workspace/model'
import { notificationPageSize } from '../../features/workspace/notifications/model'
import { Avatar, Dropdown } from '../../shared/ui'
import { Brand } from '../../shared/ui/Brand'
import type { WorkspaceView } from '../routing'

const navigation = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', Icon: Folder },
  { id: 'board', label: 'Board', Icon: Kanban },
  { id: 'list', label: 'List', Icon: ListTodo },
  { id: 'members', label: 'Members', Icon: Users },
] as const

type Props = {
  workspace: Workspace | null
  view: WorkspaceView
  appearance: ReactNode
  loading: boolean
  canWrite: boolean
  organizationPickerId?: string
  unread: number
  children: ReactNode
  go(view: WorkspaceView): void
  selectOrganization(id: string): void
  selectProject(id: string): void
  openSearch(): void
  openNotifications(): void
  createTask(): void
  openProfile(): void
  onSignOut(): void
}

export function WorkspaceShell({
  workspace, view, appearance, loading, canWrite, organizationPickerId, unread, children, go, selectOrganization,
  selectProject, openSearch, openNotifications, createTask, openProfile, onSignOut,
}: Props) {
  const [profileOpen, setProfileOpen] = useState(false)
  const profile = useRef<HTMLDivElement>(null)
  const profileTrigger = useRef<HTMLButtonElement>(null)
  const profileMenuId = useId()
  const unreadLabel = unread > notificationPageSize ? `${notificationPageSize}+` : unread

  useEffect(() => {
    if (!profileOpen) return
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !profile.current?.contains(event.target)) setProfileOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside, true)
    return () => document.removeEventListener('pointerdown', dismissOutside, true)
  }, [profileOpen])

  return <div className="app">
    <a href="#workspace-main" className="skip-link" onClick={event => {
      event.preventDefault()
      document.getElementById('workspace-main')?.focus()
    }}>Skip to content</a>
    <header className="topbar page-width">
      <Brand onClick={() => go('overview')} />
      {workspace?.organizations.length ? <><span className="top-divider" aria-hidden />
        <Dropdown className="workspace-picker" label="Organization" value={organizationPickerId ?? ''}
          leading={<span className="workspace-initial">{workspace.organizations.find(item => item.id === organizationPickerId)?.name.charAt(0)}</span>}
          options={workspace.organizations.map(item => ({ value: item.id, label: item.name }))}
          onChange={id => { if (id !== organizationPickerId) selectOrganization(id) }} />
      </> : null}
      <div className="top-spacer" />
      {workspace?.project && <button className="search-trigger" onClick={openSearch} disabled={loading} aria-label="Search tasks"><Search size={18} /><span>Search tasks</span><kbd>Ctrl K</kbd></button>}
      {appearance}
      {workspace && <button className="icon-button notification-button" aria-label={unread ? `Notifications, ${unreadLabel} unread` : 'Notifications'} onClick={openNotifications}><Bell size={19} />{unread > 0 && <span aria-hidden="true">{unreadLabel}</span>}</button>}
      {workspace && <div ref={profile} className="profile"
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false) }}
        onKeyDown={event => {
          if (profileOpen && event.key === 'Escape') {
            event.stopPropagation()
            setProfileOpen(false)
            profileTrigger.current?.focus()
          }
        }}>
        <button ref={profileTrigger} type="button" className="profile-trigger" aria-label="Account menu" aria-expanded={profileOpen}
          aria-controls={profileMenuId} onClick={() => setProfileOpen(value => !value)}><Avatar name={workspace.user.name} id={workspace.user.id} /><ChevronDown size={13} /></button>
        <div id={profileMenuId} className="profile-menu" data-open={profileOpen} inert={!profileOpen}>
          <strong>{workspace.user.name}</strong>
          <span className="profile-email muted" title={workspace.user.email}>{workspace.user.email}</span>
          <button onClick={() => { setProfileOpen(false); openProfile() }}><UserRound size={17} />Edit profile</button>
          <button onClick={() => { setProfileOpen(false); onSignOut() }}>
            <LogOut size={17} />Sign out
          </button>
        </div>
      </div>}
    </header>
    <div className="layout page-width">
      <aside className="rail-slot">
        <nav className="rail" aria-label="Workspace">
          {navigation.map(({ id, label, Icon }) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => go(id)}><Icon size={20} strokeWidth={1.8} /><span>{label}</span></button>)}
        </nav>
      </aside>
      <main id="workspace-main" className="main" tabIndex={-1} aria-busy={loading}>
        {workspace?.organization && view !== 'members' && <div className="project-toolbar">
          {workspace.projects.length > 0 ? <Dropdown className="project-picker" label="Project" value={workspace.project?.id ?? ''} disabled={loading}
            leading={<span className="project-symbol"><Folder size={16} /></span>}
            options={workspace.projects.map(item => ({ value: item.id, label: item.name }))}
            onChange={id => { if (id !== workspace.project?.id) selectProject(id) }} /> : <span className="muted">Workspace projects</span>}
          <div className="workspace-primary">
            {canWrite && <button className="button primary new-task" onClick={createTask} disabled={loading}><Plus size={19} strokeWidth={2.3} />New task</button>}
          </div>
        </div>}
        {children}
      </main>
    </div>
  </div>
}

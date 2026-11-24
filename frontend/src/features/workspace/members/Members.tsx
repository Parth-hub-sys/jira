import { useState } from 'react'
import { Building2, Folder, Plus, Search, Settings2, Shield, Users } from 'lucide-react'
import { Avatar, Dropdown, Empty } from '../../../shared/ui'
import { shortDate } from '../../../shared/lib/date'
import type { Member, Workspace } from '../model'

export type MembersSection = 'organization' | 'project' | 'settings'

const sections = [
  { id: 'organization', label: 'Organization members', Icon: Users },
  { id: 'project', label: 'Project members', Icon: Folder },
  { id: 'settings', label: 'Organization settings', Icon: Settings2 },
] as const

export function Members({ workspace, manageOrg, manageProject, section, onSectionChange, onMember, onOrganization,
  onCreateOrganization, onSelectProject, onViewProjects }: {
  workspace: Workspace; manageOrg: boolean; manageProject: boolean
  section: MembersSection
  onSectionChange(section: MembersSection): void
  onMember(kind: 'organization' | 'project', member?: Member): void
  onOrganization(): void
  onCreateOrganization?: () => void
  onSelectProject(id: string): void
  onViewProjects(): void
}) {
  const [query, setQuery] = useState('')
  const scope = section === 'project' ? 'project' : 'organization'
  const directory = scope === 'organization' ? workspace.orgMembers : workspace.projectMembers
  const term = query.trim().toLowerCase()
  const people = directory.filter(person => !term || [person.name, person.email, person.role]
    .some(value => value.toLowerCase().includes(term)))
  const isOwner = workspace.orgMembers.some(member => member.user_id === workspace.user.id && member.role === 'owner')
  const canManage = scope === 'organization' ? manageOrg : manageProject
  const project = workspace.project

  function showSection(next: MembersSection) {
    setQuery('')
    onSectionChange(next)
  }

  return <div className="appear members-page">
    <header className="page-heading view-heading">
      <div className="context-line"><span className="context-icon"><Building2 size={16} /></span>{workspace.organization?.name}</div>
      <h1>Members</h1>
      <p>Manage who can access your organization and its projects.</p>
    </header>

    <nav className="member-navigation" aria-label="Membership">
      {sections.map(({ id, label, Icon }) => <button key={id} type="button" aria-current={section === id ? 'page' : undefined}
        onClick={() => showSection(id)}><Icon size={17} aria-hidden="true" /><span>{label}</span></button>)}
    </nav>

    {section === 'settings' ? <section className="panel member-settings" aria-labelledby="member-settings-heading">
      <h2 id="member-settings-heading">Organization settings</h2>
      <div className="member-setting">
        <span className="member-setting-icon"><Building2 size={21} /></span>
        <div><h3>{workspace.organization?.name}</h3><p className="muted">{manageOrg ? 'View organization details or change its name.' : 'View organization details.'}</p></div>
        <button className="button secondary" type="button" onClick={onOrganization}>Organization details</button>
      </div>
      {isOwner && onCreateOrganization && <div className="member-setting">
        <span className="member-setting-icon"><Plus size={21} /></span>
        <div><h3>New organization</h3><p className="muted">Set up a separate workspace with its own members and projects.</p></div>
        <button className="button primary" type="button" onClick={onCreateOrganization}>Create organization</button>
      </div>}
    </section> : scope === 'project' && !project ? <section className="panel member-no-project" aria-label="Project members">
      <Empty title="No project selected" body="Open Projects to see or create a project before managing its members."
        action={<button type="button" className="button secondary" onClick={onViewProjects}>Open Projects</button>} />
    </section> : <div className="member-access-layout">
      <section className="panel member-directory" aria-labelledby="member-directory-heading">
        <header className="member-directory-header">
          <div>
            <h2 id="member-directory-heading">{scope === 'organization' ? 'Organization members' : 'Project members'}</h2>
            <p className="muted">{directory.length} {directory.length === 1 ? 'member' : 'members'} in {scope === 'organization' ? workspace.organization?.name : project?.name}</p>
          </div>
          {canManage && <button type="button" className="button primary" onClick={() => onMember(scope)}>
            <Plus size={17} />{scope === 'organization' ? 'Add member' : 'Add project member'}</button>}
        </header>
        <div className="member-directory-tools">
          {scope === 'project' && <Dropdown className="project-picker" label="Project" value={project?.id ?? ''}
            leading={<span className="project-symbol"><Folder size={16} /></span>}
            options={workspace.projects.map(item => ({ value: item.id, label: item.name }))}
            onChange={id => { if (id !== project?.id) onSelectProject(id) }} />}
          {directory.length > 0 && <label className="input-icon member-search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={query} onChange={event => setQuery(event.target.value)}
              aria-label="Search members" placeholder="Search by name, email, or role" />
          </label>}
        </div>
        {people.length > 0 ? <>
          <div className="member-columns" aria-hidden="true"><span>Member</span><span>Role</span><span>Joined</span></div>
          <ul className="member-directory-list" aria-label={scope === 'organization' ? 'Organization member list' : 'Project member list'}>
            {people.map(member => <li className="member-directory-row" key={member.user_id}>
              <div className="member-identity">
                <Avatar name={member.name} id={member.user_id} />
                <div className="row-info"><strong>{member.name}{member.user_id === workspace.user.id && <span className="member-you"> (you)</span>}</strong><span>{member.email}</span></div>
              </div>
              <span className="task-label member-role" data-role={member.role}>{member.role}</span>
              <time className="member-joined muted" dateTime={member.joined_at}>{shortDate.format(new Date(member.joined_at))}</time>
              {canManage && (scope === 'project' || member.role !== 'owner' || isOwner) &&
                <button type="button" className="button secondary" aria-label={`Manage ${member.name}`} onClick={() => onMember(scope, member)}>Manage</button>}
            </li>)}
          </ul>
        </> : <Empty title={term ? 'No matching members' : 'No members yet'}
          body={term ? 'Try a different name, email, or role.' : scope === 'project' ? 'Add people from your organization to give them project access.' : undefined}
          action={term ? <button className="button secondary" type="button" onClick={() => setQuery('')}>Clear search</button> : undefined} />}
      </section>
      <aside className="panel member-guide">
        <span className="member-setting-icon"><Shield size={21} /></span>
        <h2>{scope === 'organization' ? 'How access works' : 'Project roles'}</h2>
        {scope === 'organization' ? <>
          <p className="muted">Add someone here first. You can create a login or use their existing Fluxtech account.</p>
          <p className="muted">Add regular members to specific projects so they can access those tasks.</p>
          <button className="text-button" type="button" onClick={() => showSection('project')}>Go to project members</button>
        </> : <>
          <dl>
            <div><dt>Admin</dt><dd>Manage project members and work on tasks.</dd></div>
            <div><dt>Member</dt><dd>Work on tasks and receive assignments.</dd></div>
            <div><dt>Viewer</dt><dd>View tasks and activity.</dd></div>
          </dl>
          <button className="text-button" type="button" onClick={() => showSection('organization')}>Go to organization members</button>
        </>}
      </aside>
    </div>}
  </div>
}

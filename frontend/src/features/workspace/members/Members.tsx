import { Building2, Plus, Users } from 'lucide-react'
import { Avatar, Empty } from '../../../shared/ui'
import { shortDate } from '../../../shared/lib/date'
import type { Member, Workspace } from '../model'

export function Members({ workspace, manageOrg, manageProject, selectedScope, onScopeChange, onMember, onOrganization, onCreateOrganization }: {
  workspace: Workspace; manageOrg: boolean; manageProject: boolean
  selectedScope: 'organization' | 'project'
  onScopeChange(scope: 'organization' | 'project'): void
  onMember(kind: 'organization' | 'project', member?: Member): void
  onOrganization(): void
  onCreateOrganization?: () => void
}) {
  const scope = workspace.project ? selectedScope : 'organization'
  const people = scope === 'organization' ? workspace.orgMembers : workspace.projectMembers
  const canManage = scope === 'organization' ? manageOrg : manageProject
  const isOwner = workspace.orgMembers.some(member => member.user_id === workspace.user.id && member.role === 'owner')
  return <div className="appear">
    <header className="page-heading view-heading"><div className="context-line"><span className="context-icon"><Users size={16} /></span>{workspace.organization?.name}</div><h1>Members</h1><p>See who has access and manage their roles.</p></header>
    <div className="filter-bar">
      <div className="segmented"><button aria-pressed={scope === 'organization'} onClick={() => onScopeChange('organization')}>Organization</button>{workspace.project && <button aria-pressed={scope === 'project'} onClick={() => onScopeChange('project')}>Project</button>}</div>
      {scope === 'organization' && <button className="button secondary" onClick={onOrganization}><Building2 size={16} />Organization details</button>}
      {scope === 'organization' && isOwner && onCreateOrganization && <button className="button secondary" onClick={onCreateOrganization}><Building2 size={16} />Create organization</button>}
      {canManage && <button className="button primary" onClick={() => onMember(scope)}><Plus size={18} />Add member</button>}
    </div>
    <section className="panel member-list" aria-label="Members">
      {people.length ? people.map(member => <div className="member-row" key={member.user_id}>
        <Avatar name={member.name} id={member.user_id} />
        <div className="row-info"><strong>{member.name}</strong><span>{member.email}</span></div>
        <span className="task-label member-role">{member.role}</span>
        <span className="member-date muted">Joined {shortDate.format(new Date(member.joined_at))}</span>
        {canManage && (scope === 'project' || member.role !== 'owner' || isOwner) && <button className="button secondary" onClick={() => onMember(scope, member)}>Manage</button>}
      </div>) : <Empty title="No members in this view" />}
    </section>
  </div>
}

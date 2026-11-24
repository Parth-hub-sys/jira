import { useState } from 'react'
import { Dialog, Dropdown, FormError } from '../../../shared/ui'
import { messageOf } from '../../../shared/lib/text'
import type { Member, Role, Workspace } from '../model'

export type MemberDialog = { kind: 'organization' | 'project'; member?: Member }
export type OrganizationMemberInput = { email: string; role: Exclude<Role, 'viewer'> } & (
  { mode: 'existing' } | { mode: 'create'; name: string; password: string }
)
const minimumPasswordLength = 8

export function MemberForm({ selection, workspace, onSave, onAdd, onRemove, onClose }: {
  selection: MemberDialog; workspace: Workspace
  onSave(id: string, role: Role): Promise<void>; onRemove(id: string): Promise<void>; onClose(): void
  onAdd(values: OrganizationMemberInput): Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const { member, kind } = selection
  const [account, setAccount] = useState('')
  const [accountMode, setAccountMode] = useState<OrganizationMemberInput['mode']>('create')
  const [role, setRole] = useState<Role>(member?.role ?? 'member')
  const needsAccountChoice = !member && kind === 'project'
  const provisionAccount = !member && kind === 'organization'
  const isOwner = workspace.orgMembers.find(item => item.user_id === workspace.user.id)?.role === 'owner'
  const roles: Role[] = kind === 'project' ? ['member', 'viewer', 'admin'] : isOwner ? ['member', 'admin', 'owner'] : ['member', 'admin']
  const selectedRole = roles.includes(role) ? role : roles[0]
  const setMember = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try { await action() } catch (failure) { setError(messageOf(failure)) } finally { setBusy(false) }
  }
  const available = needsAccountChoice
    ? workspace.orgMembers.filter(item => !workspace.projectMembers.some(projectMember => projectMember.user_id === item.user_id))
    : []
  const scopeName = kind === 'project' ? workspace.project?.name : workspace.organization?.name
  const title = member ? 'Manage member' : kind === 'project' ? 'Add project member' : 'Add member'
  return <Dialog title={title} onClose={onClose}>
    <form className="form" onSubmit={event => {
      event.preventDefault()
      if (busy) return
      const fields = new FormData(event.currentTarget)
      if (provisionAccount && selectedRole !== 'viewer') {
        const email = String(fields.get('email')).trim()
        if (accountMode === 'existing') {
          void setMember(() => onAdd({ email, role: selectedRole, mode: 'existing' }))
          return
        }
        const password = String(fields.get('password'))
        const name = String(fields.get('name')).trim()
        if (!name) { setError('Enter the member’s name.'); return }
        if (Array.from(password).length < minimumPasswordLength) { setError(`Use at least ${minimumPasswordLength} characters.`); return }
        if (password !== fields.get('confirm_password')) { setError('Passwords do not match.'); return }
        void setMember(() => onAdd({ email, role: selectedRole, mode: 'create', name, password }))
        return
      }
      const userId = member?.user_id ?? account
      if (!userId) { setError('Choose a member.'); return }
      void setMember(() => onSave(userId, selectedRole))
    }}>
      <p className="member-form-scope">{kind === 'project' ? 'Project' : 'Organization'} <span aria-hidden="true">·</span> <strong>{scopeName}</strong></p>
      {member ? <p><strong>{member.name}</strong><br /><span className="muted">{member.email}</span></p> : needsAccountChoice && !available.length
        ? <p className="muted">Everyone in this organization is already on the project. Add new people under Organization members first.</p> : needsAccountChoice
        ? <div className="form-field"><span>Member</span><Dropdown label="Member" value={account} placeholder="Choose a member" disabled={busy}
          options={available.map(item => ({ value: item.user_id, label: item.name }))} onChange={setAccount} firstFocus /></div>
        : <>
          <div className="member-account-options" role="group" aria-label="Account type">
            <button type="button" aria-label="Create new account" aria-pressed={accountMode === 'create'} disabled={busy}
              onClick={() => { setAccountMode('create'); setError('') }}>
              <strong>Create new account</strong><span>Set up a Fluxtech login</span>
            </button>
            <button type="button" aria-label="Add existing account" aria-pressed={accountMode === 'existing'} disabled={busy}
              onClick={() => { setAccountMode('existing'); setError('') }}>
              <strong>Add existing account</strong><span>Use an existing Fluxtech login</span>
            </button>
          </div>
          <label key="email">Email address<input name="email" type="email" autoComplete="off" required maxLength={255} data-first-focus /></label>
          {accountMode === 'create' ? <>
            <label>Full name<input name="name" required maxLength={255} /></label>
            <label>Initial password<input name="password" type="password" autoComplete="new-password" required minLength={minimumPasswordLength} maxLength={1024} />
              <span className="field-note">Use at least {minimumPasswordLength} characters and share the password privately.</span></label>
            <label>Confirm password<input name="confirm_password" type="password" autoComplete="new-password" required minLength={minimumPasswordLength} maxLength={1024} /></label>
          </> : <p className="field-note">The member signs in with their current password.</p>}
        </>}
      <div className="form-field"><span>Role</span><Dropdown<Role> label="Role" value={selectedRole} disabled={busy}
        options={roles.map(item => ({ value: item, label: item[0].toUpperCase() + item.slice(1) }))} onChange={setRole} /></div>
      <FormError error={error} />
      {confirm && <p role="status" className="muted">
        {kind === 'organization'
          ? 'Remove this member from the organization? They will lose access to its projects and be unassigned from their tasks.'
          : 'Remove this member from the project? They will be unassigned from their tasks in this project.'}
      </p>}
      <div className="form-actions">
        {member && <button type="button" className="button secondary danger" disabled={busy} onClick={() => confirm ? void setMember(() => onRemove(member.user_id)) : setConfirm(true)}>{confirm ? 'Confirm removal' : 'Remove'}</button>}
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={busy || (needsAccountChoice && !account)}>{busy ? 'Saving…' : member ? 'Save role' : provisionAccount && accountMode === 'create' ? 'Create account and add' : 'Add member'}</button>
      </div>
    </form>
  </Dialog>
}

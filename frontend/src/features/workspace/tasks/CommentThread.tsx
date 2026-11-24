import { useState } from 'react'
import type { FormEvent } from 'react'
import { Send } from 'lucide-react'
import { Avatar, FormError } from '../../../shared/ui'
import { longDate } from '../../../shared/lib/date'
import { messageOf } from '../../../shared/lib/text'
import { request } from '../api'
import type { Comment } from '../model'
import { useTaskFeed } from './useTaskFeed'

export function CommentThread({ taskPath, userId, writable, canModerate, name }: {
  taskPath: string
  userId: string
  writable: boolean
  canModerate: boolean
  name(userId: string): string | undefined
}) {
  const path = taskPath + '/comments'
  const { page, setPage, loading, error: loadError, loadMore, retry } = useTaskFeed<Comment>(path)
  const [recent, setRecent] = useState<Comment[]>([])
  const [action, setAction] = useState<{ id: string; kind: 'edit' | 'delete' }>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const loaded = page?.items ?? []
  const loadedIds = new Set(loaded.map(comment => comment.id))
  const comments = [...loaded, ...recent.filter(comment => !loadedIds.has(comment.id))]
  const busy = saving || loading

  async function mutate(work: () => Promise<void>) {
    if (busy) return
    setSaving(true)
    setError('')
    try { await work() }
    catch (failure) { setError(messageOf(failure)) }
    finally { setSaving(false) }
  }

  function save(event: FormEvent<HTMLFormElement>, comment?: Comment) {
    event.preventDefault()
    if (busy || (!comment && action)) return
    const form = event.currentTarget
    const body = String(new FormData(form).get('body')).trim()
    if (!body) { setError('Enter a comment.'); return }
    if (comment?.body === body) { setAction(undefined); setError(''); return }

    void mutate(async () => {
      const saved = await request<Comment>(comment ? `${path}/${comment.id}` : path, {
        method: comment ? 'PATCH' : 'POST', data: { body },
      })
      if (comment) {
        const replace = (comments: Comment[]) => comments.map(item => item.id === saved.id ? saved : item)
        setPage(current => current && { ...current, items: replace(current.items) })
        setRecent(replace)
      } else {
        setRecent(current => [...current, saved])
        form.reset()
      }
      setAction(undefined)
    })
  }

  function remove(id: string) {
    void mutate(async () => {
      await request<void>(`${path}/${id}`, { method: 'DELETE' })
      setPage(current => current && {
        items: current.items.filter(item => item.id !== id),
        // The deleted row no longer occupies a position before the next server page.
        nextOffset: current.nextOffset !== null && loadedIds.has(id) ? current.nextOffset - 1 : current.nextOffset,
      })
      setRecent(current => current.filter(item => item.id !== id))
      setAction(undefined)
    })
  }

  return <div className="comments">
    {!page && loading && <p className="muted" role="status">Loading comments…</p>}
    {page && !comments.length && <p className="muted">No comments yet.</p>}
    {comments.map(comment => {
      const author = name(comment.author_id) ?? 'Member'
      const own = comment.author_id === userId
      const selectedAction = action?.id === comment.id ? action.kind : undefined
      return <article className="comment" key={comment.id}>
        <Avatar name={author} id={comment.author_id} size="small" />
        <div className="comment-content">
          <div className="comment-header">
            <div><strong>{author}</strong><time dateTime={comment.created_at}>{longDate.format(new Date(comment.created_at))}</time></div>
            {writable && (own || canModerate) && !selectedAction && <div className="comment-actions">
              {own && <button className="button secondary" type="button" disabled={busy || !!action} onClick={() => { setError(''); setAction({ id: comment.id, kind: 'edit' }) }}>Edit</button>}
              {(own || canModerate) && <button className="button secondary" type="button" disabled={busy || !!action} onClick={() => { setError(''); setAction({ id: comment.id, kind: 'delete' }) }}>Delete</button>}
            </div>}
          </div>
          {writable && selectedAction === 'edit' ? <form className="comment-form comment-edit" onSubmit={event => save(event, comment)}>
            <textarea aria-label="Edit comment" name="body" rows={3} required maxLength={500} defaultValue={comment.body} disabled={saving} />
            <FormError error={error} />
            <div className="comment-actions">
              <button type="button" className="button secondary" disabled={saving} onClick={() => { setAction(undefined); setError('') }}>Cancel</button>
              <button className="button primary" disabled={busy}>{saving ? 'Saving…' : 'Save comment'}</button>
            </div>
          </form> : <p>{comment.body}</p>}
          {writable && selectedAction === 'delete' && <div className="comment-edit">
            <p>Delete this comment?</p>
            <FormError error={error} />
            <div className="comment-actions">
              <button type="button" className="button secondary" disabled={saving} onClick={() => { setAction(undefined); setError('') }}>Cancel</button>
              <button type="button" className="button danger" disabled={busy} onClick={() => remove(comment.id)}>{saving ? 'Deleting…' : 'Delete comment'}</button>
            </div>
          </div>}
        </div>
      </article>
    })}
    <FormError error={loadError} />
    {!page && loadError && <button type="button" className="button secondary feed-more" onClick={retry}>Retry comments</button>}
    {page && page.nextOffset !== null && <button type="button" className="button secondary feed-more" disabled={busy || !!action} onClick={() => void loadMore()}>{loading ? 'Loading…' : 'Load more comments'}</button>}
    {writable && page && <form className="comment-form" onSubmit={event => save(event)}>
      <textarea aria-label="New comment" name="body" rows={3} required maxLength={500} placeholder="Write a comment" disabled={saving} />
      {!action && <FormError error={error} />}
      <button className="button primary" disabled={busy || !!action}><Send size={15} />{saving && !action ? 'Posting…' : 'Post comment'}</button>
    </form>}
  </div>
}

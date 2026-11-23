import { useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog, Empty } from '../../../shared/ui'
import { matchesTask } from '../model'
import type { Task } from '../model'
import { StatusPill } from '../tasks/TaskIndicators'

export function SearchDialog({ tasks, onOpen, onClose }: { tasks: Task[]; onOpen(id: string): void; onClose(): void }) {
  const [query, setQuery] = useState('')
  const results = tasks.filter(task => matchesTask(task, query)).slice(0, 8)
  return <Dialog title="Search tasks" onClose={onClose} className="search-dialog">
    <form className="search-form" onSubmit={event => { event.preventDefault(); if (results[0]) onOpen(results[0].id) }}>
      <label className="input-icon"><Search size={19} /><input type="search" aria-label="Search by title or task key" placeholder="Search by title or task key" data-first-focus value={query} onChange={event => setQuery(event.target.value)} /></label>
    </form>
    <div className="search-results">
      {results.map(task => <button className="overview-task" key={task.id} onClick={() => onOpen(task.id)}><span className="row-info"><strong>{task.title}</strong><span>{task.key}</span></span><StatusPill status={task.status} /></button>)}
      {!results.length && <Empty title={query ? 'No matching tasks' : 'No tasks in this project'} />}
    </div>
  </Dialog>
}

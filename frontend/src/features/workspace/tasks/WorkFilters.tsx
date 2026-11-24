import { Search, SlidersHorizontal, Users, X } from 'lucide-react'
import { Dropdown } from '../../../shared/ui'
import { emptyWorkFilters, priorities, statuses, statusNames } from '../model'
import type { WorkFilters } from '../model'

type Props = {
  board: boolean
  filters: WorkFilters
  activeFilter: boolean
  setFilters(filters: WorkFilters): void
  onViewChange?(board: boolean): void
}

export function WorkFilterBar({ board, filters, activeFilter, setFilters, onViewChange }: Props) {
  return (
    <div className="filter-bar">
      <label className="input-icon">
        <Search size={17} />
        <input
          type="search"
          aria-label="Filter tasks"
          placeholder="Filter by title or key"
          value={filters.query}
          onChange={event => setFilters({ ...filters, query: event.target.value })}
        />
      </label>
      <Dropdown label="Filter by priority" value={filters.priority} leading={<SlidersHorizontal size={15} />}
        options={[{ value: '', label: 'All priorities' }, ...priorities.map(priority => ({ value: priority, label: priority[0].toUpperCase() + priority.slice(1) }))]}
        onChange={priority => setFilters({ ...filters, priority })} />
      <Dropdown label="Filter by status" value={filters.status}
        options={[{ value: '', label: 'All statuses' }, { value: 'open', label: 'Open tasks' }, ...statuses.map(status => ({ value: status, label: statusNames[status] }))]}
        onChange={status => setFilters({ ...filters, status })} />
      <button className={`button secondary ${filters.mine ? 'toggled' : ''}`} onClick={() => setFilters({ ...filters, mine: !filters.mine })} aria-pressed={filters.mine}>
        <Users size={16} />Assigned to me
      </button>
      {activeFilter && <button className="text-button clear-button" onClick={() => setFilters(emptyWorkFilters)}><X size={15} />Clear</button>}
      {onViewChange && (
        <div className="segmented work-view-toggle" aria-label="Task layout">
          <button aria-label="Board view" aria-pressed={board} onClick={() => onViewChange(true)}>Board</button>
          <button aria-label="List view" aria-pressed={!board} onClick={() => onViewChange(false)}>List</button>
        </div>
      )}
    </div>
  )
}

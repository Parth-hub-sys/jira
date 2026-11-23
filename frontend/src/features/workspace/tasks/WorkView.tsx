import { matchesTask, statuses } from '../model'
import type { PendingTaskMove, Status, Task, Workspace } from '../model'
import { TaskBoard } from './TaskBoard'
import { TaskList } from './TaskList'
import { WorkFilterBar } from './WorkFilters'
import type { WorkFilters } from './WorkFilters'
import { WorkSummary } from './WorkSummary'

type Props = {
  workspace: Workspace
  board: boolean
  filters: WorkFilters
  canWrite: boolean
  pendingMoves: ReadonlyMap<string, PendingTaskMove>
  setFilters(filters: WorkFilters): void
  onViewChange?(board: boolean): void
  openTask(id: string): void
  openLabels(): void
  moveTask(task: Task, status: Status): void | Promise<void>
  onCreate(): void
}

export function WorkView({
  workspace, board, filters, setFilters, onViewChange, openTask, openLabels, moveTask, onCreate, canWrite, pendingMoves,
}: Props) {
  const matchesStatus = (status: Status) => {
    if (filters.status === 'open') return status !== 'done'
    return !filters.status || status === filters.status
  }
  const tasks = workspace.tasks.filter(task =>
    matchesTask(task, filters.query) &&
    (!filters.priority || task.priority === filters.priority) &&
    (!filters.label || task.label_ids.includes(filters.label)) &&
    matchesStatus(task.status) &&
    (!filters.mine || task.assignee_id === workspace.user.id))
  const activeFilter = Boolean(filters.query || filters.priority || filters.status || filters.label || filters.mine)
  const savingCount = pendingMoves.size && workspace.tasks.filter(task => pendingMoves.has(task.id)).length

  return (
    <div className="appear">
      <div className="work-heading">
        <header className="page-heading view-heading">
          <h1>{board ? 'Board' : 'Task list'}</h1>
          <p>{board ? 'Move work through each stage.' : 'Find and manage tasks in this project.'}</p>
        </header>
        {board && <WorkSummary tasks={workspace.tasks} />}
        <span className="task-saving work-saving" role="status">
          {savingCount > 0 && <><span className="spinner" />{savingCount === 1 ? 'Saving status…' : `Saving ${savingCount} statuses…`}</>}
        </span>
      </div>

      <WorkFilterBar board={board} filters={filters} labels={workspace.labels} setFilters={setFilters} openLabels={openLabels} onViewChange={onViewChange} />

      {board ? (
        <TaskBoard
          lanes={statuses.filter(matchesStatus)}
          tasks={tasks}
          members={workspace.projectMembers}
          labels={workspace.labels}
          canWrite={canWrite}
          isMoving={id => pendingMoves.has(id)}
          openTask={openTask}
          moveTask={moveTask}
        />
      ) : (
        <TaskList
          tasks={tasks}
          members={workspace.projectMembers}
          activeFilter={activeFilter}
          canWrite={canWrite}
          isMoving={id => pendingMoves.has(id)}
          openTask={openTask}
          onCreate={onCreate}
        />
      )}
    </div>
  )
}

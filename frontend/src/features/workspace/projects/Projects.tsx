import { useState } from 'react'
import { Folder, Kanban, Layers, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Empty } from '../../../shared/ui'
import type { Workspace } from '../model'

export function Projects({ workspace, selectProject, onDetails, onCreate, canManage }: {
  workspace: Workspace; selectProject(id: string): void; onDetails(id: string): void; onCreate(): void; canManage: boolean
}) {
  const [query, setQuery] = useState('')
  const projects = workspace.projects.filter(project => project.name.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="appear">
    <header className="page-heading view-heading"><div className="context-line"><span className="context-icon"><Layers size={16} /></span>{workspace.organization?.name}</div><h1>Projects</h1><p>Choose a project to see its work.</p></header>
    <div className="filter-bar"><label className="input-icon"><Search size={17} /><input type="search" aria-label="Search projects" placeholder="Search projects" value={query} onChange={event => setQuery(event.target.value)} /></label>{canManage && <button className="button primary" onClick={onCreate}><Plus size={18} />New project</button>}</div>
    <div className="project-grid">{projects.map((project, i) => <article className="panel project-card" key={project.id}>
      <header className="project-card-heading">
        <span className={`metric-icon ${['blue', 'violet', 'green'][i % 3]}`} aria-hidden="true"><Folder size={22} /></span>
        <h2>{project.name}</h2>
      </header>
      {project.description && <p className="muted">{project.description}</p>}
      <div className="project-card-actions">
        <button className="button secondary" aria-label={`Open board for ${project.name}`} onClick={() => selectProject(project.id)}><Kanban size={15} />Open board</button>
        <button className="text-button" aria-label={`Details for ${project.name}`} onClick={() => onDetails(project.id)}><SlidersHorizontal size={15} />Details</button>
      </div>
    </article>)}</div>
    {!projects.length && <div className="panel"><Empty title={query ? 'No matching projects' : 'No projects yet'} /></div>}
  </div>
}

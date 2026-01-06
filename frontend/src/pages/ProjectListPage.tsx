import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ProjectListPage.css'

interface Project {
  id: string
  name: string
  migrationType: string
  status: string
  createdAt: string
}

function ProjectListPage() {
  const navigate = useNavigate()
  const [projects] = useState<Project[]>([
    {
      id: '1',
      name: 'Customer Management System',
      migrationType: 'COBOL-to-Java',
      status: 'In Progress',
      createdAt: '2026-01-06'
    }
  ])

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Projects</h2>
        <button className="btn-primary" onClick={() => alert('Create project - Coming soon!')}>
          New Project
        </button>
      </div>

      <div className="project-list">
        {projects.map(project => (
          <div key={project.id} className="project-card" onClick={() => navigate(`/projects/${project.id}`)}>
            <h3>{project.name}</h3>
            <div className="project-meta">
              <span className="badge">{project.migrationType}</span>
              <span className="status">{project.status}</span>
            </div>
            <div className="project-date">
              Created: {project.createdAt}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProjectListPage

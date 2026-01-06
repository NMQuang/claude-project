import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjects, createProject, type Project } from '../services/api'
import './ProjectListPage.css'

function ProjectListPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProject, setNewProject] = useState({
    name: '',
    migrationType: 'COBOL-to-Java',
    sourceLanguage: 'COBOL',
    targetLanguage: 'Java 17'
  })

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      const data = await getProjects()
      setProjects(data)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      alert('Please enter a project name')
      return
    }

    try {
      await createProject(newProject)
      setShowCreateModal(false)
      setNewProject({
        name: '',
        migrationType: 'COBOL-to-Java',
        sourceLanguage: 'COBOL',
        targetLanguage: 'Java 17'
      })
      loadProjects()
    } catch (error) {
      console.error('Failed to create project:', error)
      alert('Failed to create project')
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading projects...</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Projects</h2>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <h3>No projects yet</h3>
          <p>Create your first migration project to get started</p>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            Create Project
          </button>
        </div>
      ) : (
        <div className="project-list">
          {projects.map(project => (
            <div key={project.id} className="project-card" onClick={() => navigate(`/projects/${project.id}`)}>
              <h3>{project.name}</h3>
              <div className="project-meta">
                <span className="badge">{project.migrationType}</span>
                <span className="status">{project.status}</span>
              </div>
              <div className="project-date">
                Created: {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Project</h3>
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="e.g., Customer Management System"
              />
            </div>
            <div className="form-group">
              <label>Migration Type</label>
              <select
                value={newProject.migrationType}
                onChange={(e) => setNewProject({ ...newProject, migrationType: e.target.value })}
              >
                <option value="COBOL-to-Java">COBOL to Java</option>
                <option value="PL1-to-Java">PL/I to Java</option>
                <option value="Oracle-to-PostgreSQL">Oracle to PostgreSQL</option>
                <option value="MySQL-to-Oracle">MySQL to Oracle</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateProject}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectListPage

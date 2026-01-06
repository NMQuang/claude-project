import { useParams, useNavigate } from 'react-router-dom'
import './ProjectDashboardPage.css'

function ProjectDashboardPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const documents = [
    { id: 'as-is-analysis', name: 'As-Is Analysis', status: 'Generated' },
    { id: 'migration-strategy', name: 'Migration Strategy', status: 'Not Generated' },
    { id: 'migration-design', name: 'Migration Design', status: 'Not Generated' },
    { id: 'test-strategy', name: 'Test Strategy', status: 'Not Generated' },
    { id: 'deployment-rollback', name: 'Deployment & Rollback', status: 'Not Generated' }
  ]

  return (
    <div className="page-container">
      <div className="breadcrumb">
        <a href="/">Projects</a> / Customer Management System
      </div>

      <h2>Customer Management System</h2>

      <div className="dashboard-grid">
        <div className="metrics-panel">
          <h3>Analysis Metrics</h3>
          <div className="metric-grid">
            <div className="metric">
              <div className="metric-label">COBOL Files</div>
              <div className="metric-value">6</div>
            </div>
            <div className="metric">
              <div className="metric-label">Lines of Code</div>
              <div className="metric-value">762</div>
            </div>
            <div className="metric">
              <div className="metric-label">Database Tables</div>
              <div className="metric-value">6</div>
            </div>
            <div className="metric">
              <div className="metric-label">Complexity</div>
              <div className="metric-value complexity-high">High</div>
            </div>
          </div>
        </div>

        <div className="documents-panel">
          <h3>Documents</h3>
          <div className="document-list">
            {documents.map(doc => (
              <div key={doc.id} className="document-item">
                <div className="document-info">
                  <div className="document-name">{doc.name}</div>
                  <div className={`document-status ${doc.status === 'Generated' ? 'status-success' : 'status-pending'}`}>
                    {doc.status}
                  </div>
                </div>
                <div className="document-actions">
                  {doc.status === 'Generated' ? (
                    <button
                      className="btn-secondary"
                      onClick={() => navigate(`/projects/${id}/documents/${doc.id}`)}
                    >
                      View/Edit
                    </button>
                  ) : (
                    <button className="btn-primary" onClick={() => alert('Generate - Coming soon!')}>
                      Generate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectDashboardPage

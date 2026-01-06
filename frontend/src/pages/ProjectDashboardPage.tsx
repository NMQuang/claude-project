import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getProject,
  uploadFiles,
  analyzeProject,
  generateDocument,
  type Project
} from '../services/api'
import './ProjectDashboardPage.css'

interface DocumentStatus {
  id: string
  name: string
  generated: boolean
}

function ProjectDashboardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const documents: DocumentStatus[] = [
    { id: 'as-is-analysis', name: 'As-Is Analysis', generated: false },
    { id: 'migration-strategy', name: 'Migration Strategy', generated: false },
    { id: 'migration-design', name: 'Migration Design', generated: false },
    { id: 'test-strategy', name: 'Test Strategy', generated: false },
    { id: 'deployment-rollback', name: 'Deployment & Rollback', generated: false }
  ]

  useEffect(() => {
    loadProject()
  }, [id])

  const loadProject = async () => {
    if (!id) return
    try {
      setLoading(true)
      const data = await getProject(id)
      setProject(data)
    } catch (error) {
      console.error('Failed to load project:', error)
      alert('Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || !id) return

    try {
      setUploadingFiles(true)
      await uploadFiles(id, files)
      alert(`${files.length} file(s) uploaded successfully`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Failed to upload files:', error)
      alert('Failed to upload files')
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleAnalyze = async () => {
    if (!id) return
    try {
      setAnalyzing(true)
      const result = await analyzeProject(id)
      alert('Analysis complete!')
      loadProject()
    } catch (error) {
      console.error('Failed to analyze project:', error)
      alert('Failed to analyze project. Make sure files are uploaded first.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleGenerateDocument = async (docType: string) => {
    if (!id) return
    try {
      setGenerating(docType)
      await generateDocument(id, docType)
      alert(`${docType} generated successfully!`)
      loadProject()
    } catch (error) {
      console.error('Failed to generate document:', error)
      alert('Failed to generate document. Make sure analysis is complete first.')
    } finally {
      setGenerating(null)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading project...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="page-container">
        <div className="error">Project not found</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="breadcrumb">
        <a href="/">Projects</a> / {project.name}
      </div>

      <div className="page-header">
        <h2>{project.name}</h2>
        <div className="action-buttons">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept=".cbl,.sql"
            style={{ display: 'none' }}
          />
          <button
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFiles}
          >
            {uploadingFiles ? 'Uploading...' : 'Upload Files'}
          </button>
          <button
            className="btn-primary"
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="metrics-panel">
          <h3>Analysis Metrics</h3>
          {project.metadata ? (
            <div className="metric-grid">
              <div className="metric">
                <div className="metric-label">COBOL Files</div>
                <div className="metric-value">{project.metadata.total_files || 0}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Lines of Code</div>
                <div className="metric-value">{project.metadata.total_loc || 0}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Database Tables</div>
                <div className="metric-value">{project.ddlMetadata?.tables?.length || 0}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Complexity</div>
                <div className={`metric-value complexity-${project.metadata.complexity?.toLowerCase() || 'unknown'}`}>
                  {project.metadata.complexity || 'Unknown'}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-metrics">
              No analysis data yet. Upload files and run analysis.
            </div>
          )}
        </div>

        <div className="documents-panel">
          <h3>Documents</h3>
          <div className="document-list">
            {documents.map(doc => (
              <div key={doc.id} className="document-item">
                <div className="document-info">
                  <div className="document-name">{doc.name}</div>
                  <div className={`document-status ${doc.generated ? 'status-success' : 'status-pending'}`}>
                    {doc.generated ? 'Generated' : 'Not Generated'}
                  </div>
                </div>
                <div className="document-actions">
                  {doc.generated ? (
                    <button
                      className="btn-secondary"
                      onClick={() => navigate(`/projects/${id}/documents/${doc.id}`)}
                    >
                      View/Edit
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() => handleGenerateDocument(doc.id)}
                      disabled={!project.metadata || generating === doc.id}
                    >
                      {generating === doc.id ? 'Generating...' : 'Generate'}
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

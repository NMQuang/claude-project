import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getProject,
  uploadFiles,
  analyzeProject,
  generateDocument,
  downloadDocument,
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
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en')

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

  // Load language preference from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferredLanguage')
    if (savedLanguage) {
      setSelectedLanguage(savedLanguage)
    }
  }, [])

  // Save language preference when it changes
  useEffect(() => {
    if (selectedLanguage) {
      localStorage.setItem('preferredLanguage', selectedLanguage)
    }
  }, [selectedLanguage])

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
      await generateDocument(id, docType, selectedLanguage)
      alert(`${docType} generated successfully!`)
      loadProject()
    } catch (error) {
      console.error('Failed to generate document:', error)
      alert('Failed to generate document. Make sure analysis is complete first.')
    } finally {
      setGenerating(null)
    }
  }

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLanguage(event.target.value)
  }

  const handleDownloadDocument = async (docType: string) => {
    if (!id) return
    try {
      await downloadDocument(id, docType)
    } catch (error) {
      console.error('Failed to download document:', error)
      alert('Failed to download document')
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
          <div className="language-selector">
            <label htmlFor="language-select">Language:</label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={handleLanguageChange}
              className="language-dropdown"
            >
              <option value="en">English</option>
              <option value="ja">日本語 (Japanese)</option>
            </select>
          </div>
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
                <div className="metric-value">{project.metadata.source_analysis?.total_files || 0}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Lines of Code</div>
                <div className="metric-value">{project.metadata.source_analysis?.total_loc || 0}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Database Tables</div>
                <div className="metric-value">{project.metadata.source_analysis?.database?.tables || 0}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Complexity</div>
                <div className={`metric-value complexity-${project.metadata.complexity_summary?.split(' ')[0]?.toLowerCase() || 'unknown'}`}>
                  {project.metadata.complexity_summary?.split(' - ')[0] || 'Unknown'}
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
            {documents.map(doc => {
              const isGenerated = project.generatedDocuments?.includes(doc.id) || false
              return (
                <div key={doc.id} className="document-item">
                  <div className="document-info">
                    <div className="document-name">{doc.name}</div>
                    <div className={`document-status ${isGenerated ? 'status-success' : 'status-pending'}`}>
                      {isGenerated ? 'Generated' : 'Not Generated'}
                    </div>
                  </div>
                  <div className="document-actions">
                    {isGenerated ? (
                      <>
                        <button
                          className="btn-secondary"
                          onClick={() => navigate(`/projects/${id}/documents/${doc.id}`)}
                        >
                          View/Edit
                        </button>
                        <button
                          className="btn-primary"
                          onClick={() => handleDownloadDocument(doc.id)}
                        >
                          Download
                        </button>
                      </>
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
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectDashboardPage

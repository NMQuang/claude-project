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
            <>
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
                  <div className="metric-label">Migration Difficulty</div>
                  <div className={`metric-value complexity-${project.metadata.migrationComplexity?.difficulty?.toLowerCase() || 'unknown'}`}>
                    {project.metadata.migrationComplexity?.difficulty || 'Unknown'}
                  </div>
                </div>
              </div>

              {project.metadata.migrationComplexity && (
                <div className="complexity-breakdown">
                  <h4>Migration Complexity Score: {project.metadata.migrationComplexity.overall}/100</h4>
                  <p className="complexity-description">{project.metadata.migrationComplexity.description}</p>

                  <div className="complexity-dimensions">
                    <div className="complexity-dimension">
                      <div className="dimension-header">
                        <span className="dimension-name">Logic Complexity</span>
                        <span className="dimension-score">{project.metadata.migrationComplexity.logicComplexity}/100</span>
                      </div>
                      <div className="dimension-bar">
                        <div
                          className="dimension-fill logic"
                          style={{ width: `${project.metadata.migrationComplexity.logicComplexity}%` }}
                        />
                      </div>
                      {project.metadata.migrationComplexity.details.logic.length > 0 && (
                        <ul className="dimension-details">
                          {project.metadata.migrationComplexity.details.logic.map((detail, idx) => (
                            <li key={idx}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="complexity-dimension">
                      <div className="dimension-header">
                        <span className="dimension-name">Data & SQL Complexity</span>
                        <span className="dimension-score">{project.metadata.migrationComplexity.dataComplexity}/100</span>
                      </div>
                      <div className="dimension-bar">
                        <div
                          className="dimension-fill data"
                          style={{ width: `${project.metadata.migrationComplexity.dataComplexity}%` }}
                        />
                      </div>
                      {project.metadata.migrationComplexity.details.data.length > 0 && (
                        <ul className="dimension-details">
                          {project.metadata.migrationComplexity.details.data.map((detail, idx) => (
                            <li key={idx}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="complexity-dimension">
                      <div className="dimension-header">
                        <span className="dimension-name">COBOL-specific Risk</span>
                        <span className="dimension-score">{project.metadata.migrationComplexity.cobolSpecificRisk}/100</span>
                      </div>
                      <div className="dimension-bar">
                        <div
                          className="dimension-fill risk"
                          style={{ width: `${project.metadata.migrationComplexity.cobolSpecificRisk}%` }}
                        />
                      </div>
                      {project.metadata.migrationComplexity.details.risk.length > 0 && (
                        <ul className="dimension-details">
                          {project.metadata.migrationComplexity.details.risk.map((detail, idx) => (
                            <li key={idx}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
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

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getProject,
  uploadFiles,
  analyzeProject,
  generateDocument,
  downloadDocument,
  type Project,
  type PostgreSQLMigrationComplexityScore
} from '../services/api'
import { filterFilesByMigrationType, getAcceptAttribute } from '../utils/fileFilters'
import './ProjectDashboardPage.css'

interface DocumentStatus {
  id: string
  name: string
  generated: boolean
}

interface ComplexityDimensionProps {
  name: string
  score: number
  details: string[]
  colorClass: string
}

function ProjectDashboardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en')

  const getDocumentsByMigrationType = (migrationType: string): DocumentStatus[] => {
    if (migrationType === 'Source-Analysis-COBOL') {
      return [
        { id: 'source-analysis', name: 'Source Analysis Report', generated: false }
      ]
    }
    // Default documents for COBOL-to-Java and PostgreSQL-to-Oracle
    return [
      { id: 'as-is-analysis', name: 'As-Is Analysis', generated: false },
      { id: 'migration-strategy', name: 'Migration Strategy', generated: false },
      { id: 'migration-design', name: 'Migration Design', generated: false },
      { id: 'test-strategy', name: 'Test Strategy', generated: false },
      { id: 'deployment-rollback', name: 'Deployment & Rollback', generated: false }
    ]
  }

  const documents: DocumentStatus[] = getDocumentsByMigrationType(project?.migrationType || '')

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
    if (!files || !id || !project) return

    // Filter files based on migration type
    const { validFiles, skippedCount, skippedFiles } = filterFilesByMigrationType(files, project.migrationType)

    if (validFiles.length === 0) {
      alert('No valid files selected for this migration type')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    try {
      setUploadingFiles(true)

      // Convert File array to FileList-like object
      const dataTransfer = new DataTransfer()
      validFiles.forEach(file => dataTransfer.items.add(file))

      await uploadFiles(id, dataTransfer.files)

      let message = `${validFiles.length} file(s) uploaded successfully`
      if (skippedCount > 0) {
        message += `\n\n${skippedCount} file(s) skipped (not relevant for ${project.migrationType} migration):`
        message += '\n' + skippedFiles.slice(0, 10).join('\n')
        if (skippedFiles.length > 10) {
          message += `\n... and ${skippedFiles.length - 10} more`
        }
      }
      alert(message)

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

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || !id || !project) return

    // Filter files based on migration type
    const { validFiles, skippedCount } = filterFilesByMigrationType(files, project.migrationType)

    if (validFiles.length === 0) {
      alert('No valid files found in folder for this migration type')
      if (folderInputRef.current) {
        folderInputRef.current.value = ''
      }
      return
    }

    try {
      setUploadingFiles(true)

      // Convert File array to FileList-like object while preserving webkitRelativePath
      // Skip DataTransfer because it drops the webkitRelativePath property on Chrome/Edge
      await uploadFiles(id, validFiles, true)

      let message = `${validFiles.length} file(s) from folder uploaded successfully`
      if (skippedCount > 0) {
        message += `\n\n${skippedCount} file(s) skipped (images, txt, and other files not relevant for ${project.migrationType} migration)`
      }
      alert(message)

      if (folderInputRef.current) {
        folderInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Failed to upload folder:', error)
      alert('Failed to upload folder')
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleAnalyze = async () => {
    if (!id) return
    try {
      setAnalyzing(true)
      await analyzeProject(id)
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

  // Reusable component for dimension display
  const ComplexityDimension = ({ name, score, details, colorClass }: ComplexityDimensionProps) => (
    <div className="complexity-dimension">
      <div className="dimension-header">
        <span className="dimension-name">{name}</span>
        <span className="dimension-score">{score}/100</span>
      </div>
      <div className="dimension-bar">
        <div className={`dimension-fill ${colorClass}`} style={{ width: `${score}%` }} />
      </div>
      {details && details.length > 0 && (
        <ul className="dimension-details">
          {details.map((detail, idx) => <li key={idx}>{detail}</li>)}
        </ul>
      )}
    </div>
  )

  // Dynamic renderer based on migration type
  const renderComplexityDimensions = (complexity: any, migrationType: string) => {
    if (migrationType === 'COBOL-to-Java') {
      return (
        <>
          <ComplexityDimension
            name="Logic Complexity"
            score={complexity.logicComplexity}
            details={complexity.details?.logic || []}
            colorClass="logic"
          />
          <ComplexityDimension
            name="Data & SQL Complexity"
            score={complexity.dataComplexity}
            details={complexity.details?.data || []}
            colorClass="data"
          />
          <ComplexityDimension
            name="COBOL-specific Risk"
            score={complexity.cobolSpecificRisk}
            details={complexity.details?.risk || []}
            colorClass="risk"
          />
        </>
      )
    } else if (migrationType === 'PostgreSQL-to-Oracle') {
      const pgComplexity = complexity as PostgreSQLMigrationComplexityScore
      return (
        <>
          <ComplexityDimension
            name="Schema & Data Type Complexity"
            score={pgComplexity.schemaDataTypeComplexity}
            details={pgComplexity.details?.schemaDataType || []}
            colorClass="dimension1"
          />
          <ComplexityDimension
            name="SQL & Query Rewrite Complexity"
            score={pgComplexity.sqlQueryRewriteComplexity}
            details={pgComplexity.details?.sqlQueryRewrite || []}
            colorClass="dimension2"
          />
          <ComplexityDimension
            name="Stored Procedures, Functions & Triggers"
            score={pgComplexity.procedureFunctionTriggerComplexity}
            details={pgComplexity.details?.procedureFunctionTrigger || []}
            colorClass="dimension3"
          />
          <ComplexityDimension
            name="Data Volume & Migration Strategy"
            score={pgComplexity.dataVolumeMigrationComplexity}
            details={pgComplexity.details?.dataVolumeMigration || []}
            colorClass="dimension4"
          />
          <ComplexityDimension
            name="Application & ORM Dependencies"
            score={pgComplexity.applicationORMDependencyComplexity}
            details={pgComplexity.details?.applicationORMDependency || []}
            colorClass="dimension5"
          />
          <ComplexityDimension
            name="Operational & Runtime Risks"
            score={pgComplexity.operationalRuntimeRiskComplexity}
            details={pgComplexity.details?.operationalRuntimeRisk || []}
            colorClass="dimension6"
          />
        </>
      )
    }
    return null
  }

  // Render Source-Analysis-COBOL metrics panel
  const renderSourceAnalysisMetrics = (metadata: any) => {
    const sa = metadata.source_analysis || {}
    const total = (sa.online_programs || 0) + (sa.batch_programs || 0) + (sa.undetermined || 0)
    const onlinePct = total > 0 ? Math.round(((sa.online_programs || 0) / total) * 100) : 0
    const batchPct = total > 0 ? Math.round(((sa.batch_programs || 0) / total) * 100) : 0
    const undeterminedPct = total > 0 ? Math.round(((sa.undetermined || 0) / total) * 100) : 0

    return (
      <>
        <div className="metric-grid metric-grid-3col">
          <div className="metric">
            <div className="metric-label">Total Programs</div>
            <div className="metric-value">{sa.total_files || 0}</div>
          </div>
          <div className="metric metric-online">
            <div className="metric-label">🟢 Online (CICS)</div>
            <div className="metric-value metric-online-val">{sa.online_programs || 0}</div>
          </div>
          <div className="metric metric-batch">
            <div className="metric-label">🔵 Batch</div>
            <div className="metric-value metric-batch-val">{sa.batch_programs || 0}</div>
          </div>
          <div className="metric">
            <div className="metric-label">❓ Undetermined</div>
            <div className="metric-value">{sa.undetermined || 0}</div>
          </div>
          <div className="metric">
            <div className="metric-label">JCL Jobs</div>
            <div className="metric-value">{sa.jcl_jobs || 0}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Data Structures</div>
            <div className="metric-value">{sa.data_structures || 0}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Total LOC</div>
            <div className="metric-value">{(sa.total_loc || 0).toLocaleString()}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Copybooks</div>
            <div className="metric-value">{sa.copybooks || 0}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Open Questions</div>
            <div className="metric-value metric-warn">{sa.open_questions || 0}</div>
          </div>
        </div>

        {total > 0 && (
          <div className="execution-pattern-breakdown">
            <h4>Execution Pattern Distribution</h4>
            <div className="pattern-bar-container">
              <div
                className="pattern-bar pattern-online"
                style={{ width: `${onlinePct}%` }}
                title={`Online (CICS): ${sa.online_programs || 0} programs (${onlinePct}%)`}
              >
                {onlinePct > 8 && `${onlinePct}%`}
              </div>
              <div
                className="pattern-bar pattern-batch"
                style={{ width: `${batchPct}%` }}
                title={`Batch: ${sa.batch_programs || 0} programs (${batchPct}%)`}
              >
                {batchPct > 8 && `${batchPct}%`}
              </div>
              <div
                className="pattern-bar pattern-undetermined"
                style={{ width: `${undeterminedPct}%` }}
                title={`Undetermined: ${sa.undetermined || 0} programs (${undeterminedPct}%)`}
              >
                {undeterminedPct > 8 && `${undeterminedPct}%`}
              </div>
            </div>
            <div className="pattern-legend">
              <span className="legend-item legend-online">🟢 Online/CICS: {sa.online_programs || 0}</span>
              <span className="legend-item legend-batch">🔵 Batch: {sa.batch_programs || 0}</span>
              <span className="legend-item legend-undetermined">⬜ Undetermined: {sa.undetermined || 0}</span>
            </div>
          </div>
        )}
      </>
    )
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
            accept={getAcceptAttribute(project.migrationType)}
            style={{ display: 'none' }}
          />
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFolderSelect}
            {...{ webkitdirectory: '', directory: '' } as any}
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
            className="btn-secondary"
            onClick={() => folderInputRef.current?.click()}
            disabled={uploadingFiles}
          >
            {uploadingFiles ? 'Uploading...' : 'Upload Folder'}
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
              {project.migrationType === 'Source-Analysis-COBOL' ? (
                renderSourceAnalysisMetrics(project.metadata)
              ) : (
                <>
                  <div className="metric-grid">
                    <div className="metric">
                      <div className="metric-label">
                        {project.migrationType === 'PostgreSQL-to-Oracle'
                          ? 'Database Tables'
                          : 'Source Files'}
                      </div>
                      <div className="metric-value">
                        {project.migrationType === 'PostgreSQL-to-Oracle'
                          ? (project.metadata.source_analysis?.database?.tables || 0)
                          : (project.metadata.source_analysis?.total_files || 0)}
                      </div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Lines of Code</div>
                      <div className="metric-value">
                        {(project.metadata.source_analysis?.total_loc || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">
                        {project.migrationType === 'PostgreSQL-to-Oracle'
                          ? 'Stored Procedures/Functions'
                          : 'Database Tables'}
                      </div>
                      <div className="metric-value">
                        {project.migrationType === 'PostgreSQL-to-Oracle'
                          ? ((project.metadata.source_analysis?.database?.procedures || 0) + (project.metadata.source_analysis?.database?.functions || 0))
                          : (project.metadata.source_analysis?.database?.tables || 0)}
                      </div>
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
                        {renderComplexityDimensions(project.metadata.migrationComplexity, project.migrationType)}
                      </div>
                    </div>
                  )}
                </>
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

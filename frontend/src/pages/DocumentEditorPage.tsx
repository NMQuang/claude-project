import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getDocument, updateDocument, getProject, type Project } from '../services/api'
import './DocumentEditorPage.css'

const DOC_NAMES: { [key: string]: string } = {
  'as-is-analysis': 'As-Is Analysis',
  'migration-strategy': 'Migration Strategy',
  'migration-design': 'Migration Design',
  'test-strategy': 'Test Strategy',
  'deployment-rollback': 'Deployment & Rollback'
}

function DocumentEditorPage() {
  const { id, docId } = useParams()
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    loadDocument()
    loadProject()
  }, [id, docId])

  useEffect(() => {
    setHasChanges(content !== originalContent)
  }, [content, originalContent])

  const loadProject = async () => {
    if (!id) return
    try {
      const data = await getProject(id)
      setProject(data)
    } catch (error) {
      console.error('Failed to load project:', error)
    }
  }

  const loadDocument = async () => {
    if (!id || !docId) return
    try {
      setLoading(true)
      const doc = await getDocument(id, docId)
      setContent(doc.content)
      setOriginalContent(doc.content)
    } catch (error) {
      console.error('Failed to load document:', error)
      setContent('# Document not found\n\nThis document has not been generated yet.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!id || !docId) return
    try {
      setSaving(true)
      await updateDocument(id, docId, content)
      setOriginalContent(content)
      alert('Document saved successfully!')
    } catch (error) {
      console.error('Failed to save document:', error)
      alert('Failed to save document')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${docId}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading document...</div>
      </div>
    )
  }

  const docName = docId ? DOC_NAMES[docId] || docId : 'Document'

  return (
    <div className="page-container">
      <div className="breadcrumb">
        <a href="/">Projects</a> / <a href={`/projects/${id}`}>{project?.name || 'Project'}</a> / {docName}
      </div>

      <div className="editor-header">
        <div>
          <h2>{docName}</h2>
          {hasChanges && <span className="unsaved-indicator">Unsaved changes</span>}
        </div>
        <div className="editor-actions">
          <button
            className="btn-secondary"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn-primary" onClick={handleExport}>
            Export
          </button>
        </div>
      </div>

      <div className="editor-container">
        <div className="editor-pane">
          <h3>Markdown Editor</h3>
          <textarea
            className="markdown-editor"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Document content will appear here..."
          />
        </div>

        <div className="preview-pane">
          <h3>Preview</h3>
          <div className="markdown-preview">
            <pre>{content}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentEditorPage

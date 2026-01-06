import { useState } from 'react'
import { useParams } from 'react-router-dom'
import './DocumentEditorPage.css'

function DocumentEditorPage() {
  const { id, docId } = useParams()
  const [content, setContent] = useState(`# As-Is Analysis Document

## Document Information

| Item | Details |
|------|---------|
| **Project Name** | Customer Management System |
| **Migration Type** | COBOL-to-Java |

## Executive Summary

This document provides analysis of the current system...

*[View the actual generated document in output/as-is-analysis.md]*
`)

  return (
    <div className="page-container">
      <div className="breadcrumb">
        <a href="/">Projects</a> / <a href={`/projects/${id}`}>Customer Management System</a> / As-Is Analysis
      </div>

      <div className="editor-header">
        <h2>As-Is Analysis</h2>
        <div className="editor-actions">
          <button className="btn-secondary" onClick={() => alert('Save - Coming soon!')}>
            Save
          </button>
          <button className="btn-primary" onClick={() => alert('Export - Coming soon!')}>
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
          />
        </div>

        <div className="preview-pane">
          <h3>Preview</h3>
          <div className="markdown-preview">
            <p><em>Monaco Editor integration coming soon...</em></p>
            <pre>{content}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentEditorPage

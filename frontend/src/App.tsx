import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './App.css'
import ProjectListPage from './pages/ProjectListPage'
import ProjectDashboardPage from './pages/ProjectDashboardPage'
import DocumentEditorPage from './pages/DocumentEditorPage'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <div className="navbar-brand">
            <h1>Migration Documentation Tool</h1>
          </div>
          <div className="navbar-links">
            <Link to="/">Projects</Link>
            <Link to="/about">About</Link>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<ProjectListPage />} />
            <Route path="/projects/:id" element={<ProjectDashboardPage />} />
            <Route path="/projects/:id/documents/:docId" element={<DocumentEditorPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

function AboutPage() {
  return (
    <div className="page-container">
      <h2>About Migration Documentation Tool</h2>
      <p>Semi-automatic documentation generation for migration projects.</p>
      <ul>
        <li>COBOL → Java</li>
        <li>PL/I → Java</li>
        <li>Oracle → PostgreSQL</li>
        <li>MySQL → Oracle</li>
      </ul>
    </div>
  )
}

export default App

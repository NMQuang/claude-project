# Migration Documentation Tool - Architecture Design

## Overview

A semi-automatic documentation generation tool with a **Web UI** that analyzes source code, database schemas, and migration artifacts to produce standardized migration documentation in Markdown format.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Web UI (Frontend)                         │
│     React/Vue + Monaco Editor for document review           │
│     - Project setup wizard                                   │
│     - Analysis dashboard                                     │
│     - Document editor & preview                              │
│     - Export & download                                      │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API / WebSocket
┌───────────────────────────┴─────────────────────────────────┐
│                Backend (Node.js/TypeScript)                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          Orchestration Layer                       │    │
│  │  - Project configuration management                │    │
│  │  - Workflow orchestration                          │    │
│  │  - Document generation pipeline                    │    │
│  └────────────────────────┬───────────────────────────┘    │
│                           │                                  │
│       ┌───────────────────┼───────────────────┐            │
│       │                   │                   │              │
│  ┌────▼────────┐  ┌──────▼──────┐  ┌────────▼─────────┐   │
│  │  Analyzers  │  │ Extractors  │  │   Generators     │   │
│  │             │  │             │  │                  │   │
│  │ - COBOL     │  │ - Metadata  │  │ - Template       │   │
│  │ - PL/I      │  │   Extractor │  │   Engine         │   │
│  │ - Java      │  │ - Mapping   │  │ - AI-assisted    │   │
│  │ - DDL       │  │   Builder   │  │   Generation     │   │
│  │             │  │ - Complexity│  │ - Markdown       │   │
│  └────┬────────┘  └──────┬──────┘  └────────┬─────────┘   │
│       │                  │                   │              │
│       └──────────────────┼───────────────────┘              │
│                          │                                  │
│               ┌──────────▼──────────┐                       │
│               │   Knowledge Base    │                       │
│               │  - Migration Rules  │                       │
│               │  - Best Practices   │                       │
│               │  - Pattern Library  │                       │
│               └─────────────────────┘                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │   Storage Layer     │
                │  - File System      │
                │  - SQLite/PostgreSQL│
                │  - S3 (optional)    │
                └─────────────────────┘
```

## Technology Stack (Node.js/TypeScript)

### Backend
- **Runtime:** Node.js 18+ LTS
- **Language:** TypeScript 5+
- **Web Framework:** Express.js or Fastify
- **Parsing:**
  - ANTLR4 (JavaScript target) for COBOL/PL1 grammars
  - `java-parser` (npm) for Java analysis
  - `node-sql-parser` for DDL/SQL parsing
- **Template Engine:** Handlebars or EJS
- **AI Integration:**
  - OpenAI SDK (`openai`)
  - Anthropic SDK (`@anthropic-ai/sdk`)
- **Output:**
  - `markdown-it` for Markdown processing
  - `docx` for Word export (future)
- **Database:** SQLite (dev) / PostgreSQL (production)
- **File Upload:** `multer` or `formidable`
- **Job Queue:** `bull` (for long-running analysis tasks)

### Frontend
- **Framework:** React 18+ with TypeScript
  - Alternative: Vue 3 (if team prefers)
- **UI Components:**
  - Material-UI (MUI) or Ant Design
  - Tailwind CSS for styling
- **Code/Document Editor:**
  - Monaco Editor (VS Code editor) for Markdown editing
  - Or CodeMirror 6
- **State Management:**
  - React Context + Hooks (simple)
  - Zustand or Redux Toolkit (complex)
- **API Client:** Axios or fetch with React Query
- **Visualization:**
  - Mermaid.js for diagrams
  - Chart.js or Recharts for metrics
- **File Upload:** `react-dropzone`

### DevOps & Deployment
- **Build Tool:** Vite (frontend) + esbuild/swc (backend)
- **Monorepo:** Nx or Turborepo (optional)
- **Testing:** Vitest, Jest, Playwright
- **Containerization:** Docker + Docker Compose
- **Deployment:**
  - Self-hosted: Docker on VM
  - Cloud: AWS (ECS/Fargate), Azure App Service, or Railway

## Core Components

### 1. Analyzers (Backend)
**Purpose:** Parse and understand source artifacts

**Implementation as TypeScript modules:**

```typescript
// src/analyzers/base.ts
interface Analyzer {
  analyze(filePath: string): Promise<AnalysisResult>;
}

// src/analyzers/cobol-analyzer.ts
class CobolAnalyzer implements Analyzer {
  async analyze(filePath: string): Promise<CobolAnalysisResult> {
    // Use ANTLR4 to parse COBOL
    // Extract programs, divisions, sections, data structures
  }
}
```

**Sub-components:**
- **COBOL/PL1 Analyzer**
  - Parse source code structure (programs, divisions, sections)
  - Extract business logic, data structures, file I/O
  - Identify dependencies and call hierarchies
  - Libraries: `antlr4ts` with COBOL/PL1 grammars

- **Java Analyzer**
  - Parse target Java code
  - Extract classes, methods, packages
  - Libraries: `java-parser`, `jsdoc-parser` (for Javadoc)

- **Database Analyzer**
  - Parse DDL (Oracle, PostgreSQL, MySQL)
  - Extract schema structure (tables, columns, indexes, constraints)
  - Libraries: `node-sql-parser`, custom regex for complex DDL

**Output:** Structured JSON representation

### 2. Extractors (Backend)
**Purpose:** Extract high-level metadata and insights from analyzed code

```typescript
// src/extractors/metadata-extractor.ts
class MetadataExtractor {
  extract(analysisResults: AnalysisResult[]): ProjectMetadata {
    // Calculate LOC, complexity, file counts
    // Build dependency graphs
    // Identify patterns
  }
}
```

**Output:** Metadata JSON, mapping tables, complexity metrics

### 3. Generators (Backend)
**Purpose:** Generate documentation from templates and extracted data

```typescript
// src/generators/document-generator.ts
class DocumentGenerator {
  async generate(
    template: DocumentTemplate,
    metadata: ProjectMetadata,
    config: GenerationConfig
  ): Promise<string> {
    // Use Handlebars to render template
    // Optionally call AI API for enhanced sections
    // Format as Markdown
  }
}
```

**Sub-components:**
- **Template Engine:** Handlebars with custom helpers
- **AI-Assisted Generator:** Call Claude/GPT API for prose sections
- **Markdown Formatter:** Ensure consistent formatting

### 4. Knowledge Base (Configuration Files)
**Purpose:** Store reusable migration knowledge

**Format:** YAML/JSON files in `knowledge-base/` directory

```yaml
# knowledge-base/mappings/cobol-to-java.yml
data_types:
  - source: "PIC 9(10)V99"
    target: "BigDecimal"
    notes: "Preserve precision for financial calculations"
  - source: "PIC X(n)"
    target: "String"

patterns:
  - name: "Batch Job Pattern"
    cobol_pattern: "PROCEDURE DIVISION using file-control"
    java_equivalent: "Spring Batch JobLauncher"
```

### 5. API Layer (Backend)

**REST API Endpoints:**

```typescript
// POST /api/projects
// Create new migration project

// POST /api/projects/:id/upload
// Upload source files (COBOL, DDL, etc.)

// POST /api/projects/:id/analyze
// Trigger analysis (async job)

// GET /api/projects/:id/analysis-status
// Check analysis progress

// GET /api/projects/:id/metadata
// Get extracted metadata

// POST /api/projects/:id/generate-doc
// Generate specific document type
// Body: { documentType: 'as-is-analysis', useAI: true }

// GET /api/projects/:id/documents/:docId
// Get generated document content

// PUT /api/projects/:id/documents/:docId
// Update document (user edits)

// GET /api/projects/:id/export
// Export documents (ZIP with all Markdown files)
```

**WebSocket for real-time updates:**
```typescript
// ws://server/analysis-progress
// Push analysis progress updates to UI
```

### 6. Frontend Components

**Key Pages/Views:**

```
/projects                    → Project list
/projects/new                → Project creation wizard
/projects/:id/dashboard      → Analysis dashboard
/projects/:id/documents      → Document list
/projects/:id/documents/:docId/edit → Document editor
/projects/:id/export         → Export options
```

**Component Structure:**
```
src/
├── components/
│   ├── ProjectWizard/      → Multi-step project setup
│   ├── AnalysisDashboard/  → Metrics, charts, progress
│   ├── DocumentEditor/     → Monaco editor with preview
│   ├── MappingViewer/      → Table showing COBOL→Java mappings
│   └── DiagramRenderer/    → Mermaid diagram display
├── pages/
├── hooks/
├── services/               → API client
└── types/                  → TypeScript interfaces
```

## Workflow

### End-to-End User Journey

```
1. User logs in to Web UI

2. Create New Project
   ↓
   - Click "New Project"
   - Wizard: Enter project name, migration type (COBOL→Java)
   - Upload source files (drag & drop .cbl files, .sql DDL)
   - Configure options (use AI, complexity threshold)
   - Click "Create & Analyze"

3. Analysis Phase (Backend)
   ↓
   - Backend receives files, stores in project directory
   - Queues analysis job (Bull queue)
   - Worker processes:
     * Parses COBOL/PL1 files
     * Parses Oracle DDL
     * Extracts metadata
     * Builds mappings
   - WebSocket pushes progress to UI (0% → 100%)

4. View Analysis Results
   ↓
   - Dashboard shows:
     * Metrics (LOC, file count, complexity distribution)
     * Dependency graph visualization
     * Risk heat map
     * Mapping tables preview

5. Generate Documents
   ↓
   - User clicks "Generate As-Is Analysis Document"
   - Backend:
     * Loads as-is-analysis.hbs template
     * Injects metadata
     * (Optional) Calls Claude API to enrich sections
     * Returns Markdown
   - Frontend displays in Monaco editor

6. Review & Edit
   ↓
   - User reviews generated document
   - Makes inline edits in Monaco editor
   - Saves changes (PUT /api/projects/:id/documents/:docId)

7. Generate Other Documents
   ↓
   - Repeat steps 5-6 for Migration Strategy, Design, Test, Deployment docs

8. Export
   ↓
   - Click "Export All Documents"
   - Backend generates ZIP with all Markdown files
   - User downloads
   - (Future) Convert to DOCX/PDF before download
```

## Data Model

### Database Schema (PostgreSQL)

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  migration_type VARCHAR(50), -- 'COBOL-to-Java', 'PL1-to-Java', etc.
  source_language VARCHAR(50),
  target_language VARCHAR(50),
  source_database VARCHAR(50),
  target_database VARCHAR(50),
  status VARCHAR(50), -- 'created', 'analyzing', 'completed', 'error'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Uploaded files
CREATE TABLE source_files (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  file_name VARCHAR(255),
  file_type VARCHAR(50), -- 'cobol', 'pl1', 'java', 'ddl'
  file_path TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Analysis results (stores JSON metadata)
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  metadata JSONB, -- Full metadata JSON
  completed_at TIMESTAMP DEFAULT NOW()
);

-- Generated documents
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  document_type VARCHAR(50), -- 'as-is-analysis', 'migration-strategy', etc.
  content TEXT, -- Markdown content
  version INT DEFAULT 1,
  generated_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  project_id UUID,
  user_id UUID,
  action VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Project Configuration (stored as JSON in project directory)

```json
{
  "project": {
    "id": "uuid",
    "name": "CustomerSystem-Migration",
    "type": "COBOL-to-Java"
  },
  "source": {
    "language": "COBOL",
    "files": ["CUSTMGMT.cbl", "ORDPROC.cbl"],
    "database": "Oracle 11g",
    "ddl_files": ["schema.sql"]
  },
  "target": {
    "language": "Java 17",
    "framework": "Spring Boot",
    "database": "PostgreSQL 15"
  },
  "options": {
    "use_ai": true,
    "ai_provider": "anthropic", // or "openai"
    "complexity_threshold": 10,
    "include_diagrams": true
  }
}
```

## Project Structure

```
migration-doc-tool/
├── backend/
│   ├── src/
│   │   ├── analyzers/
│   │   │   ├── base.ts
│   │   │   ├── cobol-analyzer.ts
│   │   │   ├── pl1-analyzer.ts
│   │   │   ├── java-analyzer.ts
│   │   │   └── ddl-analyzer.ts
│   │   ├── extractors/
│   │   │   ├── metadata-extractor.ts
│   │   │   ├── mapping-builder.ts
│   │   │   └── complexity-analyzer.ts
│   │   ├── generators/
│   │   │   ├── document-generator.ts
│   │   │   ├── template-engine.ts
│   │   │   └── ai-enhancer.ts
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── projects.ts
│   │   │   │   ├── documents.ts
│   │   │   │   └── analysis.ts
│   │   │   └── middleware/
│   │   ├── services/
│   │   │   ├── project-service.ts
│   │   │   └── analysis-service.ts
│   │   ├── db/
│   │   │   ├── models/
│   │   │   └── migrations/
│   │   ├── workers/
│   │   │   └── analysis-worker.ts
│   │   └── index.ts
│   ├── templates/
│   │   ├── as-is-analysis.hbs
│   │   ├── migration-strategy.hbs
│   │   ├── migration-design.hbs
│   │   ├── test-strategy.hbs
│   │   └── deployment.hbs
│   ├── knowledge-base/
│   │   ├── mappings/
│   │   │   ├── cobol-to-java.yml
│   │   │   └── oracle-to-postgres.yml
│   │   ├── patterns/
│   │   └── risks/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProjectWizard/
│   │   │   ├── AnalysisDashboard/
│   │   │   ├── DocumentEditor/
│   │   │   └── MappingViewer/
│   │   ├── pages/
│   │   │   ├── ProjectListPage.tsx
│   │   │   ├── ProjectDashboardPage.tsx
│   │   │   └── DocumentEditorPage.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── hooks/
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── shared/
│   └── types/              → Shared TypeScript types between FE/BE
│
├── docker-compose.yml
├── README.md
└── package.json            → Root workspace config
```

## Deployment Architecture

### Development
```
Docker Compose:
  - postgres:15
  - redis:7 (for Bull queue)
  - backend (Node.js, port 3000)
  - frontend (Vite dev server, port 5173)
```

### Production
```
Option 1: Single VPS
  - Nginx (reverse proxy)
  - Node.js backend (PM2)
  - PostgreSQL
  - Redis
  - Static frontend files served by Nginx

Option 2: Cloud (AWS example)
  - Frontend: S3 + CloudFront
  - Backend: ECS Fargate or EC2
  - Database: RDS PostgreSQL
  - Queue: ElastiCache Redis
  - Storage: S3 for uploaded files
```

## Security Considerations

### Authentication & Authorization
- **Phase 1 (POC):** No auth (internal tool)
- **Phase 2:**
  - JWT-based authentication
  - Role-based access control (Admin, Engineer, Viewer)
  - Integration with corporate SSO (SAML/OAuth)

### Data Security
- Source code contains sensitive business logic
  - Encrypt files at rest
  - Use HTTPS for all API calls
  - Option for on-premise deployment

### AI API Security
- API keys stored in environment variables
- Option to disable AI features for sensitive projects
- On-premise LLM option (Ollama, LocalAI)

## POC Scope

### Minimal Viable POC (2-3 weeks)

**Backend:**
- COBOL analyzer (basic parsing)
- Oracle DDL analyzer
- Metadata extractor (LOC, file count, basic complexity)
- Generate "As-Is Analysis" document
- REST API for: create project, upload files, analyze, generate doc

**Frontend:**
- Project creation page (simple form)
- File upload (drag & drop)
- Analysis progress indicator
- Document viewer (read-only Markdown display)

**Infrastructure:**
- Docker Compose setup
- SQLite database (no PostgreSQL yet)
- No AI integration (use templates only)

**Success Criteria:**
- Upload 5-10 COBOL files + DDL
- Generate As-Is Analysis document in <30 seconds
- Document includes: file list, LOC, table list, basic metrics

---

**Next Steps:**
1. Create document templates for all 5 types
2. Set up project structure (monorepo with backend/frontend)
3. Implement POC focused on COBOL→Java + As-Is Analysis

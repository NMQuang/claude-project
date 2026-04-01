# Migration Documentation Tool

A source analysis & migration documentation tool for legacy COBOL systems.

## Active Migration Types

| Type | Value | Purpose |
|------|-------|---------|
| COBOL to Java | `COBOL-to-Java` | Full migration analysis + document generation |
| COBOL Source Analysis | `Source-Analysis-COBOL` | Evidence-based COBOL source analysis (Online/Batch/JCL) |
| PostgreSQL to Oracle | `PostgreSQL-to-Oracle` | DB migration analysis + document generation |

## Quick Start

```bash
# Backend (Express + TypeScript, port 3000)
cd backend && npm run dev

# Frontend (Vite + React, port 5173)
cd frontend && npm run dev
```

## Project Structure

```
backend/
  src/
    analyzers/         # File parsers (COBOL, JCL, Copybook, DDL, Java...)
    generators/        # Document generators (Handlebars templates)
    extractors/        # Metadata extractors
    utils/             # File filters
    server.ts          # Express REST API
  templates/
    english/
      cobol-to-java/   # COBOL→Java migration templates
      source-analysis/ # COBOL source analysis templates (source-analysis.hbs)
      pg-to-oracle/    # PostgreSQL→Oracle migration templates

frontend/
  src/
    pages/             # ProjectListPage, ProjectDashboardPage, DocumentEditorPage
    services/api.ts    # API client
    utils/fileFilters.ts
```

## API Endpoints

```
POST /api/projects               Create project
POST /api/projects/:id/upload    Upload source files
POST /api/projects/:id/analyze   Run analysis
POST /api/projects/:id/generate  Generate document
GET  /api/projects/:id/documents/:docType  Get document
```

## Adding a New Migration Type

1. Add to `backend/src/utils/fileFilters.ts` — allowed extensions
2. Add to `frontend/src/utils/fileFilters.ts` — same
3. Add analyzer branch in `backend/src/server.ts` — analyze + generate routes
4. Add to `frontend/src/pages/ProjectListPage.tsx` — MIGRATION_TYPES array
5. Add to `frontend/src/pages/ProjectDashboardPage.tsx` — documents + metrics
6. Create template folder `backend/templates/english/<folder>/`
7. Map in `backend/src/generators/DocumentGenerator.ts`
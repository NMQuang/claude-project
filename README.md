# Migration Documentation Tool

A semi-automatic documentation generation tool that analyzes source code, database schemas, and migration artifacts to produce standardized migration documentation.

## Overview

This tool helps standardize and automate documentation for migration projects:
- **COBOL → Java**
- **PL/I → Java**
- **Oracle → PostgreSQL**
- **MySQL → Oracle**

## Features

- **Source Code Analysis**: Parse COBOL, PL/I, Java code to extract metadata
- **Database Schema Analysis**: Analyze DDL files from Oracle, PostgreSQL, MySQL
- **Document Generation**: Generate standardized Markdown documents from templates
- **AI Enhancement** (Optional): Use Claude/GPT to enrich document sections
- **Web UI**: User-friendly interface for project management and document editing

## Document Types

1. **As-Is Analysis**: Current system state analysis
2. **Migration Strategy**: Overall migration approach and planning
3. **Migration Design**: Detailed technical design for code and database
4. **Test Strategy**: Comprehensive testing approach
5. **Deployment & Rollback**: Deployment procedures and rollback plans

## Architecture

```
┌─────────────┐
│   Web UI    │ (React + TypeScript)
└──────┬──────┘
       │ REST API
┌──────▼──────┐
│   Backend   │ (Node.js + TypeScript)
│             │
│ ┌─────────┐ │
│ │Analyzers│ │ Parse source code & DDL
│ └─────────┘ │
│ ┌─────────┐ │
│ │Extract. │ │ Extract metadata & metrics
│ └─────────┘ │
│ ┌─────────┐ │
│ │Generator│ │ Generate documents
│ └─────────┘ │
└─────────────┘
```

## Quick Start (POC)

### Prerequisites

- Node.js 18+ LTS
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run development server
npm run dev
```

### Basic Usage

```bash
# Example: Analyze COBOL files and generate As-Is Analysis
node dist/index.js analyze --input ./samples/cobol --type cobol
node dist/index.js generate --project myproject --doc as-is-analysis
```

## Project Structure

```
migration-doc-tool/
├── src/
│   ├── analyzers/          # Source code & DB analyzers
│   ├── extractors/         # Metadata extractors
│   ├── generators/         # Document generators
│   ├── api/                # REST API (future)
│   └── index.ts            # CLI entry point (POC)
├── templates/              # Handlebars document templates
│   ├── as-is-analysis.hbs
│   ├── migration-strategy.hbs
│   ├── migration-design.hbs
│   ├── test-strategy.hbs
│   └── deployment-rollback.hbs
├── knowledge-base/         # Migration rules & patterns
│   ├── mappings/
│   └── patterns/
├── samples/                # Sample COBOL/DDL files for testing
├── output/                 # Generated documents
├── ARCHITECTURE.md         # Detailed architecture design
├── TEMPLATE_GUIDE.md       # Template usage guide
└── README.md
```

## POC Scope

The current proof of concept includes:

- ✅ Basic COBOL file analysis (LOC, file structure)
- ✅ Simple DDL parsing (table extraction)
- ✅ Metadata extraction (file counts, LOC)
- ✅ As-Is Analysis document generation
- ✅ Handlebars template engine integration

**Not Yet Implemented:**
- Full COBOL/PL1 parsing (ANTLR)
- Advanced complexity analysis
- Web UI
- Database persistence
- AI integration
- Other document types (Strategy, Design, Test, Deployment)

## Development Roadmap

### Phase 1: POC (Current)
- [x] Architecture design
- [x] Document templates
- [x] Basic analyzers
- [x] As-Is Analysis generation

### Phase 2: Core Features
- [ ] Full COBOL/PL1 parsing
- [ ] Advanced metadata extraction
- [ ] All 5 document types
- [ ] Web UI (React)
- [ ] Database (PostgreSQL)

### Phase 3: Advanced Features
- [ ] AI-enhanced generation
- [ ] Oracle/PostgreSQL schema migration
- [ ] Performance optimization
- [ ] Multi-user support

### Phase 4: Enterprise Ready
- [ ] Authentication & authorization
- [ ] DOCX/PDF export
- [ ] Japanese localization
- [ ] Integration with project management tools

## Configuration

### Project Configuration (project.yml)

```yaml
project:
  name: "CustomerSystem-Migration"
  type: "COBOL-to-Java"

source:
  language: "COBOL"
  paths:
    - "src/cobol/**/*.cbl"
  database: "Oracle 11g"
  db_schemas:
    - "schema/ddl/**/*.sql"

target:
  language: "Java 17"
  framework: "Spring Boot"
  database: "PostgreSQL 15"

output:
  directory: "output/docs"
  format: "markdown"

options:
  use_ai: false
  complexity_threshold: 10
  include_diagrams: true
```

## API Documentation (Future)

Once the Web UI is implemented, the REST API will include:

```
POST   /api/projects              # Create new project
POST   /api/projects/:id/upload   # Upload source files
POST   /api/projects/:id/analyze  # Trigger analysis
GET    /api/projects/:id/metadata # Get analysis results
POST   /api/projects/:id/generate # Generate document
GET    /api/documents/:id         # Get document content
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Detailed system architecture
- **[TEMPLATE_GUIDE.md](./TEMPLATE_GUIDE.md)**: How to use and customize templates

## License

MIT License - see LICENSE file for details

## Support

For questions or issues:
- Create an issue in the repository
- Contact: [Your contact info]

---

**Status**: 🚧 Proof of Concept Phase

**Last Updated**: 2026-01-06
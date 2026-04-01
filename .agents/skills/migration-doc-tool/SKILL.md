---
name: migration-doc-tool
description: Context and development guide for the Migration Documentation Tool — a COBOL source analysis and migration documentation platform.
---

# Migration Documentation Tool — AI Context

## What This Tool Does

This is a web application that analyzes legacy COBOL source code and generates structured documentation. It has two modes:
1. **Analysis mode** — parse source files (COBOL, JCL, Copybooks, DDL) and extract structured metadata
2. **Document generation mode** — render Handlebars templates using extracted metadata to produce Markdown reports

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express + TypeScript (`tsx watch`) |
| Frontend | React + Vite + TypeScript |
| Templates | Handlebars (`.hbs`) → Markdown output |
| File upload | Multer (multipart/form-data) |
| State | In-memory Map (no database) |

## 3 Active Migration Types

### 1. `COBOL-to-Java`
- **Input files**: `.cbl`, `.cob`, `.sql`, `.ddl`
- **Analyzer**: `CobolAnalyzer` + `DDLAnalyzer` + `MetadataExtractor`
- **Template folder**: `templates/english/cobol-to-java/`
- **Documents**: as-is-analysis, migration-strategy, migration-design, test-strategy, deployment-rollback

### 2. `Source-Analysis-COBOL` ← Primary focus
- **Input files**: `.cbl`, `.cob`, `.cpy`, `.jcl`, `.prc`, `.proc`, `.sql`, `.ddl`
- **Analyzer**: `SourceAnalyzer` (orchestrates CobolBusinessLogicAnalyzer + CopybookAnalyzer + JclParser)
- **Template folder**: `templates/english/source-analysis/`
- **Documents**: `source-analysis` (main)
- **Key output**: `executionPatternSummary` distinguishes Online (CICS) vs Batch vs Undetermined programs

### 3. `PostgreSQL-to-Oracle`
- **Input files**: `.sql`, `.java`, `.xml`, `.yml`, `.yaml`
- **Analyzer**: `JavaAnalyzer` + `PostgreSQLDDLAnalyzer` + `ORMConfigAnalyzer`
- **Template folder**: `templates/english/pg-to-oracle/`
- **Documents**: as-is-analysis, migration-strategy, migration-design, test-strategy, deployment-rollback

## Source-Analysis-COBOL Data Model

### Key interface: `SourceAnalysisResult`

```typescript
{
  section0_scopeSummary: {
    fileInventory: { cobolPrograms, copybooks, jclFiles, ddlFiles, totalLinesOfCode }
    detectedTechnologies: [{ technology, occurrenceCount, evidence[] }]
  },
  executionPatternSummary: {
    onlinePrograms:     [{ programId, fileName, indicators[] }]  // CICS detected
    batchPrograms:      [{ programId, fileName, indicators[] }]  // FILE I-O, SORT, MERGE...
    undeterminedPrograms: [{ programId, fileName }]
    jclSummary: { totalJobs, totalSteps, programsInvokedByJcl[] }
  },
  section1_programInventory: [{
    programId, fileName, relativePath, linesOfCode,
    observedExecutionPattern,   // ONLINE_INDICATED | BATCH_INDICATED | UNDETERMINED
    patternEvidence[],
    observedStructure: { divisions[], paragraphCount, copybooksReferenced[] },
    externalCallsDetected: [{ targetProgram, callType, evidence }]
  }],
  section2_persistentDataStructures: [{
    structureId, structureName, storageType,   // VSAM_FILE | DATABASE_TABLE | SEQUENTIAL_FILE...
    observedFields[], observedKeyFields[], referencedByPrograms[]
  }],
  section3_dataAccessPatterns: [{
    observationId, programId, targetStructure, accessVerb,
    accessType,   // FILE_IO | SQL | VSAM
    evidence, observedConditions[]
  }],
  section4_jclExecutionRelationships: [{
    jobName, stepSequence: [{ stepNumber, stepName, executedProgram, inputDatasets[], outputDatasets[] }],
    datasetReferences: [{ datasetName, ddName, accessMode, usedInSteps[] }]
  }],
  section5_observationsAndQuestions: {
    observations: [{ factId, category, observation, evidence[], affectedComponents[] }],
    openQuestions: [{ questionId, category, question, context, relatedEvidence[] }]
  }
}
```

### Batch Pattern Detection (in `observeExecutionPattern()`)
The analyzer classifies programs by checking for:
- **ONLINE**: `platformFeatures.cicsUsage === true`
- **BATCH**: sequential file I/O (INPUT/OUTPUT/EXTEND), SORT verb, MERGE verb, checkpoint paragraphs (CKPT/CHKPT/RESTART), PERFORM UNTIL EOF patterns, SQL batch updates (>5 DML statements)
- **UNDETERMINED**: none of the above

## Template System

### How templates work
```
DocumentGenerator.generate(documentType, data, language, migrationType)
  → resolves path: templates/{language}/{migrationFolder}/{documentType}.hbs
  → compiles with Handlebars
  → returns Markdown string
```

### Available Handlebars helpers
`formatDate`, `add`, `percentage`, `complexityLevel`, `json`, `eq`, `gt`, `lt`, `gte`, `lte`, `ne`, `join`, `subtract`, `countRoles`, `countFlowType`, `countBatchProcesses`, `countOnlineProcesses`, `filterProcesses`, `groupByTable`

### Template data shape for `source-analysis`
```handlebars
{{project.name}}
{{sourceAnalysis.section0_scopeSummary.*}}
{{sourceAnalysis.executionPatternSummary.*}}
{{sourceAnalysis.section1_programInventory}}
{{sourceAnalysis.section2_persistentDataStructures}}
{{sourceAnalysis.section3_dataAccessPatterns}}
{{sourceAnalysis.section4_jclExecutionRelationships}}
{{sourceAnalysis.section5_observationsAndQuestions.*}}
{{generated_date}}
```

## Key File Locations

| Purpose | File |
|---------|------|
| REST API + analysis routing | `backend/src/server.ts` |
| COBOL source analyzer (main) | `backend/src/analyzers/SourceAnalyzer.ts` |
| COBOL program parser | `backend/src/analyzers/CobolBusinessLogicAnalyzer.ts` |
| Copybook parser | `backend/src/analyzers/CopybookAnalyzer.ts` |
| JCL parser | `backend/src/analyzers/JclParser.ts` |
| Handlebars renderer | `backend/src/generators/DocumentGenerator.ts` |
| COBOL source analysis template | `backend/templates/english/source-analysis/source-analysis.hbs` |
| File type filtering | `backend/src/utils/fileFilters.ts` |
| Frontend file filtering | `frontend/src/utils/fileFilters.ts` |
| Project list UI | `frontend/src/pages/ProjectListPage.tsx` |
| Project dashboard UI | `frontend/src/pages/ProjectDashboardPage.tsx` |

## Development Patterns

### Adding a new analysis field
1. Add field to the relevant interface in `SourceAnalyzer.ts`
2. Populate it in the appropriate `build*()` method
3. Expose it in `server.ts` metadata
4. Use `{{sourceAnalysis.yourNewField}}` in the `.hbs` template
5. Optionally display in `ProjectDashboardPage.tsx` metrics panel

### Template improvement workflow
1. Edit `.hbs` file in `templates/english/source-analysis/`
2. Backend hot-reloads (tsx watch) — no restart needed for template changes
3. Create a new project, upload test COBOL files, Analyze → Generate → View

### Adding a new Handlebars helper
Add to `registerHelpers()` in `DocumentGenerator.ts`:
```typescript
Handlebars.registerHelper('myHelper', (arg: any) => { return ...; });
```

## Known Limitations
- Projects are in-memory only — lost on server restart
- No user authentication
- Line numbers in evidence citations default to `1` for many observations (CopybookAnalyzer doesn't track line numbers yet)
- SORT/MERGE detection relies on `program.hasSortVerb` which may not always be populated by CobolBusinessLogicAnalyzer

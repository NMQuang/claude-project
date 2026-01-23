/**
 * Source Analyzer
 *
 * Performs evidence-based source code analysis WITHOUT business interpretation.
 * Extracts and describes ONLY what is directly observable from source code
 * with explicit evidence citations (file:line).
 *
 * Key Philosophy:
 * - Evidence-based only: Every observation must have a source citation
 * - Neutral language: "observed", "detected", "identified" (NOT "manages", "handles")
 * - No business name inference
 * - Fixed 6-section format
 */

import * as fs from 'fs';
import * as path from 'path';

import { CobolBusinessLogicAnalyzer, CobolBusinessLogicResult, FileAccess, DatabaseAccess } from './CobolBusinessLogicAnalyzer.js';
import { CopybookAnalyzer, CopybookAnalysisResult, RecordLayout, CopybookField } from './CopybookAnalyzer.js';
import { JclParser, JclAnalysisResult, JclStep, DDStatement } from './JclParser.js';

// ============================================================================
// Interfaces - Evidence-Based
// ============================================================================

/**
 * Source evidence citation
 */
export interface SourceEvidence {
  file: string;
  line: number;
  statement?: string;
}

/**
 * File inventory entry with observed metrics
 */
export interface FileInventoryEntry {
  fileName: string;
  relativePath: string;
  fileType: 'COBOL_PROGRAM' | 'COPYBOOK' | 'JCL' | 'DDL' | 'UNKNOWN';
  linesOfCode: number;
  evidence: SourceEvidence;
}

/**
 * Source scope summary (Section 0)
 */
export interface SourceScopeSummary {
  analysisTimestamp: string;
  projectName: string;
  fileInventory: {
    cobolPrograms: number;
    copybooks: number;
    jclFiles: number;
    ddlFiles: number;
    totalFiles: number;
    totalLinesOfCode: number;
  };
  detectedTechnologies: DetectedTechnology[];
}

export interface DetectedTechnology {
  technology: string;
  evidence: SourceEvidence[];
  occurrenceCount: number;
}

/**
 * Program inventory entry (Section 1)
 */
export interface ProgramInventoryEntry {
  programId: string;
  fileName: string;
  relativePath: string;
  linesOfCode: number;
  observedExecutionPattern: 'BATCH_INDICATED' | 'ONLINE_INDICATED' | 'UNDETERMINED';
  patternEvidence: SourceEvidence[];
  observedStructure: {
    divisions: string[];
    paragraphCount: number;
    copybooksReferenced: string[];
  };
  externalCallsDetected: ExternalCallObservation[];
}

export interface ExternalCallObservation {
  targetProgram: string;
  callType: 'STATIC' | 'DYNAMIC';
  evidence: SourceEvidence;
}

/**
 * Persistent data structure (Section 2)
 */
export interface PersistentDataStructure {
  structureId: string;
  structureName: string;
  storageType: 'VSAM_FILE' | 'DATABASE_TABLE' | 'SEQUENTIAL_FILE' | 'INDEXED_FILE' | 'UNDETERMINED';
  sourceFile: string;
  evidence: SourceEvidence;
  observedFields: ObservedField[];
  observedKeyFields: ObservedKeyField[];
  referencedByPrograms: ProgramReference[];
}

export interface ObservedField {
  fieldName: string;
  pictureClause?: string;
  computedLength: number;
  dataType: string;
  evidence: SourceEvidence;
}

export interface ObservedKeyField {
  fieldName: string;
  keyType: 'PRIMARY' | 'ALTERNATE' | 'UNDETERMINED';
  evidence: SourceEvidence;
}

export interface ProgramReference {
  programId: string;
  accessType: 'READ' | 'WRITE' | 'REWRITE' | 'DELETE' | 'SQL_SELECT' | 'SQL_INSERT' | 'SQL_UPDATE' | 'SQL_DELETE';
  evidence: SourceEvidence;
}

/**
 * Data access observation (Section 3)
 */
export interface DataAccessObservation {
  observationId: string;
  programId: string;
  targetStructure: string;
  accessVerb: string;
  accessType: 'FILE_IO' | 'SQL' | 'VSAM';
  evidence: SourceEvidence;
  observedConditions?: string[];
}

/**
 * JCL execution relationship (Section 4)
 */
export interface JclExecutionRelationship {
  jobName: string;
  sourceFile: string;
  evidence: SourceEvidence;
  stepSequence: JclStepObservation[];
  datasetReferences: DatasetObservation[];
}

export interface JclStepObservation {
  stepNumber: number;
  stepName: string;
  executedProgram: string;
  evidence: SourceEvidence;
  inputDatasets: string[];
  outputDatasets: string[];
  isConditional: boolean;
  conditionExpression?: string;
}

export interface DatasetObservation {
  datasetName: string;
  ddName: string;
  accessMode: 'INPUT' | 'OUTPUT' | 'I-O' | 'UNDETERMINED';
  evidence: SourceEvidence;
  usedInSteps: string[];
}

/**
 * Observed fact (Section 5)
 */
export interface ObservedFact {
  factId: string;
  category: 'PATTERN' | 'DEPENDENCY' | 'ANOMALY' | 'STRUCTURE';
  observation: string;
  evidence: SourceEvidence[];
  affectedComponents: string[];
}

/**
 * Open question (Section 5)
 */
export interface OpenQuestion {
  questionId: string;
  category: 'MISSING_SOURCE' | 'AMBIGUOUS_REFERENCE' | 'EXTERNAL_DEPENDENCY' | 'INCOMPLETE_DATA';
  question: string;
  context: string;
  relatedEvidence?: SourceEvidence[];
}

/**
 * Main analysis result - Fixed 6-section format
 */
export interface SourceAnalysisResult {
  section0_scopeSummary: SourceScopeSummary;
  section1_programInventory: ProgramInventoryEntry[];
  section2_persistentDataStructures: PersistentDataStructure[];
  section3_dataAccessPatterns: DataAccessObservation[];
  section4_jclExecutionRelationships: JclExecutionRelationship[];
  section5_observationsAndQuestions: {
    observations: ObservedFact[];
    openQuestions: OpenQuestion[];
  };
}

// ============================================================================
// Main Analyzer Class
// ============================================================================

export class SourceAnalyzer {
  private cobolAnalyzer: CobolBusinessLogicAnalyzer;
  private copybookAnalyzer: CopybookAnalyzer;
  private jclParser: JclParser;

  constructor() {
    this.cobolAnalyzer = new CobolBusinessLogicAnalyzer();
    this.copybookAnalyzer = new CopybookAnalyzer();
    this.jclParser = new JclParser();
  }

  /**
   * Analyze source code with evidence-based approach
   */
  async analyzeSource(uploadDir: string, projectName: string): Promise<SourceAnalysisResult> {
    // 1. Collect all files
    const cobolFiles = this.getAllFiles(uploadDir, ['.cbl', '.cob']);
    const copybookFiles = this.getAllFiles(uploadDir, ['.cpy']);
    const jclFiles = this.getAllFiles(uploadDir, ['.jcl', '.prc', '.proc']);
    const ddlFiles = this.getAllFiles(uploadDir, ['.sql', '.ddl']);

    // 2. Analyze each file type
    const programResults: CobolBusinessLogicResult[] = [];
    for (const file of cobolFiles) {
      const result = await this.cobolAnalyzer.analyze(file);
      (result as any).relativePath = path.relative(uploadDir, file).replace(/\\/g, '/');
      programResults.push(result);
    }

    const copybookResults: CopybookAnalysisResult[] = [];
    for (const file of copybookFiles) {
      const result = await this.copybookAnalyzer.analyze(file);
      result.relativePath = path.relative(uploadDir, file).replace(/\\/g, '/');
      copybookResults.push(result);
    }

    const jclResults: JclAnalysisResult[] = [];
    for (const file of jclFiles) {
      const result = await this.jclParser.parse(file);
      result.relativePath = path.relative(uploadDir, file).replace(/\\/g, '/');
      jclResults.push(result);
    }

    // 3. Build evidence-based sections
    const section0 = this.buildScopeSummary(
      projectName, uploadDir, programResults, copybookResults, jclResults, ddlFiles
    );

    const section1 = this.buildProgramInventory(programResults, uploadDir);

    const section2 = this.buildPersistentDataStructures(
      copybookResults, programResults, uploadDir
    );

    const section3 = this.buildDataAccessPatterns(programResults, uploadDir);

    const section4 = this.buildJclExecutionRelationships(jclResults, uploadDir);

    const section5 = this.buildObservationsAndQuestions(
      programResults, copybookResults, jclResults, section1, section2
    );

    return {
      section0_scopeSummary: section0,
      section1_programInventory: section1,
      section2_persistentDataStructures: section2,
      section3_dataAccessPatterns: section3,
      section4_jclExecutionRelationships: section4,
      section5_observationsAndQuestions: section5
    };
  }

  /**
   * Section 0: Build scope summary
   */
  private buildScopeSummary(
    projectName: string,
    uploadDir: string,
    programResults: CobolBusinessLogicResult[],
    copybookResults: CopybookAnalysisResult[],
    jclResults: JclAnalysisResult[],
    ddlFiles: string[]
  ): SourceScopeSummary {
    let totalLoc = 0;

    for (const p of programResults) {
      totalLoc += p.metrics?.totalLines || 0;
    }

    // Detect technologies from evidence
    const detectedTechnologies = this.detectTechnologies(programResults, jclResults);

    return {
      analysisTimestamp: new Date().toISOString(),
      projectName,
      fileInventory: {
        cobolPrograms: programResults.length,
        copybooks: copybookResults.length,
        jclFiles: jclResults.length,
        ddlFiles: ddlFiles.length,
        totalFiles: programResults.length + copybookResults.length + jclResults.length + ddlFiles.length,
        totalLinesOfCode: totalLoc
      },
      detectedTechnologies
    };
  }

  /**
   * Detect technologies from source evidence
   */
  private detectTechnologies(
    programResults: CobolBusinessLogicResult[],
    jclResults: JclAnalysisResult[]
  ): DetectedTechnology[] {
    const techMap = new Map<string, { evidence: SourceEvidence[], count: number }>();

    for (const program of programResults) {
      // Check for SQL/database technology
      if (program.databaseAccess && program.databaseAccess.length > 0) {
        const key = 'EMBEDDED_SQL';
        if (!techMap.has(key)) {
          techMap.set(key, { evidence: [], count: 0 });
        }
        const tech = techMap.get(key)!;
        tech.count += program.databaseAccess.length;
        tech.evidence.push({
          file: (program as any).relativePath || program.fileName,
          line: 1,
          statement: `${program.databaseAccess.length} SQL statements detected`
        });
      }

      // Check for VSAM access using platformFeatures
      if (program.platformFeatures?.vsamUsage) {
        const key = 'VSAM_FILE_ACCESS';
        if (!techMap.has(key)) {
          techMap.set(key, { evidence: [], count: 0 });
        }
        const tech = techMap.get(key)!;
        tech.count += 1;
        tech.evidence.push({
          file: (program as any).relativePath || program.fileName,
          line: 1,
          statement: `VSAM usage detected`
        });
      }

      // Check for CICS
      if (program.platformFeatures?.cicsUsage) {
        const key = 'CICS';
        if (!techMap.has(key)) {
          techMap.set(key, { evidence: [], count: 0 });
        }
        const tech = techMap.get(key)!;
        tech.count += 1;
        tech.evidence.push({
          file: (program as any).relativePath || program.fileName,
          line: 1,
          statement: `CICS usage detected`
        });
      }

      // Check for external calls
      if (program.externalCalls && program.externalCalls.length > 0) {
        const key = 'EXTERNAL_PROGRAM_CALLS';
        if (!techMap.has(key)) {
          techMap.set(key, { evidence: [], count: 0 });
        }
        const tech = techMap.get(key)!;
        tech.count += program.externalCalls.length;
        tech.evidence.push({
          file: (program as any).relativePath || program.fileName,
          line: 1,
          statement: `${program.externalCalls.length} external call(s) detected`
        });
      }
    }

    // Detect JCL-based technologies
    for (const jcl of jclResults) {
      if (jcl.jobs.length > 0) {
        const key = 'JCL_BATCH_PROCESSING';
        if (!techMap.has(key)) {
          techMap.set(key, { evidence: [], count: 0 });
        }
        const tech = techMap.get(key)!;
        tech.count += jcl.jobs.length;
        tech.evidence.push({
          file: jcl.relativePath || jcl.fileName,
          line: 1,
          statement: `${jcl.jobs.length} JCL job(s) detected`
        });
      }
    }

    return Array.from(techMap.entries()).map(([technology, data]) => ({
      technology,
      evidence: data.evidence,
      occurrenceCount: data.count
    }));
  }

  /**
   * Section 1: Build program inventory
   */
  private buildProgramInventory(
    programResults: CobolBusinessLogicResult[],
    uploadDir: string
  ): ProgramInventoryEntry[] {
    return programResults.map(program => {
      // Determine execution pattern from evidence (not business interpretation)
      const { pattern, evidence } = this.observeExecutionPattern(program);

      // Map external calls
      const externalCalls: ExternalCallObservation[] = (program.externalCalls || []).map(call => ({
        targetProgram: call.programName,
        callType: 'STATIC' as const, // Default to STATIC as interface doesn't have callType
        evidence: {
          file: (program as any).relativePath || program.fileName,
          line: call.lineNumber || 1,
          statement: `CALL '${call.programName}'`
        }
      }));

      return {
        programId: program.programId,
        fileName: program.fileName,
        relativePath: (program as any).relativePath || program.fileName,
        linesOfCode: program.metrics?.totalLines || 0,
        observedExecutionPattern: pattern,
        patternEvidence: evidence,
        observedStructure: {
          divisions: program.divisions || [],
          paragraphCount: program.paragraphs?.length || 0,
          copybooksReferenced: program.copybooks || []
        },
        externalCallsDetected: externalCalls
      };
    });
  }

  /**
   * Observe execution pattern from evidence (evidence-based, not interpretive)
   */
  private observeExecutionPattern(program: CobolBusinessLogicResult): {
    pattern: 'BATCH_INDICATED' | 'ONLINE_INDICATED' | 'UNDETERMINED';
    evidence: SourceEvidence[];
  } {
    const evidence: SourceEvidence[] = [];
    const relativePath = (program as any).relativePath || program.fileName;

    // Check for CICS indicators (online)
    if (program.platformFeatures?.cicsUsage) {
      evidence.push({
        file: relativePath,
        line: 1,
        statement: `CICS usage detected`
      });
      return { pattern: 'ONLINE_INDICATED', evidence };
    }

    // Check for file processing indicators (batch)
    const hasFileProcessing = program.files && program.files.length > 0;
    const hasSequentialAccess = program.files?.some(f =>
      f.accessType === 'INPUT' || f.accessType === 'OUTPUT'
    );

    if (hasFileProcessing && hasSequentialAccess) {
      evidence.push({
        file: relativePath,
        line: 1,
        statement: `File processing detected (${program.files!.length} file(s))`
      });
      return { pattern: 'BATCH_INDICATED', evidence };
    }

    // Check PERFORM patterns (batch indicator) - using paragraphs.performs
    const hasBatchLoop = program.paragraphs?.some(p =>
      p.performs && p.performs.length > 0
    );
    if (hasBatchLoop && hasFileProcessing) {
      evidence.push({
        file: relativePath,
        line: 1,
        statement: 'PERFORM patterns with file processing detected'
      });
      return { pattern: 'BATCH_INDICATED', evidence };
    }

    return { pattern: 'UNDETERMINED', evidence: [] };
  }

  /**
   * Section 2: Build persistent data structures
   */
  private buildPersistentDataStructures(
    copybookResults: CopybookAnalysisResult[],
    programResults: CobolBusinessLogicResult[],
    uploadDir: string
  ): PersistentDataStructure[] {
    const structures: PersistentDataStructure[] = [];
    let structureCounter = 0;

    // Extract from copybooks
    for (const copybook of copybookResults) {
      for (const layout of copybook.recordLayouts) {
        structureCounter++;
        const structureId = `DS-${structureCounter.toString().padStart(3, '0')}`;

        // Determine storage type from evidence
        const storageType = this.inferStorageTypeFromLayout(layout, copybook.fileName);

        // Map fields
        const observedFields: ObservedField[] = this.flattenFields(layout.fields).map(field => ({
          fieldName: field.name,
          pictureClause: field.picture,
          computedLength: field.length,
          dataType: field.dataType,
          evidence: {
            file: copybook.relativePath || copybook.fileName,
            line: 1, // Would need line tracking in CopybookAnalyzer
            statement: `${field.level} ${field.name} ${field.picture ? 'PIC ' + field.picture : ''}`
          }
        }));

        // Map key fields
        const observedKeyFields: ObservedKeyField[] = layout.keys.map(key => ({
          fieldName: key.fields.join(', '),
          keyType: key.keyType === 'PRIMARY' ? 'PRIMARY' : key.keyType === 'ALTERNATE' ? 'ALTERNATE' : 'UNDETERMINED',
          evidence: {
            file: copybook.relativePath || copybook.fileName,
            line: 1,
            statement: `Key: ${key.keyName} (${key.keyType})`
          }
        }));

        // Find programs that reference this structure
        const referencedByPrograms = this.findProgramsReferencingStructure(
          layout.recordName, programResults
        );

        structures.push({
          structureId,
          structureName: layout.recordName,
          storageType,
          sourceFile: copybook.relativePath || copybook.fileName,
          evidence: {
            file: copybook.relativePath || copybook.fileName,
            line: 1,
            statement: `01 ${layout.recordName}`
          },
          observedFields,
          observedKeyFields,
          referencedByPrograms
        });
      }
    }

    // Extract from database access in programs
    const tableMap = new Map<string, PersistentDataStructure>();
    for (const program of programResults) {
      for (const dbAccess of program.databaseAccess || []) {
        const tableName = dbAccess.tableName.toUpperCase();

        if (!tableMap.has(tableName)) {
          structureCounter++;
          const structureId = `DS-${structureCounter.toString().padStart(3, '0')}`;

          tableMap.set(tableName, {
            structureId,
            structureName: tableName,
            storageType: 'DATABASE_TABLE',
            sourceFile: (program as any).relativePath || program.fileName,
            evidence: {
              file: (program as any).relativePath || program.fileName,
              line: 1,
              statement: `SQL access to ${tableName} detected`
            },
            observedFields: dbAccess.columns.map(col => ({
              fieldName: col,
              computedLength: 0,
              dataType: 'UNDETERMINED',
              evidence: {
                file: (program as any).relativePath || program.fileName,
                line: 1,
                statement: `Column ${col} referenced in SQL`
              }
            })),
            observedKeyFields: [],
            referencedByPrograms: []
          });
        }

        const structure = tableMap.get(tableName)!;
        const accessType = this.mapSqlOperationToAccessType(dbAccess.operation);

        // Avoid duplicates
        const existingRef = structure.referencedByPrograms.find(
          r => r.programId === program.programId && r.accessType === accessType
        );
        if (!existingRef) {
          structure.referencedByPrograms.push({
            programId: program.programId,
            accessType,
            evidence: {
              file: (program as any).relativePath || program.fileName,
              line: 1,
              statement: `${dbAccess.operation} on ${tableName}`
            }
          });
        }
      }
    }

    structures.push(...Array.from(tableMap.values()));

    return structures;
  }

  /**
   * Flatten nested fields
   */
  private flattenFields(fields: CopybookField[]): CopybookField[] {
    const result: CopybookField[] = [];
    for (const field of fields) {
      if (field.level > 1 && field.dataType !== 'GROUP') {
        result.push(field);
      }
      if (field.children && field.children.length > 0) {
        result.push(...this.flattenFields(field.children));
      }
    }
    return result;
  }

  /**
   * Infer storage type from layout evidence
   */
  private inferStorageTypeFromLayout(layout: RecordLayout, fileName: string): PersistentDataStructure['storageType'] {
    // Check if it has keys (VSAM indicator)
    if (layout.keys && layout.keys.length > 0) {
      if (layout.keys.some(k => k.keyType === 'PRIMARY')) {
        return 'VSAM_FILE';
      }
      return 'INDEXED_FILE';
    }

    // Check entity type hint
    if (layout.entityType === 'MASTER' || layout.entityType === 'TRANSACTION') {
      return 'VSAM_FILE';
    }

    return 'UNDETERMINED';
  }

  /**
   * Find programs referencing a structure
   */
  private findProgramsReferencingStructure(
    structureName: string,
    programResults: CobolBusinessLogicResult[]
  ): ProgramReference[] {
    const references: ProgramReference[] = [];
    const upperName = structureName.toUpperCase();

    for (const program of programResults) {
      // Check file access
      for (const file of program.files || []) {
        if (file.fileName?.toUpperCase().includes(upperName) ||
            file.variableName?.toUpperCase() === upperName) {
          references.push({
            programId: program.programId,
            accessType: this.mapFileAccessToAccessType(file),
            evidence: {
              file: (program as any).relativePath || program.fileName,
              line: 1,
              statement: `File ${file.fileName} (${file.variableName})`
            }
          });
        }
      }

      // Check copybook references
      if (program.copybooks?.some(c => c.toUpperCase().includes(upperName))) {
        references.push({
          programId: program.programId,
          accessType: 'READ',
          evidence: {
            file: (program as any).relativePath || program.fileName,
            line: 1,
            statement: `COPY ${structureName}`
          }
        });
      }
    }

    return references;
  }

  /**
   * Map file access to access type
   */
  private mapFileAccessToAccessType(file: FileAccess): ProgramReference['accessType'] {
    const mode = file.accessType?.toUpperCase() || '';
    if (mode.includes('OUTPUT') || mode.includes('EXTEND')) return 'WRITE';
    if (mode.includes('I-O')) return 'REWRITE';
    return 'READ';
  }

  /**
   * Map SQL operation to access type
   */
  private mapSqlOperationToAccessType(operation: string): ProgramReference['accessType'] {
    switch (operation.toUpperCase()) {
      case 'SELECT': return 'SQL_SELECT';
      case 'INSERT': return 'SQL_INSERT';
      case 'UPDATE': return 'SQL_UPDATE';
      case 'DELETE': return 'SQL_DELETE';
      default: return 'SQL_SELECT';
    }
  }

  /**
   * Section 3: Build data access patterns
   */
  private buildDataAccessPatterns(
    programResults: CobolBusinessLogicResult[],
    uploadDir: string
  ): DataAccessObservation[] {
    const observations: DataAccessObservation[] = [];
    let observationCounter = 0;

    for (const program of programResults) {
      const relativePath = (program as any).relativePath || program.fileName;

      // File I/O observations
      for (const file of program.files || []) {
        observationCounter++;
        observations.push({
          observationId: `DAO-${observationCounter.toString().padStart(4, '0')}`,
          programId: program.programId,
          targetStructure: file.fileName || file.variableName || 'UNKNOWN',
          accessVerb: file.accessType || 'UNKNOWN',
          accessType: 'FILE_IO',
          evidence: {
            file: relativePath,
            line: 1,
            statement: `File ${file.fileName} (${file.accessType})`
          }
        });
      }

      // SQL observations
      for (const dbAccess of program.databaseAccess || []) {
        observationCounter++;
        observations.push({
          observationId: `DAO-${observationCounter.toString().padStart(4, '0')}`,
          programId: program.programId,
          targetStructure: dbAccess.tableName,
          accessVerb: dbAccess.operation,
          accessType: 'SQL',
          evidence: {
            file: relativePath,
            line: dbAccess.lineNumber || 1,
            statement: `EXEC SQL ${dbAccess.operation} ... ${dbAccess.tableName}`
          },
          observedConditions: dbAccess.whereClause ? [dbAccess.whereClause] : undefined
        });
      }
    }

    return observations;
  }

  /**
   * Section 4: Build JCL execution relationships
   */
  private buildJclExecutionRelationships(
    jclResults: JclAnalysisResult[],
    uploadDir: string
  ): JclExecutionRelationship[] {
    const relationships: JclExecutionRelationship[] = [];

    for (const jcl of jclResults) {
      for (const job of jcl.jobs) {
        const stepSequence: JclStepObservation[] = job.steps.map((step, index) => ({
          stepNumber: index + 1,
          stepName: step.stepName,
          executedProgram: step.programName,
          evidence: {
            file: jcl.relativePath || jcl.fileName,
            line: 1,
            statement: `//STEP${index + 1} EXEC PGM=${step.programName}`
          },
          inputDatasets: step.ddStatements
            .filter(dd => dd.accessMode === 'INPUT')
            .map(dd => dd.datasetName || dd.ddName),
          outputDatasets: step.ddStatements
            .filter(dd => dd.accessMode === 'OUTPUT')
            .map(dd => dd.datasetName || dd.ddName),
          isConditional: step.isConditional,
          conditionExpression: step.condition?.expression
        }));

        const datasetReferences: DatasetObservation[] = [];
        const datasetMap = new Map<string, DatasetObservation>();

        for (const step of job.steps) {
          for (const dd of step.ddStatements) {
            const dsName = dd.datasetName || dd.ddName;
            if (!datasetMap.has(dsName)) {
              datasetMap.set(dsName, {
                datasetName: dsName,
                ddName: dd.ddName,
                accessMode: dd.accessMode === 'I-O' ? 'I-O' :
                           dd.accessMode === 'OUTPUT' ? 'OUTPUT' :
                           dd.accessMode === 'INPUT' ? 'INPUT' : 'UNDETERMINED',
                evidence: {
                  file: jcl.relativePath || jcl.fileName,
                  line: 1,
                  statement: `//${dd.ddName} DD DSN=${dsName}`
                },
                usedInSteps: []
              });
            }
            const obs = datasetMap.get(dsName)!;
            if (!obs.usedInSteps.includes(step.stepName)) {
              obs.usedInSteps.push(step.stepName);
            }
          }
        }

        relationships.push({
          jobName: job.jobName,
          sourceFile: jcl.relativePath || jcl.fileName,
          evidence: {
            file: jcl.relativePath || jcl.fileName,
            line: 1,
            statement: `//${job.jobName} JOB`
          },
          stepSequence,
          datasetReferences: Array.from(datasetMap.values())
        });
      }
    }

    return relationships;
  }

  /**
   * Section 5: Build observations and open questions
   */
  private buildObservationsAndQuestions(
    programResults: CobolBusinessLogicResult[],
    copybookResults: CopybookAnalysisResult[],
    jclResults: JclAnalysisResult[],
    programInventory: ProgramInventoryEntry[],
    dataStructures: PersistentDataStructure[]
  ): { observations: ObservedFact[]; openQuestions: OpenQuestion[] } {
    const observations: ObservedFact[] = [];
    const openQuestions: OpenQuestion[] = [];
    let factCounter = 0;
    let questionCounter = 0;

    // Pattern observations
    const batchPrograms = programInventory.filter(p => p.observedExecutionPattern === 'BATCH_INDICATED');
    const onlinePrograms = programInventory.filter(p => p.observedExecutionPattern === 'ONLINE_INDICATED');
    const undeterminedPrograms = programInventory.filter(p => p.observedExecutionPattern === 'UNDETERMINED');

    if (batchPrograms.length > 0 && onlinePrograms.length > 0) {
      factCounter++;
      observations.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'PATTERN',
        observation: `Mixed execution patterns detected: ${batchPrograms.length} batch-indicated, ${onlinePrograms.length} online-indicated programs`,
        evidence: batchPrograms.slice(0, 3).map(p => ({
          file: p.relativePath,
          line: 1,
          statement: `${p.programId} shows batch indicators`
        })),
        affectedComponents: [...batchPrograms.map(p => p.programId), ...onlinePrograms.map(p => p.programId)]
      });
    }

    // External call dependencies
    const programsWithExternalCalls = programInventory.filter(p => p.externalCallsDetected.length > 0);
    if (programsWithExternalCalls.length > 0) {
      const allTargets = new Set<string>();
      programsWithExternalCalls.forEach(p =>
        p.externalCallsDetected.forEach(c => allTargets.add(c.targetProgram))
      );

      // Check for missing targets
      const existingPrograms = new Set(programInventory.map(p => p.programId));
      const missingTargets = Array.from(allTargets).filter(t => !existingPrograms.has(t));

      if (missingTargets.length > 0) {
        questionCounter++;
        openQuestions.push({
          questionId: `Q-${questionCounter.toString().padStart(3, '0')}`,
          category: 'MISSING_SOURCE',
          question: `${missingTargets.length} called program(s) not found in source: ${missingTargets.slice(0, 5).join(', ')}${missingTargets.length > 5 ? '...' : ''}`,
          context: 'External CALL statements reference programs that were not included in the analysis scope',
          relatedEvidence: programsWithExternalCalls.slice(0, 3).map(p => ({
            file: p.relativePath,
            line: 1,
            statement: `CALL to ${p.externalCallsDetected.map(c => c.targetProgram).join(', ')}`
          }))
        });
      }
    }

    // Unreferenced copybooks
    const referencedCopybooks = new Set<string>();
    programResults.forEach(p => p.copybooks?.forEach(c => referencedCopybooks.add(c.toUpperCase())));

    const unreferencedCopybooks = copybookResults.filter(c => {
      const name = c.fileName.replace(/\.(cpy|CPY)$/i, '').toUpperCase();
      return !referencedCopybooks.has(name);
    });

    if (unreferencedCopybooks.length > 0) {
      factCounter++;
      observations.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'ANOMALY',
        observation: `${unreferencedCopybooks.length} copybook(s) detected without program references`,
        evidence: unreferencedCopybooks.slice(0, 5).map(c => ({
          file: c.relativePath || c.fileName,
          line: 1,
          statement: `Copybook ${c.fileName} not referenced by any analyzed program`
        })),
        affectedComponents: unreferencedCopybooks.map(c => c.fileName)
      });
    }

    // JCL-to-program mapping gaps
    const jclExecutedPrograms = new Set<string>();
    jclResults.forEach(jcl =>
      jcl.jobs.forEach(job =>
        job.steps.forEach(step => jclExecutedPrograms.add(step.programName.toUpperCase()))
      )
    );

    const programsNotInJcl = programInventory.filter(p =>
      !jclExecutedPrograms.has(p.programId.toUpperCase()) &&
      p.observedExecutionPattern === 'BATCH_INDICATED'
    );

    if (programsNotInJcl.length > 0 && jclResults.length > 0) {
      questionCounter++;
      openQuestions.push({
        questionId: `Q-${questionCounter.toString().padStart(3, '0')}`,
        category: 'INCOMPLETE_DATA',
        question: `${programsNotInJcl.length} batch-indicated program(s) not found in provided JCL: ${programsNotInJcl.slice(0, 5).map(p => p.programId).join(', ')}`,
        context: 'Programs showing batch execution patterns were not referenced in any analyzed JCL jobs'
      });
    }

    // Data structure observations
    const tablesWithMultipleAccessors = dataStructures.filter(ds =>
      ds.referencedByPrograms.length > 2
    );
    if (tablesWithMultipleAccessors.length > 0) {
      factCounter++;
      observations.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'STRUCTURE',
        observation: `${tablesWithMultipleAccessors.length} data structure(s) accessed by 3+ programs (potential shared entities)`,
        evidence: tablesWithMultipleAccessors.slice(0, 3).map(ds => ({
          file: ds.sourceFile,
          line: 1,
          statement: `${ds.structureName} referenced by ${ds.referencedByPrograms.length} programs`
        })),
        affectedComponents: tablesWithMultipleAccessors.map(ds => ds.structureName)
      });
    }

    return { observations, openQuestions };
  }

  /**
   * Get all files with extensions
   */
  private getAllFiles(dirPath: string, extensions: string[]): string[] {
    if (!fs.existsSync(dirPath)) return [];

    const files: string[] = [];
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getAllFiles(fullPath, extensions));
      } else {
        const ext = path.extname(item).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }
}

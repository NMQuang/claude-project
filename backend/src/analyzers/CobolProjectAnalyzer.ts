/**
 * COBOL Project Analyzer
 *
 * Orchestrates project-wide analysis:
 * - Identify Business Entities from record layouts
 * - Identify Business Processes (Online/Batch)
 * - Build Data Flow maps (VSAM↔VSAM, VSAM↔DB)
 * - Classify Program Roles
 * - Detect Platform Dependencies (IBM vs Fujitsu)
 * - Generate Migration Impact Summary
 */

import * as fs from 'fs';
import * as path from 'path';

import { CobolBusinessLogicAnalyzer, CobolBusinessLogicResult } from './CobolBusinessLogicAnalyzer.js';
import { CopybookAnalyzer, CopybookAnalysisResult, InferredEntity } from './CopybookAnalyzer.js';
import { JclParser, JclAnalysisResult, BatchChainFlow } from './JclParser.js';
import { CrossReferenceBuilder, CrossReferenceMap, CrossReferenceResult } from './CrossReferenceBuilder.js';

// ============================================================================
// Interfaces
// ============================================================================

// Business Overview - Human readable summary
export interface BusinessOverview {
  systemDescription: string;
  primaryBusinessDomain: string;
  keyBusinessFunctions: string[];
  dataStores: string[];
  processingModes: ('ONLINE' | 'BATCH')[];
  platformSummary: string;
}

export interface CobolProjectAnalysisResult {
  systemId: string;
  projectName: string;
  analyzedAt: string;

  // Section 0: Business Overview (Human-readable)
  businessOverview: BusinessOverview;

  // Inventory
  inventory: ProjectInventory;

  // Business Analysis
  businessEntities: BusinessEntity[];
  businessProcesses: BusinessProcess[];
  dataFlows: DataFlowMap;
  programRoles: ProgramRoleAssignment[];

  // Batch Execution
  batchExecutionFlows: BatchJobFlow[];

  // Platform Analysis
  platformDependencies: PlatformDependencyAnalysis;

  // Cross References
  crossReferences: CrossReferenceMap;

  // Migration Impact
  migrationImpact: MigrationImpactSummary;

  // Raw Results
  programResults: CobolBusinessLogicResult[];
  copybookResults: CopybookAnalysisResult[];
  jclResults: JclAnalysisResult[];
}

export interface ProjectInventory {
  programs: number;
  copybooks: number;
  jclJobs: number;
  totalFiles: number;
  totalLinesOfCode: number;
  programList: ProgramInventoryItem[];
  copybookList: CopybookInventoryItem[];
  jclList: JclInventoryItem[];
}

export interface ProgramInventoryItem {
  programId: string;
  fileName: string;
  relativePath: string;
  linesOfCode: number;
  processingType: string;
  complexity: string;
}

export interface CopybookInventoryItem {
  name: string;
  fileName: string;
  relativePath: string;
  recordCount: number;
  totalFields: number;
}

export interface JclInventoryItem {
  jobName: string;
  fileName: string;
  relativePath: string;
  stepCount: number;
  programsExecuted: string[];
}

/**
 * BusinessEntity represents PERSISTENT BUSINESS DATA only:
 * - VSAM record layouts (FD + COPYBOOK)
 * - Database tables (RDB/DB2/Symfoware)
 *
 * NOT included (these are Technical Artifacts):
 * - Working-storage structures (WS-*)
 * - Flags, counters, control variables
 * - SQLCA, utility copybooks
 */
export interface BusinessEntity {
  entityId: string;
  name: string;
  businessName: string;  // Human-readable business name
  type: 'MASTER' | 'TRANSACTION' | 'REFERENCE' | 'TECHNICAL_ARTIFACT';
  source: 'VSAM_KSDS' | 'VSAM_ESDS' | 'VSAM_RRDS' | 'DATABASE' | 'SEQUENTIAL_FILE';
  sourceFile?: string;
  businessDescription: string;  // What this entity represents in business terms
  fields: EntityField[];
  keys: EntityKey[];
  usedByPrograms: string[];
  accessPatterns: EntityAccessPattern[];  // How programs access this entity
  relationships: EntityRelationship[];
}

export interface EntityAccessPattern {
  programId: string;
  accessType: 'READ' | 'WRITE' | 'UPDATE' | 'DELETE';
  businessPurpose: string;  // WHY this access happens
}

export interface EntityField {
  name: string;
  dataType: string;
  length: number;
  businessMeaning: string;
}

export interface EntityKey {
  keyName: string;
  keyType: 'PRIMARY' | 'ALTERNATE' | 'FOREIGN';
  fields: string[];
}

export interface EntityRelationship {
  relatedEntity: string;
  relationshipType: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
  throughField: string;
}

/**
 * BusinessProcess represents a BUSINESS FUNCTION, not a COBOL program.
 * Multiple programs may collaborate to implement ONE business process.
 * Group programs by their BUSINESS PURPOSE.
 *
 * IMPORTANT: If the same business function is implemented using both VSAM and RDB,
 * this should be explicitly stated (they represent the SAME business logic with
 * DIFFERENT data access paradigms).
 */
export interface BusinessProcess {
  processId: string;
  processName: string;  // Business-friendly name (e.g., "Customer Account Management")
  processType: 'ONLINE' | 'BATCH' | 'HYBRID';
  businessDescription: string;  // What business function this serves
  businessOutcome: string;  // What is achieved when this process completes
  entryPoints: string[];  // Programs that initiate this process
  programsInvolved: string[];  // All programs that participate
  entitiesAccessed: string[];  // Business entities involved
  triggerType: 'USER_INITIATED' | 'SCHEDULED' | 'EVENT_DRIVEN' | 'UNKNOWN';
  frequency?: string;  // How often this process runs (for batch)
  estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  dataFlowSummary: string;  // Brief description of data movement

  // VSAM vs RDB Implementation Awareness (Rule 10)
  dataAccessParadigm: 'VSAM_ONLY' | 'RDB_ONLY' | 'VSAM_AND_RDB' | 'FILE_BASED' | 'MIXED';
  vsamPrograms?: string[];  // Programs using VSAM access
  rdbPrograms?: string[];   // Programs using RDB/SQL access
  implementationNote?: string;  // Note about dual implementation if applicable
}

export interface DataFlowMap {
  flows: DataFlow[];
  vsamToVsam: DataFlow[];
  vsamToDb: DataFlow[];
  dbToVsam: DataFlow[];
  fileToFile: DataFlow[];
}

/**
 * DataFlow describes HOW data moves between entities with BUSINESS INTENT.
 * For each flow: WHAT data is accessed, WHY it is accessed, HOW it is processed.
 */
export interface DataFlow {
  flowId: string;
  sourceEntity: string;
  targetEntity: string;
  flowType: 'READ' | 'WRITE' | 'UPDATE' | 'TRANSFER';
  throughProgram: string;
  throughStep?: string;
  description: string;
  businessIntent: string;  // WHY this data movement happens (business reason)
  dataTransformation?: string;  // HOW data is transformed during flow
}

export interface ProgramRoleAssignment {
  programId: string;
  programName: string;
  role: ProgramRole;
  confidence: number;
  evidence: string[];
  entitiesManaged: string[];
}

export type ProgramRole =
  | 'MASTER_MAINTENANCE'
  | 'TRANSACTION_PROCESSING'
  | 'BATCH_UPDATE'
  | 'BATCH_AGGREGATION'
  | 'BATCH_REPORTING'
  | 'REPORTING'
  | 'UTILITY'
  | 'INTERFACE'
  | 'VALIDATION'
  | 'CALCULATION'
  | 'DATA_EXTRACTION'
  | 'UNKNOWN';

export interface BatchJobFlow {
  jobName: string;
  description: string;
  steps: BatchStep[];
  executionFrequency?: string;
  dependencies: string[];
  totalPrograms: number;
}

export interface BatchStep {
  stepNumber: number;
  stepName: string;
  programName: string;
  purpose: string;
  inputDatasets: string[];
  outputDatasets: string[];
  isConditional: boolean;
}

/**
 * Platform Dependency Analysis
 * RULE 11: Classify each major dependency as:
 * - Vendor-neutral COBOL logic
 * - IBM-specific (VSAM, DB2, JCL, CICS)
 * - Fujitsu-specific (Symfoware, TP monitor, extensions)
 */
export interface PlatformDependencyAnalysis {
  platform: 'IBM' | 'FUJITSU' | 'MIXED' | 'UNKNOWN';
  vendorNeutral: PlatformFeature[];  // Standard COBOL features (portable)
  ibmSpecific: PlatformFeature[];    // IBM z/OS specific features
  fujitsuSpecific: PlatformFeature[]; // Fujitsu mainframe specific
  migrationRisks: PlatformRisk[];
  recommendations: string[];
  portabilityScore: number;  // 0-100, higher = more portable
}

export interface PlatformFeature {
  feature: string;
  usageCount: number;
  programs: string[];
  description: string;
  migrationDifficulty: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PlatformRisk {
  riskId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  affectedPrograms: string[];
  mitigationStrategy: string;
}

export interface MigrationImpactSummary {
  overallComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedEffort: MigrationEffort;
  criticalPaths: CriticalPath[];
  risks: MigrationRisk[];
  recommendations: string[];
  priorityOrder: string[];
}

export interface MigrationEffort {
  totalPrograms: number;
  lowComplexity: number;
  mediumComplexity: number;
  highComplexity: number;
  estimatedProgramDays?: number;
}

export interface CriticalPath {
  pathName: string;
  programs: string[];
  reason: string;
  priority: number;
}

export interface MigrationRisk {
  riskId: string;
  category: 'TECHNICAL' | 'BUSINESS' | 'DATA' | 'INTEGRATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  mitigation: string;
}

// ============================================================================
// Main Analyzer Class
// ============================================================================

export class CobolProjectAnalyzer {
  private cobolAnalyzer: CobolBusinessLogicAnalyzer;
  private copybookAnalyzer: CopybookAnalyzer;
  private jclParser: JclParser;
  private crossRefBuilder: CrossReferenceBuilder;

  constructor() {
    this.cobolAnalyzer = new CobolBusinessLogicAnalyzer();
    this.copybookAnalyzer = new CopybookAnalyzer();
    this.jclParser = new JclParser();
    this.crossRefBuilder = new CrossReferenceBuilder();
  }

  /**
   * Analyze entire COBOL project
   */
  async analyzeProject(
    uploadDir: string,
    projectName: string
  ): Promise<CobolProjectAnalysisResult> {

    // 1. Collect all files
    const cobolFiles = this.getAllFiles(uploadDir, ['.cbl', '.cob']);
    const copybookFiles = this.getAllFiles(uploadDir, ['.cpy']);
    const jclFiles = this.getAllFiles(uploadDir, ['.jcl', '.prc', '.proc']);

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

    // 3. Build cross-references
    const crossRefResult = this.crossRefBuilder.build(programResults, copybookResults, jclResults);

    // 4. Build project inventory
    const inventory = this.buildInventory(programResults, copybookResults, jclResults);

    // 5. Identify business entities
    const businessEntities = this.identifyBusinessEntities(copybookResults, programResults, crossRefResult);

    // 6. Identify business processes
    const businessProcesses = this.identifyBusinessProcesses(programResults, jclResults, crossRefResult);

    // 7. Build data flow map
    const dataFlows = this.buildDataFlowMap(programResults, jclResults, businessEntities);

    // 8. Classify program roles
    // v2.3: Extract JCL-executed programs for NON-OVERRIDABLE BATCH classification
    const jclExecutedPrograms = this.extractJclExecutedPrograms(jclResults);
    const programRoles = this.classifyProgramRoles(programResults, crossRefResult, jclExecutedPrograms);

    // 9. Extract batch execution flows
    const batchExecutionFlows = this.extractBatchFlows(jclResults);

    // 10. Analyze platform dependencies
    const platformDependencies = this.analyzePlatformDependencies(programResults);

    // 11. Generate migration impact summary (SYSTEM-LEVEL evaluation)
    const migrationImpact = this.generateMigrationImpact(
      programResults,
      businessEntities,
      platformDependencies,
      crossRefResult,
      businessProcesses,  // Pass for system-level analysis
      jclResults          // Pass for job chain analysis
    );

    // 12. Generate business overview (Section 0 - Human readable summary)
    const businessOverview = this.generateBusinessOverview(
      projectName,
      inventory,
      businessEntities,
      businessProcesses,
      platformDependencies
    );

    return {
      systemId: this.generateSystemId(projectName),
      projectName,
      analyzedAt: new Date().toISOString(),
      businessOverview,
      inventory,
      businessEntities,
      businessProcesses,
      dataFlows,
      programRoles,
      batchExecutionFlows,
      platformDependencies,
      crossReferences: crossRefResult.crossReferences,
      migrationImpact,
      programResults,
      copybookResults,
      jclResults
    };
  }

  /**
   * Generate system ID
   */
  private generateSystemId(projectName: string): string {
    return projectName.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 20);
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

  /**
   * Build project inventory
   */
  private buildInventory(
    programResults: CobolBusinessLogicResult[],
    copybookResults: CopybookAnalysisResult[],
    jclResults: JclAnalysisResult[]
  ): ProjectInventory {
    let totalLoc = 0;

    const programList: ProgramInventoryItem[] = programResults.map(p => {
      totalLoc += p.metrics?.totalLines || 0;
      return {
        programId: p.programId,
        fileName: p.fileName,
        relativePath: (p as any).relativePath || p.fileName,
        linesOfCode: p.metrics?.totalLines || 0,
        processingType: p.overview?.processingType || 'Unknown',
        complexity: p.complexity?.overallDifficulty || 'Unknown'
      };
    });

    const copybookList: CopybookInventoryItem[] = copybookResults.map(c => ({
      name: c.fileName.replace(/\.(cpy|CPY)$/i, ''),
      fileName: c.fileName,
      relativePath: c.relativePath || c.fileName,
      recordCount: c.recordLayouts.length,
      totalFields: c.totalFields
    }));

    const jclList: JclInventoryItem[] = [];
    for (const jcl of jclResults) {
      for (const job of jcl.jobs) {
        jclList.push({
          jobName: job.jobName,
          fileName: jcl.fileName,
          relativePath: jcl.relativePath || jcl.fileName,
          stepCount: job.steps.length,
          programsExecuted: job.steps.map(s => s.programName)
        });
      }
    }

    return {
      programs: programResults.length,
      copybooks: copybookResults.length,
      jclJobs: jclList.length,
      totalFiles: programResults.length + copybookResults.length + jclResults.length,
      totalLinesOfCode: totalLoc,
      programList,
      copybookList,
      jclList
    };
  }

  /**
   * Identify business entities from copybooks and database access
   * BUSINESS-FIRST RULES:
   * - Only include PERSISTENT BUSINESS DATA (VSAM records, DB tables)
   * - Exclude Working-Storage structures (WS-*)
   * - Exclude SQLCA, utility copybooks, flags, counters
   */
  private identifyBusinessEntities(
    copybookResults: CopybookAnalysisResult[],
    programResults: CobolBusinessLogicResult[],
    crossRefResult: CrossReferenceResult
  ): BusinessEntity[] {
    const entityMap = new Map<string, BusinessEntity>();

    // Extract from copybooks - filter out technical artifacts
    for (const copybook of copybookResults) {
      for (const layout of copybook.recordLayouts) {
        const entityId = layout.recordName;

        // Skip Working-Storage and utility structures
        if (this.isTechnicalArtifact(entityId)) {
          continue;
        }

        const entityType = this.mapEntityType(layout.entityType);
        const sourceType = this.inferVsamType(layout);

        const entity: BusinessEntity = {
          entityId,
          name: this.formatEntityName(layout.recordName),
          businessName: this.generateBusinessName(layout.recordName),
          type: entityType,
          source: sourceType,
          sourceFile: copybook.fileName,
          businessDescription: this.generateBusinessDescription(entityId, entityType, sourceType),
          fields: layout.fields.map(f => ({
            name: f.name,
            dataType: f.dataType,
            length: f.length,
            businessMeaning: f.businessMeaning || this.inferFieldMeaning(f.name)
          })),
          keys: layout.keys.map(k => ({
            keyName: k.keyName,
            keyType: k.keyType,
            fields: k.fields
          })),
          usedByPrograms: [],
          accessPatterns: [],
          relationships: []
        };

        entityMap.set(entityId.toUpperCase(), entity);
      }
    }

    // Extract from database access
    for (const program of programResults) {
      for (const dbAccess of program.databaseAccess || []) {
        const tableName = dbAccess.tableName.toUpperCase();

        if (!entityMap.has(tableName)) {
          const entityType = this.inferEntityTypeFromTableName(tableName);
          entityMap.set(tableName, {
            entityId: tableName,
            name: this.formatEntityName(tableName),
            businessName: this.generateBusinessName(tableName),
            type: entityType,
            source: 'DATABASE',
            businessDescription: this.generateBusinessDescription(tableName, entityType, 'DATABASE'),
            fields: dbAccess.columns.map(c => ({
              name: c,
              dataType: 'UNKNOWN',
              length: 0,
              businessMeaning: this.inferFieldMeaning(c)
            })),
            keys: [],
            usedByPrograms: [],
            accessPatterns: [],
            relationships: []
          });
        }

        const entity = entityMap.get(tableName)!;
        if (!entity.usedByPrograms.includes(program.programId)) {
          entity.usedByPrograms.push(program.programId);
        }

        // Add access pattern with business purpose
        entity.accessPatterns.push({
          programId: program.programId,
          accessType: this.mapDbOperationToAccessType(dbAccess.operation),
          businessPurpose: this.inferAccessPurpose(dbAccess.operation, tableName, program.programId)
        });
      }
    }

    // Update usedByPrograms from cross-references
    for (const [entityName, refs] of crossRefResult.crossReferences.entityToPrograms) {
      const entity = entityMap.get(entityName.toUpperCase());
      if (entity) {
        for (const ref of refs) {
          if (!entity.usedByPrograms.includes(ref.programId)) {
            entity.usedByPrograms.push(ref.programId);
          }
        }
      }
    }

    // Filter out TECHNICAL_ARTIFACT from final result (keep only business entities)
    return Array.from(entityMap.values()).filter(e => e.type !== 'TECHNICAL_ARTIFACT');
  }

  /**
   * Check if a record name is a technical artifact (not a business entity)
   */
  private isTechnicalArtifact(name: string): boolean {
    const upper = name.toUpperCase();

    // Working-Storage prefixes
    if (upper.startsWith('WS-') || upper.startsWith('WK-') || upper.startsWith('W-')) return true;

    // Linkage Section prefixes
    if (upper.startsWith('LS-') || upper.startsWith('LK-')) return true;

    // Utility copybooks
    if (upper.includes('SQLCA') || upper.includes('SQLDA')) return true;
    if (upper.includes('DFHAID') || upper.includes('DFHBMSCA')) return true;

    // Flags, counters, control structures
    if (upper.includes('-FLAG') || upper.includes('-CTR') || upper.includes('-COUNTER')) return true;
    if (upper.includes('-SW') || upper.includes('-SWITCH')) return true;

    // Date/time work areas
    if (upper.includes('-DATE-WORK') || upper.includes('-TIME-WORK')) return true;

    return false;
  }

  /**
   * Infer entity type from table name patterns
   */
  private inferEntityTypeFromTableName(tableName: string): BusinessEntity['type'] {
    const upper = tableName.toUpperCase();

    // Master data patterns
    if (upper.includes('MST') || upper.includes('MASTER') || upper.includes('_M_')) {
      return 'MASTER';
    }

    // Transaction patterns
    if (upper.includes('TRN') || upper.includes('TRANS') || upper.includes('_T_') ||
        upper.includes('HIST') || upper.includes('LOG')) {
      return 'TRANSACTION';
    }

    // Reference data patterns
    if (upper.includes('REF') || upper.includes('CODE') || upper.includes('_CD') ||
        upper.includes('TYPE') || upper.includes('_TYP')) {
      return 'REFERENCE';
    }

    return 'MASTER'; // Default to MASTER for database tables
  }

  /**
   * Map DB operation to access type
   */
  private mapDbOperationToAccessType(operation: string): EntityAccessPattern['accessType'] {
    switch (operation.toUpperCase()) {
      case 'SELECT': return 'READ';
      case 'INSERT': return 'WRITE';
      case 'UPDATE': return 'UPDATE';
      case 'DELETE': return 'DELETE';
      default: return 'READ';
    }
  }

  /**
   * Infer access purpose (WHY the access happens)
   */
  private inferAccessPurpose(operation: string, tableName: string, programId: string): string {
    const op = operation.toUpperCase();
    const table = this.generateBusinessName(tableName);

    switch (op) {
      case 'SELECT':
        return `Retrieve ${table} data for processing or validation`;
      case 'INSERT':
        return `Create new ${table} record as part of business transaction`;
      case 'UPDATE':
        return `Modify ${table} data based on business rules`;
      case 'DELETE':
        return `Remove ${table} record as part of business process`;
      default:
        return `Access ${table} data`;
    }
  }

  /**
   * Infer field meaning from field name
   */
  private inferFieldMeaning(fieldName: string): string {
    const upper = fieldName.toUpperCase();

    if (upper.includes('ID') || upper.includes('KEY') || upper.includes('NO') || upper.includes('NUM')) {
      return 'Identifier/Key field';
    }
    if (upper.includes('NAME') || upper.includes('NM')) return 'Name field';
    if (upper.includes('DATE') || upper.includes('DT')) return 'Date field';
    if (upper.includes('AMT') || upper.includes('AMOUNT')) return 'Amount/monetary value';
    if (upper.includes('QTY') || upper.includes('QUANTITY')) return 'Quantity field';
    if (upper.includes('CODE') || upper.includes('CD')) return 'Code/classification field';
    if (upper.includes('STATUS') || upper.includes('STS')) return 'Status indicator';
    if (upper.includes('FLAG') || upper.includes('FLG')) return 'Boolean flag';
    if (upper.includes('DESC') || upper.includes('DESCRIPTION')) return 'Description text';
    if (upper.includes('ADDR') || upper.includes('ADDRESS')) return 'Address field';
    if (upper.includes('PHONE') || upper.includes('TEL')) return 'Phone number';

    return '';
  }

  /**
   * Format entity name
   */
  private formatEntityName(name: string): string {
    return name
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Map entity type - Business-first approach
   * Only MASTER, TRANSACTION, REFERENCE are true business entities
   * Everything else is TECHNICAL_ARTIFACT
   */
  private mapEntityType(type: string): BusinessEntity['type'] {
    switch (type.toUpperCase()) {
      case 'MASTER': return 'MASTER';
      case 'TRANSACTION': return 'TRANSACTION';
      case 'REFERENCE': return 'REFERENCE';
      default: return 'TECHNICAL_ARTIFACT';
    }
  }

  /**
   * Infer VSAM file type from record layout characteristics
   */
  private inferVsamType(layout: any): BusinessEntity['source'] {
    // Check for key characteristics
    if (layout.keys && layout.keys.length > 0) {
      const hasAlternateKey = layout.keys.some((k: any) => k.keyType === 'ALTERNATE');
      if (hasAlternateKey) return 'VSAM_KSDS'; // Keyed with alternates
      return 'VSAM_KSDS'; // Primary key = KSDS
    }
    // ESDS is entry-sequenced (no key)
    if (layout.isSequential) return 'VSAM_ESDS';
    // RRDS is relative record
    if (layout.isRelative) return 'VSAM_RRDS';
    // Default to sequential file if no VSAM characteristics
    return 'SEQUENTIAL_FILE';
  }

  /**
   * Generate business name from technical name
   */
  private generateBusinessName(technicalName: string): string {
    // Remove common prefixes
    let name = technicalName
      .replace(/^(FD-|WS-|LS-|REC-|TBL-|MST-|TRN-)/i, '')
      .replace(/-REC$/i, '')
      .replace(/-RECORD$/i, '')
      .replace(/-FILE$/i, '');

    // Convert to title case with spaces
    return name
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Generate business description based on entity type and name
   */
  private generateBusinessDescription(name: string, type: BusinessEntity['type'], source: BusinessEntity['source']): string {
    const businessName = this.generateBusinessName(name);

    switch (type) {
      case 'MASTER':
        return `Master data store for ${businessName}. Contains core business entity records that are referenced by transactions.`;
      case 'TRANSACTION':
        return `Transaction records for ${businessName}. Stores business events and activities.`;
      case 'REFERENCE':
        return `Reference data for ${businessName}. Contains lookup values and configuration data.`;
      case 'TECHNICAL_ARTIFACT':
        return `Technical structure used for internal processing. Not a business entity.`;
    }
  }

  /**
   * Identify business processes - GROUPED BY BUSINESS PURPOSE
   *
   * PROMPT v2.2 RULES:
   * - Business Process ≠ COBOL Program ≠ JCL Job (FUNDAMENTAL)
   * - Business Process = BUSINESS PURPOSE (e.g., Company Master Maintenance)
   * - JCL Jobs are NOT Business Processes (CRITICAL FIX)
   * - JCL Jobs control execution order only - document separately
   * - Programs executed by JCL are BATCH type
   *
   * CORRECT Business Process examples:
   * - Company Master Maintenance (ONLINE)
   * - Employee Master Maintenance (ONLINE)
   * - Company Master Summary Reporting (BATCH)
   *
   * INCORRECT (DO NOT USE):
   * - RUNALL Processing
   * - DEFVSAM Processing
   * - One process per program
   */
  private identifyBusinessProcesses(
    programResults: CobolBusinessLogicResult[],
    jclResults: JclAnalysisResult[],
    crossRefResult: CrossReferenceResult
  ): BusinessProcess[] {
    // Track which programs are executed by JCL (these are ALWAYS BATCH)
    const jclExecutedPrograms = new Set<string>();
    for (const jcl of jclResults) {
      for (const job of jcl.jobs) {
        for (const step of job.steps) {
          jclExecutedPrograms.add(step.programName.toUpperCase());
        }
      }
    }

    // Group programs by BUSINESS PURPOSE, not by JCL job names
    const processGroups = new Map<string, {
      programs: CobolBusinessLogicResult[];
      entities: Set<string>;
      type: 'ONLINE' | 'BATCH';
      vsamPrograms: string[];
      rdbPrograms: string[];
      filePrograms: string[];
      programTypes: Map<string, 'ONLINE' | 'BATCH'>;
    }>();

    // Step 1: Categorize programs by BUSINESS DOMAIN (not JCL job names)
    for (const program of programResults) {
      // Determine program type using rule table
      const programType = this.classifyProgramType(program, jclExecutedPrograms);

      // Infer BUSINESS domain from program behavior, not from JCL
      const domain = this.inferBusinessProcessName(program, programType);

      if (!processGroups.has(domain)) {
        processGroups.set(domain, {
          programs: [],
          entities: new Set(),
          type: programType,
          vsamPrograms: [],
          rdbPrograms: [],
          filePrograms: [],
          programTypes: new Map()
        });
      }

      const group = processGroups.get(domain)!;
      group.programs.push(program);
      group.programTypes.set(program.programId, programType);

      // If any program is ONLINE, the process type should reflect that
      if (programType === 'ONLINE' && group.type === 'BATCH') {
        // Check if this is truly an online process
        const onlineCount = Array.from(group.programTypes.values()).filter(t => t === 'ONLINE').length;
        if (onlineCount > group.programs.length / 2) {
          group.type = 'ONLINE';
        }
      }

      // Determine data access paradigm for this program
      const hasDbAccess = (program.databaseAccess || []).length > 0;
      const hasVsamAccess = this.detectVsamAccess(program);
      const hasFileAccess = (program.files || []).length > 0;

      if (hasDbAccess) {
        group.rdbPrograms.push(program.programId);
      }
      if (hasVsamAccess) {
        group.vsamPrograms.push(program.programId);
      }
      if (hasFileAccess && !hasDbAccess && !hasVsamAccess) {
        group.filePrograms.push(program.programId);
      }

      // Collect entities accessed
      for (const dbAccess of program.databaseAccess || []) {
        group.entities.add(dbAccess.tableName);
      }
      // Collect VSAM file entities
      for (const file of program.files || []) {
        if (this.isBusinessDataFile(file.fileName)) {
          group.entities.add(file.fileName);
        }
      }
    }

    // Step 2: Convert groups to BusinessProcess objects
    // NOTE: JCL jobs are NOT included as business processes (CRITICAL v2.2 FIX)
    // JCL jobs are documented separately in Batch Execution Flow
    const processes: BusinessProcess[] = [];
    let processId = 1;

    for (const [domain, group] of processGroups) {
      // Skip empty groups or utility-only groups
      if (group.programs.length === 0) continue;

      const programIds = group.programs.map(p => p.programId);

      // Determine complexity based on number of programs and entities
      let complexity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (programIds.length > 5 || group.entities.size > 5) complexity = 'HIGH';
      else if (programIds.length > 2 || group.entities.size > 2) complexity = 'MEDIUM';

      // Determine data access paradigm
      const dataAccessParadigm = this.determineDataAccessParadigm(group);
      const implementationNote = this.generateImplementationNote(group);

      // Generate proper business process name (not JCL job name)
      const processName = this.formatBusinessProcessName(domain, group.type);

      processes.push({
        processId: `BP${String(processId++).padStart(3, '0')}`,
        processName,
        processType: group.type,
        businessDescription: this.generateProcessDescription(processName, group.type),
        businessOutcome: this.generateBusinessOutcome(processName, group.type),
        // Entry points are PROGRAMS, not JCL jobs
        entryPoints: programIds.slice(0, 3),
        programsInvolved: programIds,
        entitiesAccessed: Array.from(group.entities),
        triggerType: group.type === 'BATCH' ? 'SCHEDULED' : 'USER_INITIATED',
        frequency: group.type === 'BATCH' ? this.inferBatchFrequency(domain) : undefined,
        estimatedComplexity: complexity,
        dataFlowSummary: this.generateDataFlowSummary(processName, group.entities),
        // VSAM vs RDB awareness
        dataAccessParadigm,
        vsamPrograms: group.vsamPrograms.length > 0 ? group.vsamPrograms : undefined,
        rdbPrograms: group.rdbPrograms.length > 0 ? group.rdbPrograms : undefined,
        implementationNote
      });
    }

    return processes;
  }

  /**
   * Classify program type using RULE TABLE from Prompt v2.2
   *
   * | IF (Condition)                             | THEN Program Type |
   * |--------------------------------------------|-------------------|
   * | Program executed by JCL                    | BATCH             |
   * | Program has no ACCEPT / DISPLAY            | BATCH             |
   * | Program uses sequential READ NEXT          | BATCH             |
   * | Program is user-invoked CRUD               | ONLINE            |
   * | Program contains ACCEPT/DISPLAY            | ONLINE            |
   * | Program modifies master data interactively | ONLINE            |
   *
   * ❌ Never classify JCL-executed programs as Interactive.
   */
  private classifyProgramType(
    program: CobolBusinessLogicResult,
    jclExecutedPrograms: Set<string>
  ): 'ONLINE' | 'BATCH' {
    const programId = program.programId.toUpperCase();

    // RULE 1: Program executed by JCL → BATCH (ABSOLUTE)
    if (jclExecutedPrograms.has(programId)) {
      return 'BATCH';
    }

    // Check for ACCEPT/DISPLAY (indicates user interaction)
    const hasAcceptDisplay = this.hasAcceptDisplayStatements(program);

    // Check for sequential READ NEXT pattern
    const hasSequentialRead = this.hasSequentialReadPattern(program);

    // RULE 2: Program has no ACCEPT/DISPLAY → BATCH
    // RULE 3: Program uses sequential READ NEXT → BATCH
    if (!hasAcceptDisplay || hasSequentialRead) {
      // But check if it's user-invoked CRUD
      if (this.isUserInvokedCrud(program)) {
        return 'ONLINE';
      }
      return 'BATCH';
    }

    // RULE 4-6: User-invoked CRUD, ACCEPT/DISPLAY, interactive master modification → ONLINE
    if (hasAcceptDisplay) {
      return 'ONLINE';
    }

    // Default based on overview
    if (program.overview?.processingType === 'Online' ||
        program.overview?.processingType === 'Interactive') {
      return 'ONLINE';
    }

    return 'BATCH';
  }

  /**
   * Check if program has ACCEPT/DISPLAY statements (indicates ONLINE)
   */
  private hasAcceptDisplayStatements(program: CobolBusinessLogicResult): boolean {
    const paragraphs = program.paragraphs || [];
    for (const para of paragraphs) {
      const upper = para.name.toUpperCase();
      if (upper.includes('ACCEPT') || upper.includes('DISPLAY') ||
          upper.includes('SCREEN') || upper.includes('INPUT') ||
          upper.includes('USER') || upper.includes('MENU')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if program has sequential READ NEXT pattern (indicates BATCH)
   */
  private hasSequentialReadPattern(program: CobolBusinessLogicResult): boolean {
    const paragraphs = program.paragraphs || [];
    for (const para of paragraphs) {
      const upper = para.name.toUpperCase();
      if (upper.includes('READ-NEXT') || upper.includes('READ-LOOP') ||
          upper.includes('PROCESS-LOOP') || upper.includes('SEQUENTIAL')) {
        return true;
      }
    }

    // Check file access patterns
    const files = program.files || [];
    for (const file of files) {
      if (file.accessType === 'INPUT' && file.operations?.includes('READ')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if program is user-invoked CRUD
   */
  private isUserInvokedCrud(program: CobolBusinessLogicResult): boolean {
    const dbAccess = program.databaseAccess || [];
    const hasInsert = dbAccess.some(d => d.operation === 'INSERT');
    const hasUpdate = dbAccess.some(d => d.operation === 'UPDATE');
    const hasDelete = dbAccess.some(d => d.operation === 'DELETE');
    const hasSelect = dbAccess.some(d => d.operation === 'SELECT');

    // CRUD pattern on master data
    if ((hasInsert || hasUpdate || hasDelete) && hasSelect) {
      // Check if it accesses master tables
      const accessesMaster = dbAccess.some(d =>
        d.tableName.toUpperCase().includes('MST') ||
        d.tableName.toUpperCase().includes('MASTER')
      );
      if (accessesMaster) {
        return true;
      }
    }

    return false;
  }

  /**
   * Infer BUSINESS PROCESS NAME from program behavior
   * NOT from JCL job names (CRITICAL v2.2 FIX)
   */
  private inferBusinessProcessName(program: CobolBusinessLogicResult, programType: 'ONLINE' | 'BATCH'): string {
    // Get entities accessed to determine business domain
    const dbAccess = program.databaseAccess || [];
    const files = program.files || [];

    // Find the main entity being processed
    let mainEntity = '';
    for (const access of dbAccess) {
      const tableName = access.tableName.toUpperCase();
      if (tableName.includes('COMPANY') || tableName.includes('CORP')) {
        mainEntity = 'Company Master';
        break;
      }
      if (tableName.includes('EMPLOYEE') || tableName.includes('EMP') || tableName.includes('SHAIN')) {
        mainEntity = 'Employee Master';
        break;
      }
      if (tableName.includes('CUSTOMER') || tableName.includes('CUST')) {
        mainEntity = 'Customer Master';
        break;
      }
      if (tableName.includes('MST') || tableName.includes('MASTER')) {
        mainEntity = this.generateBusinessName(access.tableName);
        break;
      }
    }

    // Check files for entity hints
    if (!mainEntity) {
      for (const file of files) {
        const fileName = file.fileName.toUpperCase();
        if (fileName.includes('COMPANY') || fileName.includes('CORP')) {
          mainEntity = 'Company Master';
          break;
        }
        if (fileName.includes('EMPLOYEE') || fileName.includes('EMP')) {
          mainEntity = 'Employee Master';
          break;
        }
        if (fileName.includes('MST') || fileName.includes('MASTER')) {
          mainEntity = this.generateBusinessName(file.fileName);
          break;
        }
      }
    }

    // Determine business function based on program type and behavior
    if (programType === 'ONLINE') {
      if (this.isUserInvokedCrud(program)) {
        return mainEntity ? `${mainEntity} Maintenance` : 'Master Data Maintenance';
      }
      return mainEntity ? `${mainEntity} Inquiry` : 'Data Inquiry';
    } else {
      // BATCH
      if (this.hasBatchAggregationPattern(program)) {
        return mainEntity ? `${mainEntity} Summary Reporting` : 'Summary Reporting';
      }
      const hasReportOutput = program.paragraphs?.some(p =>
        p.name.toUpperCase().includes('REPORT') || p.name.toUpperCase().includes('PRINT')
      );
      if (hasReportOutput) {
        return mainEntity ? `${mainEntity} Reporting` : 'Batch Reporting';
      }
      return mainEntity ? `${mainEntity} Batch Processing` : 'Batch Data Processing';
    }
  }

  /**
   * Format business process name properly
   * AVOID JCL job names like RUNALL, DEFVSAM
   */
  private formatBusinessProcessName(domain: string, processType: 'ONLINE' | 'BATCH'): string {
    // Filter out JCL-like names
    const jclPatterns = ['RUNALL', 'DEFVSAM', 'IDCAMS', 'IEFBR14', 'SORT', 'DFSORT'];
    for (const pattern of jclPatterns) {
      if (domain.toUpperCase().includes(pattern)) {
        // This is a JCL utility, not a business process
        return processType === 'ONLINE' ? 'Online Data Processing' : 'Batch Data Processing';
      }
    }

    // Ensure proper suffix
    if (processType === 'ONLINE' && !domain.includes('Maintenance') && !domain.includes('Inquiry')) {
      if (domain.includes('Master')) {
        return `${domain} Maintenance`;
      }
    }

    if (processType === 'BATCH' && !domain.includes('Reporting') && !domain.includes('Processing')) {
      return `${domain} Processing`;
    }

    return domain;
  }

  /**
   * Check if file name represents business data (not utility)
   */
  private isBusinessDataFile(fileName: string): boolean {
    const upper = fileName.toUpperCase();
    // Exclude utility/temporary files
    if (upper.includes('WORK') || upper.includes('TEMP') || upper.includes('SORT') ||
        upper.includes('SYSUT') || upper.includes('SYSPRINT')) {
      return false;
    }
    return true;
  }

  /**
   * Detect VSAM access patterns in program
   */
  private detectVsamAccess(program: CobolBusinessLogicResult): boolean {
    // Check file operations that indicate VSAM (keyed access patterns)
    const files = program.files || [];
    for (const file of files) {
      // VSAM typically has I-O access type with REWRITE/DELETE operations
      if (file.accessType === 'I-O') {
        return true;
      }
      // Check for VSAM-like operations
      const ops = file.operations || [];
      if (ops.includes('REWRITE') || ops.includes('DELETE')) {
        return true;
      }
    }

    // Check for VSAM-related paragraphs or operations
    const paragraphs = program.paragraphs || [];
    for (const para of paragraphs) {
      const upper = para.name.toUpperCase();
      if (upper.includes('VSAM') || upper.includes('KEY-READ') || upper.includes('KSDS') ||
          upper.includes('START-READ') || upper.includes('RANDOM-READ')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine data access paradigm for a process group
   * RULE 10: Identify if same business logic uses VSAM vs RDB
   */
  private determineDataAccessParadigm(group: {
    vsamPrograms: string[];
    rdbPrograms: string[];
    filePrograms: string[];
  }): BusinessProcess['dataAccessParadigm'] {
    const hasVsam = group.vsamPrograms.length > 0;
    const hasRdb = group.rdbPrograms.length > 0;
    const hasFile = group.filePrograms.length > 0;

    if (hasVsam && hasRdb) {
      return 'VSAM_AND_RDB';  // Same business logic with different paradigms
    } else if (hasVsam && !hasRdb) {
      return 'VSAM_ONLY';
    } else if (hasRdb && !hasVsam) {
      return 'RDB_ONLY';
    } else if (hasFile) {
      return 'FILE_BASED';
    }
    return 'MIXED';
  }

  /**
   * Generate implementation note for dual VSAM/RDB implementations
   */
  private generateImplementationNote(group: {
    vsamPrograms: string[];
    rdbPrograms: string[];
  }): string | undefined {
    const hasVsam = group.vsamPrograms.length > 0;
    const hasRdb = group.rdbPrograms.length > 0;

    if (hasVsam && hasRdb) {
      return `This business function has dual implementations: ` +
        `VSAM-based (${group.vsamPrograms.join(', ')}) and ` +
        `RDB-based (${group.rdbPrograms.join(', ')}). ` +
        `Both represent the SAME business logic with DIFFERENT data access paradigms. ` +
        `Migration should consider consolidating to a single paradigm.`;
    }

    return undefined;
  }

  /**
   * Infer business domain from program/job name and characteristics
   * BUSINESS-FIRST RULE: Avoid generic terms like "General Processing"
   * Derive domain from entity names, CRUD behavior, batch logic
   */
  private inferBusinessDomain(name: string, program: CobolBusinessLogicResult | null): string {
    const upper = name.toUpperCase();

    // Customer-related
    if (upper.includes('CUST') || upper.includes('CLIENT') || upper.includes('MEMBER')) {
      return 'Customer Management';
    }

    // Account-related
    if (upper.includes('ACCT') || upper.includes('ACCOUNT') || upper.includes('BALANCE')) {
      return 'Account Processing';
    }

    // Order/Transaction
    if (upper.includes('ORDER') || upper.includes('ORD') || upper.includes('SALE')) {
      return 'Order Management';
    }
    if (upper.includes('TRANS') || upper.includes('TXN') || upper.includes('PAYMENT')) {
      return 'Transaction Processing';
    }

    // Product/Inventory
    if (upper.includes('PROD') || upper.includes('ITEM') || upper.includes('INVENTORY') || upper.includes('STOCK')) {
      return 'Product & Inventory Management';
    }

    // Reporting
    if (upper.includes('REPORT') || upper.includes('RPT') || upper.includes('PRINT') || upper.includes('LIST')) {
      return 'Reporting & Analytics';
    }

    // Batch processing types
    if (upper.includes('DAILY') || upper.includes('NIGHTLY') || upper.includes('EOD')) {
      return 'Daily Batch Processing';
    }
    if (upper.includes('MONTH') || upper.includes('EOM')) {
      return 'Monthly Batch Processing';
    }

    // Master data maintenance
    if (upper.includes('MAINT') || upper.includes('MASTER') || upper.includes('UPDATE') || upper.includes('UPD')) {
      return 'Master Data Maintenance';
    }

    // Interface/Integration
    if (upper.includes('INTERFACE') || upper.includes('EXPORT') || upper.includes('IMPORT') || upper.includes('EXTRACT')) {
      return 'System Integration';
    }

    // Validation
    if (upper.includes('VALID') || upper.includes('CHECK') || upper.includes('VERIFY')) {
      return 'Data Validation';
    }

    // Company/Employee Master patterns (common in Japanese mainframe)
    if (upper.includes('COMPANY') || upper.includes('KAISHA') || upper.includes('CORP')) {
      return 'Company Master Management';
    }
    if (upper.includes('EMPLOYEE') || upper.includes('EMP') || upper.includes('SHAIN')) {
      return 'Employee Master Management';
    }
    if (upper.includes('SUPPLIER') || upper.includes('VENDOR') || upper.includes('TORIHIKI')) {
      return 'Supplier Management';
    }

    // Summary/Aggregation patterns (Batch)
    if (upper.includes('SUMMARY') || upper.includes('SUM') || upper.includes('TOTAL') || upper.includes('AGG')) {
      return 'Data Aggregation & Summary';
    }

    // Derive domain from program's database/file access patterns
    if (program) {
      // Check database tables accessed
      const dbAccess = program.databaseAccess || [];
      const tableNames = dbAccess.map(d => d.tableName.toUpperCase()).join(' ');

      if (tableNames.includes('COMPANY') || tableNames.includes('CORP')) {
        return 'Company Master Management';
      }
      if (tableNames.includes('EMPLOYEE') || tableNames.includes('EMP') || tableNames.includes('STAFF')) {
        return 'Employee Master Management';
      }
      if (tableNames.includes('CUSTOMER') || tableNames.includes('CUST')) {
        return 'Customer Management';
      }
      if (tableNames.includes('ORDER') || tableNames.includes('SALES')) {
        return 'Order Management';
      }

      // Check CRUD behavior for Online programs
      if (program.overview?.processingType === 'Online' || program.overview?.processingType === 'Interactive') {
        const hasInsert = dbAccess.some(d => d.operation === 'INSERT');
        const hasUpdate = dbAccess.some(d => d.operation === 'UPDATE');
        const hasDelete = dbAccess.some(d => d.operation === 'DELETE');
        const hasSelect = dbAccess.some(d => d.operation === 'SELECT');

        if ((hasInsert || hasUpdate || hasDelete) && hasSelect) {
          // CRUD on master data
          const masterTable = dbAccess.find(d =>
            d.tableName.toUpperCase().includes('MST') ||
            d.tableName.toUpperCase().includes('MASTER')
          );
          if (masterTable) {
            return `${this.generateBusinessName(masterTable.tableName)} Maintenance (Online)`;
          }
          return 'Online Master Maintenance';
        }
        if (hasSelect && !hasInsert && !hasUpdate && !hasDelete) {
          return 'Online Inquiry Processing';
        }
        return 'Online Transaction Processing';
      }

      // Check batch aggregation patterns
      if (program.overview?.processingType === 'Batch') {
        // Sequential read with counters/totals indicates aggregation
        const hasSelectOnly = dbAccess.every(d => d.operation === 'SELECT');
        if (hasSelectOnly && dbAccess.length > 0) {
          return 'Batch Data Extraction';
        }
        return 'Batch Data Processing';
      }
    }

    // AVOID "General Processing" - use more specific fallback based on name pattern analysis
    // Extract potential entity name from program name
    const parts = name.replace(/[^A-Z0-9]/gi, ' ').split(' ').filter(p => p.length > 2);
    for (const part of parts) {
      const upperPart = part.toUpperCase();
      // Skip common prefixes/suffixes
      if (['PGM', 'PRG', 'CBL', 'COB', 'JCL', 'JOB', 'BATCH', 'ONLINE'].includes(upperPart)) continue;
      // This might be an entity name
      if (upperPart.length > 3) {
        return `${this.formatEntityName(part)} Processing`;
      }
    }

    // Last resort - but still avoid "General Processing"
    return 'Business Data Processing';
  }

  /**
   * Generate business-friendly process description
   */
  private generateProcessDescription(domain: string, type: BusinessProcess['processType']): string {
    const typeDesc = type === 'BATCH' ? 'batch processing' : type === 'ONLINE' ? 'online transaction' : 'hybrid';

    const descriptions: Record<string, string> = {
      'Customer Management': `Handles all customer-related operations including registration, profile updates, and customer data maintenance through ${typeDesc}.`,
      'Account Processing': `Manages account lifecycle including creation, updates, balance calculations, and account status management via ${typeDesc}.`,
      'Order Management': `Processes customer orders from creation through fulfillment, including order validation, pricing, and status tracking.`,
      'Transaction Processing': `Records and processes business transactions, ensuring data integrity and audit trail maintenance.`,
      'Product & Inventory Management': `Maintains product catalog and inventory levels, handling stock updates and product information management.`,
      'Reporting & Analytics': `Generates business reports and analytics, extracting data for management decision-making.`,
      'Daily Batch Processing': `Executes daily scheduled jobs for data synchronization, aggregation, and end-of-day processing.`,
      'Monthly Batch Processing': `Handles month-end processing including statement generation, period closing, and monthly reconciliation.`,
      'Master Data Maintenance': `Maintains core reference and master data, ensuring data quality and consistency across systems.`,
      'System Integration': `Handles data exchange with external systems through file transfers and interface processing.`,
      'Data Validation': `Validates data integrity and business rules, ensuring data quality before processing.`
    };

    return descriptions[domain] || `Handles ${domain.toLowerCase()} through ${typeDesc} operations.`;
  }

  /**
   * Generate business outcome description
   */
  private generateBusinessOutcome(domain: string, type: BusinessProcess['processType']): string {
    const outcomes: Record<string, string> = {
      'Customer Management': 'Updated customer records with accurate profile and preference information.',
      'Account Processing': 'Account balances and statuses are accurately maintained and reconciled.',
      'Order Management': 'Orders are validated, priced, and queued for fulfillment.',
      'Transaction Processing': 'Transactions are recorded with full audit trail and compliance.',
      'Product & Inventory Management': 'Inventory levels are synchronized and product data is current.',
      'Reporting & Analytics': 'Business reports are generated and available for stakeholders.',
      'Daily Batch Processing': 'Daily data is aggregated and systems are synchronized for next business day.',
      'Monthly Batch Processing': 'Monthly statements generated and financial period properly closed.',
      'Master Data Maintenance': 'Reference data is validated and propagated to dependent systems.',
      'System Integration': 'Data is successfully exchanged with external systems.',
      'Data Validation': 'Data quality issues are identified and flagged for correction.'
    };

    return outcomes[domain] || `${domain} operations are completed successfully.`;
  }

  /**
   * Infer batch frequency from domain
   */
  private inferBatchFrequency(domain: string): string {
    if (domain.includes('Daily')) return 'Daily';
    if (domain.includes('Monthly')) return 'Monthly';
    if (domain.includes('Reporting')) return 'On-demand / Scheduled';
    return 'Scheduled';
  }

  /**
   * Generate data flow summary
   * RULE 14: SOURCE-DRIVEN GUARANTEE
   * If data flow cannot be inferred from source, state explicitly.
   */
  private generateDataFlowSummary(domain: string, entities: Set<string>): string {
    const entityList = Array.from(entities).slice(0, 3).join(', ');
    const moreCount = entities.size > 3 ? ` and ${entities.size - 3} more` : '';

    if (entities.size === 0) {
      // RULE 14: Explicit statement when not identifiable
      return 'Data flow details not identifiable from source code. Manual review of program logic recommended.';
    }

    return `Process accesses ${entities.size} data store(s): ${entityList}${moreCount}. Data is read, validated, processed per business rules, and updated accordingly.`;
  }

  /**
   * Infer process name from program/job name
   */
  private inferProcessName(name: string): string {
    const upper = name.toUpperCase();

    if (upper.includes('CUST')) return 'Customer Management';
    if (upper.includes('ACCT')) return 'Account Processing';
    if (upper.includes('ORDER') || upper.includes('ORD')) return 'Order Processing';
    if (upper.includes('TRANS') || upper.includes('TXN')) return 'Transaction Processing';
    if (upper.includes('REPORT') || upper.includes('RPT')) return 'Reporting';
    if (upper.includes('BATCH')) return 'Batch Processing';
    if (upper.includes('UPDATE') || upper.includes('UPD')) return 'Data Update';
    if (upper.includes('EXTRACT') || upper.includes('EXT')) return 'Data Extraction';

    return this.formatEntityName(name);
  }

  /**
   * Build data flow map with BUSINESS INTENT
   * For each flow: WHAT data, WHY accessed, HOW processed
   */
  private buildDataFlowMap(
    programResults: CobolBusinessLogicResult[],
    jclResults: JclAnalysisResult[],
    entities: BusinessEntity[]
  ): DataFlowMap {
    const flows: DataFlow[] = [];
    let flowId = 1;

    // Extract flows from program database access
    for (const program of programResults) {
      for (const dbAccess of program.databaseAccess || []) {
        const operation = dbAccess.operation;
        const tableName = dbAccess.tableName;

        flows.push({
          flowId: `DF${flowId++}`,
          sourceEntity: operation === 'SELECT' ? tableName : program.programId,
          targetEntity: operation === 'SELECT' ? program.programId : tableName,
          flowType: operation === 'SELECT' ? 'READ' :
                   operation === 'INSERT' ? 'WRITE' : 'UPDATE',
          throughProgram: program.programId,
          description: `${operation} ${tableName} in ${dbAccess.paragraphName}`,
          businessIntent: this.inferDataFlowIntent(operation, tableName, program.programId),
          dataTransformation: this.inferDataTransformation(operation, dbAccess.columns)
        });
      }
    }

    // Extract flows from JCL datasets
    for (const jcl of jclResults) {
      for (const job of jcl.jobs) {
        for (const step of job.steps) {
          for (const dd of step.ddStatements) {
            if (dd.datasetName && !dd.isTemporary && dd.datasetType !== 'SYSOUT') {
              const accessMode = dd.accessMode;
              const datasetName = dd.datasetName;

              flows.push({
                flowId: `DF${flowId++}`,
                sourceEntity: accessMode === 'INPUT' ? datasetName : step.programName,
                targetEntity: accessMode === 'INPUT' ? step.programName : datasetName,
                flowType: accessMode === 'INPUT' ? 'READ' :
                         accessMode === 'OUTPUT' ? 'WRITE' : 'UPDATE',
                throughProgram: step.programName,
                throughStep: `${job.jobName}.${step.stepName}`,
                description: `${accessMode} ${datasetName} via ${dd.ddName}`,
                businessIntent: this.inferFileFlowIntent(accessMode, datasetName, job.jobName),
                dataTransformation: accessMode === 'OUTPUT' ? 'Data aggregated/transformed per business rules' : undefined
              });
            }
          }
        }
      }
    }

    // Categorize flows by type
    const vsamToVsam = flows.filter(f =>
      f.sourceEntity.includes('VSAM') || f.targetEntity.includes('VSAM') ||
      f.description.toUpperCase().includes('VSAM')
    );
    const vsamToDb: DataFlow[] = [];
    const dbToVsam: DataFlow[] = [];
    const fileToFile = flows.filter(f =>
      !f.description.includes('SELECT') &&
      !f.description.includes('INSERT') &&
      !f.description.includes('UPDATE') &&
      !f.description.includes('DELETE')
    );

    return { flows, vsamToVsam, vsamToDb, dbToVsam, fileToFile };
  }

  /**
   * Infer business intent for database data flow
   */
  private inferDataFlowIntent(operation: string, tableName: string, programId: string): string {
    const table = this.generateBusinessName(tableName);
    const op = operation.toUpperCase();

    switch (op) {
      case 'SELECT':
        if (programId.toUpperCase().includes('VALID')) {
          return `Retrieve ${table} data for validation against business rules`;
        }
        if (programId.toUpperCase().includes('REPORT') || programId.toUpperCase().includes('RPT')) {
          return `Extract ${table} data for report generation`;
        }
        return `Read ${table} records to support business processing`;

      case 'INSERT':
        return `Create new ${table} record to persist business transaction`;

      case 'UPDATE':
        return `Modify ${table} data to reflect business state change`;

      case 'DELETE':
        return `Remove ${table} record as part of data lifecycle management`;

      default:
        return `Process ${table} data for business operation`;
    }
  }

  /**
   * Infer business intent for file-based data flow
   */
  private inferFileFlowIntent(accessMode: string, datasetName: string, jobName: string): string {
    const dataset = this.generateBusinessName(datasetName);
    const job = this.generateBusinessName(jobName);

    if (accessMode === 'INPUT') {
      if (jobName.toUpperCase().includes('DAILY') || jobName.toUpperCase().includes('EOD')) {
        return `Read ${dataset} for daily processing cycle`;
      }
      if (jobName.toUpperCase().includes('REPORT')) {
        return `Read ${dataset} as source data for reporting`;
      }
      return `Read ${dataset} as input for ${job} processing`;
    }

    if (accessMode === 'OUTPUT') {
      if (datasetName.toUpperCase().includes('REPORT') || datasetName.toUpperCase().includes('RPT')) {
        return `Generate ${dataset} report output`;
      }
      if (datasetName.toUpperCase().includes('EXTRACT') || datasetName.toUpperCase().includes('EXT')) {
        return `Create ${dataset} extract for downstream processing`;
      }
      return `Write processed results to ${dataset}`;
    }

    return `Update ${dataset} with processed data`;
  }

  /**
   * Infer data transformation description
   */
  private inferDataTransformation(operation: string, columns: string[]): string | undefined {
    if (operation === 'SELECT') {
      if (columns.length > 5) {
        return `Extract ${columns.length} fields for processing`;
      }
      return undefined;
    }

    if (operation === 'INSERT' || operation === 'UPDATE') {
      return `Apply business rules and validation before ${operation.toLowerCase()}`;
    }

    return undefined;
  }

  /**
   * Classify program roles using RULE TABLE from Prompt v2.2
   *
   * | IF (Observed Behavior)              | THEN Role              |
   * |-------------------------------------|------------------------|
   * | Online CRUD on master data          | MASTER_MAINTENANCE     |
   * | Sequential read + counters          | BATCH_AGGREGATION      |
   * | Sequential read + report output     | BATCH_REPORTING        |
   * | SQL/VSAM access only for inquiry    | TRANSACTION_PROCESSING |
   * | Data crosses system boundaries      | INTERFACE              |
   * | Dataset creation / cleanup          | UTILITY                |
   *
   * v2.3 NON-OVERRIDABLE RULES:
   * ❌ BATCH programs can NEVER be MASTER_MAINTENANCE
   * ❌ INTERFACE ONLY if data crosses system boundaries
   * ❌ Internal VSAM/RDB access ≠ INTERFACE
   */
  private classifyProgramRoles(
    programResults: CobolBusinessLogicResult[],
    crossRefResult: CrossReferenceResult,
    jclExecutedPrograms?: Set<string>
  ): ProgramRoleAssignment[] {
    const roles: ProgramRoleAssignment[] = [];
    const jclPrograms = jclExecutedPrograms || new Set<string>();

    for (const program of programResults) {
      const evidence: string[] = [];
      let role: ProgramRole = 'UNKNOWN';
      let confidence = 0.5;

      const programName = program.programId.toUpperCase();
      const hasDB = (program.databaseAccess || []).length > 0;
      const hasFiles = (program.files || []).length > 0;
      const dbOps = new Set((program.databaseAccess || []).map(d => d.operation));

      // v2.3 NON-OVERRIDABLE: JCL-executed programs are ALWAYS BATCH
      const isJclExecuted = jclPrograms.has(programName) || jclPrograms.has(program.programId);
      const isInteractive = !isJclExecuted && (
        program.overview?.processingType === 'Interactive' ||
        program.overview?.processingType === 'Online'
      );
      const isBatch = isJclExecuted || program.overview?.processingType === 'Batch';

      // Check for VSAM file operations
      const hasVsamAccess = this.detectVsamAccess(program);
      const hasVsamCrud = this.hasVsamCrudPattern(program);

      // ========================================
      // v2.3 NON-OVERRIDABLE CLASSIFICATION RULES
      // ========================================

      // RULE: ONLINE programs that WRITE/REWRITE/DELETE persistent data → MASTER_MAINTENANCE (FORCED)
      // ❌ BATCH programs can NEVER be MASTER_MAINTENANCE
      if (isInteractive && (dbOps.has('INSERT') || dbOps.has('UPDATE') || dbOps.has('DELETE'))) {
        role = 'MASTER_MAINTENANCE';
        confidence = 0.90;
        evidence.push('ONLINE program with WRITE/UPDATE/DELETE on persistent data (FORCED)');
      }
      else if (isInteractive && hasVsamAccess && hasVsamCrud) {
        role = 'MASTER_MAINTENANCE';
        confidence = 0.90;
        evidence.push('ONLINE program with VSAM WRITE/REWRITE/DELETE (FORCED)');
      }
      // RULE: ONLINE read-only → TRANSACTION_PROCESSING
      else if (isInteractive && dbOps.has('SELECT') && !dbOps.has('INSERT') && !dbOps.has('UPDATE')) {
        role = 'TRANSACTION_PROCESSING';
        confidence = 0.80;
        evidence.push('ONLINE program with read-only data access');
      }
      else if (isInteractive && hasVsamAccess && !hasVsamCrud) {
        role = 'TRANSACTION_PROCESSING';
        confidence = 0.75;
        evidence.push('ONLINE program with VSAM read-only access');
      }
      // RULE: Sequential read + counters → BATCH_AGGREGATION
      else if (isBatch && this.hasBatchAggregationPattern(program)) {
        role = 'BATCH_AGGREGATION';
        confidence = 0.85;
        evidence.push('BATCH: Sequential read with counters/accumulators');
      }
      // RULE: Sequential read + formatted output → BATCH_REPORTING
      else if (isBatch && this.hasReportOutputPattern(program)) {
        role = 'BATCH_REPORTING';
        confidence = 0.85;
        evidence.push('BATCH: Sequential read with formatted report output');
      }
      // RULE: Batch read-only access → BATCH_REPORTING
      else if (isBatch && dbOps.has('SELECT') && !dbOps.has('INSERT') && !dbOps.has('UPDATE')) {
        role = 'BATCH_REPORTING';
        confidence = 0.75;
        evidence.push('BATCH program with read-only data access');
      }
      // RULE: INTERFACE ONLY if data crosses system boundaries
      // ❌ Internal VSAM/RDB access ≠ INTERFACE
      else if (this.isCrossSystemInterface(program, programName)) {
        role = 'INTERFACE';
        confidence = 0.80;
        evidence.push('Data transfer across system boundaries (external system)');
      }
      // RULE: Dataset creation / cleanup → UTILITY
      else if (this.isUtilityProgram(program, programName)) {
        role = 'UTILITY';
        confidence = 0.75;
        evidence.push('Dataset creation/cleanup/utility operations');
      }
      // BATCH with data updates → BATCH_UPDATE (NOT MASTER_MAINTENANCE)
      else if (isBatch && (dbOps.has('UPDATE') || dbOps.has('INSERT') || hasVsamCrud)) {
        role = 'BATCH_UPDATE';
        confidence = 0.70;
        evidence.push('BATCH program with data updates');
      }
      // BATCH with file operations → BATCH_AGGREGATION
      else if (isBatch && hasFiles) {
        role = 'BATCH_AGGREGATION';
        confidence = 0.60;
        evidence.push('BATCH program with file operations');
      }
      // Naming pattern hints (v2.3: ONLY for ONLINE programs)
      else if (isInteractive && (programName.includes('MAINT') || programName.includes('MASTER') ||
               programName.includes('MST'))) {
        role = 'MASTER_MAINTENANCE';
        confidence = 0.60;
        evidence.push('ONLINE program with master maintenance naming pattern');
      }
      // Fallback for BATCH with naming pattern
      else if (isBatch && (programName.includes('MAINT') || programName.includes('MASTER'))) {
        // v2.3: BATCH can NEVER be MASTER_MAINTENANCE
        role = 'BATCH_UPDATE';
        confidence = 0.55;
        evidence.push('BATCH program (naming suggests master data, but BATCH cannot be MASTER_MAINTENANCE)');
      }
      // Generic BATCH fallback
      else if (isBatch) {
        role = 'BATCH_UPDATE';
        confidence = 0.50;
        evidence.push('BATCH program (generic)');
      }
      // ONLINE fallback
      else if (isInteractive) {
        role = 'TRANSACTION_PROCESSING';
        confidence = 0.50;
        evidence.push('ONLINE program (generic)');
      }
      // Last resort - infer from behavior
      else {
        const inferredRole = this.inferRoleFromBehavior(program, programName, isBatch);
        role = inferredRole.role;
        confidence = inferredRole.confidence;
        if (inferredRole.evidence) {
          evidence.push(inferredRole.evidence);
        }
      }

      // Get entities managed
      const entitiesManaged = crossRefResult.crossReferences.programToEntities.get(program.programId) || [];

      roles.push({
        programId: program.programId,
        programName: program.programId,
        role,
        confidence,
        evidence,
        entitiesManaged
      });
    }

    return roles;
  }

  /**
   * Check if program has VSAM CRUD pattern (READ/WRITE/REWRITE/DELETE)
   */
  private hasVsamCrudPattern(program: CobolBusinessLogicResult): boolean {
    const files = program.files || [];
    const operations = new Set<string>();

    for (const file of files) {
      if (file.operations) {
        for (const op of file.operations) {
          operations.add(op.toUpperCase());
        }
      }
    }

    // Check for full CRUD
    const hasRead = operations.has('READ') || operations.has('START');
    const hasWrite = operations.has('WRITE');
    const hasRewrite = operations.has('REWRITE');
    const hasDelete = operations.has('DELETE');

    return hasRead && hasWrite && (hasRewrite || hasDelete);
  }

  /**
   * Check if program has batch aggregation pattern (sequential read with counters)
   */
  private hasBatchAggregationPattern(program: CobolBusinessLogicResult): boolean {
    // Look for aggregation indicators in business rules or data items
    const keyDataItems = program.keyDataItems || [];
    const paragraphs = program.paragraphs || [];

    // Check for counter/accumulator naming patterns in key data items
    for (const item of keyDataItems) {
      const upper = (item.name || '').toUpperCase();
      if (upper.includes('COUNT') || upper.includes('TOTAL') || upper.includes('SUM') ||
          upper.includes('CTR') || upper.includes('ACCUM') || upper.includes('AGGREGATE')) {
        return true;
      }
    }

    // Check paragraphs for aggregation logic
    for (const para of paragraphs) {
      const upper = para.name.toUpperCase();
      if (upper.includes('ACCUMULATE') || upper.includes('TOTAL') ||
          upper.includes('SUMMARIZE') || upper.includes('AGGREGATE')) {
        return true;
      }
    }

    // Check business rules for aggregation patterns
    const businessRules = program.businessRules || [];
    for (const rule of businessRules) {
      const upper = (rule.description || '').toUpperCase();
      if (upper.includes('ACCUMULATE') || upper.includes('TOTAL') || upper.includes('COUNT')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if program has report output pattern (sequential read + report writing)
   * v2.2 RULE: Sequential read + report output → BATCH_REPORTING
   */
  private hasReportOutputPattern(program: CobolBusinessLogicResult): boolean {
    const files = program.files || [];
    const paragraphs = program.paragraphs || [];
    const keyDataItems = program.keyDataItems || [];

    // Check for report-related file names
    const hasReportFile = files.some(f => {
      const name = (f.fileName || '').toUpperCase();
      return name.includes('REPORT') || name.includes('RPT') || name.includes('PRINT') ||
             name.includes('LIST') || name.includes('OUTPUT');
    });

    // Check for report-related paragraph names
    const hasReportParagraph = paragraphs.some(p => {
      const name = p.name.toUpperCase();
      return name.includes('PRINT') || name.includes('REPORT') || name.includes('WRITE-LINE') ||
             name.includes('FORMAT') || name.includes('HEADER') || name.includes('FOOTER') ||
             name.includes('DETAIL') || name.includes('PAGE');
    });

    // Check for report-related data items (line counts, page counts, etc.)
    const hasReportDataItems = keyDataItems.some(item => {
      const name = (item.name || '').toUpperCase();
      return name.includes('LINE') || name.includes('PAGE') || name.includes('COLUMN') ||
             name.includes('HEADER') || name.includes('FOOTER') || name.includes('REPORT');
    });

    // Check program name for report indicators
    const programName = program.programId.toUpperCase();
    const hasReportName = programName.includes('RPT') || programName.includes('REPORT') ||
                          programName.includes('PRINT') || programName.includes('LIST');

    return hasReportFile || hasReportParagraph || hasReportDataItems || hasReportName;
  }

  /**
   * Check if program is a CROSS-SYSTEM INTERFACE
   * v2.3 NON-OVERRIDABLE RULE:
   * - INTERFACE role ONLY if data crosses system boundaries
   * - Internal VSAM/RDB access ≠ INTERFACE
   * ❌ Do NOT use INTERFACE for simple file processing or aggregation
   */
  private isCrossSystemInterface(program: CobolBusinessLogicResult, programName: string): boolean {
    const files = program.files || [];
    const upperName = programName.toUpperCase();

    // v2.3: ONLY consider INTERFACE if there's EXPLICIT cross-system indicators
    // NOT just file read/write patterns

    // Check for EXPLICIT external system naming patterns
    const hasExternalSystemName =
      upperName.includes('INTERFACE') ||
      upperName.includes('GATEWAY') ||
      upperName.includes('BRIDGE') ||
      upperName.includes('ADAPTER') ||
      upperName.includes('CONNECTOR') ||
      upperName.includes('INBOUND') ||
      upperName.includes('OUTBOUND') ||
      upperName.includes('EXTERNAL') ||
      upperName.includes('EDI') ||       // Electronic Data Interchange
      upperName.includes('FTP') ||       // File Transfer Protocol
      upperName.includes('MQ') ||        // Message Queue
      upperName.includes('CICS');        // Cross-system CICS communication

    // Check for EXPLICIT external file indicators
    const hasExternalFiles = files.some(f => {
      const name = (f.fileName || '').toUpperCase();
      return name.includes('EXTERNAL') ||
             name.includes('INBOUND') ||
             name.includes('OUTBOUND') ||
             name.includes('EDI') ||
             name.includes('INTERFACE') ||
             name.includes('GATEWAY');
    });

    // v2.3: Internal VSAM/RDB access is NOT INTERFACE
    // Simple EXTRACT, LOAD, TRANSFER within the same system is NOT INTERFACE
    // INTERFACE requires EXPLICIT cross-system boundary indicators

    return hasExternalSystemName || hasExternalFiles;
  }

  /**
   * Check if program is a utility program (dataset creation/cleanup)
   * v2.2 RULE: Dataset creation / cleanup → UTILITY
   */
  private isUtilityProgram(program: CobolBusinessLogicResult, programName: string): boolean {
    const upperName = programName.toUpperCase();

    // Utility program naming patterns
    const utilityPatterns = [
      'UTIL', 'UTILITY',
      'INIT', 'INITIALIZE',
      'DELETE', 'PURGE', 'CLEANUP', 'CLEAN',
      'CREATE', 'DEFINE', 'ALLOC',
      'COPY', 'MOVE', 'RENAME',
      'BACKUP', 'RESTORE', 'ARCHIVE',
      'CONVERT', 'CONV',
      'SORT', 'MERGE',
      'REORG', 'REBUILD',
      'VALIDATE', 'VERIFY', 'CHECK',
      'IDCAMS', 'IEBCOPY', 'IEBGENER', 'DFSORT'  // Common IBM utilities
    ];

    const hasUtilityName = utilityPatterns.some(p => upperName.includes(p));

    // Check paragraphs for utility-like operations
    const paragraphs = program.paragraphs || [];
    const hasUtilityParagraph = paragraphs.some(p => {
      const name = p.name.toUpperCase();
      return name.includes('INIT') || name.includes('CLEANUP') ||
             name.includes('DELETE') || name.includes('CREATE') ||
             name.includes('HOUSEKEEP');
    });

    return hasUtilityName || hasUtilityParagraph;
  }

  /**
   * Infer role from observable behavior when other rules don't match
   * v2.3 RULE: AVOID using UNKNOWN when behavior is inferable
   * v2.3 NON-OVERRIDABLE: BATCH can NEVER be MASTER_MAINTENANCE
   */
  private inferRoleFromBehavior(
    program: CobolBusinessLogicResult,
    programName: string,
    forceBatch?: boolean
  ): { role: ProgramRole; confidence: number; evidence?: string } {
    const hasDB = (program.databaseAccess || []).length > 0;
    const hasFiles = (program.files || []).length > 0;
    const isBatch = forceBatch || program.overview?.processingType === 'Batch';
    const isOnline = !isBatch && (
      program.overview?.processingType === 'Online' ||
      program.overview?.processingType === 'Interactive'
    );

    // Any database access suggests data processing
    if (hasDB) {
      const dbOps = new Set((program.databaseAccess || []).map(d => d.operation));
      if (dbOps.has('INSERT') || dbOps.has('UPDATE')) {
        return {
          // v2.3: BATCH can NEVER be MASTER_MAINTENANCE
          role: isBatch ? 'BATCH_UPDATE' : 'TRANSACTION_PROCESSING',
          confidence: 0.45,
          evidence: 'Database write operations detected'
        };
      }
      return {
        role: isBatch ? 'BATCH_REPORTING' : 'REPORTING',
        confidence: 0.45,
        evidence: 'Database read operations detected'
      };
    }

    // File operations - v2.3: NOT automatically INTERFACE
    if (hasFiles) {
      return {
        role: isBatch ? 'BATCH_UPDATE' : 'TRANSACTION_PROCESSING',
        confidence: 0.45,
        evidence: `${isBatch ? 'Batch' : 'Online'} program with file operations`
      };
    }

    // Online program without DB suggests transaction processing
    if (isOnline) {
      return {
        role: 'TRANSACTION_PROCESSING',
        confidence: 0.40,
        evidence: 'Online program processing'
      };
    }

    // Batch program suggests batch update
    if (isBatch) {
      return {
        role: 'BATCH_UPDATE',
        confidence: 0.40,
        evidence: 'Batch processing mode'
      };
    }

    // Check naming for any remaining hints
    // v2.3: MASTER_MAINTENANCE hints only apply to ONLINE programs
    const nameHints: [string, ProgramRole, boolean][] = [
      ['RPT', 'REPORTING', false],
      ['REPORT', 'REPORTING', false],
      ['PRINT', 'BATCH_REPORTING', false],
      ['INQ', 'TRANSACTION_PROCESSING', false],
      ['INQUIRY', 'TRANSACTION_PROCESSING', false],
      ['ADD', 'MASTER_MAINTENANCE', true],   // Only for ONLINE
      ['DEL', 'MASTER_MAINTENANCE', true],   // Only for ONLINE
      ['MOD', 'MASTER_MAINTENANCE', true],   // Only for ONLINE
      ['EDIT', 'VALIDATION', false],
      ['CONV', 'UTILITY', false],
      ['SORT', 'UTILITY', false],
      ['MERGE', 'UTILITY', false],
    ];

    for (const [hint, hintRole, onlineOnly] of nameHints) {
      if (programName.includes(hint)) {
        // v2.3: Skip MASTER_MAINTENANCE for BATCH programs
        if (onlineOnly && isBatch) {
          return {
            role: 'BATCH_UPDATE',
            confidence: 0.40,
            evidence: `Naming pattern suggests ${hintRole.toLowerCase().replace(/_/g, ' ')}, but BATCH cannot be MASTER_MAINTENANCE`
          };
        }
        return {
          role: hintRole,
          confidence: 0.40,
          evidence: `Naming pattern suggests ${hintRole.toLowerCase().replace(/_/g, ' ')}`
        };
      }
    }

    // RULE 14: SOURCE-DRIVEN GUARANTEE
    // Last resort - return UTILITY with low confidence and explicit note
    return {
      role: 'UTILITY',
      confidence: 0.30,
      evidence: 'Role not clearly identifiable from source code; inferred as UTILITY with low confidence. Manual review recommended.'
    };
  }

  /**
   * Extract all programs executed by JCL
   * v2.3 NON-OVERRIDABLE: Any program referenced in JCL → Program Type = BATCH
   */
  private extractJclExecutedPrograms(jclResults: JclAnalysisResult[]): Set<string> {
    const programs = new Set<string>();

    for (const jcl of jclResults) {
      for (const job of jcl.jobs) {
        for (const step of job.steps) {
          if (step.programName) {
            programs.add(step.programName.toUpperCase());
          }
        }
      }
    }

    return programs;
  }

  /**
   * Extract batch execution flows from JCL
   */
  private extractBatchFlows(jclResults: JclAnalysisResult[]): BatchJobFlow[] {
    const flows: BatchJobFlow[] = [];

    for (const jcl of jclResults) {
      for (const job of jcl.jobs) {
        const steps: BatchStep[] = job.steps.map((step, idx) => ({
          stepNumber: idx + 1,
          stepName: step.stepName,
          programName: step.programName,
          purpose: this.inferStepPurpose(step.stepName, step.programName),
          inputDatasets: step.ddStatements
            .filter(d => d.accessMode === 'INPUT' && d.datasetName)
            .map(d => d.datasetName!),
          outputDatasets: step.ddStatements
            .filter(d => d.accessMode === 'OUTPUT' && d.datasetName)
            .map(d => d.datasetName!),
          isConditional: step.isConditional
        }));

        flows.push({
          jobName: job.jobName,
          description: this.inferJobDescription(job.jobName),
          steps,
          dependencies: [],
          totalPrograms: steps.length
        });
      }
    }

    return flows;
  }

  /**
   * Infer step purpose with BUSINESS FOCUS
   * RULE 9: For each batch job and step, identify business purpose
   * AVOID generic descriptions such as "Process data"
   */
  private inferStepPurpose(stepName: string, programName: string): string {
    const stepUpper = stepName.toUpperCase();
    const progUpper = programName.toUpperCase();
    const combined = stepUpper + ' ' + progUpper;

    // Sort operations
    if (combined.includes('SORT')) {
      if (combined.includes('CUST')) return 'Sort customer records for downstream processing';
      if (combined.includes('TRANS')) return 'Sort transaction records by date/key';
      if (combined.includes('MASTER') || combined.includes('MST')) return 'Sort master records for reporting';
      return 'Sort records for sequential processing';
    }

    // Extract operations
    if (combined.includes('EXTRACT') || combined.includes('EXT')) {
      if (combined.includes('CUST')) return 'Extract customer data for external processing';
      if (combined.includes('TRANS')) return 'Extract transaction data for analysis';
      return 'Extract business data for downstream systems';
    }

    // Load operations
    if (combined.includes('LOAD')) {
      if (combined.includes('CUST')) return 'Load customer data into master file';
      if (combined.includes('TRANS')) return 'Load transaction records from input file';
      if (combined.includes('INITIAL')) return 'Initial data load for batch processing';
      return 'Load input data for batch processing';
    }

    // Backup/Archive operations
    if (combined.includes('BACKUP') || combined.includes('ARCHIVE') || combined.includes('BKP')) {
      return 'Create backup copy of data for recovery purposes';
    }

    // Delete operations
    if (combined.includes('DELETE') || combined.includes('DEL') || combined.includes('PURGE')) {
      if (combined.includes('OLD') || combined.includes('HIST')) return 'Purge historical records per retention policy';
      return 'Remove obsolete or expired records from data store';
    }

    // Update operations
    if (combined.includes('UPDATE') || combined.includes('UPD')) {
      if (combined.includes('MASTER') || combined.includes('MST')) return 'Apply changes to master data records';
      if (combined.includes('BALANCE') || combined.includes('BAL')) return 'Update account balances with transaction totals';
      if (combined.includes('STATUS')) return 'Update record status based on business rules';
      return 'Apply business updates to data records';
    }

    // Report operations
    if (combined.includes('REPORT') || combined.includes('RPT') || combined.includes('PRINT') || combined.includes('LIST')) {
      if (combined.includes('SUMMARY') || combined.includes('SUM')) return 'Generate summary report of processed data';
      if (combined.includes('DETAIL')) return 'Generate detailed report with individual records';
      if (combined.includes('EXCEPTION') || combined.includes('ERROR')) return 'Generate exception/error report';
      if (combined.includes('DAILY')) return 'Generate daily business report';
      if (combined.includes('MONTHLY') || combined.includes('EOM')) return 'Generate month-end report';
      return 'Generate business report from processed data';
    }

    // Validation operations
    if (combined.includes('VALID') || combined.includes('CHECK') || combined.includes('VERIFY')) {
      return 'Validate data integrity against business rules';
    }

    // Calculation/Aggregation operations
    if (combined.includes('CALC') || combined.includes('COMPUTE') || combined.includes('TOTAL') || combined.includes('SUM')) {
      if (combined.includes('BALANCE')) return 'Calculate and update account balances';
      if (combined.includes('INTEREST')) return 'Calculate interest amounts';
      return 'Perform business calculations and aggregations';
    }

    // Copy/Transfer operations
    if (combined.includes('COPY') || combined.includes('TRANSFER') || combined.includes('MOVE')) {
      return 'Transfer data between files or datasets';
    }

    // Merge operations
    if (combined.includes('MERGE')) {
      return 'Merge multiple data sources into consolidated output';
    }

    // Init/Setup operations
    if (combined.includes('INIT') || combined.includes('SETUP') || combined.includes('START')) {
      return 'Initialize batch processing environment and work files';
    }

    // Cleanup/End operations
    if (combined.includes('CLEANUP') || combined.includes('END') || combined.includes('FINISH')) {
      return 'Clean up temporary files and finalize batch processing';
    }

    // Master data operations
    if (combined.includes('MASTER') || combined.includes('MST')) {
      return 'Process master data maintenance operations';
    }

    // Transaction operations
    if (combined.includes('TRANS') || combined.includes('TXN')) {
      return 'Process business transactions';
    }

    // Company/Employee specific
    if (combined.includes('COMPANY') || combined.includes('CORP')) {
      return 'Process company-related business data';
    }
    if (combined.includes('EMPLOYEE') || combined.includes('EMP')) {
      return 'Process employee-related business data';
    }
    if (combined.includes('CUSTOMER') || combined.includes('CUST')) {
      return 'Process customer-related business data';
    }

    // Interface operations
    if (combined.includes('INTERFACE') || combined.includes('RECV') || combined.includes('SEND')) {
      return 'Process external system interface data';
    }

    // AVOID "Process data" - derive purpose from program/step name
    // Try to extract meaningful entity from the name
    const nameMatch = progUpper.match(/([A-Z]{4,})/);
    if (nameMatch) {
      const entity = this.formatEntityName(nameMatch[1]);
      if (entity.length > 3 && !['STEP', 'EXEC', 'PROG', 'PROC'].includes(nameMatch[1])) {
        return `Execute ${entity} batch processing step`;
      }
    }

    // Last resort - still avoid completely generic "Process data"
    return `Execute ${this.formatEntityName(programName)} batch step`;
  }

  /**
   * Infer job description
   */
  private inferJobDescription(jobName: string): string {
    return `Batch job: ${this.formatEntityName(jobName)}`;
  }

  /**
   * Analyze platform dependencies
   * RULE 11: Classify each major dependency as:
   * - Vendor-neutral COBOL logic
   * - IBM-specific (VSAM, DB2, JCL, CICS)
   * - Fujitsu-specific (Symfoware, TP monitor, extensions)
   */
  private analyzePlatformDependencies(programResults: CobolBusinessLogicResult[]): PlatformDependencyAnalysis {
    const vendorNeutralFeatures: Map<string, PlatformFeature> = new Map();
    const ibmFeatures: Map<string, PlatformFeature> = new Map();
    const fujitsuFeatures: Map<string, PlatformFeature> = new Map();
    const risks: PlatformRisk[] = [];

    // Vendor-neutral COBOL patterns (portable across platforms)
    const vendorNeutralPatterns: [string, RegExp, string][] = [
      ['Standard File I/O', /OPEN|CLOSE|READ|WRITE/i, 'Standard COBOL file operations (portable)'],
      ['PERFORM Statements', /PERFORM/i, 'Standard COBOL control flow (portable)'],
      ['MOVE/COMPUTE', /MOVE|COMPUTE|ADD|SUBTRACT|MULTIPLY|DIVIDE/i, 'Standard COBOL data manipulation (portable)'],
      ['EVALUATE Statement', /EVALUATE/i, 'Standard COBOL EVALUATE (portable)'],
      ['STRING/UNSTRING', /STRING|UNSTRING/i, 'Standard COBOL string handling (portable)'],
      ['INSPECT Statement', /INSPECT/i, 'Standard COBOL INSPECT (portable)'],
      ['Standard ACCEPT/DISPLAY', /ACCEPT|DISPLAY/i, 'Standard COBOL I/O (portable)'],
      ['CALL Statement', /CALL\s+['"][^'"]+['"]/i, 'Standard COBOL program calls (portable)'],
      ['COPY Statement', /COPY\s+\w+/i, 'Standard COBOL copybook inclusion (portable)'],
    ];

    // IBM-specific patterns
    const ibmPatterns: [string, RegExp, string, 'LOW' | 'MEDIUM' | 'HIGH'][] = [
      ['EXEC CICS', /EXEC\s+CICS/i, 'CICS transaction processing (IBM z/OS)', 'HIGH'],
      ['EXEC SQL (DB2)', /EXEC\s+SQL/i, 'Embedded SQL for DB2 (IBM-specific syntax)', 'MEDIUM'],
      ['CALL DFHEI', /CALL\s+['"]?DFHEI/i, 'CICS system interface calls', 'HIGH'],
      ['VSAM KSDS Access', /ORGANIZATION\s+IS\s+INDEXED/i, 'VSAM Keyed Sequential Dataset', 'MEDIUM'],
      ['VSAM ESDS Access', /ORGANIZATION\s+IS\s+SEQUENTIAL.*ACCESS.*DYNAMIC/i, 'VSAM Entry-Sequenced Dataset', 'MEDIUM'],
      ['VSAM RRDS Access', /ORGANIZATION\s+IS\s+RELATIVE/i, 'VSAM Relative Record Dataset', 'MEDIUM'],
      ['IMS DL/I', /EXEC\s+DLI|CALL\s+['"]?CBLTDLI/i, 'IMS database access (IBM hierarchical DB)', 'HIGH'],
      ['IBM Language Environment', /CEEMSG|CEELOCT|CEEDATM/i, 'IBM LE callable services', 'MEDIUM'],
      ['JCL DD Interaction', /ASSIGN\s+TO\s+\w+/i, 'JCL DD name assignment', 'LOW'],
      ['COBOL Enterprise Features', /XML\s+PARSE|JSON\s+PARSE/i, 'IBM Enterprise COBOL features', 'MEDIUM'],
    ];

    // Fujitsu-specific patterns
    const fujitsuPatterns: [string, RegExp, string, 'LOW' | 'MEDIUM' | 'HIGH'][] = [
      ['ACCEPT DATE YYYYMMDD', /ACCEPT.*DATE\s+YYYYMMDD/i, 'Fujitsu date format extension', 'LOW'],
      ['SYMBOLIC CHARACTERS', /SYMBOLIC\s+CHARACTERS/i, 'Fujitsu symbolic character extension', 'LOW'],
      ['Symfoware SQL', /EXEC\s+SQL.*SYMFOWARE/i, 'Fujitsu Symfoware database access', 'MEDIUM'],
      ['FUJITSU TP Monitor', /EXEC\s+AIM/i, 'Fujitsu AIM transaction processing', 'HIGH'],
      ['FUJITSU Data Adapter', /EXEC\s+ODBC/i, 'Fujitsu ODBC data adapter', 'MEDIUM'],
      ['FUJITSU Extensions', /FUNCTION\s+(NATIONAL-OF|DISPLAY-OF)/i, 'Fujitsu COBOL extensions', 'LOW'],
    ];

    let vendorNeutralCount = 0;
    let platformSpecificCount = 0;

    for (const program of programResults) {
      const content = this.getProgramContent(program);

      // Check vendor-neutral patterns
      for (const [name, pattern, desc] of vendorNeutralPatterns) {
        if (pattern.test(content)) {
          if (!vendorNeutralFeatures.has(name)) {
            vendorNeutralFeatures.set(name, {
              feature: name,
              usageCount: 0,
              programs: [],
              description: desc,
              migrationDifficulty: 'LOW'  // Vendor-neutral = easy to migrate
            });
          }
          const feature = vendorNeutralFeatures.get(name)!;
          feature.usageCount++;
          if (!feature.programs.includes(program.programId)) {
            feature.programs.push(program.programId);
          }
          vendorNeutralCount++;
        }
      }

      // Check IBM patterns
      for (const [name, pattern, desc, difficulty] of ibmPatterns) {
        if (pattern.test(content)) {
          if (!ibmFeatures.has(name)) {
            ibmFeatures.set(name, {
              feature: name,
              usageCount: 0,
              programs: [],
              description: desc,
              migrationDifficulty: difficulty
            });
          }
          const feature = ibmFeatures.get(name)!;
          feature.usageCount++;
          if (!feature.programs.includes(program.programId)) {
            feature.programs.push(program.programId);
          }
          platformSpecificCount++;
        }
      }

      // Check Fujitsu patterns
      for (const [name, pattern, desc, difficulty] of fujitsuPatterns) {
        if (pattern.test(content)) {
          if (!fujitsuFeatures.has(name)) {
            fujitsuFeatures.set(name, {
              feature: name,
              usageCount: 0,
              programs: [],
              description: desc,
              migrationDifficulty: difficulty
            });
          }
          const feature = fujitsuFeatures.get(name)!;
          feature.usageCount++;
          if (!feature.programs.includes(program.programId)) {
            feature.programs.push(program.programId);
          }
          platformSpecificCount++;
        }
      }
    }

    // Determine platform
    // v2.2 RULE: If VSAM or JCL is present → Platform MUST be identified as Mainframe
    const hasIbm = ibmFeatures.size > 0;
    const hasFujitsu = fujitsuFeatures.size > 0;
    const hasVsam = ibmFeatures.has('VSAM KSDS Access') ||
                   ibmFeatures.has('VSAM ESDS Access') ||
                   ibmFeatures.has('VSAM RRDS Access');
    const hasJclDependency = ibmFeatures.has('JCL DD Interaction');

    let platform: PlatformDependencyAnalysis['platform'] = 'UNKNOWN';
    const isMainframe = hasIbm || hasFujitsu || hasVsam || hasJclDependency;

    if (hasIbm && hasFujitsu) platform = 'MIXED';
    else if (hasIbm || hasVsam || hasJclDependency) platform = 'IBM';
    else if (hasFujitsu) platform = 'FUJITSU';

    // Calculate portability score (0-100)
    // Higher score = more portable (more vendor-neutral, less platform-specific)
    // v2.2 RULE: NEVER report 100% portability for mainframe systems
    const totalFeatures = vendorNeutralCount + platformSpecificCount;
    let portabilityScore = 100;
    if (totalFeatures > 0) {
      portabilityScore = Math.round((vendorNeutralCount / totalFeatures) * 100);
    }

    // Adjust for HIGH difficulty features (they significantly reduce portability)
    const highDifficultyCount = [...ibmFeatures.values(), ...fujitsuFeatures.values()]
      .filter(f => f.migrationDifficulty === 'HIGH').length;
    portabilityScore = Math.max(0, portabilityScore - (highDifficultyCount * 15));

    // v2.2 CRITICAL: Mainframe systems NEVER have 100% portability
    // VSAM usage, JCL dependency, and DB2/Symfoware all reduce portability
    if (isMainframe) {
      // Cap at 85% max for mainframe - there are always platform-specific considerations
      portabilityScore = Math.min(portabilityScore, 85);

      // Additional penalties for specific mainframe dependencies
      if (hasVsam) {
        portabilityScore = Math.max(0, portabilityScore - 10); // VSAM requires file migration
      }
      if (hasJclDependency) {
        portabilityScore = Math.max(0, portabilityScore - 5); // JCL requires job scheduling migration
      }
      if (ibmFeatures.has('EXEC SQL (DB2)') || fujitsuFeatures.has('Symfoware SQL')) {
        portabilityScore = Math.max(0, portabilityScore - 10); // DB needs SQL dialect adjustment
      }
    }

    // Generate risks
    let riskId = 1;
    for (const feature of ibmFeatures.values()) {
      if (feature.migrationDifficulty === 'HIGH') {
        risks.push({
          riskId: `PR${riskId++}`,
          riskLevel: 'HIGH',
          description: `${feature.feature} requires significant migration effort`,
          affectedPrograms: feature.programs,
          mitigationStrategy: `Replace ${feature.feature} with target platform equivalent or portable alternative`
        });
      }
    }
    for (const feature of fujitsuFeatures.values()) {
      if (feature.migrationDifficulty === 'HIGH') {
        risks.push({
          riskId: `PR${riskId++}`,
          riskLevel: 'HIGH',
          description: `${feature.feature} requires significant migration effort`,
          affectedPrograms: feature.programs,
          mitigationStrategy: `Replace ${feature.feature} with target platform equivalent or portable alternative`
        });
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];

    // Platform-specific recommendations
    if (ibmFeatures.has('EXEC CICS')) {
      recommendations.push('Plan CICS to target platform transaction migration (consider containerized CICS or alternative TP monitor)');
    }
    if (ibmFeatures.has('EXEC SQL (DB2)')) {
      recommendations.push('Review SQL syntax compatibility with target database; DB2 SQL may need adjustments for PostgreSQL/Oracle');
    }
    if (ibmFeatures.has('IMS DL/I')) {
      recommendations.push('IMS hierarchical data requires fundamental restructuring to relational model');
    }
    if (ibmFeatures.has('VSAM KSDS Access') || ibmFeatures.has('VSAM ESDS Access')) {
      recommendations.push('VSAM files should be migrated to relational tables or modern file formats');
    }
    if (fujitsuFeatures.has('Symfoware SQL')) {
      recommendations.push('Symfoware SQL syntax may need adjustments for target database');
    }
    if (fujitsuFeatures.has('FUJITSU TP Monitor')) {
      recommendations.push('Fujitsu AIM transaction processing requires equivalent TP monitor on target platform');
    }

    // Portability-based recommendations
    if (isMainframe) {
      recommendations.push('Mainframe system identified: migration requires platform-specific considerations for JCL, VSAM, and transaction processing');
    }
    if (portabilityScore < 50) {
      recommendations.push('Low portability score indicates heavy platform dependencies; consider phased migration approach');
    } else if (portabilityScore >= 70 && isMainframe) {
      recommendations.push('Moderate portability score for mainframe system; focus on VSAM-to-RDB migration and JCL-to-scheduler conversion');
    } else if (portabilityScore >= 80 && !isMainframe) {
      recommendations.push('High portability score indicates mostly standard COBOL; migration should be relatively straightforward');
    }

    return {
      platform,
      vendorNeutral: Array.from(vendorNeutralFeatures.values()),
      ibmSpecific: Array.from(ibmFeatures.values()),
      fujitsuSpecific: Array.from(fujitsuFeatures.values()),
      migrationRisks: risks,
      recommendations,
      portabilityScore
    };
  }

  /**
   * Get program content for pattern matching
   */
  private getProgramContent(program: CobolBusinessLogicResult): string {
    // Use available data from analysis
    const parts: string[] = [];

    parts.push(program.programId);
    for (const div of program.divisions || []) parts.push(div);
    for (const para of program.paragraphs || []) parts.push(para.name);

    return parts.join(' ');
  }

  /**
   * Generate migration impact summary
   * RULE 12: Migration complexity MUST be evaluated at SYSTEM LEVEL.
   * If a system includes VSAM AND RDB, Online AND Batch, JCL job chains,
   * then overall complexity MUST be at least MEDIUM.
   * AVOID overly optimistic estimates.
   */
  private generateMigrationImpact(
    programResults: CobolBusinessLogicResult[],
    entities: BusinessEntity[],
    platformDeps: PlatformDependencyAnalysis,
    crossRefResult: CrossReferenceResult,
    businessProcesses?: BusinessProcess[],
    jclResults?: JclAnalysisResult[]
  ): MigrationImpactSummary {
    const effort: MigrationEffort = {
      totalPrograms: programResults.length,
      lowComplexity: 0,
      mediumComplexity: 0,
      highComplexity: 0
    };

    for (const program of programResults) {
      switch (program.complexity?.overallDifficulty) {
        case 'Low': effort.lowComplexity++; break;
        case 'Medium': effort.mediumComplexity++; break;
        case 'High': effort.highComplexity++; break;
        default: effort.mediumComplexity++; // Default to medium if unknown
      }
    }

    // Estimate effort (conservative - avoid overly optimistic estimates)
    // RULE 12: Be realistic, not optimistic
    effort.estimatedProgramDays =
      effort.lowComplexity * 3 +      // Increased from 2
      effort.mediumComplexity * 7 +   // Increased from 5
      effort.highComplexity * 15;     // Increased from 10

    // RULE 12: SYSTEM-LEVEL complexity evaluation
    // Must consider system-wide factors, not just individual program complexity
    let overallComplexity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let complexityReasons: string[] = [];

    // Check individual program complexity distribution
    if (effort.highComplexity > programResults.length * 0.3) {
      overallComplexity = 'HIGH';
      complexityReasons.push('More than 30% of programs are high complexity');
    } else if (effort.mediumComplexity > programResults.length * 0.5) {
      overallComplexity = 'MEDIUM';
      complexityReasons.push('More than 50% of programs are medium complexity');
    }

    // SYSTEM-LEVEL factors that FORCE at least MEDIUM complexity
    const systemLevelFactors = this.evaluateSystemLevelComplexity(
      programResults, entities, platformDeps, businessProcesses, jclResults
    );

    if (systemLevelFactors.forceAtLeastMedium && overallComplexity === 'LOW') {
      overallComplexity = 'MEDIUM';
      complexityReasons.push(...systemLevelFactors.reasons);
    }

    if (systemLevelFactors.forceHigh) {
      overallComplexity = 'HIGH';
      complexityReasons.push(...systemLevelFactors.reasons);
    }

    // Find critical paths
    const criticalPaths: CriticalPath[] = [];
    const rootPrograms = crossRefResult.crossReferences.programCallGraph.rootPrograms;

    for (let i = 0; i < Math.min(rootPrograms.length, 5); i++) {
      criticalPaths.push({
        pathName: `Main Entry Point ${i + 1}`,
        programs: [rootPrograms[i]],
        reason: 'Root program with dependent chains',
        priority: i + 1
      });
    }

    // Generate risks
    const risks: MigrationRisk[] = [
      ...platformDeps.migrationRisks.map(r => ({
        riskId: r.riskId,
        category: 'TECHNICAL' as const,
        severity: r.riskLevel,
        description: r.description,
        mitigation: r.mitigationStrategy
      }))
    ];

    // Add system-level risks
    if (systemLevelFactors.hasVsamAndRdb) {
      risks.push({
        riskId: 'SYS1',
        category: 'TECHNICAL',
        severity: 'MEDIUM',
        description: 'System uses both VSAM and RDB data access paradigms',
        mitigation: 'Consider consolidating to single data access paradigm during migration'
      });
    }

    if (systemLevelFactors.hasOnlineAndBatch) {
      risks.push({
        riskId: 'SYS2',
        category: 'INTEGRATION',
        severity: 'MEDIUM',
        description: 'System has both Online and Batch processing requiring coordination',
        mitigation: 'Develop integrated test plan covering Online-Batch interactions'
      });
    }

    if (systemLevelFactors.hasJobChains) {
      risks.push({
        riskId: 'SYS3',
        category: 'BUSINESS',
        severity: 'MEDIUM',
        description: 'Complex JCL job chains require careful orchestration during migration',
        mitigation: 'Map job dependencies and establish migration sequence plan'
      });
    }

    if (entities.filter(e => e.type === 'MASTER').length > 5) {
      risks.push({
        riskId: 'DR1',
        category: 'DATA',
        severity: 'MEDIUM',
        description: 'Multiple master entities require coordinated migration',
        mitigation: 'Develop data migration sequencing plan with dependency ordering'
      });
    }

    // Generate recommendations (include system-level context)
    const recommendations: string[] = [
      ...platformDeps.recommendations,
    ];

    // Add complexity-based recommendations
    if (overallComplexity === 'HIGH') {
      recommendations.push('Consider phased migration approach due to high system complexity');
      recommendations.push('Establish dedicated test environment mirroring production data volumes');
    }
    if (systemLevelFactors.hasJobChains) {
      recommendations.push('Map and document all JCL job chains before migration begins');
    }
    if (systemLevelFactors.hasVsamAndRdb) {
      recommendations.push('Create unified data access layer to abstract VSAM/RDB differences');
    }

    recommendations.push('Begin with utility and validation programs');
    recommendations.push('Migrate master maintenance programs before transaction processing');
    recommendations.push('Test batch chains end-to-end after migration');

    // Priority order (consider system dependencies)
    const priorityOrder = programResults
      .sort((a, b) => {
        const aScore = (a.complexity?.overallDifficulty === 'Low' ? 1 : 0) +
                      ((a.externalCalls || []).length === 0 ? 1 : 0);
        const bScore = (b.complexity?.overallDifficulty === 'Low' ? 1 : 0) +
                      ((b.externalCalls || []).length === 0 ? 1 : 0);
        return bScore - aScore;
      })
      .map(p => p.programId);

    return {
      overallComplexity,
      estimatedEffort: effort,
      criticalPaths,
      risks,
      recommendations,
      priorityOrder
    };
  }

  /**
   * Evaluate system-level complexity factors
   * RULE 12: System-level analysis, not just individual program analysis
   *
   * v2.3 NON-OVERRIDABLE COMPLEXITY RULE:
   * - ONLINE + BATCH + VSAM/RDB + JCL → Overall Complexity ≥ MEDIUM
   * - Mainframe systems can NEVER have LOW complexity
   */
  private evaluateSystemLevelComplexity(
    programResults: CobolBusinessLogicResult[],
    entities: BusinessEntity[],
    platformDeps: PlatformDependencyAnalysis,
    businessProcesses?: BusinessProcess[],
    jclResults?: JclAnalysisResult[]
  ): {
    forceAtLeastMedium: boolean;
    forceHigh: boolean;
    reasons: string[];
    hasVsamAndRdb: boolean;
    hasOnlineAndBatch: boolean;
    hasJobChains: boolean;
  } {
    const reasons: string[] = [];
    let forceAtLeastMedium = false;
    let forceHigh = false;

    // Check for VSAM usage
    const hasVsam = platformDeps.ibmSpecific.some(f =>
      f.feature.includes('VSAM') || f.feature.includes('INDEXED') || f.feature.includes('RELATIVE')
    );
    // Check for RDB usage
    const hasRdb = platformDeps.ibmSpecific.some(f =>
      f.feature.includes('SQL') || f.feature.includes('DB2')
    ) || platformDeps.fujitsuSpecific.some(f =>
      f.feature.includes('SQL') || f.feature.includes('Symfoware')
    );
    const hasVsamOrRdb = hasVsam || hasRdb;

    const hasVsamAndRdb = hasVsam && hasRdb;
    if (hasVsamAndRdb) {
      forceAtLeastMedium = true;
      reasons.push('System uses both VSAM and RDB data access paradigms');
    }

    // Check for Online AND Batch processing
    let hasOnline = false;
    let hasBatch = false;

    for (const program of programResults) {
      if (program.overview?.processingType === 'Online' ||
          program.overview?.processingType === 'Interactive') {
        hasOnline = true;
      }
      if (program.overview?.processingType === 'Batch') {
        hasBatch = true;
      }
    }

    // JCL presence implies batch
    const hasJcl = jclResults && jclResults.length > 0;
    if (hasJcl) hasBatch = true;

    const hasOnlineAndBatch = hasOnline && hasBatch;
    if (hasOnlineAndBatch) {
      forceAtLeastMedium = true;
      reasons.push('System has both Online and Batch processing modes');
    }

    // ========================================
    // v2.3 NON-OVERRIDABLE COMPLEXITY RULES
    // ========================================

    // RULE: ONLINE + BATCH + VSAM/RDB + JCL → Complexity ≥ MEDIUM
    if (hasOnline && hasBatch && hasVsamOrRdb && hasJcl) {
      forceAtLeastMedium = true;
      reasons.push('v2.3 RULE: ONLINE + BATCH + VSAM/RDB + JCL requires at least MEDIUM complexity');
    }

    // RULE: Mainframe system (has VSAM/JCL/IDCAMS) can NEVER have LOW complexity
    const isMainframe = platformDeps.platform === 'IBM' || platformDeps.platform === 'FUJITSU' ||
                       hasVsam || hasJcl;
    if (isMainframe) {
      forceAtLeastMedium = true;
      reasons.push('Mainframe system: complexity cannot be LOW');
    }

    // Check for JCL job chains (multi-step jobs)
    let hasJobChains = false;
    if (jclResults) {
      for (const jcl of jclResults) {
        for (const job of jcl.jobs) {
          if (job.steps.length > 2) {
            hasJobChains = true;
            break;
          }
        }
      }
    }

    if (hasJobChains) {
      forceAtLeastMedium = true;
      reasons.push('System has complex JCL job chains (multi-step jobs)');
    }

    // Check for multiple master entities
    const masterEntityCount = entities.filter(e => e.type === 'MASTER').length;
    if (masterEntityCount > 5) {
      forceAtLeastMedium = true;
      reasons.push(`System manages ${masterEntityCount} master data entities`);
    }

    // Check for high-risk platform features
    const highRiskFeatures = [
      ...platformDeps.ibmSpecific.filter(f => f.migrationDifficulty === 'HIGH'),
      ...platformDeps.fujitsuSpecific.filter(f => f.migrationDifficulty === 'HIGH')
    ];

    if (highRiskFeatures.length >= 2) {
      forceAtLeastMedium = true;
      reasons.push(`System uses ${highRiskFeatures.length} high-risk platform features`);
    }
    if (highRiskFeatures.length >= 4) {
      forceHigh = true;
      reasons.push(`System has ${highRiskFeatures.length} high-risk platform dependencies requiring significant rework`);
    }

    // Check portability score
    if (platformDeps.portabilityScore < 40) {
      forceAtLeastMedium = true;
      reasons.push(`Low portability score (${platformDeps.portabilityScore}%) indicates heavy platform dependencies`);
    }
    if (platformDeps.portabilityScore < 25) {
      forceHigh = true;
      reasons.push(`Very low portability score (${platformDeps.portabilityScore}%) indicates fundamental platform coupling`);
    }

    // Total program count also affects complexity at system level
    if (programResults.length > 50) {
      forceAtLeastMedium = true;
      reasons.push(`Large system with ${programResults.length} programs requires coordinated migration`);
    }
    if (programResults.length > 100) {
      forceHigh = true;
      reasons.push(`Very large system with ${programResults.length} programs`);
    }

    return {
      forceAtLeastMedium,
      forceHigh,
      reasons,
      hasVsamAndRdb,
      hasOnlineAndBatch,
      hasJobChains
    };
  }

  /**
   * Generate Business Overview - Section 0
   * Human-readable summary for both COBOL newcomers and experienced mainframe engineers
   */
  private generateBusinessOverview(
    projectName: string,
    inventory: ProjectInventory,
    entities: BusinessEntity[],
    processes: BusinessProcess[],
    platformDeps: PlatformDependencyAnalysis
  ): BusinessOverview {
    // Infer primary business domain from entity and process names
    const domainCounts = new Map<string, number>();
    for (const process of processes) {
      const domain = process.processName;
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + process.programsInvolved.length);
    }

    // BUSINESS-FIRST RULE: Primary domain MUST be concrete and specific
    // Avoid generic terms like "General Business Processing"
    let primaryDomain = '';
    let maxCount = 0;
    for (const [domain, count] of domainCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryDomain = domain;
      }
    }

    // If no domain identified, derive from entity types
    if (!primaryDomain || primaryDomain === 'Business Data Processing') {
      const masterEntities = entities.filter(e => e.type === 'MASTER');
      if (masterEntities.length > 0) {
        // Use the most common master entity as domain indicator
        const entityNames = masterEntities.map(e => e.businessName).join(', ');
        primaryDomain = `${masterEntities[0].businessName} Management`;
        if (masterEntities.length > 1) {
          primaryDomain = `${masterEntities.slice(0, 2).map(e => e.businessName).join(' and ')} Management`;
        }
      } else {
        // Still avoid "General" - use inventory-based description
        primaryDomain = 'Enterprise Data Management';
      }
    }

    // Collect key business functions
    const keyFunctions = processes
      .sort((a, b) => b.programsInvolved.length - a.programsInvolved.length)
      .slice(0, 5)
      .map(p => p.processName);

    // Collect data stores
    const dataStores = entities
      .filter(e => e.type === 'MASTER' || e.type === 'TRANSACTION')
      .slice(0, 5)
      .map(e => e.businessName);

    // Determine processing modes
    const processingModes: ('ONLINE' | 'BATCH')[] = [];
    const hasOnline = processes.some(p => p.processType === 'ONLINE' || p.processType === 'HYBRID');
    const hasBatch = processes.some(p => p.processType === 'BATCH' || p.processType === 'HYBRID');
    if (hasOnline) processingModes.push('ONLINE');
    if (hasBatch) processingModes.push('BATCH');

    // Generate system description
    const systemDescription = this.generateSystemDescription(
      projectName,
      inventory,
      primaryDomain,
      processingModes,
      platformDeps.platform
    );

    // Generate platform summary
    const platformSummary = this.generatePlatformSummary(platformDeps);

    return {
      systemDescription,
      primaryBusinessDomain: primaryDomain,
      keyBusinessFunctions: keyFunctions,
      dataStores,
      processingModes,
      platformSummary
    };
  }

  /**
   * Generate human-readable system description
   */
  private generateSystemDescription(
    projectName: string,
    inventory: ProjectInventory,
    primaryDomain: string,
    processingModes: ('ONLINE' | 'BATCH')[],
    platform: string
  ): string {
    const modeDesc = processingModes.length === 2
      ? 'both online and batch processing'
      : processingModes[0] === 'ONLINE'
        ? 'online transaction processing'
        : 'batch processing';

    const platformDesc = platform === 'IBM' ? 'IBM mainframe'
      : platform === 'FUJITSU' ? 'Fujitsu mainframe'
      : platform === 'MIXED' ? 'mixed mainframe platform'
      : 'mainframe';

    return `${projectName} is a ${platformDesc} system primarily focused on ${primaryDomain.toLowerCase()}. ` +
      `The system comprises ${inventory.programs} COBOL programs, ` +
      `${inventory.copybooks} copybooks, and ${inventory.jclJobs} batch jobs, ` +
      `totaling approximately ${inventory.totalLinesOfCode.toLocaleString()} lines of code. ` +
      `The system supports ${modeDesc} operations.`;
  }

  /**
   * Generate platform summary for migration planning
   */
  private generatePlatformSummary(platformDeps: PlatformDependencyAnalysis): string {
    const platform = platformDeps.platform;

    if (platform === 'UNKNOWN') {
      return 'Platform dependencies could not be determined from static analysis. Manual review recommended.';
    }

    const totalFeatures = platformDeps.ibmSpecific.length + platformDeps.fujitsuSpecific.length;
    const highRiskCount = platformDeps.migrationRisks.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;

    let summary = `Detected ${platform} mainframe platform with ${totalFeatures} platform-specific feature(s). `;

    if (highRiskCount > 0) {
      summary += `${highRiskCount} high-risk migration item(s) identified requiring special attention. `;
    }

    if (platformDeps.ibmSpecific.some(f => f.feature === 'EXEC CICS')) {
      summary += 'CICS transaction processing is used, requiring transaction framework migration. ';
    }

    if (platformDeps.ibmSpecific.some(f => f.feature === 'EXEC SQL')) {
      summary += 'Embedded SQL is used for database access. ';
    }

    return summary.trim();
  }
}

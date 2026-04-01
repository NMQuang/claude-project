/**
 * Cross-Reference Builder
 *
 * Builds cross-references linking:
 * - Programs ↔ Copybooks
 * - Programs ↔ Programs (call graph)
 * - JCL ↔ Programs
 * - Entities ↔ Programs
 */

import { CobolBusinessLogicResult } from './CobolBusinessLogicAnalyzer.js';
import { CopybookAnalysisResult, InferredEntity } from './CopybookAnalyzer.js';
import { JclAnalysisResult, ProgramExecution } from './JclParser.js';

// ============================================================================
// Interfaces
// ============================================================================

export interface CrossReferenceMap {
  programToCopybooks: Map<string, string[]>;
  copybookToPrograms: Map<string, string[]>;
  programCallGraph: ProgramCallGraph;
  jclToProgramMap: Map<string, JclProgramReference[]>;
  entityToPrograms: Map<string, EntityProgramReference[]>;
  programToEntities: Map<string, string[]>;
  datasetToPrograms: Map<string, DatasetProgramReference[]>;
}

export interface ProgramCallGraph {
  nodes: ProgramNode[];
  edges: ProgramEdge[];
  rootPrograms: string[];  // Entry points (not called by anyone)
  leafPrograms: string[];  // Programs that don't call others
}

export interface ProgramNode {
  programId: string;
  programName: string;
  filePath?: string;
  nodeType: 'ANALYZED' | 'EXTERNAL' | 'UNKNOWN';
  callCount: number;  // How many times this program is called
  callerCount: number;  // How many programs call this
}

export interface ProgramEdge {
  caller: string;
  callee: string;
  callType: 'STATIC' | 'DYNAMIC';
  lineNumber?: number;
  paragraphName?: string;
}

export interface JclProgramReference {
  jobName: string;
  stepName: string;
  executionOrder: number;
  inputDatasets: string[];
  outputDatasets: string[];
  parameters?: string;
}

export interface EntityProgramReference {
  programId: string;
  accessType: 'READ' | 'WRITE' | 'UPDATE' | 'DELETE' | 'MIXED';
  accessCount: number;
  paragraphs: string[];
}

export interface DatasetProgramReference {
  programId: string;
  accessMode: 'INPUT' | 'OUTPUT' | 'I-O' | 'UNKNOWN';
  jclSteps: string[];
}

export interface CrossReferenceResult {
  crossReferences: CrossReferenceMap;
  statistics: CrossReferenceStatistics;
  orphanedEntities: OrphanedEntity[];
  unreferencedPrograms: string[];
}

export interface CrossReferenceStatistics {
  totalPrograms: number;
  totalCopybooks: number;
  totalJclJobs: number;
  totalEntities: number;
  totalCallRelationships: number;
  averageCopybooksPerProgram: number;
  averageCallsPerProgram: number;
  maxCallDepth: number;
}

export interface OrphanedEntity {
  entityName: string;
  entityType: string;
  source: string;
  reason: string;
}

// ============================================================================
// Main Builder Class
// ============================================================================

export class CrossReferenceBuilder {

  /**
   * Build cross-references from analysis results
   */
  build(
    programResults: CobolBusinessLogicResult[],
    copybookResults: CopybookAnalysisResult[],
    jclResults: JclAnalysisResult[]
  ): CrossReferenceResult {

    const crossReferences: CrossReferenceMap = {
      programToCopybooks: new Map(),
      copybookToPrograms: new Map(),
      programCallGraph: { nodes: [], edges: [], rootPrograms: [], leafPrograms: [] },
      jclToProgramMap: new Map(),
      entityToPrograms: new Map(),
      programToEntities: new Map(),
      datasetToPrograms: new Map()
    };

    // Build program ↔ copybook references
    this.buildProgramCopybookReferences(programResults, copybookResults, crossReferences);

    // Build program call graph
    this.buildProgramCallGraph(programResults, crossReferences);

    // Build JCL ↔ program references
    this.buildJclProgramReferences(jclResults, programResults, crossReferences);

    // Build entity ↔ program references
    this.buildEntityProgramReferences(programResults, copybookResults, crossReferences);

    // Build dataset ↔ program references
    this.buildDatasetProgramReferences(jclResults, crossReferences);

    // Calculate statistics
    const statistics = this.calculateStatistics(crossReferences, programResults, copybookResults, jclResults);

    // Find orphaned entities
    const orphanedEntities = this.findOrphanedEntities(crossReferences, copybookResults);

    // Find unreferenced programs
    const unreferencedPrograms = this.findUnreferencedPrograms(crossReferences, programResults, jclResults);

    return {
      crossReferences,
      statistics,
      orphanedEntities,
      unreferencedPrograms
    };
  }

  /**
   * Build program ↔ copybook references
   */
  private buildProgramCopybookReferences(
    programResults: CobolBusinessLogicResult[],
    copybookResults: CopybookAnalysisResult[],
    crossReferences: CrossReferenceMap
  ): void {
    const copybookNames = new Set(copybookResults.map(c =>
      c.fileName.replace(/\.(cpy|CPY)$/i, '').toUpperCase()
    ));

    for (const program of programResults) {
      const programId = program.programId || program.fileName;
      const usedCopybooks: string[] = [];

      // Get copybooks from analysis result
      for (const copybook of program.copybooks || []) {
        const upperCopy = copybook.toUpperCase();
        usedCopybooks.push(upperCopy);

        // Add to copybookToPrograms
        if (!crossReferences.copybookToPrograms.has(upperCopy)) {
          crossReferences.copybookToPrograms.set(upperCopy, []);
        }
        crossReferences.copybookToPrograms.get(upperCopy)!.push(programId);
      }

      crossReferences.programToCopybooks.set(programId, usedCopybooks);
    }
  }

  /**
   * Build program call graph
   */
  private buildProgramCallGraph(
    programResults: CobolBusinessLogicResult[],
    crossReferences: CrossReferenceMap
  ): void {
    const callGraph = crossReferences.programCallGraph;
    const nodeMap = new Map<string, ProgramNode>();
    const callers = new Set<string>();
    const callees = new Set<string>();

    // Create nodes for analyzed programs
    for (const program of programResults) {
      const programId = program.programId || program.fileName;

      nodeMap.set(programId, {
        programId,
        programName: program.programId,
        filePath: program.filePath,
        nodeType: 'ANALYZED',
        callCount: 0,
        callerCount: 0
      });
    }

    // Build edges from external calls
    for (const program of programResults) {
      const callerId = program.programId || program.fileName;
      callers.add(callerId);

      for (const call of program.externalCalls || []) {
        const calleeId = call.programName;
        callees.add(calleeId);

        // Create node for external program if not exists
        if (!nodeMap.has(calleeId)) {
          nodeMap.set(calleeId, {
            programId: calleeId,
            programName: calleeId,
            nodeType: 'EXTERNAL',
            callCount: 0,
            callerCount: 0
          });
        }

        // Create edge
        callGraph.edges.push({
          caller: callerId,
          callee: calleeId,
          callType: call.programName.includes('WS-') ? 'DYNAMIC' : 'STATIC',
          lineNumber: call.lineNumber,
          paragraphName: call.paragraphName
        });

        // Update counts
        nodeMap.get(callerId)!.callCount++;
        nodeMap.get(calleeId)!.callerCount++;
      }
    }

    // Identify root and leaf programs
    for (const [programId, node] of nodeMap) {
      if (!callees.has(programId)) {
        callGraph.rootPrograms.push(programId);
      }
      if (node.callCount === 0) {
        callGraph.leafPrograms.push(programId);
      }
    }

    callGraph.nodes = Array.from(nodeMap.values());
  }

  /**
   * Build JCL ↔ program references
   */
  private buildJclProgramReferences(
    jclResults: JclAnalysisResult[],
    programResults: CobolBusinessLogicResult[],
    crossReferences: CrossReferenceMap
  ): void {
    const programNames = new Set(programResults.map(p =>
      (p.programId || p.fileName).toUpperCase()
    ));

    for (const jcl of jclResults) {
      for (const execution of jcl.programExecutions) {
        const programName = execution.programName.toUpperCase();

        if (!crossReferences.jclToProgramMap.has(programName)) {
          crossReferences.jclToProgramMap.set(programName, []);
        }

        crossReferences.jclToProgramMap.get(programName)!.push({
          jobName: execution.jobName,
          stepName: execution.stepName,
          executionOrder: execution.executionOrder,
          inputDatasets: execution.inputDatasets,
          outputDatasets: execution.outputDatasets,
          parameters: execution.parameters
        });
      }
    }
  }

  /**
   * Build entity ↔ program references
   */
  private buildEntityProgramReferences(
    programResults: CobolBusinessLogicResult[],
    copybookResults: CopybookAnalysisResult[],
    crossReferences: CrossReferenceMap
  ): void {
    // Build entity map from copybooks
    const entityMap = new Map<string, InferredEntity>();
    for (const copybook of copybookResults) {
      if (copybook.inferredEntity) {
        entityMap.set(copybook.inferredEntity.entityName.toUpperCase(), copybook.inferredEntity);
      }
    }

    // Map database tables to entities
    for (const program of programResults) {
      const programId = program.programId || program.fileName;
      const entityRefs: string[] = [];

      for (const dbAccess of program.databaseAccess || []) {
        const tableName = dbAccess.tableName.toUpperCase();

        if (!crossReferences.entityToPrograms.has(tableName)) {
          crossReferences.entityToPrograms.set(tableName, []);
        }

        // Determine access type
        let accessType: EntityProgramReference['accessType'] = 'READ';
        switch (dbAccess.operation) {
          case 'SELECT': accessType = 'READ'; break;
          case 'INSERT': accessType = 'WRITE'; break;
          case 'UPDATE': accessType = 'UPDATE'; break;
          case 'DELETE': accessType = 'DELETE'; break;
          default: accessType = 'MIXED';
        }

        // Check if reference already exists for this program
        const existingRef = crossReferences.entityToPrograms.get(tableName)!
          .find(r => r.programId === programId);

        if (existingRef) {
          existingRef.accessCount++;
          if (!existingRef.paragraphs.includes(dbAccess.paragraphName)) {
            existingRef.paragraphs.push(dbAccess.paragraphName);
          }
          if (existingRef.accessType !== accessType) {
            existingRef.accessType = 'MIXED';
          }
        } else {
          crossReferences.entityToPrograms.get(tableName)!.push({
            programId,
            accessType,
            accessCount: 1,
            paragraphs: [dbAccess.paragraphName]
          });
        }

        if (!entityRefs.includes(tableName)) {
          entityRefs.push(tableName);
        }
      }

      // Also map file accesses to entities (VSAM files)
      for (const file of program.files || []) {
        const fileName = file.fileName?.toUpperCase() || file.variableName?.toUpperCase();
        if (!fileName) continue;

        if (!crossReferences.entityToPrograms.has(fileName)) {
          crossReferences.entityToPrograms.set(fileName, []);
        }

        const accessType: EntityProgramReference['accessType'] =
          file.accessType === 'INPUT' ? 'READ' :
          file.accessType === 'OUTPUT' ? 'WRITE' :
          file.accessType === 'I-O' ? 'MIXED' : 'READ';

        crossReferences.entityToPrograms.get(fileName)!.push({
          programId,
          accessType,
          accessCount: file.operations?.length || 1,
          paragraphs: []
        });

        if (!entityRefs.includes(fileName)) {
          entityRefs.push(fileName);
        }
      }

      crossReferences.programToEntities.set(programId, entityRefs);
    }
  }

  /**
   * Build dataset ↔ program references from JCL
   */
  private buildDatasetProgramReferences(
    jclResults: JclAnalysisResult[],
    crossReferences: CrossReferenceMap
  ): void {
    for (const jcl of jclResults) {
      for (const dsRef of jcl.datasetReferences) {
        const datasetName = dsRef.datasetName;

        if (!crossReferences.datasetToPrograms.has(datasetName)) {
          crossReferences.datasetToPrograms.set(datasetName, []);
        }

        for (const programName of dsRef.usedByPrograms) {
          crossReferences.datasetToPrograms.get(datasetName)!.push({
            programId: programName,
            accessMode: dsRef.accessMode,
            jclSteps: dsRef.usedInSteps
          });
        }
      }
    }
  }

  /**
   * Calculate cross-reference statistics
   */
  private calculateStatistics(
    crossReferences: CrossReferenceMap,
    programResults: CobolBusinessLogicResult[],
    copybookResults: CopybookAnalysisResult[],
    jclResults: JclAnalysisResult[]
  ): CrossReferenceStatistics {
    const totalPrograms = programResults.length;
    const totalCopybooks = copybookResults.length;
    const totalJclJobs = jclResults.reduce((sum, j) => sum + j.jobs.length, 0);
    const totalEntities = crossReferences.entityToPrograms.size;
    const totalCallRelationships = crossReferences.programCallGraph.edges.length;

    // Calculate averages
    let totalCopybooksUsed = 0;
    for (const copybooks of crossReferences.programToCopybooks.values()) {
      totalCopybooksUsed += copybooks.length;
    }

    const averageCopybooksPerProgram = totalPrograms > 0
      ? Math.round((totalCopybooksUsed / totalPrograms) * 100) / 100
      : 0;

    const totalCalls = crossReferences.programCallGraph.nodes.reduce((sum, n) => sum + n.callCount, 0);
    const averageCallsPerProgram = totalPrograms > 0
      ? Math.round((totalCalls / totalPrograms) * 100) / 100
      : 0;

    // Calculate max call depth
    const maxCallDepth = this.calculateMaxCallDepth(crossReferences.programCallGraph);

    return {
      totalPrograms,
      totalCopybooks,
      totalJclJobs,
      totalEntities,
      totalCallRelationships,
      averageCopybooksPerProgram,
      averageCallsPerProgram,
      maxCallDepth
    };
  }

  /**
   * Calculate maximum call depth in the call graph
   */
  private calculateMaxCallDepth(callGraph: ProgramCallGraph): number {
    const depths = new Map<string, number>();

    const getDepth = (programId: string, visited: Set<string>): number => {
      if (visited.has(programId)) return 0;  // Cycle detection
      if (depths.has(programId)) return depths.get(programId)!;

      visited.add(programId);

      const outgoingEdges = callGraph.edges.filter(e => e.caller === programId);
      if (outgoingEdges.length === 0) {
        depths.set(programId, 0);
        return 0;
      }

      let maxChildDepth = 0;
      for (const edge of outgoingEdges) {
        const childDepth = getDepth(edge.callee, visited);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }

      const depth = maxChildDepth + 1;
      depths.set(programId, depth);
      return depth;
    };

    let maxDepth = 0;
    for (const root of callGraph.rootPrograms) {
      const depth = getDepth(root, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  /**
   * Find orphaned entities (defined but not used)
   */
  private findOrphanedEntities(
    crossReferences: CrossReferenceMap,
    copybookResults: CopybookAnalysisResult[]
  ): OrphanedEntity[] {
    const orphaned: OrphanedEntity[] = [];

    for (const copybook of copybookResults) {
      if (copybook.inferredEntity) {
        const entityName = copybook.inferredEntity.entityName.toUpperCase();
        const references = crossReferences.entityToPrograms.get(entityName);

        if (!references || references.length === 0) {
          orphaned.push({
            entityName: copybook.inferredEntity.entityName,
            entityType: copybook.inferredEntity.entityType,
            source: copybook.fileName,
            reason: 'No program references this entity'
          });
        }
      }

      // Check copybooks not used by any program
      const copybookName = copybook.fileName.replace(/\.(cpy|CPY)$/i, '').toUpperCase();
      const programs = crossReferences.copybookToPrograms.get(copybookName);

      if (!programs || programs.length === 0) {
        orphaned.push({
          entityName: copybookName,
          entityType: 'COPYBOOK',
          source: copybook.fileName,
          reason: 'Copybook not included by any program'
        });
      }
    }

    return orphaned;
  }

  /**
   * Find unreferenced programs (not called and not in JCL)
   */
  private findUnreferencedPrograms(
    crossReferences: CrossReferenceMap,
    programResults: CobolBusinessLogicResult[],
    jclResults: JclAnalysisResult[]
  ): string[] {
    const unreferenced: string[] = [];

    // Get all programs referenced in JCL
    const jclPrograms = new Set<string>();
    for (const jcl of jclResults) {
      for (const exec of jcl.programExecutions) {
        jclPrograms.add(exec.programName.toUpperCase());
      }
    }

    // Get all programs that are called by other programs
    const calledPrograms = new Set<string>();
    for (const edge of crossReferences.programCallGraph.edges) {
      calledPrograms.add(edge.callee.toUpperCase());
    }

    for (const program of programResults) {
      const programId = (program.programId || program.fileName).toUpperCase();

      if (!jclPrograms.has(programId) && !calledPrograms.has(programId)) {
        unreferenced.push(programId);
      }
    }

    return unreferenced;
  }

  /**
   * Get readable cross-reference report
   */
  getReadableReport(result: CrossReferenceResult): string {
    const lines: string[] = [];

    lines.push('# Cross-Reference Report');
    lines.push('');
    lines.push('## Statistics');
    lines.push(`- Total Programs: ${result.statistics.totalPrograms}`);
    lines.push(`- Total Copybooks: ${result.statistics.totalCopybooks}`);
    lines.push(`- Total JCL Jobs: ${result.statistics.totalJclJobs}`);
    lines.push(`- Total Entities: ${result.statistics.totalEntities}`);
    lines.push(`- Total Call Relationships: ${result.statistics.totalCallRelationships}`);
    lines.push(`- Average Copybooks per Program: ${result.statistics.averageCopybooksPerProgram}`);
    lines.push(`- Average Calls per Program: ${result.statistics.averageCallsPerProgram}`);
    lines.push(`- Maximum Call Depth: ${result.statistics.maxCallDepth}`);
    lines.push('');

    if (result.orphanedEntities.length > 0) {
      lines.push('## Orphaned Entities');
      for (const entity of result.orphanedEntities) {
        lines.push(`- ${entity.entityName} (${entity.entityType}): ${entity.reason}`);
      }
      lines.push('');
    }

    if (result.unreferencedPrograms.length > 0) {
      lines.push('## Unreferenced Programs');
      for (const program of result.unreferencedPrograms) {
        lines.push(`- ${program}`);
      }
      lines.push('');
    }

    lines.push('## Call Graph');
    lines.push('Root Programs (Entry Points):');
    for (const root of result.crossReferences.programCallGraph.rootPrograms) {
      lines.push(`  - ${root}`);
    }
    lines.push('');

    return lines.join('\n');
  }
}

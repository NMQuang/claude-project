/**
 * Business Draft Generator
 *
 * Transforms SOURCE_ANALYSIS.md data into BUSINESS_DRAFT_v1.md
 * This is a controlled transition from source analysis to initial business understanding.
 *
 * Key Philosophy:
 * - Explicitly separate FACTS and BUSINESS HYPOTHESES
 * - Preserve all uncertainty from SOURCE_ANALYSIS.md
 * - Carry forward Open Questions unchanged
 * - Avoid migration, to-be design, or refactoring discussion
 * - CONSERVATIVE interpretation only
 */

import {
  SourceAnalysisResult,
  ProgramInventoryEntry,
  PersistentDataStructure,
  DataAccessObservation,
  JclExecutionRelationship,
  ObservedFact,
  OpenQuestion
} from '../analyzers/SourceAnalyzer.js';

// ============================================================================
// Interfaces - Business Draft
// ============================================================================

/**
 * Confirmed fact extracted directly from SOURCE_ANALYSIS
 */
export interface ConfirmedFact {
  factId: string;
  category: 'INVENTORY' | 'DATA_STRUCTURE' | 'DATA_ACCESS' | 'EXECUTION_FLOW' | 'TECHNOLOGY';
  statement: string;
  sourceReference: string;  // Reference to SOURCE_ANALYSIS section
  evidenceCount: number;
}

/**
 * Business hypothesis - tentative interpretation
 */
export interface BusinessHypothesis {
  hypothesisId: string;
  category: 'BUSINESS_ENTITY' | 'BUSINESS_PROCESS' | 'DATA_FLOW' | 'INTEGRATION_POINT';
  hypothesis: string;
  confidenceLevel: 'LOW' | 'MEDIUM';  // Never HIGH - this is intentionally conservative
  supportingPatterns: string[];
  derivedFrom: string[];  // References to confirmed facts
  requiresValidation: string;  // What needs to be validated
}

/**
 * Evidence mapping entry
 */
export interface EvidenceMapping {
  hypothesisId: string;
  factIds: string[];
  patternDescription: string;
  gapIdentified?: string;
}

/**
 * Parallel implementation consideration
 */
export interface ParallelConsideration {
  considerationId: string;
  category: 'SHARED_DATA' | 'SEQUENCE_DEPENDENCY' | 'BATCH_ONLINE_BOUNDARY' | 'EXTERNAL_INTERFACE';
  observation: string;
  affectedComponents: string[];
  sourceEvidence: string;
}

/**
 * Risk of misinterpretation
 */
export interface MisinterpretationRisk {
  riskId: string;
  area: string;
  potentialMisinterpretation: string;
  correctInterpretation: string;
  guidance: string;
}

/**
 * Main Business Draft result
 */
export interface BusinessDraftResult {
  section0_scopeAssumptions: {
    analysisScope: string;
    sourceAnalysisReference: string;
    assumptions: string[];
    limitations: string[];
    generatedAt: string;
  };
  section1_confirmedFacts: ConfirmedFact[];
  section2_businessHypotheses: BusinessHypothesis[];
  section3_evidenceMapping: EvidenceMapping[];
  section4_parallelConsiderations: ParallelConsideration[];
  section5_openQuestions: OpenQuestion[];  // Unchanged from SOURCE_ANALYSIS
  section6_misinterpretationRisks: MisinterpretationRisk[];
  validationResult: ValidationResult;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  location?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  location?: string;
}

// ============================================================================
// Forbidden Keywords - Migration-related terms that should NOT appear
// ============================================================================

const FORBIDDEN_MIGRATION_KEYWORDS = [
  'migrate', 'migration', 'migrating',
  'convert', 'conversion', 'converting',
  'transform', 'transformation', 'transforming',
  'modernize', 'modernization', 'modernizing',
  'refactor', 'refactoring',
  'rewrite', 'rewriting',
  'replace', 'replacement', 'replacing',
  'to-be', 'target', 'future state',
  'java', 'spring', 'microservice',  // Target technology names
  'cloud', 'aws', 'azure', 'kubernetes',
  'should be', 'will be', 'must be changed',
  'suggest', 'propose change'
];

// ============================================================================
// Main Generator Class
// ============================================================================

export class BusinessDraftGenerator {

  /**
   * Generate Business Draft from Source Analysis
   */
  generateBusinessDraft(sourceAnalysis: SourceAnalysisResult, projectName: string): BusinessDraftResult {
    // Section 0: Scope & Assumptions
    const section0 = this.buildScopeAssumptions(sourceAnalysis, projectName);

    // Section 1: Confirmed Facts (from SOURCE_ANALYSIS.md)
    const section1 = this.extractConfirmedFacts(sourceAnalysis);

    // Section 2: Proposed Business Hypotheses (clearly labeled)
    const section2 = this.generateBusinessHypotheses(sourceAnalysis, section1);

    // Section 3: Supporting Evidence Mapping
    const section3 = this.buildEvidenceMapping(section1, section2);

    // Section 4: Parallel Implementation Considerations
    const section4 = this.identifyParallelConsiderations(sourceAnalysis);

    // Section 5: Open Questions (unchanged from SOURCE_ANALYSIS)
    const section5 = sourceAnalysis.section5_observationsAndQuestions.openQuestions;

    // Section 6: Risks of Misinterpretation
    const section6 = this.identifyMisinterpretationRisks(sourceAnalysis, section2);

    // Build result
    const result: BusinessDraftResult = {
      section0_scopeAssumptions: section0,
      section1_confirmedFacts: section1,
      section2_businessHypotheses: section2,
      section3_evidenceMapping: section3,
      section4_parallelConsiderations: section4,
      section5_openQuestions: section5,
      section6_misinterpretationRisks: section6,
      validationResult: { isValid: true, errors: [], warnings: [] }
    };

    // Validate the generated document
    result.validationResult = this.validateBusinessDraft(result, sourceAnalysis);

    return result;
  }

  /**
   * Section 0: Build scope and assumptions
   */
  private buildScopeAssumptions(sourceAnalysis: SourceAnalysisResult, projectName: string): BusinessDraftResult['section0_scopeAssumptions'] {
    const inventory = sourceAnalysis.section0_scopeSummary.fileInventory;

    return {
      analysisScope: `This Business Draft covers ${inventory.cobolPrograms} COBOL program(s), ${inventory.copybooks} copybook(s), ${inventory.jclFiles} JCL file(s), and ${inventory.ddlFiles} DDL file(s) from project "${projectName}".`,
      sourceAnalysisReference: `SOURCE_ANALYSIS.md (generated at ${sourceAnalysis.section0_scopeSummary.analysisTimestamp})`,
      assumptions: [
        'All business interpretations in this document are HYPOTHESES requiring validation',
        'No source code re-analysis was performed; all facts are derived from SOURCE_ANALYSIS.md',
        'Business process names are tentative labels based on observed patterns only',
        'This document is intended for human review and validation, not as final documentation'
      ],
      limitations: [
        'Business purpose cannot be determined from code structure alone',
        'External system integrations may exist beyond the analyzed scope',
        'Runtime behavior and configuration are not observable from static analysis',
        `${sourceAnalysis.section5_observationsAndQuestions.openQuestions.length} open question(s) remain unresolved from source analysis`
      ],
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Section 1: Extract confirmed facts from source analysis
   */
  private extractConfirmedFacts(sourceAnalysis: SourceAnalysisResult): ConfirmedFact[] {
    const facts: ConfirmedFact[] = [];
    let factCounter = 0;

    // Inventory facts
    const inv = sourceAnalysis.section0_scopeSummary.fileInventory;
    if (inv.cobolPrograms > 0) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'INVENTORY',
        statement: `${inv.cobolPrograms} COBOL program(s) identified with total ${inv.totalLinesOfCode} lines of code`,
        sourceReference: 'SOURCE_ANALYSIS Section 0: Scope Summary',
        evidenceCount: inv.cobolPrograms
      });
    }

    if (inv.copybooks > 0) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'INVENTORY',
        statement: `${inv.copybooks} copybook(s) defining data structures`,
        sourceReference: 'SOURCE_ANALYSIS Section 0: Scope Summary',
        evidenceCount: inv.copybooks
      });
    }

    if (inv.jclFiles > 0) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'EXECUTION_FLOW',
        statement: `${inv.jclFiles} JCL file(s) defining batch execution flow`,
        sourceReference: 'SOURCE_ANALYSIS Section 0: Scope Summary',
        evidenceCount: inv.jclFiles
      });
    }

    // Technology facts
    for (const tech of sourceAnalysis.section0_scopeSummary.detectedTechnologies) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'TECHNOLOGY',
        statement: `Technology detected: ${tech.technology} (${tech.occurrenceCount} occurrence(s))`,
        sourceReference: 'SOURCE_ANALYSIS Section 0: Detected Technologies',
        evidenceCount: tech.occurrenceCount
      });
    }

    // Data structure facts
    const dataStructures = sourceAnalysis.section2_persistentDataStructures;
    const vsamStructures = dataStructures.filter(ds => ds.storageType === 'VSAM_FILE');
    const dbTables = dataStructures.filter(ds => ds.storageType === 'DATABASE_TABLE');

    if (vsamStructures.length > 0) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'DATA_STRUCTURE',
        statement: `${vsamStructures.length} VSAM file structure(s) identified: ${vsamStructures.map(v => v.structureName).join(', ')}`,
        sourceReference: 'SOURCE_ANALYSIS Section 2: Persistent Data Structures',
        evidenceCount: vsamStructures.length
      });
    }

    if (dbTables.length > 0) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'DATA_STRUCTURE',
        statement: `${dbTables.length} database table(s) accessed: ${dbTables.map(t => t.structureName).join(', ')}`,
        sourceReference: 'SOURCE_ANALYSIS Section 2: Persistent Data Structures',
        evidenceCount: dbTables.length
      });
    }

    // Execution pattern facts
    const programs = sourceAnalysis.section1_programInventory;
    const batchPrograms = programs.filter(p => p.observedExecutionPattern === 'BATCH_INDICATED');
    const onlinePrograms = programs.filter(p => p.observedExecutionPattern === 'ONLINE_INDICATED');

    if (batchPrograms.length > 0) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'EXECUTION_FLOW',
        statement: `${batchPrograms.length} program(s) show batch execution indicators`,
        sourceReference: 'SOURCE_ANALYSIS Section 1: Program Inventory',
        evidenceCount: batchPrograms.length
      });
    }

    if (onlinePrograms.length > 0) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'EXECUTION_FLOW',
        statement: `${onlinePrograms.length} program(s) show online/CICS execution indicators`,
        sourceReference: 'SOURCE_ANALYSIS Section 1: Program Inventory',
        evidenceCount: onlinePrograms.length
      });
    }

    // Data access facts
    const dataAccessPatterns = sourceAnalysis.section3_dataAccessPatterns;
    const sqlAccess = dataAccessPatterns.filter(da => da.accessType === 'SQL');
    const fileAccess = dataAccessPatterns.filter(da => da.accessType === 'FILE_IO');

    if (sqlAccess.length > 0) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'DATA_ACCESS',
        statement: `${sqlAccess.length} SQL data access operation(s) observed`,
        sourceReference: 'SOURCE_ANALYSIS Section 3: Data Access Patterns',
        evidenceCount: sqlAccess.length
      });
    }

    if (fileAccess.length > 0) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'DATA_ACCESS',
        statement: `${fileAccess.length} file I/O operation(s) observed`,
        sourceReference: 'SOURCE_ANALYSIS Section 3: Data Access Patterns',
        evidenceCount: fileAccess.length
      });
    }

    // JCL execution facts
    const jclRelationships = sourceAnalysis.section4_jclExecutionRelationships;
    if (jclRelationships.length > 0) {
      factCounter++;
      const totalSteps = jclRelationships.reduce((sum, j) => sum + j.stepSequence.length, 0);
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: 'EXECUTION_FLOW',
        statement: `${jclRelationships.length} JCL job(s) with total ${totalSteps} execution step(s)`,
        sourceReference: 'SOURCE_ANALYSIS Section 4: JCL Execution Relationships',
        evidenceCount: jclRelationships.length
      });
    }

    // Include observed facts from source analysis
    for (const obs of sourceAnalysis.section5_observationsAndQuestions.observations) {
      factCounter++;
      facts.push({
        factId: `FACT-${factCounter.toString().padStart(3, '0')}`,
        category: obs.category === 'PATTERN' ? 'DATA_ACCESS' :
                 obs.category === 'STRUCTURE' ? 'DATA_STRUCTURE' : 'EXECUTION_FLOW',
        statement: obs.observation,
        sourceReference: 'SOURCE_ANALYSIS Section 5: Observations',
        evidenceCount: obs.evidence.length
      });
    }

    return facts;
  }

  /**
   * Section 2: Generate business hypotheses (TENTATIVE only)
   */
  private generateBusinessHypotheses(
    sourceAnalysis: SourceAnalysisResult,
    confirmedFacts: ConfirmedFact[]
  ): BusinessHypothesis[] {
    const hypotheses: BusinessHypothesis[] = [];
    let hypothesisCounter = 0;

    // Hypothesis from data structures with multiple accessors
    const sharedStructures = sourceAnalysis.section2_persistentDataStructures
      .filter(ds => ds.referencedByPrograms.length >= 2);

    for (const structure of sharedStructures) {
      hypothesisCounter++;
      const accessorPrograms = structure.referencedByPrograms.map(r => r.programId);

      hypotheses.push({
        hypothesisId: `HYP-${hypothesisCounter.toString().padStart(3, '0')}`,
        category: 'BUSINESS_ENTITY',
        hypothesis: `"${structure.structureName}" may represent a shared business entity accessed by multiple processes`,
        confidenceLevel: structure.referencedByPrograms.length >= 3 ? 'MEDIUM' : 'LOW',
        supportingPatterns: [
          `Accessed by ${structure.referencedByPrograms.length} different program(s)`,
          `Access types include: ${[...new Set(structure.referencedByPrograms.map(r => r.accessType))].join(', ')}`
        ],
        derivedFrom: confirmedFacts
          .filter(f => f.category === 'DATA_STRUCTURE')
          .map(f => f.factId),
        requiresValidation: `Confirm if "${structure.structureName}" represents a distinct business entity and identify its business name`
      });
    }

    // Hypothesis from JCL execution sequences
    for (const jcl of sourceAnalysis.section4_jclExecutionRelationships) {
      if (jcl.stepSequence.length >= 2) {
        hypothesisCounter++;

        hypotheses.push({
          hypothesisId: `HYP-${hypothesisCounter.toString().padStart(3, '0')}`,
          category: 'BUSINESS_PROCESS',
          hypothesis: `JCL job "${jcl.jobName}" may represent a batch business process with ${jcl.stepSequence.length} sequential steps`,
          confidenceLevel: 'LOW',
          supportingPatterns: [
            `Executes programs: ${jcl.stepSequence.map(s => s.executedProgram).join(' → ')}`,
            `Uses datasets: ${jcl.datasetReferences.slice(0, 3).map(d => d.datasetName).join(', ')}${jcl.datasetReferences.length > 3 ? '...' : ''}`
          ],
          derivedFrom: confirmedFacts
            .filter(f => f.category === 'EXECUTION_FLOW')
            .map(f => f.factId),
          requiresValidation: `Confirm the business purpose of job "${jcl.jobName}" and when it is scheduled to run`
        });
      }
    }

    // Hypothesis from program call chains
    const programsWithCalls = sourceAnalysis.section1_programInventory
      .filter(p => p.externalCallsDetected.length > 0);

    for (const program of programsWithCalls) {
      if (program.externalCallsDetected.length >= 2) {
        hypothesisCounter++;

        hypotheses.push({
          hypothesisId: `HYP-${hypothesisCounter.toString().padStart(3, '0')}`,
          category: 'BUSINESS_PROCESS',
          hypothesis: `Program "${program.programId}" may orchestrate a multi-step operation calling ${program.externalCallsDetected.length} subprogram(s)`,
          confidenceLevel: 'LOW',
          supportingPatterns: [
            `Calls: ${program.externalCallsDetected.map(c => c.targetProgram).join(', ')}`,
            `Execution pattern: ${program.observedExecutionPattern}`
          ],
          derivedFrom: confirmedFacts
            .filter(f => f.statement.includes(program.programId) || f.category === 'EXECUTION_FLOW')
            .map(f => f.factId),
          requiresValidation: `Confirm the business function performed by "${program.programId}" and its subprograms`
        });
      }
    }

    // Hypothesis from data flow (input → processing → output)
    const inputDatasets = new Set<string>();
    const outputDatasets = new Set<string>();

    for (const jcl of sourceAnalysis.section4_jclExecutionRelationships) {
      for (const ds of jcl.datasetReferences) {
        if (ds.accessMode === 'INPUT') inputDatasets.add(ds.datasetName);
        if (ds.accessMode === 'OUTPUT') outputDatasets.add(ds.datasetName);
      }
    }

    if (inputDatasets.size > 0 && outputDatasets.size > 0) {
      hypothesisCounter++;
      hypotheses.push({
        hypothesisId: `HYP-${hypothesisCounter.toString().padStart(3, '0')}`,
        category: 'DATA_FLOW',
        hypothesis: `Data flow pattern detected: ${inputDatasets.size} input source(s) → processing → ${outputDatasets.size} output target(s)`,
        confidenceLevel: 'LOW',
        supportingPatterns: [
          `Input datasets: ${Array.from(inputDatasets).slice(0, 3).join(', ')}${inputDatasets.size > 3 ? '...' : ''}`,
          `Output datasets: ${Array.from(outputDatasets).slice(0, 3).join(', ')}${outputDatasets.size > 3 ? '...' : ''}`
        ],
        derivedFrom: confirmedFacts
          .filter(f => f.category === 'EXECUTION_FLOW' || f.category === 'DATA_ACCESS')
          .map(f => f.factId),
        requiresValidation: 'Confirm the business meaning of input/output datasets and the transformation performed'
      });
    }

    // Hypothesis from batch vs online split
    const batchCount = sourceAnalysis.section1_programInventory
      .filter(p => p.observedExecutionPattern === 'BATCH_INDICATED').length;
    const onlineCount = sourceAnalysis.section1_programInventory
      .filter(p => p.observedExecutionPattern === 'ONLINE_INDICATED').length;

    if (batchCount > 0 && onlineCount > 0) {
      hypothesisCounter++;
      hypotheses.push({
        hypothesisId: `HYP-${hypothesisCounter.toString().padStart(3, '0')}`,
        category: 'INTEGRATION_POINT',
        hypothesis: `System may have both batch (${batchCount} programs) and online (${onlineCount} programs) components with potential interaction points`,
        confidenceLevel: 'LOW',
        supportingPatterns: [
          `Batch programs typically process files and run scheduled`,
          `Online programs typically interact with users via CICS`
        ],
        derivedFrom: confirmedFacts
          .filter(f => f.category === 'EXECUTION_FLOW')
          .map(f => f.factId),
        requiresValidation: 'Confirm how batch and online components interact and share data'
      });
    }

    return hypotheses;
  }

  /**
   * Section 3: Build evidence mapping
   */
  private buildEvidenceMapping(
    confirmedFacts: ConfirmedFact[],
    hypotheses: BusinessHypothesis[]
  ): EvidenceMapping[] {
    const mappings: EvidenceMapping[] = [];

    for (const hypothesis of hypotheses) {
      const relatedFacts = confirmedFacts.filter(f =>
        hypothesis.derivedFrom.includes(f.factId)
      );

      const gaps: string[] = [];

      // Identify gaps based on hypothesis category
      if (hypothesis.category === 'BUSINESS_ENTITY') {
        gaps.push('Business name and purpose not determinable from code');
      }
      if (hypothesis.category === 'BUSINESS_PROCESS') {
        gaps.push('Process trigger conditions and scheduling not visible in code');
      }
      if (hypothesis.category === 'DATA_FLOW') {
        gaps.push('Business meaning of data transformation not determinable');
      }
      if (hypothesis.category === 'INTEGRATION_POINT') {
        gaps.push('Timing and coordination mechanism not visible in static analysis');
      }

      mappings.push({
        hypothesisId: hypothesis.hypothesisId,
        factIds: relatedFacts.map(f => f.factId),
        patternDescription: hypothesis.supportingPatterns.join('; '),
        gapIdentified: gaps.length > 0 ? gaps[0] : undefined
      });
    }

    return mappings;
  }

  /**
   * Section 4: Identify parallel implementation considerations
   */
  private identifyParallelConsiderations(sourceAnalysis: SourceAnalysisResult): ParallelConsideration[] {
    const considerations: ParallelConsideration[] = [];
    let considerationCounter = 0;

    // Shared data considerations
    const sharedStructures = sourceAnalysis.section2_persistentDataStructures
      .filter(ds => ds.referencedByPrograms.length >= 2);

    for (const structure of sharedStructures) {
      considerationCounter++;
      considerations.push({
        considerationId: `PAR-${considerationCounter.toString().padStart(3, '0')}`,
        category: 'SHARED_DATA',
        observation: `"${structure.structureName}" is accessed by ${structure.referencedByPrograms.length} programs - parallel work on these programs requires data structure coordination`,
        affectedComponents: structure.referencedByPrograms.map(r => r.programId),
        sourceEvidence: `SOURCE_ANALYSIS Section 2: ${structure.structureId}`
      });
    }

    // Sequence dependency considerations
    for (const jcl of sourceAnalysis.section4_jclExecutionRelationships) {
      if (jcl.stepSequence.length >= 2) {
        // Check for output-to-input dependencies
        const outputToInput: string[] = [];
        for (let i = 0; i < jcl.stepSequence.length - 1; i++) {
          const currentOutputs = jcl.stepSequence[i].outputDatasets;
          const nextInputs = jcl.stepSequence[i + 1].inputDatasets;
          const overlap = currentOutputs.filter(o => nextInputs.includes(o));
          if (overlap.length > 0) {
            outputToInput.push(`Step ${i + 1} → Step ${i + 2} via ${overlap.join(', ')}`);
          }
        }

        if (outputToInput.length > 0) {
          considerationCounter++;
          considerations.push({
            considerationId: `PAR-${considerationCounter.toString().padStart(3, '0')}`,
            category: 'SEQUENCE_DEPENDENCY',
            observation: `Job "${jcl.jobName}" has step-to-step data dependencies: ${outputToInput.join('; ')}`,
            affectedComponents: jcl.stepSequence.map(s => s.executedProgram),
            sourceEvidence: `SOURCE_ANALYSIS Section 4: ${jcl.jobName}`
          });
        }
      }
    }

    // Batch-online boundary considerations
    const batchPrograms = sourceAnalysis.section1_programInventory
      .filter(p => p.observedExecutionPattern === 'BATCH_INDICATED')
      .map(p => p.programId);
    const onlinePrograms = sourceAnalysis.section1_programInventory
      .filter(p => p.observedExecutionPattern === 'ONLINE_INDICATED')
      .map(p => p.programId);

    if (batchPrograms.length > 0 && onlinePrograms.length > 0) {
      // Check for shared data between batch and online
      for (const structure of sourceAnalysis.section2_persistentDataStructures) {
        const batchAccessors = structure.referencedByPrograms
          .filter(r => batchPrograms.includes(r.programId));
        const onlineAccessors = structure.referencedByPrograms
          .filter(r => onlinePrograms.includes(r.programId));

        if (batchAccessors.length > 0 && onlineAccessors.length > 0) {
          considerationCounter++;
          considerations.push({
            considerationId: `PAR-${considerationCounter.toString().padStart(3, '0')}`,
            category: 'BATCH_ONLINE_BOUNDARY',
            observation: `"${structure.structureName}" is accessed by both batch and online programs - concurrent access considerations needed`,
            affectedComponents: [
              ...batchAccessors.map(r => `${r.programId} (batch)`),
              ...onlineAccessors.map(r => `${r.programId} (online)`)
            ],
            sourceEvidence: `SOURCE_ANALYSIS Section 2: ${structure.structureId}`
          });
        }
      }
    }

    // External interface considerations (programs called but not in scope)
    const allPrograms = new Set(sourceAnalysis.section1_programInventory.map(p => p.programId));
    const externalCalls: string[] = [];

    for (const program of sourceAnalysis.section1_programInventory) {
      for (const call of program.externalCallsDetected) {
        if (!allPrograms.has(call.targetProgram)) {
          externalCalls.push(`${program.programId} → ${call.targetProgram}`);
        }
      }
    }

    if (externalCalls.length > 0) {
      considerationCounter++;
      considerations.push({
        considerationId: `PAR-${considerationCounter.toString().padStart(3, '0')}`,
        category: 'EXTERNAL_INTERFACE',
        observation: `${externalCalls.length} call(s) to external programs not in analysis scope: ${externalCalls.slice(0, 5).join(', ')}${externalCalls.length > 5 ? '...' : ''}`,
        affectedComponents: [...new Set(externalCalls.map(c => c.split(' → ')[0]))],
        sourceEvidence: 'SOURCE_ANALYSIS Section 5: Open Questions (Missing Source)'
      });
    }

    return considerations;
  }

  /**
   * Section 6: Identify misinterpretation risks
   */
  private identifyMisinterpretationRisks(
    sourceAnalysis: SourceAnalysisResult,
    hypotheses: BusinessHypothesis[]
  ): MisinterpretationRisk[] {
    const risks: MisinterpretationRisk[] = [];
    let riskCounter = 0;

    // Risk: Assuming technical names are business names
    const technicalNames = sourceAnalysis.section2_persistentDataStructures
      .map(ds => ds.structureName)
      .filter(name => /^[A-Z]{2,3}[-_]?\d{2,3}[-_]?[A-Z]*/.test(name));

    if (technicalNames.length > 0) {
      riskCounter++;
      risks.push({
        riskId: `RISK-${riskCounter.toString().padStart(3, '0')}`,
        area: 'Data Structure Naming',
        potentialMisinterpretation: `Technical names like "${technicalNames[0]}" may be mistaken for business entity names`,
        correctInterpretation: 'These are technical identifiers; actual business names must be obtained from documentation or SMEs',
        guidance: 'Create a mapping table between technical names and business names during validation'
      });
    }

    // Risk: Assuming program names indicate business function
    const crypticProgramNames = sourceAnalysis.section1_programInventory
      .filter(p => p.programId.length <= 8 && /^[A-Z]{1,4}\d{2,4}$/.test(p.programId));

    if (crypticProgramNames.length > 0) {
      riskCounter++;
      risks.push({
        riskId: `RISK-${riskCounter.toString().padStart(3, '0')}`,
        area: 'Program Identification',
        potentialMisinterpretation: `Program names like "${crypticProgramNames[0].programId}" do not indicate business function`,
        correctInterpretation: 'Program names follow technical conventions; business purpose must be determined separately',
        guidance: 'Document business purpose for each program based on SME interviews or existing documentation'
      });
    }

    // Risk: Assuming JCL job names are business process names
    if (sourceAnalysis.section4_jclExecutionRelationships.length > 0) {
      riskCounter++;
      risks.push({
        riskId: `RISK-${riskCounter.toString().padStart(3, '0')}`,
        area: 'Batch Process Identification',
        potentialMisinterpretation: 'JCL job names may be mistaken for business process names',
        correctInterpretation: 'JCL job names are technical identifiers; they may not reflect business terminology',
        guidance: 'Map each JCL job to its business process name and scheduling requirements'
      });
    }

    // Risk: Missing external dependencies
    const openQuestions = sourceAnalysis.section5_observationsAndQuestions.openQuestions;
    const missingSourceQuestions = openQuestions.filter(q => q.category === 'MISSING_SOURCE');

    if (missingSourceQuestions.length > 0) {
      riskCounter++;
      risks.push({
        riskId: `RISK-${riskCounter.toString().padStart(3, '0')}`,
        area: 'System Boundary',
        potentialMisinterpretation: 'Analysis may appear complete but external dependencies are not visible',
        correctInterpretation: `${missingSourceQuestions.length} external program(s) are referenced but not included in analysis`,
        guidance: 'Identify and document all external system interfaces before proceeding'
      });
    }

    // Risk: Low confidence hypotheses
    const lowConfidenceCount = hypotheses.filter(h => h.confidenceLevel === 'LOW').length;
    if (lowConfidenceCount > hypotheses.length * 0.5) {
      riskCounter++;
      risks.push({
        riskId: `RISK-${riskCounter.toString().padStart(3, '0')}`,
        area: 'Hypothesis Reliability',
        potentialMisinterpretation: 'Business hypotheses may be treated as confirmed facts',
        correctInterpretation: `${lowConfidenceCount} of ${hypotheses.length} hypotheses have LOW confidence and require validation`,
        guidance: 'Prioritize SME validation sessions before using hypotheses in planning'
      });
    }

    // Risk: Undetermined execution patterns
    const undeterminedPrograms = sourceAnalysis.section1_programInventory
      .filter(p => p.observedExecutionPattern === 'UNDETERMINED');

    if (undeterminedPrograms.length > 0) {
      riskCounter++;
      risks.push({
        riskId: `RISK-${riskCounter.toString().padStart(3, '0')}`,
        area: 'Execution Context',
        potentialMisinterpretation: `${undeterminedPrograms.length} program(s) have undetermined execution pattern`,
        correctInterpretation: 'These programs may be batch, online, or utility - context cannot be determined from code alone',
        guidance: 'Clarify execution context for each undetermined program with operations team'
      });
    }

    return risks;
  }

  /**
   * Validate the generated Business Draft
   */
  validateBusinessDraft(draft: BusinessDraftResult, sourceAnalysis: SourceAnalysisResult): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Rule 1: Reject if migration-related keywords appear
    const allText = JSON.stringify(draft);
    for (const keyword of FORBIDDEN_MIGRATION_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(allText)) {
        errors.push({
          code: 'MIGRATION_KEYWORD_DETECTED',
          message: `Forbidden migration-related keyword detected: "${keyword}"`,
          location: 'Document content'
        });
      }
    }

    // Rule 2: Reject if FACT and HYPOTHESIS are mixed
    for (const hypothesis of draft.section2_businessHypotheses) {
      // Check if hypothesis text sounds too certain
      const certaintyPhrases = ['is a', 'represents', 'performs', 'handles', 'manages'];
      for (const phrase of certaintyPhrases) {
        if (hypothesis.hypothesis.toLowerCase().includes(phrase) &&
            !hypothesis.hypothesis.toLowerCase().includes('may')) {
          warnings.push({
            code: 'HYPOTHESIS_SOUNDS_CERTAIN',
            message: `Hypothesis ${hypothesis.hypothesisId} may sound too certain: contains "${phrase}" without qualification`,
            location: `Section 2: ${hypothesis.hypothesisId}`
          });
        }
      }
    }

    // Rule 3: Reject if Open Questions differ from SOURCE_ANALYSIS.md
    const sourceOpenQuestions = sourceAnalysis.section5_observationsAndQuestions.openQuestions;
    if (draft.section5_openQuestions.length !== sourceOpenQuestions.length) {
      errors.push({
        code: 'OPEN_QUESTIONS_MODIFIED',
        message: `Open Questions count mismatch: SOURCE_ANALYSIS has ${sourceOpenQuestions.length}, BUSINESS_DRAFT has ${draft.section5_openQuestions.length}`,
        location: 'Section 5: Open Questions'
      });
    } else {
      // Check if any question was modified
      for (let i = 0; i < sourceOpenQuestions.length; i++) {
        if (draft.section5_openQuestions[i].questionId !== sourceOpenQuestions[i].questionId ||
            draft.section5_openQuestions[i].question !== sourceOpenQuestions[i].question) {
          errors.push({
            code: 'OPEN_QUESTION_MODIFIED',
            message: `Open Question ${sourceOpenQuestions[i].questionId} was modified from source`,
            location: 'Section 5: Open Questions'
          });
        }
      }
    }

    // Rule 4: Reject if conclusions are not traceable to source analysis
    for (const hypothesis of draft.section2_businessHypotheses) {
      if (hypothesis.derivedFrom.length === 0) {
        errors.push({
          code: 'HYPOTHESIS_NOT_TRACEABLE',
          message: `Hypothesis ${hypothesis.hypothesisId} has no reference to confirmed facts`,
          location: `Section 2: ${hypothesis.hypothesisId}`
        });
      }
    }

    // Additional validation: Check evidence mapping completeness
    const mappedHypotheses = new Set(draft.section3_evidenceMapping.map(m => m.hypothesisId));
    for (const hypothesis of draft.section2_businessHypotheses) {
      if (!mappedHypotheses.has(hypothesis.hypothesisId)) {
        warnings.push({
          code: 'HYPOTHESIS_NOT_MAPPED',
          message: `Hypothesis ${hypothesis.hypothesisId} has no evidence mapping entry`,
          location: 'Section 3: Evidence Mapping'
        });
      }
    }

    // Check if all hypotheses have validation requirements
    for (const hypothesis of draft.section2_businessHypotheses) {
      if (!hypothesis.requiresValidation || hypothesis.requiresValidation.trim() === '') {
        warnings.push({
          code: 'MISSING_VALIDATION_REQUIREMENT',
          message: `Hypothesis ${hypothesis.hypothesisId} has no validation requirement specified`,
          location: `Section 2: ${hypothesis.hypothesisId}`
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

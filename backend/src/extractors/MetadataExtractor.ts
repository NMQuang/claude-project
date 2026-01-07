/**
 * Metadata Extractor
 *
 * Extracts high-level metadata and metrics from analysis results
 */

import { CobolAnalysisResult } from '../analyzers/CobolAnalyzer.js';
import { DDLAnalysisResult, TableDefinition } from '../analyzers/DDLAnalyzer.js';
import { MigrationComplexityScorer, MigrationComplexityScore } from './MigrationComplexityScorer.js';

export interface ProjectMetadata {
  source_analysis: {
    total_files: number;
    total_loc: number;
    programs: Array<{
      name: string;
      path: string;
      type: string;
      loc: number;
      complexity: number;
      priority: string;
    }>;
    database: {
      tables: number;
      views: number;
      stored_procedures: number;
      indexes: number;
      triggers: number;
      functions: number;
    };
  };
  complexity_summary: string;
  migrationComplexity?: MigrationComplexityScore;
  file_type_distribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  dependencies: Array<{
    source: string;
    targets: string;
  }>;
  high_complexity_modules: Array<{
    name: string;
    score: number;
    risk: string;
    recommendation: string;
  }>;
  risks: Array<{
    id: string;
    category: string;
    description: string;
    severity: string;
    impact: string;
    mitigation: string;
  }>;
}

export class MetadataExtractor {
  /**
   * Extract metadata from analysis results
   */
  extract(analysisResults: CobolAnalysisResult[], ddlResults?: DDLAnalysisResult): ProjectMetadata {
    const totalLOC = this.calculateTotalLOC(analysisResults);

    // Calculate comprehensive migration complexity
    const scorer = new MigrationComplexityScorer();
    const migrationComplexity = scorer.scoreProject(analysisResults);

    return {
      source_analysis: {
        total_files: analysisResults.length,
        total_loc: totalLOC,
        programs: this.extractProgramInfo(analysisResults),
        database: ddlResults ? {
          tables: ddlResults.totalTables,
          views: ddlResults.views.length,
          stored_procedures: ddlResults.storedProcedures.length,
          indexes: ddlResults.totalIndexes,
          triggers: ddlResults.triggers.length,
          functions: ddlResults.functions.length
        } : {
          tables: 0,
          views: 0,
          stored_procedures: 0,
          indexes: 0,
          triggers: 0,
          functions: 0
        }
      },
      complexity_summary: `${migrationComplexity.difficulty} difficulty (score: ${migrationComplexity.overall}/100) - ${migrationComplexity.description}`,
      migrationComplexity,
      file_type_distribution: this.calculateFileTypeDistribution(analysisResults),
      dependencies: this.extractDependencies(analysisResults),
      high_complexity_modules: this.identifyHighComplexityModules(analysisResults),
      risks: this.assessRisks(analysisResults, migrationComplexity)
    };
  }

  private calculateTotalLOC(results: CobolAnalysisResult[]): number {
    return results.reduce((sum, result) => sum + result.loc, 0);
  }

  private calculateAverageComplexity(results: CobolAnalysisResult[]): number {
    const total = results.reduce((sum, result) => sum + result.complexity, 0);
    return results.length > 0 ? Math.round(total / results.length) : 0;
  }

  private extractProgramInfo(results: CobolAnalysisResult[]) {
    return results.map(result => ({
      name: result.name,
      path: result.path,
      type: result.type,
      loc: result.loc,
      complexity: result.complexity,
      priority: this.determinePriority(result)
    }));
  }

  private determinePriority(result: CobolAnalysisResult): string {
    // Simple heuristic: high complexity or large LOC = high priority
    if (result.complexity > 30 || result.loc > 1000) {
      return 'High';
    } else if (result.complexity > 15 || result.loc > 500) {
      return 'Medium';
    }
    return 'Low';
  }

  private generateComplexitySummary(avgComplexity: number): string {
    if (avgComplexity < 10) {
      return 'Low complexity - straightforward migration expected';
    } else if (avgComplexity < 20) {
      return 'Medium complexity - some refactoring required';
    } else if (avgComplexity < 30) {
      return 'High complexity - significant refactoring needed';
    }
    return 'Very high complexity - extensive redesign recommended';
  }

  private calculateFileTypeDistribution(results: CobolAnalysisResult[]) {
    const types = new Map<string, number>();

    for (const result of results) {
      types.set(result.type, (types.get(result.type) || 0) + 1);
    }

    const total = results.length;
    return Array.from(types.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100)
    }));
  }

  private extractDependencies(results: CobolAnalysisResult[]) {
    return results
      .filter(result => result.dependencies.length > 0)
      .map(result => ({
        source: result.name,
        targets: result.dependencies.join(', ')
      }));
  }

  private identifyHighComplexityModules(results: CobolAnalysisResult[]) {
    return results
      .filter(result => result.complexity > 20)
      .map(result => ({
        name: result.name,
        score: result.complexity,
        risk: result.complexity > 40 ? 'High' : 'Medium',
        recommendation: result.complexity > 40
          ? 'Consider breaking into smaller modules during migration'
          : 'Review and simplify logic where possible'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10
  }

  private assessRisks(results: CobolAnalysisResult[], migrationComplexity: MigrationComplexityScore): Array<any> {
    const risks = [];

    // Risk: High migration difficulty
    if (migrationComplexity.overall >= 60) {
      risks.push({
        id: 'R-001',
        category: 'Migration Complexity',
        description: `Migration difficulty score is ${migrationComplexity.overall}/100 (${migrationComplexity.difficulty})`,
        severity: migrationComplexity.overall >= 80 ? 'Critical' : 'High',
        impact: 'May lead to longer migration timeline, higher defect rate, and increased resource requirements',
        mitigation: 'Allocate experienced developers, plan for refactoring, increase code review frequency, consider phased migration'
      });
    }

    // Risk: High logic complexity
    if (migrationComplexity.logicComplexity >= 60) {
      risks.push({
        id: 'R-002',
        category: 'Logic Complexity',
        description: `Logic complexity score: ${migrationComplexity.logicComplexity}/100. ${migrationComplexity.details.logic.join('; ')}`,
        severity: 'High',
        impact: 'Complex control flow increases risk of logic errors during migration',
        mitigation: 'Comprehensive unit testing, code refactoring to simplify logic, peer review of critical sections'
      });
    }

    // Risk: High data complexity
    if (migrationComplexity.dataComplexity >= 60) {
      risks.push({
        id: 'R-003',
        category: 'Data Complexity',
        description: `Data complexity score: ${migrationComplexity.dataComplexity}/100. ${migrationComplexity.details.data.join('; ')}`,
        severity: 'High',
        impact: 'Complex data structures and database operations require careful mapping',
        mitigation: 'Create detailed data mapping documents, implement data validation tests, use ORM frameworks'
      });
    }

    // Risk: COBOL-specific features
    if (migrationComplexity.cobolSpecificRisk >= 60) {
      risks.push({
        id: 'R-004',
        category: 'COBOL-specific Risk',
        description: `COBOL-specific risk score: ${migrationComplexity.cobolSpecificRisk}/100. ${migrationComplexity.details.risk.join('; ')}`,
        severity: 'Critical',
        impact: 'Legacy COBOL features may not have direct Java equivalents, requiring custom solutions',
        mitigation: 'Research migration patterns for specific features, develop custom libraries, plan for redesign where necessary'
      });
    }

    // Risk: Large codebase
    const totalLOC = this.calculateTotalLOC(results);
    if (totalLOC > 100000) {
      risks.push({
        id: 'R-005',
        category: 'Scale',
        description: `Large codebase with ${totalLOC.toLocaleString()} lines of code`,
        severity: 'Medium',
        impact: 'Extended timeline, higher resource requirements',
        mitigation: 'Use phased migration approach, consider automated conversion tools'
      });
    }

    // Risk: High number of dependencies
    const totalDeps = results.reduce((sum, r) => sum + r.dependencies.length, 0);
    if (totalDeps > 50) {
      risks.push({
        id: 'R-006',
        category: 'Dependencies',
        description: `High number of inter-module dependencies (${totalDeps})`,
        severity: 'Medium',
        impact: 'Complex integration testing, potential circular dependencies',
        mitigation: 'Map dependencies early, identify and break circular references'
      });
    }

    return risks;
  }
}

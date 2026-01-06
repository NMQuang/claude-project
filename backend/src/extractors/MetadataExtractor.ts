/**
 * Metadata Extractor
 *
 * Extracts high-level metadata and metrics from analysis results
 */

import { CobolAnalysisResult } from '../analyzers/CobolAnalyzer.js';
import { DDLAnalysisResult, TableDefinition } from '../analyzers/DDLAnalyzer.js';

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
    const avgComplexity = this.calculateAverageComplexity(analysisResults);

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
      complexity_summary: this.generateComplexitySummary(avgComplexity),
      file_type_distribution: this.calculateFileTypeDistribution(analysisResults),
      dependencies: this.extractDependencies(analysisResults),
      high_complexity_modules: this.identifyHighComplexityModules(analysisResults),
      risks: this.assessRisks(analysisResults, avgComplexity)
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
    if (result.complexity > 15 || result.loc > 1000) {
      return 'High';
    } else if (result.complexity > 8 || result.loc > 500) {
      return 'Medium';
    }
    return 'Low';
  }

  private generateComplexitySummary(avgComplexity: number): string {
    if (avgComplexity < 5) {
      return 'Low complexity - straightforward migration expected';
    } else if (avgComplexity < 10) {
      return 'Medium complexity - some refactoring required';
    } else if (avgComplexity < 15) {
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
      .filter(result => result.complexity > 10)
      .map(result => ({
        name: result.name,
        score: result.complexity,
        risk: result.complexity > 20 ? 'High' : 'Medium',
        recommendation: result.complexity > 20
          ? 'Consider breaking into smaller modules during migration'
          : 'Review and simplify logic where possible'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10
  }

  private assessRisks(results: CobolAnalysisResult[], avgComplexity: number): Array<any> {
    const risks = [];

    // Risk: High average complexity
    if (avgComplexity > 12) {
      risks.push({
        id: 'R-001',
        category: 'Complexity',
        description: `Average code complexity is ${avgComplexity}, which is higher than recommended threshold (10)`,
        severity: 'High',
        impact: 'May lead to longer migration timeline and higher defect rate',
        mitigation: 'Allocate experienced developers, plan for refactoring, increase code review frequency'
      });
    }

    // Risk: Large codebase
    const totalLOC = this.calculateTotalLOC(results);
    if (totalLOC > 100000) {
      risks.push({
        id: 'R-002',
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
        id: 'R-003',
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

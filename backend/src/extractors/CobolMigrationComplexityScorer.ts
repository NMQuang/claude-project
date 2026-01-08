/**
 * COBOL Migration Complexity Scorer
 *
 * Calculates comprehensive migration difficulty score for COBOL-to-Java migration based on multiple dimensions:
 * 1. Logic Complexity (cyclomatic complexity, control flow)
 * 2. Data & SQL Complexity (database operations, data structures)
 * 3. COBOL-specific Risk (legacy constructs, platform dependencies)
 */

import { CobolAnalysisResult } from '../analyzers/CobolAnalyzer.js';

export interface CobolMigrationComplexityScore {
  overall: number; // 0-100
  logicComplexity: number; // 0-100
  dataComplexity: number; // 0-100
  cobolSpecificRisk: number; // 0-100
  difficulty: 'Low' | 'Medium' | 'High' | 'Very High';
  description: string;
  details: {
    logic: string[];
    data: string[];
    risk: string[];
  };
}

export class CobolMigrationComplexityScorer {
  /**
   * Calculate migration complexity score for a single file
   */
  scoreFile(result: CobolAnalysisResult): CobolMigrationComplexityScore {
    const metrics = result.migrationMetrics;
    const loc = result.loc;

    // 1. Logic Complexity Score (0-100)
    const logicScore = this.calculateLogicComplexity(metrics, loc);

    // 2. Data & SQL Complexity Score (0-100)
    const dataScore = this.calculateDataComplexity(metrics, loc);

    // 3. COBOL-specific Risk Score (0-100)
    const riskScore = this.calculateCobolRisk(metrics, loc);

    // Overall Migration Difficulty (weighted average)
    const overall = Math.round(
      logicScore * 0.35 +  // Logic is 35% of difficulty
      dataScore * 0.35 +   // Data is 35% of difficulty
      riskScore * 0.30     // COBOL-specific risks are 30% of difficulty
    );

    return {
      overall,
      logicComplexity: logicScore,
      dataComplexity: dataScore,
      cobolSpecificRisk: riskScore,
      difficulty: this.getDifficultyLevel(overall),
      description: this.getDescription(overall),
      details: {
        logic: this.getLogicDetails(metrics, loc),
        data: this.getDataDetails(metrics, loc),
        risk: this.getRiskDetails(metrics, loc)
      }
    };
  }

  /**
   * Calculate average migration complexity for multiple files
   */
  scoreProject(results: CobolAnalysisResult[]): CobolMigrationComplexityScore {
    if (results.length === 0) {
      return this.emptyScore();
    }

    const fileScores = results.map(r => this.scoreFile(r));

    const avgLogic = Math.round(
      fileScores.reduce((sum, s) => sum + s.logicComplexity, 0) / fileScores.length
    );
    const avgData = Math.round(
      fileScores.reduce((sum, s) => sum + s.dataComplexity, 0) / fileScores.length
    );
    const avgRisk = Math.round(
      fileScores.reduce((sum, s) => sum + s.cobolSpecificRisk, 0) / fileScores.length
    );

    const overall = Math.round(
      avgLogic * 0.35 + avgData * 0.35 + avgRisk * 0.30
    );

    // Aggregate details from all files
    const allLogicDetails = fileScores.flatMap(s => s.details.logic);
    const allDataDetails = fileScores.flatMap(s => s.details.data);
    const allRiskDetails = fileScores.flatMap(s => s.details.risk);

    return {
      overall,
      logicComplexity: avgLogic,
      dataComplexity: avgData,
      cobolSpecificRisk: avgRisk,
      difficulty: this.getDifficultyLevel(overall),
      description: this.getDescription(overall),
      details: {
        logic: [...new Set(allLogicDetails)], // Remove duplicates
        data: [...new Set(allDataDetails)],
        risk: [...new Set(allRiskDetails)]
      }
    };
  }

  private calculateLogicComplexity(metrics: any, loc: number): number {
    let score = 0;

    // Cyclomatic complexity (normalized per 100 LOC)
    const complexityRatio = (metrics.cyclomaticComplexity / Math.max(loc, 1)) * 100;
    score += Math.min(complexityRatio * 2, 40); // Max 40 points

    // Nested IF depth penalty
    if (metrics.nestedIfDepth > 5) score += 20;
    else if (metrics.nestedIfDepth > 3) score += 10;
    else if (metrics.nestedIfDepth > 2) score += 5;

    // GOTO usage (spaghetti code indicator)
    score += Math.min(metrics.gotoCount * 10, 30); // Max 30 points

    // EVALUATE complexity
    score += Math.min(metrics.evaluateCount * 2, 10); // Max 10 points

    return Math.min(Math.round(score), 100);
  }

  private calculateDataComplexity(metrics: any, loc: number): number {
    let score = 0;

    // COPYBOOK usage
    score += Math.min(metrics.copybookCount * 5, 25); // Max 25 points

    // SQL complexity
    const sqlRatio = (metrics.sqlStatementCount / Math.max(loc, 1)) * 100;
    score += Math.min(sqlRatio * 5, 30); // Max 30 points

    // File operations
    score += Math.min(metrics.fileOperationCount * 2, 20); // Max 20 points

    // Complex data structures
    score += Math.min(metrics.occursCount * 3, 15); // Max 15 points
    score += Math.min(metrics.redefinesCount * 3, 10); // Max 10 points

    return Math.min(Math.round(score), 100);
  }

  private calculateCobolRisk(metrics: any, loc: number): number {
    let score = 0;

    // COMP-3 / Packed decimal (requires special handling in Java)
    score += Math.min(metrics.comp3Count * 5, 25); // Max 25 points

    // Assembly language calls (cannot migrate directly)
    score += Math.min(metrics.assemblyCallCount * 20, 40); // Max 40 points

    // Complex PIC clauses
    score += Math.min(metrics.complexPicCount * 3, 15); // Max 15 points

    // SORT/MERGE operations
    score += Math.min(metrics.sortMergeCount * 3, 10); // Max 10 points

    // Report Writer (requires complete redesign)
    if (metrics.reportWriterUsage) score += 10;

    return Math.min(Math.round(score), 100);
  }

  private getDifficultyLevel(overall: number): 'Low' | 'Medium' | 'High' | 'Very High' {
    if (overall < 30) return 'Low';
    if (overall < 60) return 'Medium';
    if (overall < 80) return 'High';
    return 'Very High';
  }

  private getDescription(overall: number): string {
    if (overall < 30) {
      return 'Low migration difficulty - straightforward conversion expected with minimal refactoring';
    } else if (overall < 60) {
      return 'Medium migration difficulty - moderate refactoring required, standard migration patterns applicable';
    } else if (overall < 80) {
      return 'High migration difficulty - significant redesign needed, complex legacy patterns present';
    } else {
      return 'Very high migration difficulty - extensive redesign required, critical COBOL-specific features in use';
    }
  }

  private getLogicDetails(metrics: any, loc: number): string[] {
    const details: string[] = [];

    if (metrics.cyclomaticComplexity > 20) {
      details.push(`High cyclomatic complexity (${metrics.cyclomaticComplexity})`);
    }
    if (metrics.nestedIfDepth > 3) {
      details.push(`Deep nesting detected (${metrics.nestedIfDepth} levels)`);
    }
    if (metrics.gotoCount > 0) {
      details.push(`GOTO statements present (${metrics.gotoCount}) - requires refactoring`);
    }
    if (metrics.evaluateCount > 5) {
      details.push(`Multiple EVALUATE statements (${metrics.evaluateCount})`);
    }

    return details;
  }

  private getDataDetails(metrics: any, loc: number): string[] {
    const details: string[] = [];

    if (metrics.copybookCount > 3) {
      details.push(`High COPYBOOK usage (${metrics.copybookCount}) - data structure mapping needed`);
    }
    if (metrics.sqlStatementCount > 10) {
      details.push(`Embedded SQL detected (${metrics.sqlStatementCount} statements)`);
    }
    if (metrics.fileOperationCount > 10) {
      details.push(`Multiple file operations (${metrics.fileOperationCount})`);
    }
    if (metrics.occursCount > 2) {
      details.push(`Arrays/tables present (${metrics.occursCount} OCCURS clauses)`);
    }
    if (metrics.redefinesCount > 2) {
      details.push(`Union types detected (${metrics.redefinesCount} REDEFINES)`);
    }

    return details;
  }

  private getRiskDetails(metrics: any, loc: number): string[] {
    const details: string[] = [];

    if (metrics.comp3Count > 0) {
      details.push(`COMP-3/Packed decimal fields (${metrics.comp3Count}) - custom conversion required`);
    }
    if (metrics.assemblyCallCount > 0) {
      details.push(`Assembly language calls detected (${metrics.assemblyCallCount}) - critical risk`);
    }
    if (metrics.complexPicCount > 5) {
      details.push(`Complex PIC clauses (${metrics.complexPicCount})`);
    }
    if (metrics.sortMergeCount > 0) {
      details.push(`SORT/MERGE operations (${metrics.sortMergeCount})`);
    }
    if (metrics.reportWriterUsage) {
      details.push('Report Writer in use - requires complete redesign');
    }

    return details;
  }

  private emptyScore(): CobolMigrationComplexityScore {
    return {
      overall: 0,
      logicComplexity: 0,
      dataComplexity: 0,
      cobolSpecificRisk: 0,
      difficulty: 'Low',
      description: 'No files analyzed',
      details: {
        logic: [],
        data: [],
        risk: []
      }
    };
  }
}

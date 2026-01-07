/**
 * Basic COBOL Analyzer (POC version)
 *
 * This is a simplified analyzer that extracts basic metrics from COBOL files.
 * In a production version, this would use ANTLR4 with a proper COBOL grammar.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CobolAnalysisResult {
  name: string;
  path: string;
  type: string;
  loc: number;
  complexity: number;
  divisions: string[];
  paragraphs: string[];
  dependencies: string[];
  migrationMetrics: {
    // Logic Complexity Indicators
    cyclomaticComplexity: number;
    nestedIfDepth: number;
    gotoCount: number;
    evaluateCount: number;
    performCount: number;

    // Data & SQL Complexity Indicators
    copybookCount: number;
    sqlStatementCount: number;
    fileOperationCount: number;
    occursCount: number;
    redefinesCount: number;

    // COBOL-specific Risk Indicators
    comp3Count: number;
    assemblyCallCount: number;
    complexPicCount: number;
    sortMergeCount: number;
    reportWriterUsage: boolean;
  };
}

export class CobolAnalyzer {
  /**
   * Analyze a COBOL source file
   */
  async analyze(filePath: string): Promise<CobolAnalysisResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const migrationMetrics = this.analyzeMigrationMetrics(lines);

    return {
      name: path.basename(filePath, '.cbl').toUpperCase(),
      path: filePath,
      type: 'COBOL Program',
      loc: this.countLOC(lines),
      complexity: migrationMetrics.cyclomaticComplexity,
      divisions: this.extractDivisions(lines),
      paragraphs: this.extractParagraphs(lines),
      dependencies: this.extractDependencies(lines),
      migrationMetrics
    };
  }

  /**
   * Count lines of code (excluding comments and blank lines)
   */
  private countLOC(lines: string[]): number {
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments (lines starting with *) and blank lines
      if (trimmed && !trimmed.startsWith('*')) {
        count++;
      }
    }

    return count;
  }

  /**
   * Estimate cyclomatic complexity (simplified)
   * Count decision points: IF, EVALUATE, PERFORM UNTIL, etc.
   */
  private estimateComplexity(lines: string[]): number {
    let complexity = 1; // Base complexity

    for (const line of lines) {
      const upperLine = line.toUpperCase();

      // Count decision points
      if (upperLine.includes(' IF ') || upperLine.includes('IF ')) {
        complexity++;
      }
      if (upperLine.includes('EVALUATE')) {
        complexity++;
      }
      if (upperLine.includes('PERFORM') && upperLine.includes('UNTIL')) {
        complexity++;
      }
      if (upperLine.includes('WHEN')) {
        complexity++;
      }
    }

    return complexity;
  }

  /**
   * Extract COBOL divisions
   */
  private extractDivisions(lines: string[]): string[] {
    const divisions: string[] = [];
    const divisionPattern = /(IDENTIFICATION|ENVIRONMENT|DATA|PROCEDURE)\s+DIVISION/i;

    for (const line of lines) {
      const match = line.match(divisionPattern);
      if (match) {
        divisions.push(match[1].toUpperCase() + ' DIVISION');
      }
    }

    return divisions;
  }

  /**
   * Extract paragraph names
   */
  private extractParagraphs(lines: string[]): string[] {
    const paragraphs: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Paragraph typically ends with a period and is at column 8-11
      // Simplified: look for all-caps words followed by period
      const match = trimmed.match(/^([A-Z][A-Z0-9\-]+)\.\s*$/);
      if (match && match[1] !== 'DIVISION') {
        paragraphs.push(match[1]);
      }
    }

    return paragraphs;
  }

  /**
   * Extract dependencies (CALL statements, COPY books)
   */
  private extractDependencies(lines: string[]): string[] {
    const dependencies: string[] = [];

    for (const line of lines) {
      const upperLine = line.toUpperCase();

      // Extract CALL statements
      const callMatch = upperLine.match(/CALL\s+['"]([^'"]+)['"]/);
      if (callMatch) {
        dependencies.push(callMatch[1]);
      }

      // Extract COPY statements
      const copyMatch = upperLine.match(/COPY\s+([A-Z0-9\-]+)/);
      if (copyMatch) {
        dependencies.push(copyMatch[1]);
      }
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Analyze migration-specific metrics
   */
  private analyzeMigrationMetrics(lines: string[]) {
    let cyclomaticComplexity = 1;
    let nestedIfDepth = 0;
    let currentIfDepth = 0;
    let maxIfDepth = 0;
    let gotoCount = 0;
    let evaluateCount = 0;
    let performCount = 0;
    let copybookCount = 0;
    let sqlStatementCount = 0;
    let fileOperationCount = 0;
    let occursCount = 0;
    let redefinesCount = 0;
    let comp3Count = 0;
    let assemblyCallCount = 0;
    let complexPicCount = 0;
    let sortMergeCount = 0;
    let reportWriterUsage = false;

    for (const line of lines) {
      const upperLine = line.toUpperCase();
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('*')) continue;

      // Logic Complexity
      if (upperLine.includes(' IF ') || upperLine.startsWith('IF ')) {
        cyclomaticComplexity++;
        currentIfDepth++;
        maxIfDepth = Math.max(maxIfDepth, currentIfDepth);
      }
      if (upperLine.includes('END-IF')) {
        currentIfDepth = Math.max(0, currentIfDepth - 1);
      }
      if (upperLine.includes('EVALUATE')) {
        cyclomaticComplexity++;
        evaluateCount++;
      }
      if (upperLine.includes('PERFORM')) {
        performCount++;
        if (upperLine.includes('UNTIL')) {
          cyclomaticComplexity++;
        }
      }
      if (upperLine.includes('WHEN')) {
        cyclomaticComplexity++;
      }
      if (upperLine.match(/\bGO\s+TO\b/) || upperLine.match(/\bGOTO\b/)) {
        gotoCount++;
        cyclomaticComplexity++;
      }

      // Data & SQL Complexity
      if (upperLine.includes('COPY ')) {
        copybookCount++;
      }
      if (upperLine.includes('EXEC SQL') || upperLine.includes('EXEC-SQL')) {
        sqlStatementCount++;
      }
      if (upperLine.match(/\b(OPEN|READ|WRITE|CLOSE|REWRITE|DELETE)\b/)) {
        fileOperationCount++;
      }
      if (upperLine.includes('OCCURS')) {
        occursCount++;
      }
      if (upperLine.includes('REDEFINES')) {
        redefinesCount++;
      }

      // COBOL-specific Risks
      if (upperLine.match(/\bCOMP-3\b/) || upperLine.match(/\bPACKED-DECIMAL\b/)) {
        comp3Count++;
      }
      if (upperLine.includes('CALL') && (upperLine.includes('ILBOA') || upperLine.includes('ASMX'))) {
        assemblyCallCount++;
      }
      if (upperLine.match(/PIC\s+[^.\s]*[SVP9X]{5,}/)) {
        // Complex PIC clauses with 5+ format characters
        complexPicCount++;
      }
      if (upperLine.match(/\b(SORT|MERGE|RELEASE|RETURN)\b/)) {
        sortMergeCount++;
      }
      if (upperLine.includes('REPORT') && upperLine.includes('SECTION')) {
        reportWriterUsage = true;
      }
    }

    return {
      cyclomaticComplexity,
      nestedIfDepth: maxIfDepth,
      gotoCount,
      evaluateCount,
      performCount,
      copybookCount,
      sqlStatementCount,
      fileOperationCount,
      occursCount,
      redefinesCount,
      comp3Count,
      assemblyCallCount,
      complexPicCount,
      sortMergeCount,
      reportWriterUsage
    };
  }
}

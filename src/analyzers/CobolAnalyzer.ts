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
}

export class CobolAnalyzer {
  /**
   * Analyze a COBOL source file
   */
  async analyze(filePath: string): Promise<CobolAnalysisResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    return {
      name: path.basename(filePath, '.cbl').toUpperCase(),
      path: filePath,
      type: 'COBOL Program',
      loc: this.countLOC(lines),
      complexity: this.estimateComplexity(lines),
      divisions: this.extractDivisions(lines),
      paragraphs: this.extractParagraphs(lines),
      dependencies: this.extractDependencies(lines)
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
}

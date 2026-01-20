/**
 * COBOL Business Logic Analyzer
 *
 * Analyzes COBOL source code to extract business logic, process flows,
 * data perspectives, and business rules for documentation purposes.
 *
 * This analyzer focuses on UNDERSTANDING the business behavior rather than
 * migration metrics. Output is structured for generating business logic documentation.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Interfaces
// ============================================================================

export interface BusinessProcessStep {
  stepNumber: number;
  paragraphName: string;
  lineRange: { start: number; end: number };
  businessAction: string;
  description: string;
  calledParagraphs: string[];
  sqlOperations: string[];
  fileOperations: string[];
}

export interface DecisionPoint {
  paragraphName: string;
  lineNumber: number;
  condition: string;
  conditionType: 'IF' | 'EVALUATE' | 'PERFORM_UNTIL' | 'AT_END';
  businessMeaning: string;
  branches: string[];
}

export interface DatabaseAccess {
  tableName: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN';
  paragraphName: string;
  lineNumber: number;
  columns: string[];
  whereClause?: string;
  businessRole: string;
}

export interface FileAccess {
  fileName: string;
  variableName: string;
  accessType: 'INPUT' | 'OUTPUT' | 'I-O' | 'EXTEND';
  operations: ('OPEN' | 'READ' | 'WRITE' | 'REWRITE' | 'DELETE' | 'CLOSE')[];
  businessMeaning: string;
}

export interface DataItem {
  name: string;
  level: number;
  picture?: string;
  value?: string;
  occurs?: number;
  redefines?: string;
  businessMeaning: string;
  isFlag: boolean;
  flagValues?: { value: string; meaning: string }[];
}

export interface BusinessRule {
  ruleId: string;
  ruleType: 'VALIDATION' | 'CALCULATION' | 'DECISION' | 'THRESHOLD' | 'STATUS';
  description: string;
  implementation: string;
  paragraphName: string;
  lineNumber: number;
}

export interface ExternalCall {
  programName: string;
  paragraphName: string;
  lineNumber: number;
  parameters: string[];
  assumedRole: string;
}

export interface ErrorCondition {
  errorType: string;
  detection: string;
  handling: string;
  paragraphName: string;
  lineNumber: number;
  userMessage?: string;
  behavior: 'ABORT' | 'SKIP' | 'CONTINUE' | 'RETRY';
}

export interface ComplexityAssessment {
  logicComplexity: { score: number; factors: string[] };
  dataComplexity: { score: number; factors: string[] };
  businessRuleDensity: { score: number; factors: string[] };
  overallDifficulty: 'Low' | 'Medium' | 'High';
  justification: string;
}

export interface CobolBusinessLogicResult {
  // Program Identity
  programId: string;
  filePath: string;
  fileName: string;

  // Overview
  overview: {
    purpose: string;
    businessResponsibility: string;
    processingType: 'Batch' | 'Online' | 'Interactive' | 'Unknown';
    triggerCondition: string;
    terminationCondition: string;
  };

  // Structure
  divisions: string[];
  paragraphs: ParagraphInfo[];
  copybooks: string[];

  // Business Process
  businessProcessSteps: BusinessProcessStep[];
  decisionPoints: DecisionPoint[];
  mermaidFlowchart: string;

  // Data Perspective
  files: FileAccess[];
  databaseAccess: DatabaseAccess[];
  keyDataItems: DataItem[];

  // Business Rules
  businessRules: BusinessRule[];

  // External Interactions
  externalCalls: ExternalCall[];
  sharedCopybooks: string[];

  // Error Handling
  errorConditions: ErrorCondition[];

  // Complexity
  complexity: ComplexityAssessment;

  // Raw Metrics (for reference)
  metrics: {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
    paragraphCount: number;
    sqlStatementCount: number;
    fileOperationCount: number;
  };
}

export interface ParagraphInfo {
  name: string;
  lineStart: number;
  lineEnd: number;
  purpose: string;
  performedBy: string[];
  performs: string[];
}

// ============================================================================
// Main Analyzer Class
// ============================================================================

export class CobolBusinessLogicAnalyzer {

  private lines: string[] = [];
  private upperLines: string[] = [];

  /**
   * Main entry point - analyze a COBOL file for business logic
   */
  async analyze(filePath: string): Promise<CobolBusinessLogicResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    this.lines = content.split('\n');
    this.upperLines = this.lines.map(l => l.toUpperCase());

    const programId = this.extractProgramId();
    const divisions = this.extractDivisions();
    const paragraphs = this.extractParagraphsDetailed();
    const copybooks = this.extractCopybooks();

    // Extract business logic components
    const files = this.extractFileAccess();
    const databaseAccess = this.extractDatabaseAccess(paragraphs);
    const keyDataItems = this.extractKeyDataItems();
    const businessRules = this.extractBusinessRules(paragraphs);
    const externalCalls = this.extractExternalCalls(paragraphs);
    const errorConditions = this.extractErrorConditions(paragraphs);
    const decisionPoints = this.extractDecisionPoints(paragraphs);

    // Build business process flow
    const businessProcessSteps = this.buildBusinessProcessSteps(paragraphs, databaseAccess, files);

    // Generate Mermaid flowchart
    const mermaidFlowchart = this.generateMermaidFlowchart(paragraphs, decisionPoints);

    // Assess complexity
    const complexity = this.assessComplexity(
      paragraphs, decisionPoints, databaseAccess, files, businessRules
    );

    // Determine overview
    const overview = this.determineOverview(
      programId, paragraphs, files, databaseAccess, divisions
    );

    // Calculate metrics
    const metrics = this.calculateMetrics();

    return {
      programId,
      filePath,
      fileName: path.basename(filePath),
      overview,
      divisions,
      paragraphs,
      copybooks,
      businessProcessSteps,
      decisionPoints,
      mermaidFlowchart,
      files,
      databaseAccess,
      keyDataItems,
      businessRules,
      externalCalls,
      sharedCopybooks: copybooks,
      errorConditions,
      complexity,
      metrics
    };
  }

  // --------------------------------------------------------------------------
  // Extraction Methods
  // --------------------------------------------------------------------------

  private extractProgramId(): string {
    for (const line of this.upperLines) {
      const match = line.match(/PROGRAM-ID\.\s*([A-Z0-9\-]+)/);
      if (match) return match[1];
    }
    return 'UNKNOWN';
  }

  private extractDivisions(): string[] {
    const divisions: string[] = [];
    const pattern = /(IDENTIFICATION|ENVIRONMENT|DATA|PROCEDURE)\s+DIVISION/i;

    for (const line of this.lines) {
      const match = line.match(pattern);
      if (match) {
        divisions.push(match[1].toUpperCase() + ' DIVISION');
      }
    }
    return divisions;
  }

  private extractParagraphsDetailed(): ParagraphInfo[] {
    const paragraphs: ParagraphInfo[] = [];
    const paragraphPattern = /^\s{0,7}([A-Z][A-Z0-9\-]+)\.\s*$/;

    let inProcedureDivision = false;
    let currentParagraph: ParagraphInfo | null = null;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const upperLine = this.upperLines[i];

      if (upperLine.includes('PROCEDURE DIVISION')) {
        inProcedureDivision = true;
        continue;
      }

      if (!inProcedureDivision) continue;

      const match = line.match(paragraphPattern);
      if (match && !upperLine.includes('DIVISION')) {
        // Close previous paragraph
        if (currentParagraph) {
          currentParagraph.lineEnd = i;
          paragraphs.push(currentParagraph);
        }

        currentParagraph = {
          name: match[1],
          lineStart: i + 1,
          lineEnd: i + 1,
          purpose: this.inferParagraphPurpose(match[1]),
          performedBy: [],
          performs: []
        };
      }
    }

    // Close last paragraph
    if (currentParagraph) {
      currentParagraph.lineEnd = this.lines.length;
      paragraphs.push(currentParagraph);
    }

    // Build PERFORM relationships
    this.buildPerformRelationships(paragraphs);

    return paragraphs;
  }

  private inferParagraphPurpose(name: string): string {
    const upper = name.toUpperCase();

    if (upper.includes('MAIN') || upper.includes('CONTROL')) return 'Main control flow';
    if (upper.includes('INIT')) return 'Initialization';
    if (upper.includes('READ')) return 'Read data';
    if (upper.includes('WRITE')) return 'Write data';
    if (upper.includes('UPDATE')) return 'Update data';
    if (upper.includes('DELETE')) return 'Delete data';
    if (upper.includes('CREATE') || upper.includes('INSERT') || upper.includes('ADD')) return 'Create/Add data';
    if (upper.includes('VALID')) return 'Validation';
    if (upper.includes('CALC')) return 'Calculation';
    if (upper.includes('PROCESS')) return 'Business processing';
    if (upper.includes('ERROR') || upper.includes('ERR')) return 'Error handling';
    if (upper.includes('OPEN')) return 'Open files/resources';
    if (upper.includes('CLOSE')) return 'Close files/resources';
    if (upper.includes('PRINT') || upper.includes('REPORT')) return 'Generate output/report';
    if (upper.includes('SEARCH') || upper.includes('FIND')) return 'Search/lookup';
    if (upper.includes('END') || upper.includes('TERM') || upper.includes('FINAL')) return 'Termination';

    return 'Business processing';
  }

  private buildPerformRelationships(paragraphs: ParagraphInfo[]): void {
    const paragraphNames = new Set(paragraphs.map(p => p.name));

    for (const para of paragraphs) {
      for (let i = para.lineStart - 1; i < para.lineEnd && i < this.lines.length; i++) {
        const upperLine = this.upperLines[i];
        const performMatch = upperLine.match(/PERFORM\s+([A-Z][A-Z0-9\-]+)/);

        if (performMatch) {
          const targetName = performMatch[1];
          if (paragraphNames.has(targetName) && !para.performs.includes(targetName)) {
            para.performs.push(targetName);

            const targetPara = paragraphs.find(p => p.name === targetName);
            if (targetPara && !targetPara.performedBy.includes(para.name)) {
              targetPara.performedBy.push(para.name);
            }
          }
        }
      }
    }
  }

  private extractCopybooks(): string[] {
    const copybooks: string[] = [];

    for (const line of this.upperLines) {
      const match = line.match(/COPY\s+([A-Z0-9\-]+)/);
      if (match && !copybooks.includes(match[1])) {
        copybooks.push(match[1]);
      }
    }

    return copybooks;
  }

  private extractFileAccess(): FileAccess[] {
    const files: FileAccess[] = [];
    const fileMap = new Map<string, FileAccess>();

    // Extract from FILE-CONTROL
    for (let i = 0; i < this.lines.length; i++) {
      const upperLine = this.upperLines[i];

      const selectMatch = upperLine.match(/SELECT\s+([A-Z0-9\-]+)\s+ASSIGN\s+TO\s+['"]?([A-Z0-9\-\.]+)/);
      if (selectMatch) {
        fileMap.set(selectMatch[1], {
          variableName: selectMatch[1],
          fileName: selectMatch[2],
          accessType: 'INPUT',
          operations: [],
          businessMeaning: this.inferFileMeaning(selectMatch[1])
        });
      }
    }

    // Detect access type and operations
    for (let i = 0; i < this.lines.length; i++) {
      const upperLine = this.upperLines[i];

      // Open mode
      for (const [varName, file] of fileMap) {
        if (upperLine.includes(`OPEN INPUT ${varName}`)) file.accessType = 'INPUT';
        if (upperLine.includes(`OPEN OUTPUT ${varName}`)) file.accessType = 'OUTPUT';
        if (upperLine.includes(`OPEN I-O ${varName}`)) file.accessType = 'I-O';
        if (upperLine.includes(`OPEN EXTEND ${varName}`)) file.accessType = 'EXTEND';

        if (upperLine.match(new RegExp(`\\bOPEN\\b.*\\b${varName}\\b`))) {
          if (!file.operations.includes('OPEN')) file.operations.push('OPEN');
        }
        if (upperLine.match(new RegExp(`\\bREAD\\s+${varName}\\b`))) {
          if (!file.operations.includes('READ')) file.operations.push('READ');
        }
        if (upperLine.match(new RegExp(`\\bWRITE\\s+.*\\b${varName}\\b|\\bWRITE\\b.*FROM.*${varName}`))) {
          if (!file.operations.includes('WRITE')) file.operations.push('WRITE');
        }
        if (upperLine.match(new RegExp(`\\bREWRITE\\s+${varName}\\b`))) {
          if (!file.operations.includes('REWRITE')) file.operations.push('REWRITE');
        }
        if (upperLine.match(new RegExp(`\\bDELETE\\s+${varName}\\b`))) {
          if (!file.operations.includes('DELETE')) file.operations.push('DELETE');
        }
        if (upperLine.match(new RegExp(`\\bCLOSE\\b.*\\b${varName}\\b`))) {
          if (!file.operations.includes('CLOSE')) file.operations.push('CLOSE');
        }
      }
    }

    return Array.from(fileMap.values());
  }

  private inferFileMeaning(name: string): string {
    const upper = name.toUpperCase();

    if (upper.includes('INPUT') || upper.includes('IN-')) return 'Input data file';
    if (upper.includes('OUTPUT') || upper.includes('OUT-')) return 'Output data file';
    if (upper.includes('REPORT') || upper.includes('RPT')) return 'Report output';
    if (upper.includes('LOG')) return 'Log file';
    if (upper.includes('ERROR') || upper.includes('ERR')) return 'Error output file';
    if (upper.includes('MASTER')) return 'Master data file';
    if (upper.includes('TRANS')) return 'Transaction file';
    if (upper.includes('WORK') || upper.includes('TEMP')) return 'Temporary work file';

    return 'Data file';
  }

  private extractDatabaseAccess(paragraphs: ParagraphInfo[]): DatabaseAccess[] {
    const dbAccess: DatabaseAccess[] = [];
    let inSqlBlock = false;
    let sqlBuffer = '';
    let sqlStartLine = 0;
    let currentParagraph = '';

    for (let i = 0; i < this.lines.length; i++) {
      const upperLine = this.upperLines[i];

      // Track current paragraph
      for (const para of paragraphs) {
        if (i >= para.lineStart - 1 && i < para.lineEnd) {
          currentParagraph = para.name;
          break;
        }
      }

      if (upperLine.includes('EXEC SQL') || upperLine.includes('EXEC-SQL')) {
        inSqlBlock = true;
        sqlBuffer = '';
        sqlStartLine = i + 1;
      }

      if (inSqlBlock) {
        sqlBuffer += ' ' + upperLine;

        if (upperLine.includes('END-EXEC')) {
          inSqlBlock = false;
          const access = this.parseSqlStatement(sqlBuffer, currentParagraph, sqlStartLine);
          if (access) {
            dbAccess.push(access);
          }
        }
      }
    }

    return dbAccess;
  }

  private parseSqlStatement(sql: string, paragraphName: string, lineNumber: number): DatabaseAccess | null {
    const upperSql = sql.toUpperCase();

    let operation: DatabaseAccess['operation'] = 'UNKNOWN';
    let tableName = '';
    let columns: string[] = [];
    let whereClause: string | undefined;

    // Detect operation type
    if (upperSql.includes('SELECT')) {
      operation = 'SELECT';
      const fromMatch = upperSql.match(/FROM\s+([A-Z0-9_]+)/);
      if (fromMatch) tableName = fromMatch[1];

      const selectMatch = upperSql.match(/SELECT\s+(.+?)\s+(?:INTO|FROM)/);
      if (selectMatch) {
        columns = selectMatch[1].split(',').map(c => c.trim().replace(/^:/, ''));
      }
    } else if (upperSql.includes('INSERT')) {
      operation = 'INSERT';
      const intoMatch = upperSql.match(/INSERT\s+INTO\s+([A-Z0-9_]+)/);
      if (intoMatch) tableName = intoMatch[1];

      const colMatch = upperSql.match(/\(([^)]+)\)\s*VALUES/);
      if (colMatch) {
        columns = colMatch[1].split(',').map(c => c.trim());
      }
    } else if (upperSql.includes('UPDATE')) {
      operation = 'UPDATE';
      const tableMatch = upperSql.match(/UPDATE\s+([A-Z0-9_]+)/);
      if (tableMatch) tableName = tableMatch[1];

      const setMatch = upperSql.match(/SET\s+(.+?)(?:\s+WHERE|$)/);
      if (setMatch) {
        columns = setMatch[1].split(',').map(c => c.split('=')[0].trim());
      }
    } else if (upperSql.includes('DELETE')) {
      operation = 'DELETE';
      const fromMatch = upperSql.match(/DELETE\s+FROM\s+([A-Z0-9_]+)/);
      if (fromMatch) tableName = fromMatch[1];
    }

    // Extract WHERE clause
    const whereMatch = upperSql.match(/WHERE\s+(.+?)(?:END-EXEC|$)/);
    if (whereMatch) {
      whereClause = whereMatch[1].trim();
    }

    if (!tableName) return null;

    return {
      tableName,
      operation,
      paragraphName,
      lineNumber,
      columns: columns.filter(c => c && c !== '*'),
      whereClause,
      businessRole: this.inferTableRole(tableName, operation)
    };
  }

  private inferTableRole(tableName: string, operation: string): string {
    const upper = tableName.toUpperCase();

    let entityType = 'data';
    if (upper.includes('EMP') || upper.includes('USER') || upper.includes('PERSON')) entityType = 'employee/user data';
    else if (upper.includes('CUST')) entityType = 'customer data';
    else if (upper.includes('ORDER') || upper.includes('TRANS')) entityType = 'transaction data';
    else if (upper.includes('PROD') || upper.includes('ITEM')) entityType = 'product/item data';
    else if (upper.includes('ACCT') || upper.includes('ACCOUNT')) entityType = 'account data';
    else if (upper.includes('LOG') || upper.includes('AUDIT')) entityType = 'audit/log data';
    else if (upper.includes('MAST')) entityType = 'master data';
    else if (upper.includes('CONFIG') || upper.includes('PARAM')) entityType = 'configuration data';

    const opVerb = {
      'SELECT': 'Retrieve',
      'INSERT': 'Create new',
      'UPDATE': 'Update existing',
      'DELETE': 'Remove',
      'UNKNOWN': 'Access'
    }[operation] || 'Access';

    return `${opVerb} ${entityType}`;
  }

  private extractKeyDataItems(): DataItem[] {
    const items: DataItem[] = [];
    let inDataDivision = false;
    let currentLevel = 0;
    let current88Parent = '';

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const upperLine = this.upperLines[i];

      if (upperLine.includes('DATA DIVISION')) {
        inDataDivision = true;
        continue;
      }
      if (upperLine.includes('PROCEDURE DIVISION')) {
        inDataDivision = false;
        break;
      }

      if (!inDataDivision) continue;

      // Match level number and variable name
      const dataMatch = line.match(/^\s*(\d{2})\s+([A-Z0-9\-]+)/i);
      if (!dataMatch) continue;

      const level = parseInt(dataMatch[1]);
      const name = dataMatch[2].toUpperCase();

      // Skip FILLER
      if (name === 'FILLER') continue;

      const item: DataItem = {
        name,
        level,
        businessMeaning: this.inferDataItemMeaning(name),
        isFlag: level === 88
      };

      // Extract PIC clause
      const picMatch = upperLine.match(/PIC(?:TURE)?\s+(?:IS\s+)?([^\s.]+)/);
      if (picMatch) {
        item.picture = picMatch[1];
      }

      // Extract VALUE clause
      const valueMatch = upperLine.match(/VALUE\s+(?:IS\s+)?(['"]?[^.'"\s]+['"]?|SPACES?|ZEROS?)/);
      if (valueMatch) {
        item.value = valueMatch[1];
      }

      // Extract OCCURS clause
      const occursMatch = upperLine.match(/OCCURS\s+(\d+)/);
      if (occursMatch) {
        item.occurs = parseInt(occursMatch[1]);
      }

      // Extract REDEFINES clause
      const redefinesMatch = upperLine.match(/REDEFINES\s+([A-Z0-9\-]+)/);
      if (redefinesMatch) {
        item.redefines = redefinesMatch[1];
      }

      // Handle level 88 conditions (flags)
      if (level === 88) {
        const parentItem = items.find(it => it.name === current88Parent);
        if (parentItem) {
          if (!parentItem.flagValues) parentItem.flagValues = [];
          parentItem.flagValues.push({
            value: item.value || '',
            meaning: name.replace(/-/g, ' ').toLowerCase()
          });
          parentItem.isFlag = true;
        }
        continue;
      }

      if (level !== 88) {
        current88Parent = name;
      }

      // Only include significant items (level 01, 05, or items with important names)
      if (level <= 5 || this.isSignificantDataItem(name)) {
        items.push(item);
      }
    }

    return items;
  }

  private isSignificantDataItem(name: string): boolean {
    const upper = name.toUpperCase();
    const significantPatterns = [
      'STATUS', 'CODE', 'FLAG', 'IND', 'INDICATOR', 'COUNT', 'TOTAL',
      'AMOUNT', 'DATE', 'TIME', 'KEY', 'ID', 'NUMBER', 'NUM', 'ACTION',
      'TYPE', 'MODE', 'ERROR', 'MSG', 'MESSAGE', 'RESULT', 'RETURN'
    ];
    return significantPatterns.some(p => upper.includes(p));
  }

  private inferDataItemMeaning(name: string): string {
    const upper = name.toUpperCase();

    if (upper.includes('STATUS') || upper.includes('STAT')) return 'Status indicator';
    if (upper.includes('FLAG') || upper.includes('IND') || upper.includes('SW-')) return 'Control flag';
    if (upper.includes('COUNT') || upper.includes('CNT')) return 'Counter';
    if (upper.includes('TOTAL') || upper.includes('TOT')) return 'Accumulated total';
    if (upper.includes('AMOUNT') || upper.includes('AMT')) return 'Monetary amount';
    if (upper.includes('DATE') || upper.includes('DT')) return 'Date value';
    if (upper.includes('TIME') || upper.includes('TM')) return 'Time value';
    if (upper.includes('KEY')) return 'Key/identifier';
    if (upper.includes('CODE') || upper.includes('CD')) return 'Code value';
    if (upper.includes('ERROR') || upper.includes('ERR')) return 'Error information';
    if (upper.includes('MSG') || upper.includes('MESSAGE')) return 'Message text';
    if (upper.includes('ACTION')) return 'Action control';
    if (upper.includes('WS-')) return 'Working storage variable';

    return 'Business data';
  }

  private extractBusinessRules(paragraphs: ParagraphInfo[]): BusinessRule[] {
    const rules: BusinessRule[] = [];
    let ruleCounter = 1;

    for (let i = 0; i < this.lines.length; i++) {
      const upperLine = this.upperLines[i];
      const currentPara = this.findParagraphAtLine(paragraphs, i);

      // Validation rules (IF conditions with error messages)
      if (upperLine.includes(' IF ') || upperLine.startsWith('IF ')) {
        const conditionMatch = upperLine.match(/IF\s+(.+?)(?:\s+THEN)?$/);
        if (conditionMatch) {
          // Look ahead for DISPLAY with error-like messages
          const nextLines = this.upperLines.slice(i + 1, i + 5).join(' ');

          if (nextLines.includes('DISPLAY') &&
              (nextLines.includes('ERROR') || nextLines.includes('INVALID') || nextLines.includes('FAILED'))) {
            rules.push({
              ruleId: `BR-${String(ruleCounter++).padStart(3, '0')}`,
              ruleType: 'VALIDATION',
              description: this.simplifyCondition(conditionMatch[1]),
              implementation: `IF ${conditionMatch[1]}`,
              paragraphName: currentPara,
              lineNumber: i + 1
            });
          } else if (this.isBusinessCondition(conditionMatch[1])) {
            rules.push({
              ruleId: `BR-${String(ruleCounter++).padStart(3, '0')}`,
              ruleType: 'DECISION',
              description: this.simplifyCondition(conditionMatch[1]),
              implementation: `IF ${conditionMatch[1]}`,
              paragraphName: currentPara,
              lineNumber: i + 1
            });
          }
        }
      }

      // EVALUATE statements (business decisions)
      if (upperLine.includes('EVALUATE')) {
        const evalMatch = upperLine.match(/EVALUATE\s+(.+)/);
        if (evalMatch) {
          rules.push({
            ruleId: `BR-${String(ruleCounter++).padStart(3, '0')}`,
            ruleType: 'DECISION',
            description: `Decision based on ${this.simplifyCondition(evalMatch[1])}`,
            implementation: `EVALUATE ${evalMatch[1]}`,
            paragraphName: currentPara,
            lineNumber: i + 1
          });
        }
      }

      // Calculations (COMPUTE, ADD, SUBTRACT, MULTIPLY, DIVIDE)
      if (upperLine.match(/\b(COMPUTE|ADD|SUBTRACT|MULTIPLY|DIVIDE)\b/)) {
        const calcMatch = upperLine.match(/(COMPUTE\s+[A-Z0-9\-]+\s*=.+|ADD\s+.+TO\s+[A-Z0-9\-]+|SUBTRACT\s+.+FROM\s+[A-Z0-9\-]+)/);
        if (calcMatch) {
          rules.push({
            ruleId: `BR-${String(ruleCounter++).padStart(3, '0')}`,
            ruleType: 'CALCULATION',
            description: this.describeCalculation(calcMatch[1]),
            implementation: calcMatch[1],
            paragraphName: currentPara,
            lineNumber: i + 1
          });
        }
      }
    }

    return rules;
  }

  private isBusinessCondition(condition: string): boolean {
    const upper = condition.toUpperCase();
    // Check if it's a significant business condition, not just a simple check
    const businessKeywords = ['SQLCODE', 'STATUS', 'CODE', 'FLAG', 'ACTION', 'TYPE', 'AMOUNT', 'COUNT', 'TOTAL'];
    return businessKeywords.some(k => upper.includes(k)) ||
           upper.includes('=') ||
           upper.includes('>') ||
           upper.includes('<');
  }

  private simplifyCondition(condition: string): string {
    return condition
      .replace(/\s+/g, ' ')
      .replace(/WS-|WK-|W-/g, '')
      .trim();
  }

  private describeCalculation(calc: string): string {
    const upper = calc.toUpperCase();

    if (upper.includes('COMPUTE')) {
      return `Calculate ${calc.match(/COMPUTE\s+([A-Z0-9\-]+)/)?.[1] || 'value'}`;
    }
    if (upper.includes('ADD')) {
      return `Accumulate ${calc.match(/ADD\s+(.+?)\s+TO/)?.[1] || 'value'}`;
    }
    if (upper.includes('SUBTRACT')) {
      return `Deduct ${calc.match(/SUBTRACT\s+(.+?)\s+FROM/)?.[1] || 'value'}`;
    }

    return 'Perform calculation';
  }

  private findParagraphAtLine(paragraphs: ParagraphInfo[], lineIndex: number): string {
    for (const para of paragraphs) {
      if (lineIndex >= para.lineStart - 1 && lineIndex < para.lineEnd) {
        return para.name;
      }
    }
    return 'UNKNOWN';
  }

  private extractExternalCalls(paragraphs: ParagraphInfo[]): ExternalCall[] {
    const calls: ExternalCall[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const upperLine = this.upperLines[i];
      const currentPara = this.findParagraphAtLine(paragraphs, i);

      const callMatch = upperLine.match(/CALL\s+['"]([^'"]+)['"]/);
      if (callMatch) {
        const programName = callMatch[1];

        // Extract USING parameters
        const usingMatch = upperLine.match(/USING\s+(.+)/);
        const params = usingMatch
          ? usingMatch[1].split(/\s+/).filter(p => p && !p.includes(','))
          : [];

        calls.push({
          programName,
          paragraphName: currentPara,
          lineNumber: i + 1,
          parameters: params,
          assumedRole: this.inferProgramRole(programName)
        });
      }
    }

    return calls;
  }

  private inferProgramRole(name: string): string {
    const upper = name.toUpperCase();

    if (upper.includes('LOG') || upper.includes('AUDIT')) return 'Logging/Audit';
    if (upper.includes('ERROR') || upper.includes('ERR')) return 'Error handling';
    if (upper.includes('VALID')) return 'Validation';
    if (upper.includes('CALC')) return 'Calculation';
    if (upper.includes('FMT') || upper.includes('FORMAT')) return 'Formatting';
    if (upper.includes('UTIL') || upper.includes('COMMON')) return 'Utility functions';
    if (upper.includes('DB') || upper.includes('SQL')) return 'Database access';
    if (upper.includes('PRINT') || upper.includes('REPORT')) return 'Reporting';
    if (upper.includes('SEND') || upper.includes('MSG')) return 'Messaging';

    return 'External processing';
  }

  private extractErrorConditions(paragraphs: ParagraphInfo[]): ErrorCondition[] {
    const errors: ErrorCondition[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const upperLine = this.upperLines[i];
      const currentPara = this.findParagraphAtLine(paragraphs, i);

      // SQLCODE check
      if (upperLine.includes('SQLCODE')) {
        const condMatch = upperLine.match(/SQLCODE\s*([<>=!]+|NOT\s*=)\s*(\d+|ZERO|ZEROS)/);
        if (condMatch) {
          const nextLines = this.lines.slice(i + 1, i + 5).join(' ');
          const displayMatch = nextLines.match(/DISPLAY\s+['"]([^'"]+)['"]/);

          errors.push({
            errorType: 'SQL Error',
            detection: `SQLCODE ${condMatch[1]} ${condMatch[2]}`,
            handling: this.inferErrorHandling(nextLines),
            paragraphName: currentPara,
            lineNumber: i + 1,
            userMessage: displayMatch?.[1],
            behavior: this.inferErrorBehavior(nextLines)
          });
        }
      }

      // File status check
      if (upperLine.includes('FILE-STATUS') || upperLine.includes('FILE STATUS')) {
        errors.push({
          errorType: 'File Error',
          detection: 'FILE-STATUS check',
          handling: 'Status code validation',
          paragraphName: currentPara,
          lineNumber: i + 1,
          behavior: 'CONTINUE'
        });
      }

      // Explicit error display
      if (upperLine.includes('DISPLAY') &&
          (upperLine.includes('ERROR') || upperLine.includes('FAIL') || upperLine.includes('INVALID'))) {
        const msgMatch = this.lines[i].match(/DISPLAY\s+['"]([^'"]+)['"]/);
        errors.push({
          errorType: 'Business Error',
          detection: 'Business condition',
          handling: 'Display error message',
          paragraphName: currentPara,
          lineNumber: i + 1,
          userMessage: msgMatch?.[1],
          behavior: 'CONTINUE'
        });
      }
    }

    return errors;
  }

  private inferErrorHandling(code: string): string {
    const upper = code.toUpperCase();

    if (upper.includes('STOP RUN')) return 'Terminate program';
    if (upper.includes('PERFORM') && upper.includes('ERROR')) return 'Execute error routine';
    if (upper.includes('DISPLAY')) return 'Display error message';
    if (upper.includes('MOVE') && upper.includes('ERROR')) return 'Set error status';
    if (upper.includes('ROLLBACK')) return 'Rollback transaction';

    return 'Continue processing';
  }

  private inferErrorBehavior(code: string): 'ABORT' | 'SKIP' | 'CONTINUE' | 'RETRY' {
    const upper = code.toUpperCase();

    if (upper.includes('STOP RUN') || upper.includes('ABEND')) return 'ABORT';
    if (upper.includes('GO TO') && upper.includes('END')) return 'SKIP';
    if (upper.includes('PERFORM') && upper.includes('UNTIL')) return 'RETRY';

    return 'CONTINUE';
  }

  private extractDecisionPoints(paragraphs: ParagraphInfo[]): DecisionPoint[] {
    const decisions: DecisionPoint[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const upperLine = this.upperLines[i];
      const currentPara = this.findParagraphAtLine(paragraphs, i);

      // IF statements
      if ((upperLine.includes(' IF ') || upperLine.startsWith('IF ')) && !upperLine.includes('END-IF')) {
        const condMatch = upperLine.match(/IF\s+(.+?)(?:\s+THEN)?$/);
        if (condMatch) {
          const branches = this.extractBranches(i);
          decisions.push({
            paragraphName: currentPara,
            lineNumber: i + 1,
            condition: condMatch[1].trim(),
            conditionType: 'IF',
            businessMeaning: this.interpretCondition(condMatch[1]),
            branches
          });
        }
      }

      // EVALUATE statements
      if (upperLine.includes('EVALUATE')) {
        const evalMatch = upperLine.match(/EVALUATE\s+(.+)/);
        if (evalMatch) {
          const branches = this.extractEvaluateBranches(i);
          decisions.push({
            paragraphName: currentPara,
            lineNumber: i + 1,
            condition: evalMatch[1].trim(),
            conditionType: 'EVALUATE',
            businessMeaning: `Decision routing based on ${this.simplifyCondition(evalMatch[1])}`,
            branches
          });
        }
      }

      // PERFORM UNTIL
      if (upperLine.includes('PERFORM') && upperLine.includes('UNTIL')) {
        const untilMatch = upperLine.match(/UNTIL\s+(.+)/);
        if (untilMatch) {
          decisions.push({
            paragraphName: currentPara,
            lineNumber: i + 1,
            condition: untilMatch[1].trim(),
            conditionType: 'PERFORM_UNTIL',
            businessMeaning: `Loop until ${this.simplifyCondition(untilMatch[1])}`,
            branches: ['Continue loop', 'Exit loop']
          });
        }
      }

      // AT END (for READ operations)
      if (upperLine.includes('AT END') || upperLine.includes('AT END-OF-FILE')) {
        decisions.push({
          paragraphName: currentPara,
          lineNumber: i + 1,
          condition: 'End of file reached',
          conditionType: 'AT_END',
          businessMeaning: 'Handle end of data',
          branches: ['End of file processing', 'Continue reading']
        });
      }
    }

    return decisions;
  }

  private extractBranches(lineIndex: number): string[] {
    const branches: string[] = ['TRUE branch'];

    // Look for ELSE
    for (let i = lineIndex + 1; i < Math.min(lineIndex + 20, this.lines.length); i++) {
      if (this.upperLines[i].includes('END-IF')) break;
      if (this.upperLines[i].trim().startsWith('ELSE')) {
        branches.push('FALSE branch');
        break;
      }
    }

    return branches;
  }

  private extractEvaluateBranches(lineIndex: number): string[] {
    const branches: string[] = [];

    for (let i = lineIndex + 1; i < Math.min(lineIndex + 30, this.lines.length); i++) {
      if (this.upperLines[i].includes('END-EVALUATE')) break;

      const whenMatch = this.upperLines[i].match(/WHEN\s+(.+)/);
      if (whenMatch) {
        branches.push(whenMatch[1].trim());
      }
    }

    return branches;
  }

  private interpretCondition(condition: string): string {
    const upper = condition.toUpperCase();

    if (upper.includes('SQLCODE') && upper.includes('0')) {
      return upper.includes('NOT') || upper.includes('<>')
        ? 'Database operation failed'
        : 'Database operation successful';
    }
    if (upper.includes('EOF') || upper.includes('END-OF-FILE')) {
      return 'Check for end of data';
    }
    if (upper.includes('ERROR') || upper.includes('ERR')) {
      return 'Error condition check';
    }
    if (upper.includes('VALID')) {
      return 'Validation check';
    }
    if (upper.includes('=')) {
      return `Equality check: ${this.simplifyCondition(condition)}`;
    }
    if (upper.includes('>') || upper.includes('<')) {
      return `Comparison: ${this.simplifyCondition(condition)}`;
    }

    return `Condition: ${this.simplifyCondition(condition)}`;
  }

  // --------------------------------------------------------------------------
  // Business Process Flow Building
  // --------------------------------------------------------------------------

  private buildBusinessProcessSteps(
    paragraphs: ParagraphInfo[],
    dbAccess: DatabaseAccess[],
    files: FileAccess[]
  ): BusinessProcessStep[] {
    const steps: BusinessProcessStep[] = [];
    let stepNum = 1;

    // Find main/entry paragraph
    const mainPara = paragraphs.find(p =>
      p.name.includes('MAIN') ||
      p.performedBy.length === 0 ||
      p.name === paragraphs[0]?.name
    );

    if (!mainPara) return steps;

    // Build steps from main paragraph's execution flow
    const visited = new Set<string>();
    this.buildStepsRecursive(mainPara, paragraphs, dbAccess, files, steps, visited, stepNum);

    // Re-number steps sequentially
    steps.forEach((step, idx) => {
      step.stepNumber = idx + 1;
    });

    return steps;
  }

  private buildStepsRecursive(
    para: ParagraphInfo,
    allParagraphs: ParagraphInfo[],
    dbAccess: DatabaseAccess[],
    files: FileAccess[],
    steps: BusinessProcessStep[],
    visited: Set<string>,
    stepNum: number
  ): void {
    if (visited.has(para.name)) return;
    visited.add(para.name);

    // Get SQL and file operations for this paragraph
    const sqlOps = dbAccess
      .filter(d => d.paragraphName === para.name)
      .map(d => `${d.operation} ${d.tableName}`);

    const fileOps = files
      .filter(f => f.operations.length > 0)
      .map(f => `${f.operations.join('/')} ${f.variableName}`);

    steps.push({
      stepNumber: stepNum,
      paragraphName: para.name,
      lineRange: { start: para.lineStart, end: para.lineEnd },
      businessAction: this.inferBusinessAction(para, sqlOps),
      description: para.purpose,
      calledParagraphs: para.performs,
      sqlOperations: sqlOps,
      fileOperations: fileOps
    });

    // Recursively process called paragraphs
    for (const calledName of para.performs) {
      const calledPara = allParagraphs.find(p => p.name === calledName);
      if (calledPara) {
        this.buildStepsRecursive(calledPara, allParagraphs, dbAccess, files, steps, visited, stepNum + 1);
      }
    }
  }

  private inferBusinessAction(para: ParagraphInfo, sqlOps: string[]): string {
    const name = para.name.toUpperCase();

    if (name.includes('MAIN') || name.includes('CONTROL')) return 'Control program flow';
    if (name.includes('INIT')) return 'Initialize processing';
    if (name.includes('CREATE') || name.includes('INSERT') || sqlOps.some(s => s.includes('INSERT'))) return 'Create new record';
    if (name.includes('READ') || sqlOps.some(s => s.includes('SELECT'))) return 'Retrieve data';
    if (name.includes('UPDATE') || sqlOps.some(s => s.includes('UPDATE'))) return 'Update existing record';
    if (name.includes('DELETE') || sqlOps.some(s => s.includes('DELETE'))) return 'Remove record';
    if (name.includes('VALID')) return 'Validate data';
    if (name.includes('CALC')) return 'Perform calculation';
    if (name.includes('PRINT') || name.includes('REPORT')) return 'Generate output';
    if (name.includes('ERROR')) return 'Handle error';
    if (name.includes('END') || name.includes('TERM')) return 'Terminate processing';

    return para.purpose;
  }

  // --------------------------------------------------------------------------
  // Mermaid Flowchart Generation
  // --------------------------------------------------------------------------

  private generateMermaidFlowchart(paragraphs: ParagraphInfo[], decisions: DecisionPoint[]): string {
    const lines: string[] = ['flowchart TD'];
    const nodes = new Set<string>();
    const edges = new Set<string>();

    // Add start node
    lines.push('    START([Start Program])');
    nodes.add('START');

    // Find entry point
    const entryPara = paragraphs[0];
    if (entryPara) {
      const entryId = this.sanitizeNodeId(entryPara.name);
      lines.push(`    START --> ${entryId}`);
      edges.add(`START->${entryId}`);
    }

    // Process paragraphs
    for (const para of paragraphs) {
      const nodeId = this.sanitizeNodeId(para.name);

      if (!nodes.has(nodeId)) {
        // Determine node shape based on purpose
        let nodeShape: string;
        if (para.purpose.toLowerCase().includes('decision') || para.name.includes('EVAL')) {
          nodeShape = `${nodeId}{{"${para.name}"}}`;
        } else if (para.purpose.toLowerCase().includes('input') || para.purpose.toLowerCase().includes('output')) {
          nodeShape = `${nodeId}[/"${para.name}"/]`;
        } else {
          nodeShape = `${nodeId}["${para.name}"]`;
        }

        lines.push(`    ${nodeShape}`);
        nodes.add(nodeId);
      }

      // Add edges for PERFORM relationships
      for (const called of para.performs) {
        const calledId = this.sanitizeNodeId(called);
        const edgeKey = `${nodeId}->${calledId}`;

        if (!edges.has(edgeKey)) {
          lines.push(`    ${nodeId} --> ${calledId}`);
          edges.add(edgeKey);
        }
      }
    }

    // Add decision nodes from decision points
    for (const decision of decisions) {
      if (decision.conditionType === 'EVALUATE' || decision.conditionType === 'IF') {
        const decisionId = this.sanitizeNodeId(`DEC_${decision.paragraphName}_${decision.lineNumber}`);

        if (!nodes.has(decisionId)) {
          const shortCondition = decision.condition.substring(0, 30);
          lines.push(`    ${decisionId}{{"${shortCondition}"}}`);
          nodes.add(decisionId);

          // Add branches
          decision.branches.forEach((branch, idx) => {
            const branchId = this.sanitizeNodeId(`BR_${decisionId}_${idx}`);
            const branchLabel = branch.substring(0, 20);
            lines.push(`    ${decisionId} -->|"${branchLabel}"| ${branchId}["Process"]`);
          });
        }
      }
    }

    // Add end node
    lines.push('    STOP([End Program])');

    // Connect last paragraph to end (simplified)
    if (paragraphs.length > 0) {
      const lastPara = paragraphs.find(p =>
        p.name.includes('END') || p.name.includes('TERM') || p.performs.length === 0
      ) || paragraphs[paragraphs.length - 1];

      const lastId = this.sanitizeNodeId(lastPara.name);
      if (!edges.has(`${lastId}->STOP`)) {
        lines.push(`    ${lastId} --> STOP`);
      }
    }

    return lines.join('\n');
  }

  private sanitizeNodeId(name: string): string {
    return name.replace(/[^A-Za-z0-9]/g, '_');
  }

  // --------------------------------------------------------------------------
  // Complexity Assessment
  // --------------------------------------------------------------------------

  private assessComplexity(
    paragraphs: ParagraphInfo[],
    decisions: DecisionPoint[],
    dbAccess: DatabaseAccess[],
    files: FileAccess[],
    rules: BusinessRule[]
  ): ComplexityAssessment {
    // Logic Complexity (1-5)
    const logicFactors: string[] = [];
    let logicScore = 1;

    if (decisions.length > 10) {
      logicScore += 2;
      logicFactors.push(`High decision count (${decisions.length})`);
    } else if (decisions.length > 5) {
      logicScore += 1;
      logicFactors.push(`Moderate decision count (${decisions.length})`);
    }

    const evaluateCount = decisions.filter(d => d.conditionType === 'EVALUATE').length;
    if (evaluateCount > 3) {
      logicScore += 1;
      logicFactors.push(`Multiple EVALUATE statements (${evaluateCount})`);
    }

    const nestedParagraphs = paragraphs.filter(p => p.performs.length > 2);
    if (nestedParagraphs.length > 3) {
      logicScore += 1;
      logicFactors.push('Deep paragraph nesting');
    }

    logicScore = Math.min(5, logicScore);
    if (logicFactors.length === 0) logicFactors.push('Simple linear flow');

    // Data Complexity (1-5)
    const dataFactors: string[] = [];
    let dataScore = 1;

    const totalDataSources = dbAccess.length + files.length;
    if (totalDataSources > 5) {
      dataScore += 2;
      dataFactors.push(`Multiple data sources (${totalDataSources})`);
    } else if (totalDataSources > 2) {
      dataScore += 1;
      dataFactors.push(`Moderate data sources (${totalDataSources})`);
    }

    const uniqueTables = new Set(dbAccess.map(d => d.tableName)).size;
    if (uniqueTables > 3) {
      dataScore += 1;
      dataFactors.push(`Multiple tables (${uniqueTables})`);
    }

    const crudOps = new Set(dbAccess.map(d => d.operation)).size;
    if (crudOps >= 4) {
      dataScore += 1;
      dataFactors.push('Full CRUD operations');
    }

    dataScore = Math.min(5, dataScore);
    if (dataFactors.length === 0) dataFactors.push('Simple data structure');

    // Business Rule Density (1-5)
    const ruleFactors: string[] = [];
    let ruleScore = 1;

    if (rules.length > 15) {
      ruleScore += 2;
      ruleFactors.push(`High rule count (${rules.length})`);
    } else if (rules.length > 7) {
      ruleScore += 1;
      ruleFactors.push(`Moderate rule count (${rules.length})`);
    }

    const validationRules = rules.filter(r => r.ruleType === 'VALIDATION').length;
    if (validationRules > 5) {
      ruleScore += 1;
      ruleFactors.push(`Multiple validations (${validationRules})`);
    }

    const calculationRules = rules.filter(r => r.ruleType === 'CALCULATION').length;
    if (calculationRules > 3) {
      ruleScore += 1;
      ruleFactors.push(`Multiple calculations (${calculationRules})`);
    }

    ruleScore = Math.min(5, ruleScore);
    if (ruleFactors.length === 0) ruleFactors.push('Low business rule density');

    // Overall difficulty
    const avgScore = (logicScore + dataScore + ruleScore) / 3;
    let overallDifficulty: 'Low' | 'Medium' | 'High';
    let justification: string;

    if (avgScore <= 2) {
      overallDifficulty = 'Low';
      justification = 'Straightforward program with simple flow, limited data sources, and few business rules.';
    } else if (avgScore <= 3.5) {
      overallDifficulty = 'Medium';
      justification = 'Moderate complexity with some decision logic, multiple data sources, or significant business rules.';
    } else {
      overallDifficulty = 'High';
      justification = 'Complex program with deep logic branching, multiple data dependencies, and dense business rules.';
    }

    return {
      logicComplexity: { score: logicScore, factors: logicFactors },
      dataComplexity: { score: dataScore, factors: dataFactors },
      businessRuleDensity: { score: ruleScore, factors: ruleFactors },
      overallDifficulty,
      justification
    };
  }

  // --------------------------------------------------------------------------
  // Overview Determination
  // --------------------------------------------------------------------------

  private determineOverview(
    programId: string,
    paragraphs: ParagraphInfo[],
    files: FileAccess[],
    dbAccess: DatabaseAccess[],
    divisions: string[]
  ): CobolBusinessLogicResult['overview'] {
    // Determine processing type
    let processingType: 'Batch' | 'Online' | 'Interactive' | 'Unknown' = 'Unknown';

    const hasAcceptDisplay = this.lines.some(l =>
      l.toUpperCase().includes('ACCEPT') ||
      (l.toUpperCase().includes('DISPLAY') && !l.toUpperCase().includes('UPON'))
    );

    if (hasAcceptDisplay) {
      processingType = 'Interactive';
    } else if (files.some(f => f.accessType === 'INPUT' || f.accessType === 'OUTPUT')) {
      processingType = 'Batch';
    } else if (dbAccess.length > 0) {
      processingType = 'Online';
    }

    // Infer purpose from operations
    let purpose = `COBOL program ${programId}`;
    const operations = dbAccess.map(d => d.operation);

    if (operations.includes('INSERT') && operations.includes('SELECT') &&
        operations.includes('UPDATE') && operations.includes('DELETE')) {
      purpose = `CRUD operations management for ${dbAccess[0]?.tableName || 'database records'}`;
    } else if (operations.includes('SELECT') && !operations.includes('INSERT')) {
      purpose = `Data retrieval and reporting`;
    } else if (files.length > 0) {
      purpose = `File processing (${files.map(f => f.accessType).join(', ')})`;
    }

    // Business responsibility
    const uniqueTables = [...new Set(dbAccess.map(d => d.tableName))];
    let businessResponsibility = 'Data processing';

    if (uniqueTables.length > 0) {
      businessResponsibility = `Manage ${uniqueTables.join(', ')} data`;
    } else if (files.length > 0) {
      businessResponsibility = `Process ${files.map(f => f.fileName || f.variableName).join(', ')} files`;
    }

    // Trigger condition
    let triggerCondition = 'Not found in provided source';
    if (processingType === 'Interactive') {
      triggerCondition = 'User initiates program and provides input';
    } else if (processingType === 'Batch') {
      triggerCondition = 'Scheduled job or JCL execution';
    }

    // Termination condition
    let terminationCondition = 'STOP RUN';
    const hasStopRun = this.upperLines.some(l => l.includes('STOP RUN'));
    const hasGoBack = this.upperLines.some(l => l.includes('GOBACK'));

    if (hasStopRun) {
      terminationCondition = 'Program terminates via STOP RUN after completing main process';
    } else if (hasGoBack) {
      terminationCondition = 'Program returns control via GOBACK';
    }

    return {
      purpose,
      businessResponsibility,
      processingType,
      triggerCondition,
      terminationCondition
    };
  }

  // --------------------------------------------------------------------------
  // Metrics Calculation
  // --------------------------------------------------------------------------

  private calculateMetrics(): CobolBusinessLogicResult['metrics'] {
    let totalLines = this.lines.length;
    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;

    for (const line of this.lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        blankLines++;
      } else if (trimmed.startsWith('*')) {
        commentLines++;
      } else {
        codeLines++;
      }
    }

    // Count paragraphs (excluding divisions)
    let paragraphCount = 0;
    for (const line of this.upperLines) {
      if (line.match(/^\s{0,7}[A-Z][A-Z0-9\-]+\.\s*$/) && !line.includes('DIVISION')) {
        paragraphCount++;
      }
    }

    // Count SQL statements
    let sqlStatementCount = 0;
    for (const line of this.upperLines) {
      if (line.includes('EXEC SQL') || line.includes('EXEC-SQL')) {
        sqlStatementCount++;
      }
    }

    // Count file operations
    let fileOperationCount = 0;
    for (const line of this.upperLines) {
      if (line.match(/\b(OPEN|READ|WRITE|CLOSE|REWRITE|DELETE)\b/)) {
        fileOperationCount++;
      }
    }

    return {
      totalLines,
      codeLines,
      commentLines,
      blankLines,
      paragraphCount,
      sqlStatementCount,
      fileOperationCount
    };
  }
}

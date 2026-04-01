/**
 * COBOL Copybook Analyzer
 *
 * Parses .cpy files to extract:
 * - Record layouts with field definitions
 * - VSAM key structures
 * - Field offsets and lengths
 * - Business entity inference
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Interfaces
// ============================================================================

export interface CopybookField {
  name: string;
  level: number;
  picture?: string;
  usage?: string;
  occurs?: number;
  redefines?: string;
  value?: string;
  offset: number;
  length: number;
  dataType: 'ALPHANUMERIC' | 'NUMERIC' | 'PACKED' | 'BINARY' | 'GROUP' | 'COMP' | 'COMP-3';
  isKey: boolean;
  businessMeaning: string;
  children: CopybookField[];
}

export interface RecordLayout {
  recordName: string;
  copybooks: string[];
  totalLength: number;
  fields: CopybookField[];
  keys: KeyStructure[];
  entityType: string;
}

export interface KeyStructure {
  keyName: string;
  keyType: 'PRIMARY' | 'ALTERNATE' | 'FOREIGN';
  fields: string[];
  isUnique: boolean;
}

export interface CopybookAnalysisResult {
  fileName: string;
  filePath: string;
  relativePath?: string;
  recordLayouts: RecordLayout[];
  inferredEntity: InferredEntity | null;
  totalFields: number;
  referencedCopybooks: string[];
  metrics: {
    totalLines: number;
    groupItems: number;
    elementaryItems: number;
    redefinitions: number;
    occursCount: number;
  };
}

export interface InferredEntity {
  entityName: string;
  entityType: 'MASTER' | 'TRANSACTION' | 'REFERENCE' | 'WORK' | 'UNKNOWN';
  confidence: number;
  evidence: string[];
}

// ============================================================================
// Main Analyzer Class
// ============================================================================

export class CopybookAnalyzer {
  private lines: string[] = [];
  private upperLines: string[] = [];

  /**
   * Analyze a copybook file
   */
  async analyze(filePath: string): Promise<CopybookAnalysisResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    this.lines = content.split('\n');
    this.upperLines = this.lines.map(l => l.toUpperCase());

    const fields = this.extractFields();
    const recordLayouts = this.buildRecordLayouts(fields);
    const inferredEntity = this.inferBusinessEntity(recordLayouts, path.basename(filePath));
    const referencedCopybooks = this.extractReferencedCopybooks();
    const metrics = this.calculateMetrics(fields);

    return {
      fileName: path.basename(filePath),
      filePath,
      recordLayouts,
      inferredEntity,
      totalFields: fields.length,
      referencedCopybooks,
      metrics
    };
  }

  /**
   * Extract all fields from copybook
   */
  private extractFields(): CopybookField[] {
    const fields: CopybookField[] = [];
    let currentOffset = 0;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith('*') ||
          (line.length >= 7 && line[6] === '*')) {
        continue;
      }

      // Match level number and field name
      const fieldMatch = trimmedLine.match(/^(\d{2})\s+([A-Z0-9\-]+)/i);
      if (!fieldMatch) continue;

      const level = parseInt(fieldMatch[1]);
      const name = fieldMatch[2].toUpperCase();

      // Skip FILLER
      if (name === 'FILLER') {
        const length = this.calculateFieldLength(trimmedLine);
        currentOffset += length;
        continue;
      }

      const field = this.parseFieldDefinition(trimmedLine, name, level, currentOffset);

      // Update offset for non-group items
      if (level !== 1 && level !== 66 && level !== 77 && level !== 88 && !field.children.length) {
        currentOffset += field.length;
      }

      fields.push(field);
    }

    return fields;
  }

  /**
   * Parse a single field definition
   */
  private parseFieldDefinition(line: string, name: string, level: number, offset: number): CopybookField {
    const upperLine = line.toUpperCase();

    const field: CopybookField = {
      name,
      level,
      offset,
      length: 0,
      dataType: 'GROUP',
      isKey: this.inferIsKey(name),
      businessMeaning: this.inferFieldMeaning(name),
      children: []
    };

    // Extract PIC clause
    const picMatch = upperLine.match(/PIC(?:TURE)?\s+(?:IS\s+)?([^\s.]+)/);
    if (picMatch) {
      field.picture = picMatch[1];
      field.length = this.calculatePictureLength(picMatch[1]);
      field.dataType = this.inferDataType(picMatch[1], upperLine);
    }

    // Extract USAGE clause
    const usageMatch = upperLine.match(/USAGE\s+(?:IS\s+)?(DISPLAY|COMP|COMP-1|COMP-2|COMP-3|COMP-4|COMP-5|BINARY|PACKED-DECIMAL)/);
    if (usageMatch) {
      field.usage = usageMatch[1];
      if (usageMatch[1].includes('COMP-3') || usageMatch[1].includes('PACKED')) {
        field.dataType = 'PACKED';
      } else if (usageMatch[1].includes('COMP') || usageMatch[1].includes('BINARY')) {
        field.dataType = 'BINARY';
      }
    }

    // Extract OCCURS clause
    const occursMatch = upperLine.match(/OCCURS\s+(\d+)/);
    if (occursMatch) {
      field.occurs = parseInt(occursMatch[1]);
    }

    // Extract REDEFINES clause
    const redefinesMatch = upperLine.match(/REDEFINES\s+([A-Z0-9\-]+)/);
    if (redefinesMatch) {
      field.redefines = redefinesMatch[1];
    }

    // Extract VALUE clause
    const valueMatch = upperLine.match(/VALUE\s+(?:IS\s+)?(['"]?[^.'"\s]+['"]?|SPACES?|ZEROS?)/);
    if (valueMatch) {
      field.value = valueMatch[1];
    }

    // Group items have no PIC - set length to 0 (will be calculated from children)
    if (!field.picture) {
      field.dataType = 'GROUP';
      field.length = 0;
    }

    return field;
  }

  /**
   * Calculate the byte length of a PIC clause
   */
  private calculatePictureLength(pic: string): number {
    let length = 0;
    const upperPic = pic.toUpperCase();

    // Handle repeated patterns like X(10), 9(5), etc.
    const expandedPic = upperPic.replace(/([X9AZS\-V+,.])\((\d+)\)/g, (_, char, count) => {
      return char.repeat(parseInt(count));
    });

    for (const char of expandedPic) {
      if ('X9AZBS+-'.includes(char)) {
        length++;
      } else if (char === 'V') {
        // Virtual decimal - no storage
      } else if (char === '.') {
        length++; // Actual decimal point
      }
    }

    return length;
  }

  /**
   * Calculate field length from a line (for FILLER)
   */
  private calculateFieldLength(line: string): number {
    const picMatch = line.toUpperCase().match(/PIC(?:TURE)?\s+(?:IS\s+)?([^\s.]+)/);
    if (picMatch) {
      return this.calculatePictureLength(picMatch[1]);
    }
    return 0;
  }

  /**
   * Infer data type from PIC clause
   */
  private inferDataType(pic: string, line: string): CopybookField['dataType'] {
    const upperPic = pic.toUpperCase();

    if (line.includes('COMP-3') || line.includes('PACKED')) {
      return 'PACKED';
    }
    if (line.includes('COMP') || line.includes('BINARY')) {
      return 'BINARY';
    }
    if (upperPic.includes('X') || upperPic.includes('A')) {
      return 'ALPHANUMERIC';
    }
    if (upperPic.includes('9') || upperPic.includes('S') || upperPic.includes('V')) {
      return 'NUMERIC';
    }

    return 'ALPHANUMERIC';
  }

  /**
   * Infer if field is likely a key
   */
  private inferIsKey(name: string): boolean {
    const upper = name.toUpperCase();
    const keyPatterns = ['KEY', '-ID', '-CD', '-CODE', '-NO', '-NUM', '-NBR'];
    return keyPatterns.some(p => upper.includes(p) || upper.endsWith(p));
  }

  /**
   * Infer business meaning from field name
   */
  private inferFieldMeaning(name: string): string {
    const upper = name.toUpperCase();

    const meanings: [string[], string][] = [
      [['CUST', 'CUSTOMER'], 'Customer identifier/data'],
      [['ACCT', 'ACCOUNT'], 'Account identifier/data'],
      [['TRANS', 'TXN'], 'Transaction data'],
      [['DATE', 'DT', 'YMD'], 'Date value'],
      [['TIME', 'TM', 'HMS'], 'Time value'],
      [['AMOUNT', 'AMT', 'BAL'], 'Monetary amount'],
      [['STATUS', 'STAT', 'STS'], 'Status indicator'],
      [['FLAG', 'IND', 'SW'], 'Boolean flag'],
      [['CODE', 'CD', 'TYPE', 'TYP'], 'Code/type value'],
      [['NAME', 'NM'], 'Name field'],
      [['ADDR', 'ADDRESS'], 'Address data'],
      [['PHONE', 'TEL'], 'Phone number'],
      [['EMAIL', 'MAIL'], 'Email address'],
      [['COUNT', 'CNT', 'CTR'], 'Counter'],
      [['TOTAL', 'TOT', 'SUM'], 'Total/sum value'],
      [['DESC', 'DESCRIPTION'], 'Description text'],
      [['ERROR', 'ERR'], 'Error information'],
      [['SEQ', 'SEQUENCE'], 'Sequence number'],
      [['REC', 'RECORD'], 'Record identifier']
    ];

    for (const [patterns, meaning] of meanings) {
      if (patterns.some(p => upper.includes(p))) {
        return meaning;
      }
    }

    return 'Business data';
  }

  /**
   * Build hierarchical record layouts
   */
  private buildRecordLayouts(fields: CopybookField[]): RecordLayout[] {
    const layouts: RecordLayout[] = [];
    let currentLayout: RecordLayout | null = null;
    const levelStack: CopybookField[] = [];

    for (const field of fields) {
      // Level 01 starts a new record
      if (field.level === 1) {
        if (currentLayout) {
          currentLayout.totalLength = this.calculateRecordLength(currentLayout.fields);
          currentLayout.keys = this.extractKeys(currentLayout.fields);
          layouts.push(currentLayout);
        }

        currentLayout = {
          recordName: field.name,
          copybooks: [],
          totalLength: 0,
          fields: [field],
          keys: [],
          entityType: this.inferEntityType(field.name)
        };
        levelStack.length = 0;
        levelStack.push(field);
        continue;
      }

      if (!currentLayout) continue;

      // Find parent based on level
      while (levelStack.length > 0 && levelStack[levelStack.length - 1].level >= field.level) {
        levelStack.pop();
      }

      if (levelStack.length > 0) {
        levelStack[levelStack.length - 1].children.push(field);
      } else {
        currentLayout.fields.push(field);
      }

      if (field.level !== 88) {
        levelStack.push(field);
      }
    }

    // Add last layout
    if (currentLayout) {
      currentLayout.totalLength = this.calculateRecordLength(currentLayout.fields);
      currentLayout.keys = this.extractKeys(currentLayout.fields);
      layouts.push(currentLayout);
    }

    return layouts;
  }

  /**
   * Calculate total record length
   */
  private calculateRecordLength(fields: CopybookField[]): number {
    let total = 0;

    const sumFieldLengths = (fieldList: CopybookField[]): number => {
      let sum = 0;
      for (const field of fieldList) {
        if (field.children.length > 0) {
          sum += sumFieldLengths(field.children);
        } else if (field.level !== 88) {
          const multiplier = field.occurs || 1;
          sum += field.length * multiplier;
        }
      }
      return sum;
    };

    return sumFieldLengths(fields);
  }

  /**
   * Extract key structures from fields
   */
  private extractKeys(fields: CopybookField[]): KeyStructure[] {
    const keys: KeyStructure[] = [];

    const findKeyFields = (fieldList: CopybookField[], parentPath: string = '') => {
      for (const field of fieldList) {
        if (field.isKey && field.level !== 88) {
          const fullName = parentPath ? `${parentPath}.${field.name}` : field.name;

          // Determine key type
          let keyType: KeyStructure['keyType'] = 'ALTERNATE';
          if (field.name.includes('PRIMARY') || field.name.includes('KEY') && !field.name.includes('ALT')) {
            keyType = 'PRIMARY';
          } else if (field.name.includes('FK') || field.name.includes('FOREIGN')) {
            keyType = 'FOREIGN';
          }

          keys.push({
            keyName: fullName,
            keyType,
            fields: [field.name],
            isUnique: keyType === 'PRIMARY'
          });
        }

        if (field.children.length > 0) {
          findKeyFields(field.children, field.name);
        }
      }
    };

    findKeyFields(fields);
    return keys;
  }

  /**
   * Infer entity type from record name
   */
  private inferEntityType(recordName: string): string {
    const upper = recordName.toUpperCase();

    if (upper.includes('MAST') || upper.includes('MST')) return 'MASTER';
    if (upper.includes('TRANS') || upper.includes('TXN') || upper.includes('TRN')) return 'TRANSACTION';
    if (upper.includes('REF') || upper.includes('CODE') || upper.includes('TBL')) return 'REFERENCE';
    if (upper.includes('WORK') || upper.includes('WRK') || upper.includes('TEMP')) return 'WORK';
    if (upper.includes('HDR') || upper.includes('HEADER')) return 'HEADER';
    if (upper.includes('DTL') || upper.includes('DETAIL')) return 'DETAIL';

    return 'DATA';
  }

  /**
   * Infer business entity from record layouts
   */
  private inferBusinessEntity(layouts: RecordLayout[], fileName: string): InferredEntity | null {
    if (layouts.length === 0) return null;

    const evidence: string[] = [];
    let entityType: InferredEntity['entityType'] = 'UNKNOWN';
    let confidence = 0.5;
    let entityName = fileName.replace(/\.(cpy|CPY)$/, '');

    // Analyze primary record
    const primaryRecord = layouts[0];

    // Check for master file patterns
    const hasMasterPattern = primaryRecord.recordName.toUpperCase().includes('MAST') ||
                            primaryRecord.recordName.toUpperCase().includes('MST');
    if (hasMasterPattern) {
      entityType = 'MASTER';
      confidence += 0.2;
      evidence.push(`Record name contains master pattern: ${primaryRecord.recordName}`);
    }

    // Check for transaction patterns
    const hasTransPattern = primaryRecord.recordName.toUpperCase().includes('TRANS') ||
                           primaryRecord.recordName.toUpperCase().includes('TXN');
    if (hasTransPattern) {
      entityType = 'TRANSACTION';
      confidence += 0.2;
      evidence.push(`Record name contains transaction pattern: ${primaryRecord.recordName}`);
    }

    // Check key structures
    if (primaryRecord.keys.some(k => k.keyType === 'PRIMARY')) {
      confidence += 0.15;
      evidence.push('Has primary key structure');
    }

    // Check for common entity patterns in field names
    const allFieldNames = this.getAllFieldNames(primaryRecord.fields);

    const entityPatterns: [string[], string, InferredEntity['entityType']][] = [
      [['CUST-ID', 'CUSTOMER-ID', 'CUST-NO'], 'Customer', 'MASTER'],
      [['ACCT-ID', 'ACCOUNT-ID', 'ACCT-NO'], 'Account', 'MASTER'],
      [['EMP-ID', 'EMPLOYEE-ID', 'EMP-NO'], 'Employee', 'MASTER'],
      [['PROD-ID', 'PRODUCT-ID', 'PROD-CD'], 'Product', 'MASTER'],
      [['ORDER-ID', 'ORDER-NO', 'ORD-NO'], 'Order', 'TRANSACTION'],
      [['TRANS-ID', 'TXN-ID', 'TRANS-NO'], 'Transaction', 'TRANSACTION']
    ];

    for (const [patterns, name, type] of entityPatterns) {
      if (patterns.some(p => allFieldNames.some(f => f.includes(p)))) {
        entityName = name;
        entityType = type;
        confidence += 0.15;
        evidence.push(`Field pattern suggests ${name} entity`);
        break;
      }
    }

    return {
      entityName,
      entityType,
      confidence: Math.min(confidence, 1.0),
      evidence
    };
  }

  /**
   * Get all field names recursively
   */
  private getAllFieldNames(fields: CopybookField[]): string[] {
    const names: string[] = [];

    const collect = (fieldList: CopybookField[]) => {
      for (const field of fieldList) {
        names.push(field.name);
        if (field.children.length > 0) {
          collect(field.children);
        }
      }
    };

    collect(fields);
    return names;
  }

  /**
   * Extract referenced copybooks
   */
  private extractReferencedCopybooks(): string[] {
    const copybooks: string[] = [];

    for (const line of this.upperLines) {
      const copyMatch = line.match(/COPY\s+([A-Z0-9\-]+)/);
      if (copyMatch && !copybooks.includes(copyMatch[1])) {
        copybooks.push(copyMatch[1]);
      }
    }

    return copybooks;
  }

  /**
   * Calculate metrics
   */
  private calculateMetrics(fields: CopybookField[]): CopybookAnalysisResult['metrics'] {
    let groupItems = 0;
    let elementaryItems = 0;
    let redefinitions = 0;
    let occursCount = 0;

    const countFields = (fieldList: CopybookField[]) => {
      for (const field of fieldList) {
        if (field.children.length > 0) {
          groupItems++;
          countFields(field.children);
        } else if (field.level !== 88) {
          elementaryItems++;
        }

        if (field.redefines) redefinitions++;
        if (field.occurs) occursCount++;
      }
    };

    countFields(fields);

    return {
      totalLines: this.lines.length,
      groupItems,
      elementaryItems,
      redefinitions,
      occursCount
    };
  }
}

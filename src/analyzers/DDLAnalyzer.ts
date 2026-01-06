/**
 * DDL Analyzer for Oracle/PostgreSQL/MySQL
 *
 * Parses DDL (Data Definition Language) files to extract database schema information
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKey?: string[];
  foreignKeys: ForeignKeyDefinition[];
  indexes: IndexDefinition[];
  constraints: string[];
}

export interface ColumnDefinition {
  name: string;
  dataType: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  defaultValue?: string;
}

export interface ForeignKeyDefinition {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique: boolean;
  type?: string;
}

export interface DDLAnalysisResult {
  tables: TableDefinition[];
  views: string[];
  sequences: string[];
  storedProcedures: string[];
  triggers: string[];
  functions: string[];
  totalTables: number;
  totalColumns: number;
  totalIndexes: number;
}

export class DDLAnalyzer {
  /**
   * Analyze a DDL file
   */
  async analyze(filePath: string): Promise<DDLAnalysisResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const statements = this.splitStatements(content);

    const result: DDLAnalysisResult = {
      tables: [],
      views: [],
      sequences: [],
      storedProcedures: [],
      triggers: [],
      functions: [],
      totalTables: 0,
      totalColumns: 0,
      totalIndexes: 0
    };

    for (const statement of statements) {
      const trimmed = statement.trim().toUpperCase();

      if (trimmed.startsWith('CREATE TABLE')) {
        const table = this.parseCreateTable(statement);
        if (table) {
          result.tables.push(table);
        }
      } else if (trimmed.startsWith('CREATE VIEW')) {
        const viewName = this.extractViewName(statement);
        if (viewName) result.views.push(viewName);
      } else if (trimmed.startsWith('CREATE SEQUENCE')) {
        const seqName = this.extractSequenceName(statement);
        if (seqName) result.sequences.push(seqName);
      } else if (trimmed.startsWith('CREATE PROCEDURE') || trimmed.startsWith('CREATE OR REPLACE PROCEDURE')) {
        const procName = this.extractProcedureName(statement);
        if (procName) result.storedProcedures.push(procName);
      } else if (trimmed.startsWith('CREATE TRIGGER')) {
        const triggerName = this.extractTriggerName(statement);
        if (triggerName) result.triggers.push(triggerName);
      } else if (trimmed.startsWith('CREATE FUNCTION') || trimmed.startsWith('CREATE OR REPLACE FUNCTION')) {
        const funcName = this.extractFunctionName(statement);
        if (funcName) result.functions.push(funcName);
      }
    }

    // Calculate totals
    result.totalTables = result.tables.length;
    result.totalColumns = result.tables.reduce((sum, table) => sum + table.columns.length, 0);
    result.totalIndexes = result.tables.reduce((sum, table) => sum + table.indexes.length, 0);

    return result;
  }

  /**
   * Split DDL content into individual statements
   */
  private splitStatements(content: string): string[] {
    // Remove comments
    content = content.replace(/--[^\n]*/g, ''); // Single line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments

    // Split by semicolon (basic approach)
    const statements = content.split(';').map(s => s.trim()).filter(s => s.length > 0);

    return statements;
  }

  /**
   * Parse CREATE TABLE statement
   */
  private parseCreateTable(statement: string): TableDefinition | null {
    const tableNameMatch = statement.match(/CREATE\s+TABLE\s+([^\s(]+)/i);
    if (!tableNameMatch) return null;

    const tableName = tableNameMatch[1].replace(/["`]/g, '');

    // Extract column definitions between parentheses
    const columnsMatch = statement.match(/\(([\s\S]+)\)/);
    if (!columnsMatch) return null;

    const columnsSection = columnsMatch[1];
    const lines = columnsSection.split(',').map(line => line.trim());

    const table: TableDefinition = {
      name: tableName,
      columns: [],
      foreignKeys: [],
      indexes: [],
      constraints: []
    };

    for (const line of lines) {
      const upperLine = line.toUpperCase();

      if (upperLine.startsWith('CONSTRAINT') && upperLine.includes('PRIMARY KEY')) {
        // Primary key constraint
        const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          table.primaryKey = pkMatch[1].split(',').map(col => col.trim().replace(/["`]/g, ''));
        }
      } else if (upperLine.startsWith('CONSTRAINT') && upperLine.includes('FOREIGN KEY')) {
        // Foreign key constraint
        const fk = this.parseForeignKey(line);
        if (fk) table.foreignKeys.push(fk);
      } else if (upperLine.startsWith('PRIMARY KEY')) {
        // Inline primary key
        const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          table.primaryKey = pkMatch[1].split(',').map(col => col.trim().replace(/["`]/g, ''));
        }
      } else if (!upperLine.startsWith('CONSTRAINT')) {
        // Column definition
        const column = this.parseColumnDefinition(line);
        if (column) table.columns.push(column);
      }
    }

    return table;
  }

  /**
   * Parse column definition
   */
  private parseColumnDefinition(line: string): ColumnDefinition | null {
    // Example: CUSTOMER_ID NUMBER(10) NOT NULL
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const columnName = parts[0].replace(/["`]/g, '');
    const dataTypeRaw = parts[1];

    // Parse data type with optional length/precision
    const typeMatch = dataTypeRaw.match(/^([A-Z0-9_]+)(?:\((\d+)(?:,(\d+))?\))?/i);
    if (!typeMatch) return null;

    const column: ColumnDefinition = {
      name: columnName,
      dataType: typeMatch[1].toUpperCase(),
      nullable: !line.toUpperCase().includes('NOT NULL')
    };

    if (typeMatch[2]) {
      column.length = parseInt(typeMatch[2]);
    }

    if (typeMatch[3]) {
      column.precision = parseInt(typeMatch[2]);
      column.scale = parseInt(typeMatch[3]);
    }

    // Check for DEFAULT value
    const defaultMatch = line.match(/DEFAULT\s+([^\s,]+)/i);
    if (defaultMatch) {
      column.defaultValue = defaultMatch[1];
    }

    return column;
  }

  /**
   * Parse foreign key constraint
   */
  private parseForeignKey(line: string): ForeignKeyDefinition | null {
    // CONSTRAINT fk_name FOREIGN KEY (col1) REFERENCES other_table (col2)
    const fkMatch = line.match(/CONSTRAINT\s+([^\s]+)\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i);
    if (!fkMatch) return null;

    return {
      name: fkMatch[1].replace(/["`]/g, ''),
      columns: fkMatch[2].split(',').map(col => col.trim().replace(/["`]/g, '')),
      referencedTable: fkMatch[3].replace(/["`]/g, ''),
      referencedColumns: fkMatch[4].split(',').map(col => col.trim().replace(/["`]/g, ''))
    };
  }

  /**
   * Extract view name from CREATE VIEW statement
   */
  private extractViewName(statement: string): string | null {
    const match = statement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([^\s(]+)/i);
    return match ? match[1].replace(/["`]/g, '') : null;
  }

  /**
   * Extract sequence name
   */
  private extractSequenceName(statement: string): string | null {
    const match = statement.match(/CREATE\s+SEQUENCE\s+([^\s;]+)/i);
    return match ? match[1].replace(/["`]/g, '') : null;
  }

  /**
   * Extract procedure name
   */
  private extractProcedureName(statement: string): string | null {
    const match = statement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([^\s(]+)/i);
    return match ? match[1].replace(/["`]/g, '') : null;
  }

  /**
   * Extract trigger name
   */
  private extractTriggerName(statement: string): string | null {
    const match = statement.match(/CREATE\s+TRIGGER\s+([^\s]+)/i);
    return match ? match[1].replace(/["`]/g, '') : null;
  }

  /**
   * Extract function name
   */
  private extractFunctionName(statement: string): string | null {
    const match = statement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)/i);
    return match ? match[1].replace(/["`]/g, '') : null;
  }

  /**
   * Estimate row count from DDL comments or external metadata
   */
  estimateRowCount(tableName: string): number {
    // Placeholder - in real implementation, would query database or use metadata
    return 0;
  }
}

/**
 * PostgreSQL DDL Analyzer
 *
 * Extends DDLAnalyzer to parse PostgreSQL-specific DDL features for migration to Oracle.
 * Detects PostgreSQL data types, index types, PL/pgSQL functions, partitioning, extensions, etc.
 */

import { DDLAnalyzer, DDLAnalysisResult, TableDefinition } from './DDLAnalyzer.js';
import * as fs from 'fs';

export interface DataTypeUsage {
  type: string;
  count: number;
  tables: string[];
  oracleMappingComplexity: 'Simple' | 'Moderate' | 'Complex';
  suggestedOracleType: string;
}

export interface IndexTypeInfo {
  type: string; // 'BTREE', 'HASH', 'GIN', 'GIST', 'BRIN', 'SP-GIST'
  count: number;
  oracleSupport: boolean;
}

export interface PLpgSQLFunctionInfo {
  name: string;
  complexity: number; // Lines of code
  usesDynamicSQL: boolean;
  usesArrays: boolean;
  usesJSON: boolean;
  returnsTable: boolean;
}

export interface TriggerDetailInfo {
  name: string;
  timing: string; // BEFORE/AFTER/INSTEAD OF
  event: string; // INSERT/UPDATE/DELETE
  forEach: string; // ROW/STATEMENT
  hasReturningClause: boolean;
}

export interface SequenceDetailInfo {
  name: string;
  dataType: string; // BIGINT, INTEGER, SMALLINT
  increment: number;
  isSerial: boolean; // Created via SERIAL type
}

export interface PartitionedTableInfo {
  name: string;
  strategy: string; // RANGE, LIST, HASH
  partitionCount: number;
}

export interface RowCountEstimate {
  table: string;
  estimatedRows: number;
  sizeCategory: 'Small' | 'Medium' | 'Large' | 'Very Large';
}

export interface PostgreSQLFeatures {
  dataTypeUsage: DataTypeUsage[];
  indexTypes: IndexTypeInfo[];
  partialIndexes: number;
  expressionIndexes: number;
  plpgsqlFunctions: PLpgSQLFunctionInfo[];
  triggerDetails: TriggerDetailInfo[];
  sequenceDetails: SequenceDetailInfo[];
  extensions: string[];
  partitionedTables: PartitionedTableInfo[];
  inheritanceTables: string[];
  rlsPolicies: number;
  estimatedRowCounts: RowCountEstimate[];
  checkConstraints: number;
  exclusionConstraints: number;
}

export interface PostgreSQLDDLAnalysisResult extends DDLAnalysisResult {
  postgresqlFeatures: PostgreSQLFeatures;
}

export class PostgreSQLDDLAnalyzer extends DDLAnalyzer {
  /**
   * Analyze PostgreSQL DDL file with PostgreSQL-specific features
   */
  async analyze(filePath: string): Promise<PostgreSQLDDLAnalysisResult> {
    // Get base DDL analysis from parent class
    const baseResult = await super.analyze(filePath);

    // Read file content again for PostgreSQL-specific analysis
    const content = fs.readFileSync(filePath, 'utf-8');

    // Analyze PostgreSQL-specific features
    const postgresqlFeatures = this.analyzePostgreSQLFeatures(content, baseResult);

    return {
      ...baseResult,
      postgresqlFeatures
    };
  }

  /**
   * Analyze PostgreSQL-specific features
   */
  private analyzePostgreSQLFeatures(content: string, baseResult: DDLAnalysisResult): PostgreSQLFeatures {
    return {
      dataTypeUsage: this.analyzeDataTypeUsage(content, baseResult.tables),
      indexTypes: this.analyzeIndexTypes(content),
      partialIndexes: this.countPartialIndexes(content),
      expressionIndexes: this.countExpressionIndexes(content),
      plpgsqlFunctions: this.analyzePLpgSQLFunctions(content),
      triggerDetails: this.analyzeTriggerDetails(content),
      sequenceDetails: this.analyzeSequenceDetails(content, baseResult.tables),
      extensions: this.detectExtensions(content),
      partitionedTables: this.analyzePartitionedTables(content),
      inheritanceTables: this.detectInheritanceTables(content),
      rlsPolicies: this.countRLSPolicies(content),
      estimatedRowCounts: this.estimateRowCounts(baseResult.tables),
      checkConstraints: this.countCheckConstraints(content),
      exclusionConstraints: this.countExclusionConstraints(content)
    };
  }

  /**
   * Analyze PostgreSQL data type usage with Oracle mapping information
   */
  private analyzeDataTypeUsage(content: string, tables: TableDefinition[]): DataTypeUsage[] {
    const dataTypeMap = new Map<string, DataTypeUsage>();

    // Oracle mapping guide
    const oracleMappings: { [key: string]: { oracle: string; complexity: 'Simple' | 'Moderate' | 'Complex' } } = {
      'SERIAL': { oracle: 'NUMBER + SEQUENCE + TRIGGER', complexity: 'Simple' },
      'BIGSERIAL': { oracle: 'NUMBER + SEQUENCE + TRIGGER', complexity: 'Simple' },
      'SMALLSERIAL': { oracle: 'NUMBER + SEQUENCE + TRIGGER', complexity: 'Simple' },
      'BOOLEAN': { oracle: 'NUMBER(1) or CHAR(1)', complexity: 'Simple' },
      'UUID': { oracle: 'RAW(16) or VARCHAR2(36)', complexity: 'Moderate' },
      'JSONB': { oracle: 'JSON (12c+) or CLOB', complexity: 'Complex' },
      'JSON': { oracle: 'JSON (12c+) or CLOB', complexity: 'Moderate' },
      'ARRAY': { oracle: 'VARRAY or Nested Table', complexity: 'Complex' },
      'HSTORE': { oracle: 'JSON or Separate Table', complexity: 'Complex' },
      'INET': { oracle: 'VARCHAR2(45)', complexity: 'Simple' },
      'MACADDR': { oracle: 'VARCHAR2(17)', complexity: 'Simple' },
      'CITEXT': { oracle: 'VARCHAR2 + Function-based Index', complexity: 'Moderate' },
      'TSQUERY': { oracle: 'Oracle Text Index', complexity: 'Complex' },
      'TSVECTOR': { oracle: 'Oracle Text Index', complexity: 'Complex' },
      'BYTEA': { oracle: 'BLOB', complexity: 'Simple' },
      'TEXT': { oracle: 'CLOB', complexity: 'Simple' }
    };

    // Analyze tables for data type usage
    for (const table of tables) {
      for (const column of table.columns) {
        const baseType = column.dataType.replace(/\[\]$/g, ''); // Remove array suffix
        const isArray = column.dataType.endsWith('[]');

        let pgType = baseType;
        if (isArray) pgType = 'ARRAY';

        // Check if this is a PostgreSQL-specific type
        if (oracleMappings[pgType]) {
          if (!dataTypeMap.has(pgType)) {
            dataTypeMap.set(pgType, {
              type: pgType,
              count: 0,
              tables: [],
              oracleMappingComplexity: oracleMappings[pgType].complexity,
              suggestedOracleType: oracleMappings[pgType].oracle
            });
          }

          const usage = dataTypeMap.get(pgType)!;
          usage.count++;
          if (!usage.tables.includes(table.name)) {
            usage.tables.push(table.name);
          }
        }
      }
    }

    // Also check for SERIAL types in CREATE TABLE statements
    const serialPattern = /(SMALL|BIG)?SERIAL/gi;
    const serialMatches = content.match(serialPattern);
    if (serialMatches) {
      for (const match of serialMatches) {
        const type = match.toUpperCase();
        if (!dataTypeMap.has(type)) {
          dataTypeMap.set(type, {
            type,
            count: 0,
            tables: [],
            oracleMappingComplexity: 'Simple',
            suggestedOracleType: 'NUMBER + SEQUENCE + TRIGGER'
          });
        }
        dataTypeMap.get(type)!.count++;
      }
    }

    return Array.from(dataTypeMap.values());
  }

  /**
   * Analyze index types
   */
  private analyzeIndexTypes(content: string): IndexTypeInfo[] {
    const indexTypeMap = new Map<string, IndexTypeInfo>();

    // PostgreSQL index types and Oracle support
    const indexTypeSupport: { [key: string]: boolean } = {
      'BTREE': true,  // Oracle has B-tree
      'HASH': true,   // Oracle has hash indexes
      'GIN': false,   // No direct equivalent
      'GIST': false,  // No direct equivalent
      'BRIN': false,  // No direct equivalent
      'SPGIST': false // No direct equivalent
    };

    // Default to BTREE if not specified
    const indexPattern = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+\w+\s+ON\s+\w+\s+(?:USING\s+(\w+)\s+)?\(/gi;
    let match;

    while ((match = indexPattern.exec(content)) !== null) {
      const indexType = match[1] ? match[1].toUpperCase() : 'BTREE';

      if (!indexTypeMap.has(indexType)) {
        indexTypeMap.set(indexType, {
          type: indexType,
          count: 0,
          oracleSupport: indexTypeSupport[indexType] !== undefined ? indexTypeSupport[indexType] : false
        });
      }

      indexTypeMap.get(indexType)!.count++;
    }

    return Array.from(indexTypeMap.values());
  }

  /**
   * Count partial indexes (indexes with WHERE clause)
   */
  private countPartialIndexes(content: string): number {
    const partialIndexPattern = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+\w+\s+ON\s+\w+\s*.*\s+WHERE\s+/gi;
    const matches = content.match(partialIndexPattern);
    return matches ? matches.length : 0;
  }

  /**
   * Count expression indexes (indexes on expressions/functions)
   */
  private countExpressionIndexes(content: string): number {
    // Look for indexes with functions or expressions
    const expressionIndexPattern = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+\w+\s+ON\s+\w+\s*\([^)]*(?:lower|upper|substring|to_char|\+|\-|\*|\/)[^)]*\)/gi;
    const matches = content.match(expressionIndexPattern);
    return matches ? matches.length : 0;
  }

  /**
   * Analyze PL/pgSQL functions
   */
  private analyzePLpgSQLFunctions(content: string): PLpgSQLFunctionInfo[] {
    const functions: PLpgSQLFunctionInfo[] = [];

    // Find all function definitions
    const functionPattern = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)\s*\([^)]*\)\s+RETURNS?\s+([^\s]+)\s+(?:AS|LANGUAGE)\s+(['"]?\$\$['"]?|')?([^]*?)(?:\$\$|')\s*LANGUAGE\s+plpgsql/gi;
    let match;

    while ((match = functionPattern.exec(content)) !== null) {
      const name = match[1];
      const returnType = match[2];
      const body = match[4] || '';

      const bodyLines = body.split('\n').filter(line => line.trim().length > 0);
      const complexity = bodyLines.length;

      functions.push({
        name,
        complexity,
        usesDynamicSQL: /EXECUTE\s+/i.test(body),
        usesArrays: /ARRAY\[|array_/i.test(body),
        usesJSON: /jsonb_|json_|->|->>/i.test(body),
        returnsTable: /RETURNS\s+TABLE/i.test(returnType) || /RETURNS\s+SETOF/i.test(returnType)
      });
    }

    return functions;
  }

  /**
   * Analyze trigger details
   */
  private analyzeTriggerDetails(content: string): TriggerDetailInfo[] {
    const triggers: TriggerDetailInfo[] = [];

    // Parse trigger definitions
    const triggerPattern = /CREATE\s+TRIGGER\s+(\w+)\s+(BEFORE|AFTER|INSTEAD\s+OF)\s+(INSERT|UPDATE|DELETE)(?:\s+OR\s+(?:INSERT|UPDATE|DELETE))*\s+ON\s+\w+\s+FOR\s+EACH\s+(ROW|STATEMENT)/gi;
    let match;

    while ((match = triggerPattern.exec(content)) !== null) {
      triggers.push({
        name: match[1],
        timing: match[2],
        event: match[3],
        forEach: match[4],
        hasReturningClause: false // Will be updated if RETURNING is found in related queries
      });
    }

    return triggers;
  }

  /**
   * Analyze sequence details
   */
  private analyzeSequenceDetails(content: string, tables: TableDefinition[]): SequenceDetailInfo[] {
    const sequences: SequenceDetailInfo[] = [];

    // Explicit CREATE SEQUENCE statements
    const sequencePattern = /CREATE\s+SEQUENCE\s+(\w+)\s+(?:AS\s+(\w+)\s+)?(?:INCREMENT\s+(?:BY\s+)?(\d+))?/gi;
    let match;

    while ((match = sequencePattern.exec(content)) !== null) {
      sequences.push({
        name: match[1],
        dataType: match[2] || 'BIGINT',
        increment: match[3] ? parseInt(match[3]) : 1,
        isSerial: false
      });
    }

    // Detect SERIAL-generated sequences from table definitions
    for (const table of tables) {
      for (const column of table.columns) {
        if (/SERIAL$/i.test(column.dataType)) {
          const sequenceName = `${table.name}_${column.name}_seq`;
          sequences.push({
            name: sequenceName,
            dataType: column.dataType.toUpperCase().includes('BIG') ? 'BIGINT' : 'INTEGER',
            increment: 1,
            isSerial: true
          });
        }
      }
    }

    return sequences;
  }

  /**
   * Detect PostgreSQL extensions
   */
  private detectExtensions(content: string): string[] {
    const extensions: string[] = [];

    const extensionPattern = /CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi;
    let match;

    while ((match = extensionPattern.exec(content)) !== null) {
      extensions.push(match[1]);
    }

    // Also detect common extensions by usage patterns
    if (/ST_\w+|geography|geometry/i.test(content)) {
      if (!extensions.includes('postgis')) extensions.push('postgis');
    }
    if (/uuid_generate/i.test(content)) {
      if (!extensions.includes('uuid-ossp')) extensions.push('uuid-ossp');
    }
    if (/similarity\s*\(/i.test(content)) {
      if (!extensions.includes('pg_trgm')) extensions.push('pg_trgm');
    }

    return extensions;
  }

  /**
   * Analyze partitioned tables
   */
  private analyzePartitionedTables(content: string): PartitionedTableInfo[] {
    const partitionedTables: PartitionedTableInfo[] = [];

    // PostgreSQL 10+ declarative partitioning
    const partitionPattern = /CREATE\s+TABLE\s+(\w+)\s+\([^)]+\)\s+PARTITION\s+BY\s+(RANGE|LIST|HASH)\s*\(/gi;
    let match;

    while ((match = partitionPattern.exec(content)) !== null) {
      const tableName = match[1];
      const strategy = match[2];

      // Count partitions for this table
      const partitionCountPattern = new RegExp(`CREATE\\s+TABLE\\s+\\w+\\s+PARTITION\\s+OF\\s+${tableName}`, 'gi');
      const partitionMatches = content.match(partitionCountPattern);
      const partitionCount = partitionMatches ? partitionMatches.length : 0;

      partitionedTables.push({
        name: tableName,
        strategy,
        partitionCount
      });
    }

    return partitionedTables;
  }

  /**
   * Detect table inheritance
   */
  private detectInheritanceTables(content: string): string[] {
    const inheritanceTables: string[] = [];

    const inheritancePattern = /CREATE\s+TABLE\s+(\w+)\s+\([^)]*\)\s+INHERITS\s*\(\s*(\w+)\s*\)/gi;
    let match;

    while ((match = inheritancePattern.exec(content)) !== null) {
      inheritanceTables.push(match[1]);
    }

    return inheritanceTables;
  }

  /**
   * Count row-level security policies
   */
  private countRLSPolicies(content: string): number {
    const rlsPattern = /CREATE\s+POLICY|ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
    const matches = content.match(rlsPattern);
    return matches ? matches.length : 0;
  }

  /**
   * Estimate row counts based on table structure (heuristic)
   */
  private estimateRowCounts(tables: TableDefinition[]): RowCountEstimate[] {
    const estimates: RowCountEstimate[] = [];

    for (const table of tables) {
      // Heuristic: Use number of indexes as indicator of table size
      // More indexes often means larger/more important table
      const indexCount = table.indexes.length;
      const hasPartitioning = false; // Would be detected separately

      let estimatedRows = 100000; // Default
      let sizeCategory: 'Small' | 'Medium' | 'Large' | 'Very Large' = 'Medium';

      if (indexCount >= 5 || hasPartitioning) {
        estimatedRows = 10000000;
        sizeCategory = 'Very Large';
      } else if (indexCount >= 3) {
        estimatedRows = 1000000;
        sizeCategory = 'Large';
      } else if (indexCount >= 1) {
        estimatedRows = 100000;
        sizeCategory = 'Medium';
      } else {
        estimatedRows = 10000;
        sizeCategory = 'Small';
      }

      estimates.push({
        table: table.name,
        estimatedRows,
        sizeCategory
      });
    }

    return estimates;
  }

  /**
   * Count CHECK constraints
   */
  private countCheckConstraints(content: string): number {
    const checkPattern = /CONSTRAINT\s+\w+\s+CHECK\s*\(|CHECK\s*\(/gi;
    const matches = content.match(checkPattern);
    return matches ? matches.length : 0;
  }

  /**
   * Count EXCLUSION constraints (PostgreSQL-specific)
   */
  private countExclusionConstraints(content: string): number {
    const exclusionPattern = /CONSTRAINT\s+\w+\s+EXCLUDE|EXCLUDE\s+USING/gi;
    const matches = content.match(exclusionPattern);
    return matches ? matches.length : 0;
  }
}

/**
 * Java Analyzer for PostgreSQL Migration Analysis
 *
 * Analyzes Java source files to detect PostgreSQL dependencies, ORM framework usage,
 * and PostgreSQL-specific features that require migration to Oracle.
 *
 * This is a POC version using regex-based pattern matching.
 */

import * as fs from 'fs';
import * as path from 'path';

export enum OrmFramework {
  SPRING_DATA_JPA = 'Spring Data JPA',
  MYBATIS = 'MyBatis',
  HIBERNATE = 'Hibernate',
  JDBC_TEMPLATE = 'JDBC Template',
  PLAIN_JDBC = 'Plain JDBC',
  NONE = 'None'
}

export interface NativeQueryInfo {
  line: number;
  query: string;
  type: 'annotation' | 'string_literal' | 'xml';
  hasPostgreSQLSyntax: boolean;
  features: string[]; // List of PostgreSQL-specific features detected
}

export interface JavaAnalysisResult {
  name: string;
  path: string;
  type: string; // 'Controller', 'Service', 'Repository', 'Entity', 'Mapper', 'Config', 'Other'
  loc: number;
  ormFramework: OrmFramework;
  postgresqlDependencies: {
    // ORM & Framework Indicators
    repositoryAnnotations: number; // @Repository count
    entityAnnotations: number; // @Entity, @Table count
    mapperAnnotations: number; // @Mapper (MyBatis)
    jpaAnnotations: string[]; // @Query, @NamedQuery, etc.

    // PostgreSQL-specific SQL Features
    nativeQueries: NativeQueryInfo[];
    postgresqlFunctions: string[]; // array_agg, jsonb_*, etc.
    postgresqlDataTypes: string[]; // SERIAL, JSONB, ARRAY, etc.
    postgresqlOperators: string[]; // @>, <@, ||, etc.

    // JDBC Direct Usage
    jdbcCalls: number;
    preparedStatements: number;

    // PostgreSQL-specific Features in Code
    schemaSpecificCode: string[]; // pg_catalog references, etc.
    extensionUsage: string[]; // PostGIS, pg_trgm, etc.
  };
}

export class JavaAnalyzer {
  /**
   * Analyze a Java source file
   */
  async analyze(filePath: string): Promise<JavaAnalysisResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const fileName = path.basename(filePath, '.java');
    const ormFramework = this.detectOrmFramework(lines, content);
    const fileType = this.detectFileType(content, fileName);

    return {
      name: fileName,
      path: filePath,
      type: fileType,
      loc: this.countLOC(lines),
      ormFramework,
      postgresqlDependencies: {
        repositoryAnnotations: this.countPattern(content, /@Repository/g),
        entityAnnotations: this.countPattern(content, /@Entity|@Table/g),
        mapperAnnotations: this.countPattern(content, /@Mapper/g),
        jpaAnnotations: this.extractJPAAnnotations(content),
        nativeQueries: this.extractNativeQueries(lines, content),
        postgresqlFunctions: this.detectPostgreSQLFunctions(content),
        postgresqlDataTypes: this.detectPostgreSQLDataTypes(content),
        postgresqlOperators: this.detectPostgreSQLOperators(content),
        jdbcCalls: this.countPattern(content, /DriverManager\.getConnection|Connection\s+conn/g),
        preparedStatements: this.countPattern(content, /PreparedStatement/g),
        schemaSpecificCode: this.detectSchemaSpecificCode(content),
        extensionUsage: this.detectExtensionUsage(content)
      }
    };
  }

  /**
   * Count lines of code (excluding comments and blank lines)
   */
  private countLOC(lines: string[]): number {
    let count = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Handle block comments
      if (trimmed.includes('/*')) inBlockComment = true;
      if (trimmed.includes('*/')) {
        inBlockComment = false;
        continue;
      }
      if (inBlockComment) continue;

      // Skip single-line comments and blank lines
      if (trimmed && !trimmed.startsWith('//')) {
        count++;
      }
    }

    return count;
  }

  /**
   * Detect ORM framework being used
   */
  private detectOrmFramework(lines: string[], content: string): OrmFramework {
    // Check imports and annotations to determine framework
    const hasSpringDataJPA = /@Repository|@Entity|@Table|import org\.springframework\.data\.jpa/i.test(content);
    const hasMyBatis = /@Mapper|import org\.apache\.ibatis|SqlSession/i.test(content);
    const hasHibernate = /SessionFactory|import org\.hibernate/i.test(content);
    const hasJdbcTemplate = /JdbcTemplate|import org\.springframework\.jdbc\.core\.JdbcTemplate/i.test(content);
    const hasPlainJDBC = /DriverManager\.getConnection|import java\.sql\.DriverManager/i.test(content);

    // Priority order: Spring Data JPA > MyBatis > Hibernate > JDBC Template > Plain JDBC
    if (hasSpringDataJPA) return OrmFramework.SPRING_DATA_JPA;
    if (hasMyBatis) return OrmFramework.MYBATIS;
    if (hasHibernate) return OrmFramework.HIBERNATE;
    if (hasJdbcTemplate) return OrmFramework.JDBC_TEMPLATE;
    if (hasPlainJDBC) return OrmFramework.PLAIN_JDBC;

    return OrmFramework.NONE;
  }

  /**
   * Detect file type based on class name and annotations
   */
  private detectFileType(content: string, fileName: string): string {
    if (/@RestController|@Controller/i.test(content)) return 'Controller';
    if (/@Service/i.test(content)) return 'Service';
    if (/@Repository/i.test(content)) return 'Repository';
    if (/@Entity/i.test(content)) return 'Entity';
    if (/@Mapper/i.test(content)) return 'Mapper';
    if (/@Configuration/i.test(content)) return 'Config';
    if (fileName.endsWith('Controller')) return 'Controller';
    if (fileName.endsWith('Service')) return 'Service';
    if (fileName.endsWith('Repository')) return 'Repository';
    if (fileName.endsWith('Entity') || fileName.endsWith('Model')) return 'Entity';
    if (fileName.endsWith('Mapper')) return 'Mapper';
    if (fileName.endsWith('Config')) return 'Config';
    return 'Other';
  }

  /**
   * Extract JPA annotations
   */
  private extractJPAAnnotations(content: string): string[] {
    const annotations: string[] = [];
    const annotationPatterns = [
      '@Query',
      '@NamedQuery',
      '@NamedQueries',
      '@Modifying',
      '@Transactional',
      '@PersistenceContext'
    ];

    for (const pattern of annotationPatterns) {
      if (content.includes(pattern)) {
        annotations.push(pattern);
      }
    }

    return annotations;
  }

  /**
   * Extract native SQL queries from Java code
   */
  private extractNativeQueries(lines: string[], content: string): NativeQueryInfo[] {
    const queries: NativeQueryInfo[] = [];

    // Pattern 1: @Query annotation with nativeQuery=true
    const queryAnnotationPattern = /@Query\s*\(\s*value\s*=\s*"([^"]+)"|@Query\s*\(\s*"([^"]+)"/g;
    let match;
    while ((match = queryAnnotationPattern.exec(content)) !== null) {
      const query = match[1] || match[2];
      const lineNumber = this.getLineNumber(content, match.index);
      const analysis = this.analyzeQuery(query);

      queries.push({
        line: lineNumber,
        query,
        type: 'annotation',
        hasPostgreSQLSyntax: analysis.hasPostgreSQLSyntax,
        features: analysis.features
      });
    }

    // Pattern 2: String literals containing SQL keywords
    const sqlStringPattern = /"((?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+[^"]{20,})"/gi;
    while ((match = sqlStringPattern.exec(content)) !== null) {
      const query = match[1];
      const lineNumber = this.getLineNumber(content, match.index);
      const analysis = this.analyzeQuery(query);

      if (analysis.hasPostgreSQLSyntax) {
        queries.push({
          line: lineNumber,
          query,
          type: 'string_literal',
          hasPostgreSQLSyntax: true,
          features: analysis.features
        });
      }
    }

    return queries;
  }

  /**
   * Analyze a SQL query to detect PostgreSQL-specific syntax
   */
  private analyzeQuery(query: string): { hasPostgreSQLSyntax: boolean; features: string[] } {
    const features: string[] = [];
    const upperQuery = query.toUpperCase();

    // Check for PostgreSQL-specific syntax
    if (/\bLIMIT\s+\d+|\bOFFSET\s+\d+/i.test(query)) features.push('LIMIT/OFFSET');
    if (/\bRETURNING\b/i.test(query)) features.push('RETURNING clause');
    if (/\bON\s+CONFLICT\b/i.test(query)) features.push('ON CONFLICT (upsert)');
    if (/\bILIKE\b/i.test(query)) features.push('ILIKE');
    if (/\bDISTINCT\s+ON\b/i.test(query)) features.push('DISTINCT ON');
    if (/\bSELECT\s+FOR\s+UPDATE\s+SKIP\s+LOCKED\b/i.test(query)) features.push('SELECT FOR UPDATE SKIP LOCKED');

    // Check for BOOLEAN data type usage
    if (/\bBOOLEAN\b|\b(?:WHERE|AND|OR)\s+\w+\s*=\s*(?:true|false)\b/i.test(query)) features.push('BOOLEAN type');

    // Check for array operations
    if (/\[|\]|ARRAY\[/i.test(query)) features.push('ARRAY syntax');

    // Check for JSON operations
    if (/->|->>/i.test(query)) features.push('JSON operators');

    // Check for PostgreSQL functions (partial list)
    const pgFunctions = ['array_agg', 'string_agg', 'generate_series', 'unnest', 'jsonb_', 'json_'];
    for (const func of pgFunctions) {
      if (upperQuery.includes(func.toUpperCase())) {
        features.push(`${func}() function`);
      }
    }

    return {
      hasPostgreSQLSyntax: features.length > 0,
      features
    };
  }

  /**
   * Detect PostgreSQL-specific functions
   */
  private detectPostgreSQLFunctions(content: string): string[] {
    const functions: string[] = [];
    const pgFunctionPatterns = [
      /\barray_agg\s*\(/gi,
      /\bstring_agg\s*\(/gi,
      /\bgenerate_series\s*\(/gi,
      /\bunnest\s*\(/gi,
      /\bjsonb_\w+\s*\(/gi,
      /\bjson_\w+\s*\(/gi,
      /\barray_to_string\s*\(/gi,
      /\bregexp_matches\s*\(/gi,
      /\bregexp_replace\s*\(/gi,
      /\bregexp_split_to_array\s*\(/gi,
      /\bGREATEST\s*\(/gi,
      /\bLEAST\s*\(/gi
    ];

    for (const pattern of pgFunctionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const funcName = match.replace(/\s*\(/g, '').trim();
          if (!functions.includes(funcName)) {
            functions.push(funcName);
          }
        });
      }
    }

    return functions;
  }

  /**
   * Detect PostgreSQL-specific data types
   */
  private detectPostgreSQLDataTypes(content: string): string[] {
    const dataTypes: string[] = [];
    const pgDataTypePatterns = [
      /\bSERIAL\b/gi,
      /\bBIGSERIAL\b/gi,
      /\bSMALLSERIAL\b/gi,
      /\bUUID\b/gi,
      /\bJSONB\b/gi,
      /\bJSON\b/gi,
      /\bARRAY\b/gi,
      /\bHSTORE\b/gi,
      /\bBOOLEAN\b/gi,
      /\bINET\b/gi,
      /\bMACCDDR\b/gi,
      /\bCITEXT\b/gi,
      /\bTSQUERY\b/gi,
      /\bTSVECTOR\b/gi
    ];

    for (const pattern of pgDataTypePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const dataType = match.trim().toUpperCase();
          if (!dataTypes.includes(dataType)) {
            dataTypes.push(dataType);
          }
        });
      }
    }

    return dataTypes;
  }

  /**
   * Detect PostgreSQL-specific operators
   */
  private detectPostgreSQLOperators(content: string): string[] {
    const operators: string[] = [];

    // Array operators
    if (/@>/gi.test(content)) operators.push('@> (contains)');
    if (/<@/gi.test(content)) operators.push('<@ (contained by)');

    // JSON operators
    if (/->/gi.test(content)) operators.push('-> (JSON field)');
    if (/->>/gi.test(content)) operators.push('->> (JSON text)');

    // Full-text search
    if (/@@/gi.test(content)) operators.push('@@ (full-text search)');

    // Regex operators
    if (/\s~\s/gi.test(content)) operators.push('~ (regex match)');
    if (/~\*/gi.test(content)) operators.push('~* (regex case-insensitive)');

    // Concatenation (can be array or string)
    if (/\|\|/gi.test(content)) operators.push('|| (concatenation/array append)');

    return operators;
  }

  /**
   * Detect schema-specific code (e.g., pg_catalog references)
   */
  private detectSchemaSpecificCode(content: string): string[] {
    const schemaCode: string[] = [];

    if (/pg_catalog/gi.test(content)) schemaCode.push('pg_catalog references');
    if (/information_schema/gi.test(content)) schemaCode.push('information_schema references');
    if (/pg_stat/gi.test(content)) schemaCode.push('pg_stat views');
    if (/pg_class|pg_namespace|pg_attribute/gi.test(content)) schemaCode.push('PostgreSQL system tables');

    return schemaCode;
  }

  /**
   * Detect PostgreSQL extension usage
   */
  private detectExtensionUsage(content: string): string[] {
    const extensions: string[] = [];

    if (/PostGIS|ST_\w+|geography|geometry/gi.test(content)) extensions.push('PostGIS');
    if (/pg_trgm|similarity\s*\(/gi.test(content)) extensions.push('pg_trgm');
    if (/uuid_generate|uuid-ossp/gi.test(content)) extensions.push('uuid-ossp');
    if (/hstore/gi.test(content)) extensions.push('hstore');
    if (/ltree/gi.test(content)) extensions.push('ltree');

    return extensions;
  }

  /**
   * Count pattern occurrences
   */
  private countPattern(content: string, pattern: RegExp): number {
    const matches = content.match(pattern);
    return matches ? matches.length : 0;
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    const substring = content.substring(0, index);
    return substring.split('\n').length;
  }
}

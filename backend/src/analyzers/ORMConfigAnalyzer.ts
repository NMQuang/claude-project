/**
 * ORM Configuration Analyzer
 *
 * Parses ORM configuration files (MyBatis XML mappers, JPA persistence.xml, Hibernate mappings)
 * to extract SQL queries and detect PostgreSQL-specific features.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ORMConfigAnalysisResult {
  type: 'MyBatis' | 'JPA' | 'Hibernate' | 'Unknown';
  filePath: string;
  fileName: string;
  postgresqlFeatures: {
    nativeQueries: number;
    resultMaps: number;
    dynamicSQL: number;
    postgresqlFunctions: string[];
    postgresqlDataTypes: string[];
    postgresqlSyntax: string[];
    customTypeHandlers: string[];
  };
  queries: Array<{
    id: string;
    type: 'select' | 'insert' | 'update' | 'delete' | 'other';
    sql: string;
    hasPostgreSQLFeatures: boolean;
    features: string[];
  }>;
}

export class ORMConfigAnalyzer {
  /**
   * Analyze an ORM configuration file
   */
  async analyze(filePath: string): Promise<ORMConfigAnalysisResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();

    let type: 'MyBatis' | 'JPA' | 'Hibernate' | 'Unknown' = 'Unknown';

    // Detect file type
    if (extension === '.xml') {
      if (content.includes('<!DOCTYPE mapper') || content.includes('<mapper')) {
        type = 'MyBatis';
      } else if (content.includes('<persistence') || content.includes('<entity-mappings')) {
        type = 'JPA';
      } else if (content.includes('<!DOCTYPE hibernate-mapping') || content.includes('<hibernate-mapping')) {
        type = 'Hibernate';
      }
    }

    let result: ORMConfigAnalysisResult;

    if (type === 'MyBatis') {
      result = this.analyzeMyBatisMapper(filePath, fileName, content);
    } else if (type === 'JPA') {
      result = this.analyzeJPAConfig(filePath, fileName, content);
    } else if (type === 'Hibernate') {
      result = this.analyzeHibernateMapping(filePath, fileName, content);
    } else {
      // Try to extract any SQL from the file anyway
      result = this.analyzeGenericConfig(filePath, fileName, content);
    }

    return result;
  }

  /**
   * Analyze MyBatis XML mapper file
   */
  private analyzeMyBatisMapper(filePath: string, fileName: string, content: string): ORMConfigAnalysisResult {
    const queries: ORMConfigAnalysisResult['queries'] = [];
    const postgresqlFunctions = new Set<string>();
    const postgresqlDataTypes = new Set<string>();
    const postgresqlSyntax = new Set<string>();
    const customTypeHandlers = new Set<string>();

    // Extract SQL statements from select, insert, update, delete tags
    const sqlTagPatterns = [
      { type: 'select' as const, pattern: /<select[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi },
      { type: 'insert' as const, pattern: /<insert[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/insert>/gi },
      { type: 'update' as const, pattern: /<update[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/update>/gi },
      { type: 'delete' as const, pattern: /<delete[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/delete>/gi }
    ];

    for (const { type, pattern } of sqlTagPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const id = match[1];
        const sql = this.cleanSQL(match[2]);

        const analysis = this.analyzeSQL(sql);

        queries.push({
          id,
          type,
          sql,
          hasPostgreSQLFeatures: analysis.hasPostgreSQLFeatures,
          features: analysis.features
        });

        // Collect PostgreSQL features
        analysis.functions.forEach(f => postgresqlFunctions.add(f));
        analysis.dataTypes.forEach(dt => postgresqlDataTypes.add(dt));
        analysis.syntax.forEach(s => postgresqlSyntax.add(s));
      }
    }

    // Detect result maps (may indicate complex data type mappings)
    const resultMapPattern = /<resultMap[^>]*>/gi;
    const resultMapMatches = content.match(resultMapPattern);
    const resultMapCount = resultMapMatches ? resultMapMatches.length : 0;

    // Detect dynamic SQL tags
    const dynamicSQLPattern = /<if\s|<choose\s|<when\s|<foreach\s|<where\s|<set\s/gi;
    const dynamicSQLMatches = content.match(dynamicSQLPattern);
    const dynamicSQLCount = dynamicSQLMatches ? dynamicSQLMatches.length : 0;

    // Detect custom type handlers
    const typeHandlerPattern = /typeHandler=["']([^"']+)["']/gi;
    let typeHandlerMatch;
    while ((typeHandlerMatch = typeHandlerPattern.exec(content)) !== null) {
      customTypeHandlers.add(typeHandlerMatch[1]);
    }

    return {
      type: 'MyBatis',
      filePath,
      fileName,
      postgresqlFeatures: {
        nativeQueries: queries.length,
        resultMaps: resultMapCount,
        dynamicSQL: dynamicSQLCount,
        postgresqlFunctions: Array.from(postgresqlFunctions),
        postgresqlDataTypes: Array.from(postgresqlDataTypes),
        postgresqlSyntax: Array.from(postgresqlSyntax),
        customTypeHandlers: Array.from(customTypeHandlers)
      },
      queries
    };
  }

  /**
   * Analyze JPA persistence.xml or orm.xml file
   */
  private analyzeJPAConfig(filePath: string, fileName: string, content: string): ORMConfigAnalysisResult {
    const queries: ORMConfigAnalysisResult['queries'] = [];
    const postgresqlFunctions = new Set<string>();
    const postgresqlDataTypes = new Set<string>();
    const postgresqlSyntax = new Set<string>();

    // Extract named queries
    const namedQueryPattern = /<named-query[^>]*name=["']([^"']+)["'][^>]*>\s*<query>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/query>|<named-query[^>]*name=["']([^"']+)["'][^>]*>\s*<query>([^<]+)<\/query>/gi;
    let match;

    while ((match = namedQueryPattern.exec(content)) !== null) {
      const id = match[1] || match[3];
      const sql = this.cleanSQL(match[2] || match[4]);

      const analysis = this.analyzeSQL(sql);

      queries.push({
        id,
        type: 'select', // Most named queries are selects
        sql,
        hasPostgreSQLFeatures: analysis.hasPostgreSQLFeatures,
        features: analysis.features
      });

      analysis.functions.forEach(f => postgresqlFunctions.add(f));
      analysis.dataTypes.forEach(dt => postgresqlDataTypes.add(dt));
      analysis.syntax.forEach(s => postgresqlSyntax.add(s));
    }

    return {
      type: 'JPA',
      filePath,
      fileName,
      postgresqlFeatures: {
        nativeQueries: queries.length,
        resultMaps: 0,
        dynamicSQL: 0,
        postgresqlFunctions: Array.from(postgresqlFunctions),
        postgresqlDataTypes: Array.from(postgresqlDataTypes),
        postgresqlSyntax: Array.from(postgresqlSyntax),
        customTypeHandlers: []
      },
      queries
    };
  }

  /**
   * Analyze Hibernate mapping file
   */
  private analyzeHibernateMapping(filePath: string, fileName: string, content: string): ORMConfigAnalysisResult {
    const queries: ORMConfigAnalysisResult['queries'] = [];
    const postgresqlFunctions = new Set<string>();
    const postgresqlDataTypes = new Set<string>();
    const postgresqlSyntax = new Set<string>();

    // Extract SQL queries from Hibernate mapping
    const queryPattern = /<sql-query[^>]*name=["']([^"']+)["'][^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>|<query[^>]*name=["']([^"']+)["'][^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>/gi;
    let match;

    while ((match = queryPattern.exec(content)) !== null) {
      const id = match[1] || match[3];
      const sql = this.cleanSQL(match[2] || match[4]);

      const analysis = this.analyzeSQL(sql);

      queries.push({
        id,
        type: 'select',
        sql,
        hasPostgreSQLFeatures: analysis.hasPostgreSQLFeatures,
        features: analysis.features
      });

      analysis.functions.forEach(f => postgresqlFunctions.add(f));
      analysis.dataTypes.forEach(dt => postgresqlDataTypes.add(dt));
      analysis.syntax.forEach(s => postgresqlSyntax.add(s));
    }

    return {
      type: 'Hibernate',
      filePath,
      fileName,
      postgresqlFeatures: {
        nativeQueries: queries.length,
        resultMaps: 0,
        dynamicSQL: 0,
        postgresqlFunctions: Array.from(postgresqlFunctions),
        postgresqlDataTypes: Array.from(postgresqlDataTypes),
        postgresqlSyntax: Array.from(postgresqlSyntax),
        customTypeHandlers: []
      },
      queries
    };
  }

  /**
   * Analyze generic configuration file
   */
  private analyzeGenericConfig(filePath: string, fileName: string, content: string): ORMConfigAnalysisResult {
    return {
      type: 'Unknown',
      filePath,
      fileName,
      postgresqlFeatures: {
        nativeQueries: 0,
        resultMaps: 0,
        dynamicSQL: 0,
        postgresqlFunctions: [],
        postgresqlDataTypes: [],
        postgresqlSyntax: [],
        customTypeHandlers: []
      },
      queries: []
    };
  }

  /**
   * Clean SQL from XML entities and whitespace
   */
  private cleanSQL(sql: string): string {
    return sql
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .trim();
  }

  /**
   * Analyze SQL for PostgreSQL-specific features
   */
  private analyzeSQL(sql: string): {
    hasPostgreSQLFeatures: boolean;
    features: string[];
    functions: string[];
    dataTypes: string[];
    syntax: string[];
  } {
    const features: string[] = [];
    const functions: string[] = [];
    const dataTypes: string[] = [];
    const syntax: string[] = [];

    const upperSQL = sql.toUpperCase();

    // PostgreSQL-specific syntax
    if (/\bLIMIT\s+\d+/i.test(sql)) {
      syntax.push('LIMIT');
      features.push('LIMIT clause');
    }
    if (/\bOFFSET\s+\d+/i.test(sql)) {
      syntax.push('OFFSET');
      features.push('OFFSET clause');
    }
    if (/\bRETURNING\b/i.test(sql)) {
      syntax.push('RETURNING');
      features.push('RETURNING clause');
    }
    if (/\bON\s+CONFLICT\b/i.test(sql)) {
      syntax.push('ON CONFLICT');
      features.push('ON CONFLICT (upsert)');
    }
    if (/\bILIKE\b/i.test(sql)) {
      syntax.push('ILIKE');
      features.push('ILIKE operator');
    }
    if (/\bDISTINCT\s+ON\b/i.test(sql)) {
      syntax.push('DISTINCT ON');
      features.push('DISTINCT ON');
    }

    // PostgreSQL functions
    const pgFunctions = [
      'array_agg', 'string_agg', 'generate_series', 'unnest',
      'jsonb_', 'json_', 'array_to_string', 'regexp_matches',
      'regexp_replace', 'GREATEST', 'LEAST'
    ];

    for (const func of pgFunctions) {
      const pattern = new RegExp(`\\b${func}`, 'i');
      if (pattern.test(sql)) {
        functions.push(func);
        features.push(`${func}() function`);
      }
    }

    // PostgreSQL data types
    const pgDataTypes = ['SERIAL', 'BIGSERIAL', 'SMALLSERIAL', 'UUID', 'JSONB', 'JSON', 'ARRAY', 'BOOLEAN'];
    for (const dt of pgDataTypes) {
      const pattern = new RegExp(`\\b${dt}\\b`, 'i');
      if (pattern.test(sql)) {
        dataTypes.push(dt);
        features.push(`${dt} data type`);
      }
    }

    // PostgreSQL operators
    if (/@>/i.test(sql)) {
      syntax.push('@>');
      features.push('@> (contains) operator');
    }
    if (/<@/i.test(sql)) {
      syntax.push('<@');
      features.push('<@ (contained by) operator');
    }
    if (/->/i.test(sql)) {
      syntax.push('->');
      features.push('-> (JSON field) operator');
    }
    if (/->>/i.test(sql)) {
      syntax.push('->>');
      features.push('->> (JSON text) operator');
    }

    return {
      hasPostgreSQLFeatures: features.length > 0,
      features,
      functions,
      dataTypes,
      syntax
    };
  }
}

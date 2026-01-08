/**
 * PostgreSQL Migration Complexity Scorer
 *
 * Calculates comprehensive PostgreSQL-to-Oracle migration difficulty score based on 6 dimensions:
 * 1. Schema and Data Type Complexity
 * 2. SQL and Query Rewrite Complexity
 * 3. Stored Procedures, Functions, and Triggers Complexity
 * 4. Data Volume and Migration Strategy Complexity
 * 5. Application and ORM Dependency Complexity
 * 6. Operational and Runtime Risk Complexity
 */

import { JavaAnalysisResult } from '../analyzers/JavaAnalyzer.js';
import { PostgreSQLDDLAnalysisResult } from '../analyzers/PostgreSQLDDLAnalyzer.js';

export interface PostgreSQLMigrationComplexityScore {
  overall: number; // 0-100
  schemaDataTypeComplexity: number; // 0-100
  sqlQueryRewriteComplexity: number; // 0-100
  procedureFunctionTriggerComplexity: number; // 0-100
  dataVolumeMigrationComplexity: number; // 0-100
  applicationORMDependencyComplexity: number; // 0-100
  operationalRuntimeRiskComplexity: number; // 0-100
  difficulty: 'Low' | 'Medium' | 'High' | 'Very High';
  description: string;
  details: {
    schemaDataType: string[];
    sqlQueryRewrite: string[];
    procedureFunctionTrigger: string[];
    dataVolumeMigration: string[];
    applicationORMDependency: string[];
    operationalRuntimeRisk: string[];
  };
  recommendations: Array<{
    dimension: string;
    severity: 'Low' | 'Medium' | 'High';
    issue: string;
    mitigation: string;
  }>;
}

export class PostgreSQLMigrationComplexityScorer {
  /**
   * Calculate migration complexity score for a PostgreSQL-to-Oracle migration project
   */
  scoreProject(
    javaResults: JavaAnalysisResult[],
    ddlResult: PostgreSQLDDLAnalysisResult | undefined
  ): PostgreSQLMigrationComplexityScore {
    // Calculate each dimension score
    const schemaDataTypeScore = ddlResult
      ? this.calculateSchemaDataTypeComplexity(ddlResult)
      : 0;

    const sqlQueryRewriteScore = this.calculateSQLQueryRewriteComplexity(javaResults, ddlResult);

    const procedureFunctionTriggerScore = ddlResult
      ? this.calculateProcedureFunctionTriggerComplexity(ddlResult)
      : 0;

    const dataVolumeMigrationScore = ddlResult
      ? this.calculateDataVolumeMigrationComplexity(ddlResult)
      : 0;

    const applicationORMDependencyScore = this.calculateApplicationORMDependencyComplexity(javaResults);

    const operationalRuntimeRiskScore = this.calculateOperationalRuntimeRiskComplexity(javaResults, ddlResult);

    // Calculate overall score (weighted average)
    const overall = Math.round(
      schemaDataTypeScore * 0.20 +           // 20%
      sqlQueryRewriteScore * 0.20 +          // 20%
      procedureFunctionTriggerScore * 0.20 + // 20%
      dataVolumeMigrationScore * 0.15 +      // 15%
      applicationORMDependencyScore * 0.15 + // 15%
      operationalRuntimeRiskScore * 0.10     // 10%
    );

    return {
      overall,
      schemaDataTypeComplexity: schemaDataTypeScore,
      sqlQueryRewriteComplexity: sqlQueryRewriteScore,
      procedureFunctionTriggerComplexity: procedureFunctionTriggerScore,
      dataVolumeMigrationComplexity: dataVolumeMigrationScore,
      applicationORMDependencyComplexity: applicationORMDependencyScore,
      operationalRuntimeRiskComplexity: operationalRuntimeRiskScore,
      difficulty: this.getDifficultyLevel(overall),
      description: this.getDescription(overall),
      details: {
        schemaDataType: this.getSchemaDataTypeDetails(ddlResult),
        sqlQueryRewrite: this.getSQLQueryRewriteDetails(javaResults, ddlResult),
        procedureFunctionTrigger: this.getProcedureFunctionTriggerDetails(ddlResult),
        dataVolumeMigration: this.getDataVolumeMigrationDetails(ddlResult),
        applicationORMDependency: this.getApplicationORMDependencyDetails(javaResults),
        operationalRuntimeRisk: this.getOperationalRuntimeRiskDetails(javaResults, ddlResult)
      },
      recommendations: this.generateRecommendations(
        schemaDataTypeScore,
        sqlQueryRewriteScore,
        procedureFunctionTriggerScore,
        dataVolumeMigrationScore,
        applicationORMDependencyScore,
        operationalRuntimeRiskScore,
        javaResults,
        ddlResult
      )
    };
  }

  /**
   * 1. Calculate Schema and Data Type Complexity (0-100)
   */
  private calculateSchemaDataTypeComplexity(ddlResult: PostgreSQLDDLAnalysisResult): number {
    let score = 0;
    const features = ddlResult.postgresqlFeatures;

    // Complex data types (JSONB, ARRAY, HSTORE, etc.): 5 pts each, max 30
    const complexTypes = features.dataTypeUsage.filter(dt =>
      ['JSONB', 'JSON', 'ARRAY', 'HSTORE', 'UUID', 'CITEXT', 'TSQUERY', 'TSVECTOR'].includes(dt.type)
    );
    const complexTypeCount = complexTypes.reduce((sum, dt) => sum + dt.count, 0);
    score += Math.min(complexTypeCount * 5, 30);

    // SERIAL types: 2 pts each, max 10
    const serialTypes = features.dataTypeUsage.filter(dt => dt.type.includes('SERIAL'));
    const serialCount = serialTypes.reduce((sum, dt) => sum + dt.count, 0);
    score += Math.min(serialCount * 2, 10);

    // CHECK constraints: 2 pts each, max 15
    score += Math.min((features.checkConstraints || 0) * 2, 15);

    // EXCLUSION constraints: 5 pts each, max 15
    score += Math.min((features.exclusionConstraints || 0) * 5, 15);

    // Inheritance (no direct Oracle equivalent): 10 pts if used
    if (features.inheritanceTables && features.inheritanceTables.length > 0) {
      score += 10;
    }

    // Partitioning adds complexity: 5 pts per partitioned table, max 20
    if (features.partitionedTables) {
      score += Math.min(features.partitionedTables.length * 5, 20);
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * 2. Calculate SQL and Query Rewrite Complexity (0-100)
   */
  private calculateSQLQueryRewriteComplexity(
    javaResults: JavaAnalysisResult[],
    ddlResult: PostgreSQLDDLAnalysisResult | undefined
  ): number {
    let score = 0;

    // Native queries with PostgreSQL syntax: 3 pts each, max 30
    const totalNativeQueries = javaResults.reduce(
      (sum, r) => sum + r.postgresqlDependencies.nativeQueries.filter(q => q.hasPostgreSQLSyntax).length,
      0
    );
    score += Math.min(totalNativeQueries * 3, 30);

    // PostgreSQL-specific functions: 2 pts each, max 25
    const totalFunctions = javaResults.reduce(
      (sum, r) => sum + r.postgresqlDependencies.postgresqlFunctions.length,
      0
    );
    score += Math.min(totalFunctions * 2, 25);

    // PostgreSQL-specific operators: 2 pts each, max 20
    const totalOperators = javaResults.reduce(
      (sum, r) => sum + r.postgresqlDependencies.postgresqlOperators.length,
      0
    );
    score += Math.min(totalOperators * 2, 20);

    // LIMIT/OFFSET usage: 1 pt each, max 10
    const limitOffsetCount = javaResults.reduce(
      (sum, r) => sum + r.postgresqlDependencies.nativeQueries.filter(q =>
        /LIMIT|OFFSET/i.test(q.query)
      ).length,
      0
    );
    score += Math.min(limitOffsetCount * 1, 10);

    // RETURNING clause: 2 pts each, max 10
    const returningCount = javaResults.reduce(
      (sum, r) => sum + r.postgresqlDependencies.nativeQueries.filter(q =>
        /RETURNING/i.test(q.query)
      ).length,
      0
    );
    score += Math.min(returningCount * 2, 10);

    // BOOLEAN data type usage: 1 pt each, max 5
    const booleanUsage = javaResults.reduce(
      (sum, r) => sum + r.postgresqlDependencies.postgresqlDataTypes.filter(dt =>
        dt === 'BOOLEAN'
      ).length,
      0
    );
    score += Math.min(booleanUsage * 1, 5);

    return Math.min(Math.round(score), 100);
  }

  /**
   * 3. Calculate Stored Procedures, Functions, and Triggers Complexity (0-100)
   */
  private calculateProcedureFunctionTriggerComplexity(ddlResult: PostgreSQLDDLAnalysisResult): number {
    let score = 0;
    const features = ddlResult.postgresqlFeatures;

    // PL/pgSQL functions: 5 pts each, max 25
    const totalFunctions = features.plpgsqlFunctions?.length || 0;
    score += Math.min(totalFunctions * 5, 25);

    // Function complexity (average LOC): 5-20 pts based on size
    if (totalFunctions > 0) {
      const avgComplexity = features.plpgsqlFunctions
        .reduce((sum, f) => sum + f.complexity, 0) / totalFunctions;

      if (avgComplexity > 100) score += 20;
      else if (avgComplexity > 50) score += 10;
      else if (avgComplexity > 20) score += 5;
    }

    // Functions with dynamic SQL (high risk): 8 pts each, max 20
    const dynamicSQLCount = features.plpgsqlFunctions?.filter(f => f.usesDynamicSQL).length || 0;
    score += Math.min(dynamicSQLCount * 8, 20);

    // Functions using arrays/JSON: 5 pts each, max 15
    const arrayJSONCount = features.plpgsqlFunctions?.filter(f => f.usesArrays || f.usesJSON).length || 0;
    score += Math.min(arrayJSONCount * 5, 15);

    // Functions returning tables: 3 pts each, max 10
    const tableReturningCount = features.plpgsqlFunctions?.filter(f => f.returnsTable).length || 0;
    score += Math.min(tableReturningCount * 3, 10);

    // Triggers: 3 pts each, max 10
    const totalTriggers = features.triggerDetails?.length || 0;
    score += Math.min(totalTriggers * 3, 10);

    return Math.min(Math.round(score), 100);
  }

  /**
   * 4. Calculate Data Volume and Migration Strategy Complexity (0-100)
   */
  private calculateDataVolumeMigrationComplexity(ddlResult: PostgreSQLDDLAnalysisResult): number {
    let score = 0;
    const features = ddlResult.postgresqlFeatures;

    // Estimated total row count: 10-40 pts based on scale
    const totalRows = features.estimatedRowCounts?.reduce((sum, t) => sum + t.estimatedRows, 0) || 0;

    if (totalRows > 1_000_000_000) score += 40; // 1B+ rows
    else if (totalRows > 100_000_000) score += 30; // 100M+ rows
    else if (totalRows > 10_000_000) score += 20; // 10M+ rows
    else if (totalRows > 1_000_000) score += 10; // 1M+ rows

    // Number of large tables: 5 pts each, max 20
    const largeTables = features.estimatedRowCounts?.filter(t =>
      t.sizeCategory === 'Very Large' || t.sizeCategory === 'Large'
    ).length || 0;
    score += Math.min(largeTables * 5, 20);

    // Partitioned tables: 8 pts each, max 20
    const partitionedCount = features.partitionedTables?.length || 0;
    score += Math.min(partitionedCount * 8, 20);

    // Tables with JSONB/ARRAY (complex data migration): 5 pts each, max 20
    const complexDataTables = features.dataTypeUsage.filter(dt =>
      ['JSONB', 'JSON', 'ARRAY'].includes(dt.type)
    ).reduce((sum, dt) => sum + dt.tables.length, 0);
    score += Math.min(complexDataTables * 5, 20);

    return Math.min(Math.round(score), 100);
  }

  /**
   * 5. Calculate Application and ORM Dependency Complexity (0-100)
   */
  private calculateApplicationORMDependencyComplexity(javaResults: JavaAnalysisResult[]): number {
    let score = 0;

    // Plain JDBC usage (hardest to migrate): 8 pts each file, max 30
    const plainJDBCCount = javaResults.filter(r => r.ormFramework === 'Plain JDBC').length;
    score += Math.min(plainJDBCCount * 8, 30);

    // Native queries in code: 2 pts each, max 25
    const nativeQueryCount = javaResults.reduce(
      (sum, r) => sum + r.postgresqlDependencies.nativeQueries.length,
      0
    );
    score += Math.min(nativeQueryCount * 2, 25);

    // MyBatis files: 3 pts each, max 20
    const mybatisFiles = javaResults.filter(r => r.ormFramework === 'MyBatis').length;
    score += Math.min(mybatisFiles * 3, 20);

    // Direct JDBC driver calls: 2 pts each, max 15
    const jdbcCallCount = javaResults.reduce(
      (sum, r) => sum + r.postgresqlDependencies.jdbcCalls,
      0
    );
    score += Math.min(jdbcCallCount * 2, 15);

    // Schema-specific code (pg_catalog references): 5 pts each, max 10
    const schemaSpecificCount = javaResults.reduce(
      (sum, r) => sum + r.postgresqlDependencies.schemaSpecificCode.length,
      0
    );
    score += Math.min(schemaSpecificCount * 5, 10);

    return Math.min(Math.round(score), 100);
  }

  /**
   * 6. Calculate Operational and Runtime Risk Complexity (0-100)
   */
  private calculateOperationalRuntimeRiskComplexity(
    javaResults: JavaAnalysisResult[],
    ddlResult: PostgreSQLDDLAnalysisResult | undefined
  ): number {
    let score = 0;

    if (!ddlResult) {
      // Base runtime risk even without DDL
      score += 15;
      return score;
    }

    const features = ddlResult.postgresqlFeatures;

    // PostgreSQL extensions: 10 pts each, max 30
    const extensionCount = features.extensions?.length || 0;
    score += Math.min(extensionCount * 10, 30);

    // Advanced index types (GIN, GIST, BRIN): 5 pts each, max 20
    const advancedIndexCount = features.indexTypes
      ?.filter(idx => ['GIN', 'GIST', 'BRIN', 'SPGIST'].includes(idx.type) && !idx.oracleSupport)
      .reduce((sum, idx) => sum + idx.count, 0) || 0;
    score += Math.min(advancedIndexCount * 5, 20);

    // Row-level security policies: 15 pts if used
    if ((features.rlsPolicies || 0) > 0) {
      score += 15;
    }

    // Partial indexes: 3 pts each, max 15
    const partialIndexCount = features.partialIndexes || 0;
    score += Math.min(partialIndexCount * 3, 15);

    // Base runtime risks (transaction isolation, connection pooling, concurrency)
    score += 20; // Base operational risk

    return Math.min(Math.round(score), 100);
  }

  /**
   * Get difficulty level based on overall score
   */
  private getDifficultyLevel(score: number): 'Low' | 'Medium' | 'High' | 'Very High' {
    if (score < 30) return 'Low';
    if (score < 60) return 'Medium';
    if (score < 80) return 'High';
    return 'Very High';
  }

  /**
   * Get description based on overall score
   */
  private getDescription(score: number): string {
    if (score < 30) {
      return 'Low complexity migration - straightforward conversion with minimal PostgreSQL-specific features';
    } else if (score < 60) {
      return 'Medium complexity migration - some PostgreSQL-specific features require careful conversion';
    } else if (score < 80) {
      return 'High complexity migration - significant PostgreSQL-specific features and dependencies';
    } else {
      return 'Very high complexity migration - extensive PostgreSQL-specific features requiring comprehensive migration strategy';
    }
  }

  // Detail generation methods (continued in next section...)

  private getSchemaDataTypeDetails(ddlResult: PostgreSQLDDLAnalysisResult | undefined): string[] {
    const details: string[] = [];
    if (!ddlResult) return details;

    const features = ddlResult.postgresqlFeatures;

    features.dataTypeUsage.forEach(dt => {
      if (dt.count > 0) {
        details.push(`${dt.count} ${dt.type} columns (${dt.oracleMappingComplexity} complexity → ${dt.suggestedOracleType})`);
      }
    });

    if (features.inheritanceTables && features.inheritanceTables.length > 0) {
      details.push(`${features.inheritanceTables.length} tables using inheritance (requires redesign for Oracle)`);
    }

    if (features.partitionedTables && features.partitionedTables.length > 0) {
      details.push(`${features.partitionedTables.length} partitioned tables (migration strategy needed)`);
    }

    return details;
  }

  private getSQLQueryRewriteDetails(javaResults: JavaAnalysisResult[], ddlResult: PostgreSQLDDLAnalysisResult | undefined): string[] {
    const details: string[] = [];

    const nativeQueryCount = javaResults.reduce((sum, r) => sum + r.postgresqlDependencies.nativeQueries.length, 0);
    if (nativeQueryCount > 0) {
      details.push(`${nativeQueryCount} native SQL queries requiring review`);
    }

    const functionSet = new Set<string>();
    javaResults.forEach(r => r.postgresqlDependencies.postgresqlFunctions.forEach(f => functionSet.add(f)));
    if (functionSet.size > 0) {
      details.push(`PostgreSQL-specific functions: ${Array.from(functionSet).join(', ')}`);
    }

    const operatorSet = new Set<string>();
    javaResults.forEach(r => r.postgresqlDependencies.postgresqlOperators.forEach(o => operatorSet.add(o)));
    if (operatorSet.size > 0) {
      details.push(`PostgreSQL-specific operators requiring conversion: ${Array.from(operatorSet).join(', ')}`);
    }

    return details;
  }

  private getProcedureFunctionTriggerDetails(ddlResult: PostgreSQLDDLAnalysisResult | undefined): string[] {
    const details: string[] = [];
    if (!ddlResult) return details;

    const features = ddlResult.postgresqlFeatures;

    if (features.plpgsqlFunctions && features.plpgsqlFunctions.length > 0) {
      details.push(`${features.plpgsqlFunctions.length} PL/pgSQL functions need conversion to PL/SQL`);

      const dynamicSQLCount = features.plpgsqlFunctions.filter(f => f.usesDynamicSQL).length;
      if (dynamicSQLCount > 0) {
        details.push(`${dynamicSQLCount} functions use dynamic SQL (high conversion risk)`);
      }

      const arrayJSONCount = features.plpgsqlFunctions.filter(f => f.usesArrays || f.usesJSON).length;
      if (arrayJSONCount > 0) {
        details.push(`${arrayJSONCount} functions use arrays/JSON (complex conversion)`);
      }
    }

    if (features.triggerDetails && features.triggerDetails.length > 0) {
      details.push(`${features.triggerDetails.length} triggers require conversion`);
    }

    return details;
  }

  private getDataVolumeMigrationDetails(ddlResult: PostgreSQLDDLAnalysisResult | undefined): string[] {
    const details: string[] = [];
    if (!ddlResult) return details;

    const features = ddlResult.postgresqlFeatures;

    const totalRows = features.estimatedRowCounts?.reduce((sum, t) => sum + t.estimatedRows, 0) || 0;
    if (totalRows > 0) {
      details.push(`Estimated ${(totalRows / 1000000).toFixed(1)}M total rows to migrate`);
    }

    const largeTables = features.estimatedRowCounts?.filter(t => t.sizeCategory === 'Very Large' || t.sizeCategory === 'Large') || [];
    if (largeTables.length > 0) {
      details.push(`${largeTables.length} large tables requiring careful migration strategy`);
    }

    if (features.partitionedTables && features.partitionedTables.length > 0) {
      details.push(`${features.partitionedTables.length} partitioned tables (partition strategy conversion needed)`);
    }

    return details;
  }

  private getApplicationORMDependencyDetails(javaResults: JavaAnalysisResult[]): string[] {
    const details: string[] = [];

    const ormCounts = new Map<string, number>();
    javaResults.forEach(r => {
      const current = ormCounts.get(r.ormFramework) || 0;
      ormCounts.set(r.ormFramework, current + 1);
    });

    ormCounts.forEach((count, orm) => {
      if (orm !== 'None') {
        details.push(`${count} files using ${orm}`);
      }
    });

    const plainJDBCCount = javaResults.filter(r => r.ormFramework === 'Plain JDBC').length;
    if (plainJDBCCount > 0) {
      details.push(`${plainJDBCCount} files with direct JDBC calls (highest migration effort)`);
    }

    return details;
  }

  private getOperationalRuntimeRiskDetails(javaResults: JavaAnalysisResult[], ddlResult: PostgreSQLDDLAnalysisResult | undefined): string[] {
    const details: string[] = [];

    if (ddlResult) {
      const features = ddlResult.postgresqlFeatures;

      if (features.extensions && features.extensions.length > 0) {
        details.push(`PostgreSQL extensions in use: ${features.extensions.join(', ')}`);
      }

      const advancedIndexes = features.indexTypes?.filter(idx => !idx.oracleSupport) || [];
      if (advancedIndexes.length > 0) {
        details.push(`Advanced index types requiring alternatives: ${advancedIndexes.map(idx => idx.type).join(', ')}`);
      }

      if (features.rlsPolicies && features.rlsPolicies > 0) {
        details.push(`Row-level security policies require Oracle VPD implementation`);
      }
    }

    details.push('Transaction isolation and concurrency control differences require testing');

    return details;
  }

  private generateRecommendations(
    schemaScore: number,
    sqlScore: number,
    procScore: number,
    dataScore: number,
    ormScore: number,
    opsScore: number,
    javaResults: JavaAnalysisResult[],
    ddlResult: PostgreSQLDDLAnalysisResult | undefined
  ): PostgreSQLMigrationComplexityScore['recommendations'] {
    const recommendations: PostgreSQLMigrationComplexityScore['recommendations'] = [];

    // CRITICAL: Add migration principle as top priority
    recommendations.push({
      dimension: 'Migration Principle',
      severity: 'High',
      issue: 'Database migration from PostgreSQL to Oracle',
      mitigation: '**KEEP JAVA APPLICATION LOGIC UNCHANGED**. Limited Java changes restricted to: (1) Entity mappings (@Entity, @Table, @Column), (2) Repository queries (@Query annotations, MyBatis XML), (3) Database configurations (JDBC driver, connection properties). NO business logic refactoring required.'
    });

    if (schemaScore > 50) {
      recommendations.push({
        dimension: 'Schema & Data Types',
        severity: schemaScore > 70 ? 'High' : 'Medium',
        issue: 'Complex PostgreSQL data types detected',
        mitigation: 'Update DDL scripts with Oracle equivalents (JSONB→JSON/CLOB, ARRAY→VARRAY, SERIAL→SEQUENCE+TRIGGER). Modify Entity class annotations if needed (@Type for custom types). Keep entity business logic unchanged.'
      });
    }

    if (sqlScore > 50) {
      recommendations.push({
        dimension: 'SQL & Query Rewrite',
        severity: sqlScore > 70 ? 'High' : 'Medium',
        issue: 'Numerous PostgreSQL-specific SQL features',
        mitigation: 'Rewrite SQL in @Query annotations and MyBatis XML (LIMIT→FETCH FIRST, array_agg→LISTAGG, RETURNING→OUTPUT). Keep repository method signatures and service layer unchanged. NO refactoring of business logic.'
      });
    }

    if (procScore > 50) {
      recommendations.push({
        dimension: 'Procedures & Functions',
        severity: procScore > 70 ? 'High' : 'Medium',
        issue: 'PL/pgSQL functions require conversion to PL/SQL',
        mitigation: 'Convert PL/pgSQL to PL/SQL in database layer only. If procedures are called from Java (@Procedure), update only the procedure name/parameters in Repository interface. Keep business logic in service layer unchanged.'
      });
    }

    if (dataScore > 50) {
      recommendations.push({
        dimension: 'Data Volume',
        severity: dataScore > 70 ? 'High' : 'Medium',
        issue: 'Large data volume migration',
        mitigation: 'Use Oracle Data Pump or AWS DMS for data migration. Recreate partitioning in Oracle DDL. Update Entity classes only if partition keys change. NO application logic changes required.'
      });
    }

    if (ormScore > 50) {
      recommendations.push({
        dimension: 'Application & ORM',
        severity: ormScore > 70 ? 'High' : 'Medium',
        issue: 'Application code has PostgreSQL dependencies',
        mitigation: 'Update JDBC driver (org.postgresql.Driver→oracle.jdbc.OracleDriver) in config files. Rewrite SQL in @Query and MyBatis XML. **CRITICAL: Do NOT refactor repository methods or business logic.** Keep method signatures, return types, and service layer unchanged.'
      });
    }

    if (opsScore > 50) {
      recommendations.push({
        dimension: 'Operational & Runtime',
        severity: opsScore > 70 ? 'High' : 'Medium',
        issue: 'PostgreSQL extensions and operational differences',
        mitigation: 'Replace PostgreSQL extensions with Oracle equivalents in DDL (PostGIS→Oracle Spatial, pg_trgm→Oracle Text). Recreate GIN/GIST indexes as B-tree or function-based indexes. Update database config files only. NO Java code changes for indexing.'
      });
    }

    return recommendations;
  }
}

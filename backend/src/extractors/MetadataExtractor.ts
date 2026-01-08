/**
 * Metadata Extractor
 *
 * Extracts high-level metadata and metrics from analysis results
 */

import { CobolAnalysisResult } from '../analyzers/CobolAnalyzer.js';
import { DDLAnalysisResult, TableDefinition } from '../analyzers/DDLAnalyzer.js';
import { CobolMigrationComplexityScorer, CobolMigrationComplexityScore } from './CobolMigrationComplexityScorer.js';
import { JavaAnalysisResult } from '../analyzers/JavaAnalyzer.js';
import { PostgreSQLDDLAnalysisResult } from '../analyzers/PostgreSQLDDLAnalyzer.js';
import { ORMConfigAnalysisResult } from '../analyzers/ORMConfigAnalyzer.js';
import { PostgreSQLMigrationComplexityScorer, PostgreSQLMigrationComplexityScore } from './PostgreSQLMigrationComplexityScorer.js';

export interface ProjectMetadata {
  source_analysis: {
    total_files: number;
    total_loc: number;
    programs: Array<{
      name: string;
      path: string;
      type: string;
      loc: number;
      complexity: number;
      priority: string;
    }>;
    database: {
      tables: number;
      views: number;
      stored_procedures: number;
      indexes: number;
      triggers: number;
      functions: number;
    };
  };
  complexity_summary: string;
  migrationComplexity?: CobolMigrationComplexityScore;
  file_type_distribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  dependencies: Array<{
    source: string;
    targets: string;
  }>;
  high_complexity_modules: Array<{
    name: string;
    score: number;
    risk: string;
    recommendation: string;
  }>;
  risks: Array<{
    id: string;
    category: string;
    description: string;
    severity: string;
    impact: string;
    mitigation: string;
  }>;
}

export class MetadataExtractor {
  /**
   * Extract metadata from analysis results
   */
  extract(analysisResults: CobolAnalysisResult[], ddlResults?: DDLAnalysisResult): ProjectMetadata {
    const totalLOC = this.calculateTotalLOC(analysisResults);

    // Calculate comprehensive migration complexity
    const scorer = new CobolMigrationComplexityScorer();
    const migrationComplexity = scorer.scoreProject(analysisResults);

    return {
      source_analysis: {
        total_files: analysisResults.length,
        total_loc: totalLOC,
        programs: this.extractProgramInfo(analysisResults),
        database: ddlResults ? {
          tables: ddlResults.totalTables,
          views: ddlResults.views.length,
          stored_procedures: ddlResults.storedProcedures.length,
          indexes: ddlResults.totalIndexes,
          triggers: ddlResults.triggers.length,
          functions: ddlResults.functions.length
        } : {
          tables: 0,
          views: 0,
          stored_procedures: 0,
          indexes: 0,
          triggers: 0,
          functions: 0
        }
      },
      complexity_summary: `${migrationComplexity.difficulty} difficulty (score: ${migrationComplexity.overall}/100) - ${migrationComplexity.description}`,
      migrationComplexity,
      file_type_distribution: this.calculateFileTypeDistribution(analysisResults),
      dependencies: this.extractDependencies(analysisResults),
      high_complexity_modules: this.identifyHighComplexityModules(analysisResults),
      risks: this.assessRisks(analysisResults, migrationComplexity)
    };
  }

  private calculateTotalLOC(results: CobolAnalysisResult[]): number {
    return results.reduce((sum, result) => sum + result.loc, 0);
  }

  private calculateAverageComplexity(results: CobolAnalysisResult[]): number {
    const total = results.reduce((sum, result) => sum + result.complexity, 0);
    return results.length > 0 ? Math.round(total / results.length) : 0;
  }

  private extractProgramInfo(results: CobolAnalysisResult[]) {
    return results.map(result => ({
      name: result.name,
      path: result.path,
      type: result.type,
      loc: result.loc,
      complexity: result.complexity,
      priority: this.determinePriority(result)
    }));
  }

  private determinePriority(result: CobolAnalysisResult): string {
    // Simple heuristic: high complexity or large LOC = high priority
    if (result.complexity > 30 || result.loc > 1000) {
      return 'High';
    } else if (result.complexity > 15 || result.loc > 500) {
      return 'Medium';
    }
    return 'Low';
  }

  private generateComplexitySummary(avgComplexity: number): string {
    if (avgComplexity < 10) {
      return 'Low complexity - straightforward migration expected';
    } else if (avgComplexity < 20) {
      return 'Medium complexity - some refactoring required';
    } else if (avgComplexity < 30) {
      return 'High complexity - significant refactoring needed';
    }
    return 'Very high complexity - extensive redesign recommended';
  }

  private calculateFileTypeDistribution(results: CobolAnalysisResult[]) {
    const types = new Map<string, number>();

    for (const result of results) {
      types.set(result.type, (types.get(result.type) || 0) + 1);
    }

    const total = results.length;
    return Array.from(types.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100)
    }));
  }

  private extractDependencies(results: CobolAnalysisResult[]) {
    return results
      .filter(result => result.dependencies.length > 0)
      .map(result => ({
        source: result.name,
        targets: result.dependencies.join(', ')
      }));
  }

  private identifyHighComplexityModules(results: CobolAnalysisResult[]) {
    return results
      .filter(result => result.complexity > 20)
      .map(result => ({
        name: result.name,
        score: result.complexity,
        risk: result.complexity > 40 ? 'High' : 'Medium',
        recommendation: result.complexity > 40
          ? 'Consider breaking into smaller modules during migration'
          : 'Review and simplify logic where possible'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10
  }

  private assessRisks(results: CobolAnalysisResult[], migrationComplexity: CobolMigrationComplexityScore): Array<any> {
    const risks = [];

    // Risk: High migration difficulty
    if (migrationComplexity.overall >= 60) {
      risks.push({
        id: 'R-001',
        category: 'Migration Complexity',
        description: `Migration difficulty score is ${migrationComplexity.overall}/100 (${migrationComplexity.difficulty})`,
        severity: migrationComplexity.overall >= 80 ? 'Critical' : 'High',
        impact: 'May lead to longer migration timeline, higher defect rate, and increased resource requirements',
        mitigation: 'Allocate experienced developers, plan for refactoring, increase code review frequency, consider phased migration'
      });
    }

    // Risk: High logic complexity
    if (migrationComplexity.logicComplexity >= 60) {
      risks.push({
        id: 'R-002',
        category: 'Logic Complexity',
        description: `Logic complexity score: ${migrationComplexity.logicComplexity}/100. ${migrationComplexity.details.logic.join('; ')}`,
        severity: 'High',
        impact: 'Complex control flow increases risk of logic errors during migration',
        mitigation: 'Comprehensive unit testing, code refactoring to simplify logic, peer review of critical sections'
      });
    }

    // Risk: High data complexity
    if (migrationComplexity.dataComplexity >= 60) {
      risks.push({
        id: 'R-003',
        category: 'Data Complexity',
        description: `Data complexity score: ${migrationComplexity.dataComplexity}/100. ${migrationComplexity.details.data.join('; ')}`,
        severity: 'High',
        impact: 'Complex data structures and database operations require careful mapping',
        mitigation: 'Create detailed data mapping documents, implement data validation tests, use ORM frameworks'
      });
    }

    // Risk: COBOL-specific features
    if (migrationComplexity.cobolSpecificRisk >= 60) {
      risks.push({
        id: 'R-004',
        category: 'COBOL-specific Risk',
        description: `COBOL-specific risk score: ${migrationComplexity.cobolSpecificRisk}/100. ${migrationComplexity.details.risk.join('; ')}`,
        severity: 'Critical',
        impact: 'Legacy COBOL features may not have direct Java equivalents, requiring custom solutions',
        mitigation: 'Research migration patterns for specific features, develop custom libraries, plan for redesign where necessary'
      });
    }

    // Risk: Large codebase
    const totalLOC = this.calculateTotalLOC(results);
    if (totalLOC > 100000) {
      risks.push({
        id: 'R-005',
        category: 'Scale',
        description: `Large codebase with ${totalLOC.toLocaleString()} lines of code`,
        severity: 'Medium',
        impact: 'Extended timeline, higher resource requirements',
        mitigation: 'Use phased migration approach, consider automated conversion tools'
      });
    }

    // Risk: High number of dependencies
    const totalDeps = results.reduce((sum, r) => sum + r.dependencies.length, 0);
    if (totalDeps > 50) {
      risks.push({
        id: 'R-006',
        category: 'Dependencies',
        description: `High number of inter-module dependencies (${totalDeps})`,
        severity: 'Medium',
        impact: 'Complex integration testing, potential circular dependencies',
        mitigation: 'Map dependencies early, identify and break circular references'
      });
    }

    return risks;
  }

  /**
   * Extract metadata from PostgreSQL-to-Oracle migration analysis
   */
  extractPostgreSQL(
    javaResults: JavaAnalysisResult[],
    ddlResult: PostgreSQLDDLAnalysisResult | undefined,
    ormConfigResults: ORMConfigAnalysisResult[]
  ): PostgreSQLProjectMetadata {
    const totalLOC = javaResults.reduce((sum, r) => sum + r.loc, 0);

    // Calculate comprehensive migration complexity (6 dimensions)
    const scorer = new PostgreSQLMigrationComplexityScorer();
    const migrationComplexity = scorer.scoreProject(javaResults, ddlResult);

    // Detect primary ORM framework
    const ormFramework = this.detectPrimaryOrmFramework(javaResults);

    // Categorize Java changes following minimal-change principle
    const javaChanges = this.categorizeJavaChanges(javaResults);

    return {
      source_analysis: {
        total_files: javaResults.length + ormConfigResults.length,
        total_loc: totalLOC,
        ormFramework,
        javaFiles: this.extractJavaFileInfo(javaResults),
        database: ddlResult ? {
          tables: ddlResult.totalTables,
          views: ddlResult.views.length,
          functions: ddlResult.functions.length,
          stored_procedures: ddlResult.storedProcedures.length,
          triggers: ddlResult.triggers.length,
          indexes: ddlResult.totalIndexes,
          sequences: ddlResult.sequences.length,
          partitionedTables: ddlResult.postgresqlFeatures.partitionedTables?.length || 0
        } : {
          tables: 0,
          views: 0,
          functions: 0,
          stored_procedures: 0,
          triggers: 0,
          indexes: 0,
          sequences: 0,
          partitionedTables: 0
        },
        postgresqlFeatures: ddlResult ? {
          dataTypes: ddlResult.postgresqlFeatures.dataTypeUsage,
          extensions: ddlResult.postgresqlFeatures.extensions || [],
          advancedIndexes: ddlResult.postgresqlFeatures.indexTypes || [],
          nativeQueryCount: javaResults.reduce((sum, r) => sum + r.postgresqlDependencies.nativeQueries.length, 0)
        } : {
          dataTypes: [],
          extensions: [],
          advancedIndexes: [],
          nativeQueryCount: 0
        }
      },
      javaChanges,
      complexity_summary: `${migrationComplexity.difficulty} difficulty (score: ${migrationComplexity.overall}/100) - ${migrationComplexity.description}`,
      migrationComplexity,
      risks: this.assessPostgreSQLRisks(javaResults, ddlResult, migrationComplexity)
    };
  }

  private detectPrimaryOrmFramework(javaResults: JavaAnalysisResult[]): string {
    const ormCounts = new Map<string, number>();

    javaResults.forEach(r => {
      const current = ormCounts.get(r.ormFramework) || 0;
      ormCounts.set(r.ormFramework, current + 1);
    });

    // Find the most common ORM framework
    let maxCount = 0;
    let primaryOrm = 'None';

    ormCounts.forEach((count, orm) => {
      if (orm !== 'None' && count > maxCount) {
        maxCount = count;
        primaryOrm = orm;
      }
    });

    // If multiple frameworks detected
    if (ormCounts.size > 2) {
      return `Mixed (${Array.from(ormCounts.keys()).filter(k => k !== 'None').join(', ')})`;
    }

    return primaryOrm;
  }

  private extractJavaFileInfo(javaResults: JavaAnalysisResult[]) {
    return javaResults.map(result => ({
      name: result.name,
      path: result.path,
      type: result.type,
      loc: result.loc,
      ormFramework: result.ormFramework,
      hasPostgreSQLDependencies: result.postgresqlDependencies.nativeQueries.length > 0 ||
        result.postgresqlDependencies.postgresqlFunctions.length > 0 ||
        result.postgresqlDependencies.postgresqlDataTypes.length > 0
    }));
  }

  /**
   * Categorize required Java changes following the minimal-change principle
   * Changes restricted to: Entity mappings, Repository queries, Database configurations
   * NO business logic refactoring
   */
  private categorizeJavaChanges(javaResults: JavaAnalysisResult[]) {
    const acceptable = {
      entityMappings: [] as string[],
      repositoryQueries: [] as string[],
      configurations: [] as string[]
    };
    const requiresReview: string[] = [];

    javaResults.forEach(result => {
      const hasDBDependency = result.postgresqlDependencies.nativeQueries.length > 0 ||
        result.postgresqlDependencies.postgresqlFunctions.length > 0 ||
        result.postgresqlDependencies.postgresqlDataTypes.length > 0;

      if (!hasDBDependency) {
        return; // No changes needed
      }

      switch (result.type) {
        case 'Entity':
          // Acceptable: Update @Entity, @Table, @Column annotations if type mapping fails
          acceptable.entityMappings.push(result.path);
          break;

        case 'Repository':
          // Acceptable: Rewrite SQL in @Query annotations, keep method signatures unchanged
          acceptable.repositoryQueries.push(result.path);
          break;

        case 'Configuration':
          // Acceptable: Update JDBC driver, connection URL, datasource properties
          acceptable.configurations.push(result.path);
          break;

        case 'Service':
        case 'Controller':
          // CRITICAL: Service/Controller with DB dependencies requires review
          // These should ideally NOT have PostgreSQL-specific code
          requiresReview.push(`${result.path} (${result.type} with native queries - review for business logic impact)`);
          break;

        default:
          // Any other file type with DB dependencies needs review
          if (hasDBDependency) {
            requiresReview.push(`${result.path} (${result.type} - unexpected DB dependency)`);
          }
      }
    });

    return {
      acceptable,
      requiresReview,
      summary: {
        totalFiles: javaResults.length,
        filesRequiringChange: acceptable.entityMappings.length + acceptable.repositoryQueries.length + acceptable.configurations.length,
        filesRequiringReview: requiresReview.length,
        principle: 'Keep Java application logic unchanged. Limited changes to: (1) Entity mappings, (2) Repository queries, (3) DB configurations. NO business logic refactoring.'
      }
    };
  }

  private assessPostgreSQLRisks(
    javaResults: JavaAnalysisResult[],
    ddlResult: PostgreSQLDDLAnalysisResult | undefined,
    migrationComplexity: PostgreSQLMigrationComplexityScore
  ): Array<any> {
    const risks = [];

    // Risk: High migration difficulty
    if (migrationComplexity.overall >= 60) {
      risks.push({
        id: 'PG-R-001',
        category: 'Migration Complexity',
        description: `Migration difficulty score is ${migrationComplexity.overall}/100 (${migrationComplexity.difficulty})`,
        severity: migrationComplexity.overall >= 80 ? 'Critical' : 'High',
        impact: 'Complex PostgreSQL-to-Oracle migration may lead to longer timeline and increased resource requirements',
        mitigation: 'Focus on database layer migration (DDL, SQL queries, procedures). Keep Java application logic unchanged. Allocate database migration specialists and use tools (Ora2Pg, AWS DMS).'
      });
    }

    // Risk: Schema and data type complexity
    if (migrationComplexity.schemaDataTypeComplexity >= 60) {
      risks.push({
        id: 'PG-R-002',
        category: 'Schema & Data Types',
        description: `Schema complexity score: ${migrationComplexity.schemaDataTypeComplexity}/100. ${migrationComplexity.details.schemaDataType.join('; ')}`,
        severity: 'High',
        impact: 'Complex PostgreSQL data types may require Entity annotation updates',
        mitigation: 'Update DDL scripts with Oracle equivalents (JSONB→JSON/CLOB, ARRAY→VARRAY). Modify Entity class annotations (@Type, @Column) ONLY if type mapping fails. Keep entity business logic unchanged.'
      });
    }

    // Risk: SQL rewrite complexity
    if (migrationComplexity.sqlQueryRewriteComplexity >= 60) {
      risks.push({
        id: 'PG-R-003',
        category: 'SQL Rewrite',
        description: `SQL rewrite complexity: ${migrationComplexity.sqlQueryRewriteComplexity}/100. ${migrationComplexity.details.sqlQueryRewrite.join('; ')}`,
        severity: 'High',
        impact: 'Extensive SQL query rewrites in @Query annotations and MyBatis XML required',
        mitigation: 'Rewrite SQL in @Query and MyBatis XML with Oracle syntax (LIMIT→FETCH FIRST, array_agg→LISTAGG). **CRITICAL: Keep repository method signatures, parameters, and return types unchanged.** No service layer changes.'
      });
    }

    // Risk: PL/pgSQL conversion
    if (migrationComplexity.procedureFunctionTriggerComplexity >= 60) {
      risks.push({
        id: 'PG-R-004',
        category: 'Procedures & Functions',
        description: `Procedure complexity: ${migrationComplexity.procedureFunctionTriggerComplexity}/100. ${migrationComplexity.details.procedureFunctionTrigger.join('; ')}`,
        severity: 'High',
        impact: 'PL/pgSQL to PL/SQL conversion requires careful review',
        mitigation: 'Convert PL/pgSQL to PL/SQL in database layer. If called from Java (@Procedure), update only procedure name/parameters in Repository interface. Keep business logic in service layer unchanged.'
      });
    }

    // Risk: Data volume
    if (migrationComplexity.dataVolumeMigrationComplexity >= 60) {
      risks.push({
        id: 'PG-R-005',
        category: 'Data Volume',
        description: `Data migration complexity: ${migrationComplexity.dataVolumeMigrationComplexity}/100. ${migrationComplexity.details.dataVolumeMigration.join('; ')}`,
        severity: 'Medium',
        impact: 'Large data volumes require careful migration planning',
        mitigation: 'Use Oracle Data Pump or AWS DMS. Recreate partitioning in Oracle DDL. Update Entity classes only if partition keys change. NO application logic changes.'
      });
    }

    // Risk: Application coupling - categorize Java changes
    if (migrationComplexity.applicationORMDependencyComplexity >= 60) {
      // Categorize Java files by type
      const entityFiles = javaResults.filter(j => j.type === 'Entity').length;
      const repoFiles = javaResults.filter(j => j.type === 'Repository').length;
      const serviceFiles = javaResults.filter(j => j.type === 'Service' && j.postgresqlDependencies.nativeQueries.length > 0).length;

      risks.push({
        id: 'PG-R-006',
        category: 'Application Dependencies',
        description: `Application dependency complexity: ${migrationComplexity.applicationORMDependencyComplexity}/100. Java files with DB dependencies: ${entityFiles} Entities, ${repoFiles} Repositories${serviceFiles > 0 ? `, ${serviceFiles} Services (review required)` : ''}`,
        severity: 'High',
        impact: 'Database layer Java code requires targeted updates',
        mitigation: `**Acceptable Java changes (DB layer only):** (1) Update JDBC driver in config files, (2) Modify Entity annotations if type mapping needed, (3) Rewrite SQL in Repository @Query/MyBatis XML. **CRITICAL: Do NOT refactor repository methods or service layer logic.** Keep method signatures and business logic unchanged.${serviceFiles > 0 ? ' Services with native queries require careful review.' : ''}`
      });
    }

    // Risk: Operational differences
    if (migrationComplexity.operationalRuntimeRiskComplexity >= 60) {
      risks.push({
        id: 'PG-R-007',
        category: 'Operational & Runtime',
        description: `Operational risk: ${migrationComplexity.operationalRuntimeRiskComplexity}/100. ${migrationComplexity.details.operationalRuntimeRisk.join('; ')}`,
        severity: 'Medium',
        impact: 'PostgreSQL extensions and operational differences may affect application behavior',
        mitigation: 'Replace extensions in DDL with Oracle equivalents (PostGIS→Oracle Spatial). Recreate GIN/GIST indexes. Update DB config files only. NO Java code changes for indexing.'
      });
    }

    // Risk: PostgreSQL extensions
    if (ddlResult && ddlResult.postgresqlFeatures.extensions && ddlResult.postgresqlFeatures.extensions.length > 0) {
      risks.push({
        id: 'PG-R-008',
        category: 'Extensions',
        description: `PostgreSQL extensions in use: ${ddlResult.postgresqlFeatures.extensions.join(', ')}`,
        severity: 'High',
        impact: 'Extensions may not have direct Oracle equivalents',
        mitigation: 'Research Oracle alternatives for each extension. Replace in DDL scripts. If Java code calls extension functions, update SQL queries in repositories only. NO business logic changes.'
      });
    }

    return risks;
  }
}

export interface PostgreSQLProjectMetadata {
  source_analysis: {
    total_files: number;
    total_loc: number;
    ormFramework: string;
    javaFiles: Array<{
      name: string;
      path: string;
      type: string;
      loc: number;
      ormFramework: string;
      hasPostgreSQLDependencies: boolean;
    }>;
    database: {
      tables: number;
      views: number;
      functions: number;
      stored_procedures: number;
      triggers: number;
      indexes: number;
      sequences: number;
      partitionedTables: number;
    };
    postgresqlFeatures: {
      dataTypes: any[];
      extensions: string[];
      advancedIndexes: any[];
      nativeQueryCount: number;
    };
  };
  javaChanges: {
    acceptable: {
      entityMappings: string[];
      repositoryQueries: string[];
      configurations: string[];
    };
    requiresReview: string[];
    summary: {
      totalFiles: number;
      filesRequiringChange: number;
      filesRequiringReview: number;
      principle: string;
    };
  };
  complexity_summary: string;
  migrationComplexity: PostgreSQLMigrationComplexityScore;
  risks: Array<{
    id: string;
    category: string;
    description: string;
    severity: string;
    impact: string;
    mitigation: string;
  }>;
}

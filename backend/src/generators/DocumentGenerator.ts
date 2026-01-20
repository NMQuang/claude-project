/**
 * Document Generator
 *
 * Generates Markdown documents from Handlebars templates
 */

import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DocumentGenerator {
  private templatesDir: string;

  constructor() {
    // Templates are in the root /templates directory
    this.templatesDir = path.join(__dirname, '..', '..', 'templates');
    this.registerHelpers();
  }

  /**
   * Generate a document from template
   * @param documentType - Type of document (as-is-analysis, migration-strategy, etc.)
   * @param data - Data to populate template
   * @param language - Language code ('en' or 'ja')
   * @param migrationType - Optional migration type (e.g., 'COBOL-to-Java', 'PostgreSQL-to-Oracle')
   */
  async generate(documentType: string, data: any, language: string = 'en', migrationType?: string): Promise<string> {
    // Map language codes to folder names
    const languageFolder = language === 'ja' ? 'japanese' : 'english';

    // Map migration type to subfolder name
    const migrationSubfolder = this.getMigrationSubfolder(migrationType || data.project?.migration_type);

    // Try paths in order of priority:
    // 1. Language + Migration Type specific
    // 2. English + Migration Type specific
    // 3. Language only (legacy fallback for backward compatibility)
    // 4. English only (fallback)
    const tryPaths = [
      path.join(languageFolder, migrationSubfolder, `${documentType}.hbs`),
      path.join('english', migrationSubfolder, `${documentType}.hbs`),
      path.join(languageFolder, `${documentType}.hbs`),  // Legacy fallback
      path.join('english', `${documentType}.hbs`)         // Legacy fallback
    ];

    let templatePath: string | null = null;
    for (const tryPath of tryPaths) {
      const fullPath = path.join(this.templatesDir, tryPath);
      if (fs.existsSync(fullPath)) {
        templatePath = fullPath;
        break;
      }
    }

    if (!templatePath) {
      throw new Error(`Template not found for ${documentType} in any language (migration type: ${migrationSubfolder})`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    return template(data);
  }

  /**
   * Map migration type to subfolder name
   */
  private getMigrationSubfolder(migrationType?: string): string {
    if (!migrationType) {
      return 'cobol-to-java'; // Default for backward compatibility
    }

    // Normalize migration type names to folder names
    const typeMap: { [key: string]: string } = {
      'COBOL-to-Java': 'cobol-to-java',
      'COBOL-Analysis': 'cobol-analysis',
      'PostgreSQL-to-Oracle': 'pg-to-oracle',
      'PL1-to-Java': 'pl1-to-java',
      'Oracle-to-PostgreSQL': 'oracle-to-pg',
      'MySQL-to-Oracle': 'mysql-to-oracle'
    };

    return typeMap[migrationType] || 'cobol-to-java'; // Default fallback
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers() {
    // Helper: Format date
    Handlebars.registerHelper('formatDate', (date: string, format: string) => {
      // Simple date formatting (in production, use a library like date-fns)
      return date;
    });

    // Helper: Add numbers
    Handlebars.registerHelper('add', (a: number, b: number) => {
      return a + b;
    });

    // Helper: Calculate percentage
    Handlebars.registerHelper('percentage', (value: number, total: number) => {
      if (total === 0) return 0;
      return Math.round((value / total) * 100);
    });

    // Helper: Complexity level
    Handlebars.registerHelper('complexityLevel', (score: number) => {
      if (score < 5) return 'Low';
      if (score < 10) return 'Medium';
      if (score < 15) return 'High';
      return 'Very High';
    });

    // Helper: JSON stringify (for debugging)
    Handlebars.registerHelper('json', (context: any) => {
      return JSON.stringify(context, null, 2);
    });

    // Helper: Equality comparison
    Handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    // Helper: Greater than comparison
    Handlebars.registerHelper('gt', (a: number, b: number) => {
      return a > b;
    });

    // Helper: Less than comparison
    Handlebars.registerHelper('lt', (a: number, b: number) => {
      return a < b;
    });

    // Helper: Greater than or equal comparison
    Handlebars.registerHelper('gte', (a: number, b: number) => {
      return a >= b;
    });

    // Helper: Less than or equal comparison
    Handlebars.registerHelper('lte', (a: number, b: number) => {
      return a <= b;
    });

    // Helper: Not equal comparison
    Handlebars.registerHelper('ne', (a: any, b: any) => {
      return a !== b;
    });

    // Helper: Group database access by table name
    Handlebars.registerHelper('groupByTable', (databaseAccess: any[]) => {
      if (!databaseAccess || !Array.isArray(databaseAccess)) {
        return [];
      }

      const tableMap = new Map<string, { table: string; selectCount: number; insertCount: number; updateCount: number; deleteCount: number }>();

      for (const access of databaseAccess) {
        const tableName = access.tableName || 'UNKNOWN';
        if (!tableMap.has(tableName)) {
          tableMap.set(tableName, {
            table: tableName,
            selectCount: 0,
            insertCount: 0,
            updateCount: 0,
            deleteCount: 0
          });
        }

        const entry = tableMap.get(tableName)!;
        switch (access.operation) {
          case 'SELECT':
            entry.selectCount++;
            break;
          case 'INSERT':
            entry.insertCount++;
            break;
          case 'UPDATE':
            entry.updateCount++;
            break;
          case 'DELETE':
            entry.deleteCount++;
            break;
        }
      }

      return Array.from(tableMap.values());
    });
  }
}

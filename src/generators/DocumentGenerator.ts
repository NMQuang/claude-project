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
   */
  async generate(documentType: string, data: any): Promise<string> {
    const templatePath = path.join(this.templatesDir, `${documentType}.hbs`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${documentType}.hbs`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    return template(data);
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
  }
}

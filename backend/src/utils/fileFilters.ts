// File extension filters for different migration types

export interface MigrationTypeFileFilters {
  extensions: string[];
  description: string;
}

export const MIGRATION_FILE_FILTERS: Record<string, MigrationTypeFileFilters> = {
  'COBOL-to-Java': {
    extensions: ['.cbl', '.cob', '.sql', '.ddl'],
    description: 'COBOL files (.cbl, .cob) and SQL/DDL files (.sql, .ddl)'
  },
  'Source-Analysis-COBOL': {
    extensions: ['.cbl', '.cob', '.cpy', '.jcl', '.prc', '.proc', '.sql', '.ddl'],
    description: 'COBOL programs (.cbl, .cob), copybooks (.cpy), JCL (.jcl, .prc, .proc), and DDL (.sql, .ddl)'
  },
  'PostgreSQL-to-Oracle': {
    extensions: ['.sql', '.java', '.xml', '.yml', '.yaml'],
    description: 'SQL, Java, and ORM config files (.sql, .java, .xml, .yml, .yaml)'
  }
};

/**
 * Validates if a file is allowed for the given migration type
 */
export function isValidFileForMigrationType(filename: string, migrationType: string): boolean {
  const filters = MIGRATION_FILE_FILTERS[migrationType];

  if (!filters) {
    // If migration type not recognized, accept all files
    return true;
  }

  const lowerFilename = filename.toLowerCase();
  return filters.extensions.some(ext => lowerFilename.endsWith(ext));
}

/**
 * Gets allowed extensions for a migration type
 */
export function getAllowedExtensions(migrationType: string): string[] {
  const filters = MIGRATION_FILE_FILTERS[migrationType];
  return filters ? filters.extensions : [];
}

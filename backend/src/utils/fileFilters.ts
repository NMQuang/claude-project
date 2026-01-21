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
  'COBOL-Analysis': {
    extensions: ['.cbl', '.cob', '.cpy'],
    description: 'COBOL source files (.cbl, .cob) and copybooks (.cpy) for business logic analysis'
  },
  'COBOL-Project-Analysis': {
    extensions: ['.cbl', '.cob', '.cpy', '.jcl', '.prc', '.proc'],
    description: 'COBOL programs, copybooks, and JCL for project-level analysis'
  },
  'PostgreSQL-to-Oracle': {
    extensions: ['.sql', '.java', '.xml', '.yml', '.yaml'],
    description: 'SQL, Java, and ORM config files (.sql, .java, .xml, .yml, .yaml)'
  },
  'MySQL-to-Oracle': {
    extensions: ['.sql', '.java', '.xml', '.yml', '.yaml'],
    description: 'SQL, Java, and ORM config files (.sql, .java, .xml, .yml, .yaml)'
  },
  'Oracle-to-PostgreSQL': {
    extensions: ['.sql', '.java', '.xml', '.yml', '.yaml'],
    description: 'SQL, Java, and ORM config files (.sql, .java, .xml, .yml, .yaml)'
  }

};

/**
 * Validates if a file is allowed for the given migration type
 * @param filename - The name of the file to validate
 * @param migrationType - The project's migration type
 * @returns true if the file is valid, false otherwise
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
 * @param migrationType - The project's migration type
 * @returns Array of allowed extensions
 */
export function getAllowedExtensions(migrationType: string): string[] {
  const filters = MIGRATION_FILE_FILTERS[migrationType];
  return filters ? filters.extensions : [];
}

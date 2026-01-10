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
  'PostgreSQL-to-Oracle': {
    extensions: ['.sql', '.java', '.xml', '.yml', '.yaml'],
    description: 'SQL, Java, and ORM config files (.sql, .java, .xml, .yml, .yaml)'
  },
  'Oracle-to-PostgreSQL': {
    extensions: ['.sql', '.java', '.xml', '.yml', '.yaml'],
    description: 'SQL, Java, and ORM config files (.sql, .java, .xml, .yml, .yaml)'
  },
  'MySQL-to-Oracle': {
    extensions: ['.sql', '.java', '.xml', '.yml', '.yaml'],
    description: 'SQL, Java, and ORM config files (.sql, .java, .xml, .yml, .yaml)'
  }
};

/**
 * Filters a FileList to only include files with valid extensions for the migration type
 * @param files - The FileList to filter
 * @param migrationType - The project's migration type
 * @returns Object containing valid files array and count of skipped files
 */
export function filterFilesByMigrationType(
  files: FileList,
  migrationType: string
): { validFiles: File[]; skippedCount: number; skippedFiles: string[] } {
  const filters = MIGRATION_FILE_FILTERS[migrationType];

  if (!filters) {
    // If migration type not recognized, accept all files
    return {
      validFiles: Array.from(files),
      skippedCount: 0,
      skippedFiles: []
    };
  }

  const validFiles: File[] = [];
  const skippedFiles: string[] = [];

  Array.from(files).forEach(file => {
    const fileName = file.name.toLowerCase();
    const isValid = filters.extensions.some(ext => fileName.endsWith(ext));

    if (isValid) {
      validFiles.push(file);
    } else {
      skippedFiles.push(file.name);
    }
  });

  return {
    validFiles,
    skippedCount: files.length - validFiles.length,
    skippedFiles
  };
}

/**
 * Gets the accept attribute value for file input based on migration type
 * @param migrationType - The project's migration type
 * @returns Comma-separated list of file extensions for the accept attribute
 */
export function getAcceptAttribute(migrationType: string): string {
  const filters = MIGRATION_FILE_FILTERS[migrationType];
  return filters ? filters.extensions.join(',') : '*';
}

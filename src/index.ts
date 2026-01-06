/**
 * Migration Documentation Tool - CLI Entry Point
 *
 * Enhanced version supporting:
 * 1. COBOL file analysis
 * 2. DDL/SQL schema analysis
 * 3. All 5 document types generation
 */

import { CobolAnalyzer } from './analyzers/CobolAnalyzer.js';
import { DDLAnalyzer } from './analyzers/DDLAnalyzer.js';
import { MetadataExtractor } from './extractors/MetadataExtractor.js';
import { DocumentGenerator } from './generators/DocumentGenerator.js';
import * as fs from 'fs';
import * as path from 'path';

interface CLIArgs {
  command: 'analyze' | 'generate';
  input?: string;
  type?: string;
  ddl?: string;
  project?: string;
  doc?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const command = args[0] as CLIArgs['command'];

  const parsedArgs: CLIArgs = { command };

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace('--', '') as keyof CLIArgs;
    const value = args[i + 1];
    (parsedArgs as any)[key] = value;
  }

  return parsedArgs;
}

/**
 * Analyze COBOL files
 */
async function analyzeCommand(inputPath: string, type: string, ddlPath?: string) {
  console.log(`Analyzing ${type} files in: ${inputPath}\n`);

  // Analyze COBOL files
  const analyzer = new CobolAnalyzer();
  const files = getAllFiles(inputPath, '.cbl');

  console.log(`Found ${files.length} COBOL files\n`);

  const analysisResults = [];

  for (const file of files) {
    console.log(`Analyzing: ${path.basename(file)}`);
    const result = await analyzer.analyze(file);
    analysisResults.push(result);
  }

  // Analyze DDL files if provided
  let ddlResults = undefined;
  if (ddlPath) {
    console.log(`\nAnalyzing DDL files in: ${ddlPath}\n`);
    const ddlAnalyzer = new DDLAnalyzer();
    const ddlFiles = getAllFiles(ddlPath, '.sql');

    console.log(`Found ${ddlFiles.length} DDL files\n`);

    for (const file of ddlFiles) {
      console.log(`Analyzing: ${path.basename(file)}`);
      const result = await ddlAnalyzer.analyze(file);

      // Merge results (in simple POC, just use last file's results)
      // In production, would aggregate across all DDL files
      ddlResults = result;

      console.log(`  Tables: ${result.totalTables}`);
      console.log(`  Views: ${result.views.length}`);
      console.log(`  Stored Procedures: ${result.storedProcedures.length}`);
      console.log(`  Triggers: ${result.triggers.length}`);
      console.log(`  Functions: ${result.functions.length}`);
    }
  }

  // Extract metadata
  const extractor = new MetadataExtractor();
  const metadata = extractor.extract(analysisResults, ddlResults);

  // Save metadata to output directory
  const outputDir = 'output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const metadataPath = path.join(outputDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Also save DDL results if available
  if (ddlResults) {
    const ddlMetadataPath = path.join(outputDir, 'ddl-metadata.json');
    fs.writeFileSync(ddlMetadataPath, JSON.stringify(ddlResults, null, 2));
  }

  console.log(`\nAnalysis complete!`);
  console.log(`Total COBOL files: ${metadata.source_analysis.total_files}`);
  console.log(`Total LOC: ${metadata.source_analysis.total_loc}`);
  if (ddlResults) {
    console.log(`Total Tables: ${ddlResults.totalTables}`);
    console.log(`Total Columns: ${ddlResults.totalColumns}`);
  }
  console.log(`Metadata saved to: ${metadataPath}\n`);
}

/**
 * Generate document
 */
async function generateCommand(projectName: string, docType: string) {
  console.log(`Generating ${docType} document for project: ${projectName}\n`);

  // Load metadata
  const metadataPath = 'output/metadata.json';
  if (!fs.existsSync(metadataPath)) {
    console.error('Error: No metadata found. Run "analyze" command first.');
    process.exit(1);
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

  // Load DDL metadata if available
  let ddlMetadata = undefined;
  const ddlMetadataPath = 'output/ddl-metadata.json';
  if (fs.existsSync(ddlMetadataPath)) {
    ddlMetadata = JSON.parse(fs.readFileSync(ddlMetadataPath, 'utf-8'));
  }

  // Prepare document data
  const data = {
    project: {
      name: projectName,
      migration_type: 'COBOL-to-Java'
    },
    source: {
      language: 'COBOL',
      database: 'Oracle 11g',
      app_server: 'IBM WebSphere',
      os: 'z/OS'
    },
    target: {
      language: 'Java 17',
      framework: 'Spring Boot 3.x',
      database: 'PostgreSQL 15',
      deployment: 'Docker/Kubernetes'
    },
    metadata,
    ddl_metadata: ddlMetadata,
    generated_date: new Date().toISOString().split('T')[0],
    version: '1.0',
    author: 'Auto-generated'
  };

  // Generate document
  const generator = new DocumentGenerator();
  const markdown = await generator.generate(docType, data);

  // Save document
  const outputPath = `output/${docType}.md`;
  fs.writeFileSync(outputPath, markdown);

  console.log(`Document generated: ${outputPath}\n`);
}

/**
 * Get all files with specific extension recursively
 */
function getAllFiles(dirPath: string, extension: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files: string[] = [];
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, extension));
    } else if (item.endsWith(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main entry point
 */
async function main() {
  console.log('=== Migration Documentation Tool ===\n');

  const args = parseArgs();

  try {
    if (args.command === 'analyze') {
      if (!args.input || !args.type) {
        console.error('Usage: node index.js analyze --input <path> --type <cobol|pl1> [--ddl <ddl-path>]');
        process.exit(1);
      }
      await analyzeCommand(args.input, args.type, args.ddl);
    } else if (args.command === 'generate') {
      if (!args.project || !args.doc) {
        console.error('Usage: node index.js generate --project <name> --doc <document-type>');
        console.error('');
        console.error('Available document types:');
        console.error('  as-is-analysis         - Current system analysis');
        console.error('  migration-strategy     - Migration approach and planning');
        console.error('  migration-design       - Technical design (code & database)');
        console.error('  test-strategy          - Testing approach');
        console.error('  deployment-rollback    - Deployment procedures');
        process.exit(1);
      }
      await generateCommand(args.project, args.doc);
    } else {
      console.log('Available commands:');
      console.log('  analyze  --input <path> --type <cobol|pl1> [--ddl <ddl-path>]');
      console.log('  generate --project <name> --doc <document-type>');
      console.log('');
      console.log('Document types:');
      console.log('  as-is-analysis, migration-strategy, migration-design,');
      console.log('  test-strategy, deployment-rollback');
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { main };

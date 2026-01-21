/**
 * Migration Documentation Tool - REST API Server
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import analyzers and generators
import { CobolAnalyzer } from './analyzers/CobolAnalyzer.js';
import { CobolBusinessLogicAnalyzer } from './analyzers/CobolBusinessLogicAnalyzer.js';
import { CobolProjectAnalyzer } from './analyzers/CobolProjectAnalyzer.js';
import { DDLAnalyzer } from './analyzers/DDLAnalyzer.js';
import { JavaAnalyzer } from './analyzers/JavaAnalyzer.js';
import { PostgreSQLDDLAnalyzer } from './analyzers/PostgreSQLDDLAnalyzer.js';
import { ORMConfigAnalyzer } from './analyzers/ORMConfigAnalyzer.js';
import { MetadataExtractor } from './extractors/MetadataExtractor.js';
import { DocumentGenerator } from './generators/DocumentGenerator.js';
import { isValidFileForMigrationType, getAllowedExtensions } from './utils/fileFilters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.params.id;
    const uploadDir = path.join(__dirname, '../uploads', projectId);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const projectId = req.params.id;
  const project = projects.get(projectId);

  if (!project) {
    cb(new Error('Project not found'));
    return;
  }

  // Validate file extension based on migration type
  if (!isValidFileForMigrationType(file.originalname, project.migrationType)) {
    const allowedExtensions = getAllowedExtensions(project.migrationType);
    cb(new Error(`File type not allowed for ${project.migrationType} migration. Allowed types: ${allowedExtensions.join(', ')}`));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter
});

// In-memory storage for projects (replace with database in production)
interface Project {
  id: string;
  name: string;
  migrationType: string;
  status: string;
  createdAt: string;
  sourceLanguage?: string;
  sourceDatabase?: string;
  targetLanguage?: string;
  targetDatabase?: string;
  metadata?: any;
  ddlMetadata?: any;
  generatedDocuments?: string[]; // Track which documents have been generated
}

const projects: Map<string, Project> = new Map();

// Error handling middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
};

// =======================
// API Routes
// =======================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all projects
app.get('/api/projects', (req, res) => {
  const projectList = Array.from(projects.values());
  res.json(projectList);
});

// Get project by ID
app.get('/api/projects/:id', (req, res) => {
  const project = projects.get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json(project);
});

// Create new project
app.post('/api/projects', (req, res) => {
  const { name, migrationType, sourceLanguage, sourceDatabase, targetLanguage, targetDatabase } = req.body;

  if (!name || !migrationType) {
    return res.status(400).json({ error: 'Name and migration type are required' });
  }

  const project: Project = {
    id: uuidv4(),
    name,
    migrationType,
    status: 'Created',
    createdAt: new Date().toISOString(),
    sourceLanguage,
    sourceDatabase,
    targetLanguage,
    targetDatabase
  };

  projects.set(project.id, project);

  res.status(201).json(project);
});

// Upload files to project
app.post('/api/projects/:id/upload', (req, res) => {
  upload.array('files')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const project = projects.get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const files = req.files as Express.Multer.File[];
    const filePaths = req.body.filePaths; // Array of relative paths from folder upload
    const uploadDir = path.join(__dirname, '../uploads', project.id);

    // Process files to preserve folder structure
    const processedFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let relativePath = file.filename; // Default to filename

      // If filePaths provided (folder upload), use relative path
      if (filePaths) {
        const pathArray = Array.isArray(filePaths) ? filePaths : [filePaths];
        if (pathArray[i]) {
          relativePath = pathArray[i];

          // Create subdirectory if needed
          const targetDir = path.join(uploadDir, path.dirname(relativePath));
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          // Move file to correct location with folder structure
          const targetPath = path.join(uploadDir, relativePath);
          if (file.path !== targetPath) {
            fs.renameSync(file.path, targetPath);
          }
        }
      }

      processedFiles.push({
        filename: path.basename(relativePath),
        relativePath: relativePath,
        size: file.size,
        path: path.join(uploadDir, relativePath)
      });
    }

    res.json({
      message: 'Files uploaded successfully',
      files: processedFiles
    });
  });
});

// Analyze project
app.post('/api/projects/:id/analyze', async (req, res) => {
  const project = projects.get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    project.status = 'Analyzing';

    const uploadDir = path.join(__dirname, '../uploads', project.id);

    // Route based on migration type
    if (project.migrationType === 'COBOL-to-Java') {
      // Existing COBOL analysis logic
      const cobolAnalyzer = new CobolAnalyzer();
      const cobolFiles = getAllFiles(uploadDir, '.cbl');

      const analysisResults = [];
      for (const file of cobolFiles) {
        const result = await cobolAnalyzer.analyze(file);
        analysisResults.push(result);
      }

      // Analyze DDL files
      let ddlResults = undefined;
      const ddlAnalyzer = new DDLAnalyzer();
      const ddlFiles = getAllFiles(uploadDir, '.sql');

      if (ddlFiles.length > 0) {
        for (const file of ddlFiles) {
          const result = await ddlAnalyzer.analyze(file);
          ddlResults = result; // In production, merge multiple DDL files
        }
      }

      // Extract metadata
      const extractor = new MetadataExtractor();
      const metadata = extractor.extract(analysisResults, ddlResults);

      // Save to project
      project.metadata = metadata;
      project.ddlMetadata = ddlResults;
      project.status = 'Analyzed';

      res.json({
        message: 'Analysis complete',
        metadata,
        ddlMetadata: ddlResults
      });

    } else if (project.migrationType === 'COBOL-Analysis') {
      // COBOL Business Logic Analysis
      const businessLogicAnalyzer = new CobolBusinessLogicAnalyzer();
      const cobolFiles = getAllFiles(uploadDir, ['.cbl', '.cob']);

      const businessLogicResults = [];
      for (const file of cobolFiles) {
        const result = await businessLogicAnalyzer.analyze(file);
        // Add relative path (from upload directory)
        const relativePath = path.relative(uploadDir, file).replace(/\\/g, '/');
        result.relativePath = relativePath;
        businessLogicResults.push(result);
      }

      // Calculate metrics from analysis results
      let totalLoc = 0;
      let totalParagraphs = 0;
      let totalSqlStatements = 0;
      let highComplexityCount = 0;
      let mediumComplexityCount = 0;

      for (const result of businessLogicResults) {
        totalLoc += result.metrics?.totalLines || 0;
        totalParagraphs += result.paragraphs?.length || 0;
        totalSqlStatements += result.metrics?.sqlStatementCount || 0;

        const difficulty = result.complexity?.overallDifficulty;
        if (difficulty === 'High') highComplexityCount++;
        else if (difficulty === 'Medium') mediumComplexityCount++;
      }

      // Determine overall difficulty
      let overallDifficulty = 'Low';
      if (highComplexityCount > 0 || (mediumComplexityCount > cobolFiles.length / 2)) {
        overallDifficulty = 'High';
      } else if (mediumComplexityCount > 0) {
        overallDifficulty = 'Medium';
      }

      // Store results in project metadata with source_analysis for frontend compatibility
      project.metadata = {
        type: 'COBOL-Analysis',
        businessLogicResults,
        totalFiles: cobolFiles.length,
        analyzedAt: new Date().toISOString(),
        // Add source_analysis for frontend metrics display
        source_analysis: {
          total_files: cobolFiles.length,
          total_loc: totalLoc,
          total_paragraphs: totalParagraphs,
          database: {
            tables: totalSqlStatements > 0 ? totalSqlStatements : 0
          }
        },
        // Add migrationComplexity for frontend display
        migrationComplexity: {
          difficulty: overallDifficulty,
          overall: overallDifficulty === 'High' ? 75 : (overallDifficulty === 'Medium' ? 50 : 25),
          description: `COBOL Business Logic Analysis - ${cobolFiles.length} program(s) analyzed with ${overallDifficulty.toLowerCase()} complexity`
        }
      };
      project.status = 'Analyzed';

      res.json({
        message: 'COBOL Business Logic analysis complete',
        totalFiles: cobolFiles.length,
        results: businessLogicResults.map(r => ({
          programId: r.programId,
          fileName: r.fileName,
          relativePath: r.relativePath,
          processingType: r.overview.processingType,
          paragraphCount: r.paragraphs.length,
          complexityLevel: r.complexity.overallDifficulty
        }))
      });

    } else if (project.migrationType === 'COBOL-Project-Analysis') {
      // COBOL Project-Level Analysis
      const projectAnalyzer = new CobolProjectAnalyzer();
      const projectAnalysisResult = await projectAnalyzer.analyzeProject(uploadDir, project.name);

      // Calculate metrics summary
      const totalLoc = projectAnalysisResult.inventory.totalLinesOfCode;
      const totalPrograms = projectAnalysisResult.inventory.programs;
      const totalCopybooks = projectAnalysisResult.inventory.copybooks;
      const totalJclJobs = projectAnalysisResult.inventory.jclJobs;

      // Determine overall difficulty
      const effort = projectAnalysisResult.migrationImpact.estimatedEffort;
      let overallDifficulty = 'Low';
      if (effort.highComplexity > totalPrograms * 0.3) {
        overallDifficulty = 'High';
      } else if (effort.mediumComplexity > totalPrograms * 0.5) {
        overallDifficulty = 'Medium';
      }

      // Store results in project metadata
      project.metadata = {
        type: 'COBOL-Project-Analysis',
        projectAnalysis: projectAnalysisResult,
        analyzedAt: new Date().toISOString(),
        source_analysis: {
          total_files: totalPrograms,
          total_loc: totalLoc,
          total_paragraphs: projectAnalysisResult.programResults.reduce(
            (sum, p) => sum + (p.paragraphs?.length || 0), 0
          ),
          copybooks: totalCopybooks,
          jcl_jobs: totalJclJobs,
          entities: projectAnalysisResult.businessEntities.length,
          database: {
            tables: projectAnalysisResult.businessEntities.filter(e => e.source === 'DATABASE').length
          }
        },
        migrationComplexity: {
          difficulty: overallDifficulty,
          overall: overallDifficulty === 'High' ? 75 : (overallDifficulty === 'Medium' ? 50 : 25),
          description: `Project-level analysis: ${totalPrograms} programs, ${totalCopybooks} copybooks, ${totalJclJobs} JCL jobs`
        }
      };
      project.status = 'Analyzed';

      res.json({
        message: 'COBOL Project-Level analysis complete',
        inventory: projectAnalysisResult.inventory,
        businessEntities: projectAnalysisResult.businessEntities.length,
        businessProcesses: projectAnalysisResult.businessProcesses.length,
        migrationImpact: projectAnalysisResult.migrationImpact.overallComplexity
      });

    } else if (project.migrationType === 'PostgreSQL-to-Oracle') {
      // NEW: PostgreSQL-to-Oracle analysis

      // 1. Analyze Java files
      const javaAnalyzer = new JavaAnalyzer();
      const javaFiles = getAllFiles(uploadDir, '.java');

      const javaResults = [];
      for (const file of javaFiles) {
        const result = await javaAnalyzer.analyze(file);
        javaResults.push(result);
      }

      // 2. Analyze PostgreSQL DDL
      const pgDDLAnalyzer = new PostgreSQLDDLAnalyzer();
      const ddlFiles = getAllFiles(uploadDir, '.sql');

      let ddlResult = undefined;
      if (ddlFiles.length > 0) {
        for (const file of ddlFiles) {
          const result = await pgDDLAnalyzer.analyze(file);
          ddlResult = result; // In production, merge multiple DDL files
        }
      }

      // 3. Analyze ORM config files
      const ormAnalyzer = new ORMConfigAnalyzer();
      const ormFiles = getAllFiles(uploadDir, ['.xml', '.yml', '.yaml']);

      const ormResults = [];
      for (const file of ormFiles) {
        const result = await ormAnalyzer.analyze(file);
        ormResults.push(result);
      }

      // 4. Extract metadata
      const extractor = new MetadataExtractor();
      const metadata = extractor.extractPostgreSQL(javaResults, ddlResult, ormResults);

      // Save to project
      project.metadata = metadata;
      project.ddlMetadata = ddlResult;
      project.status = 'Analyzed';

      res.json({
        message: 'PostgreSQL-to-Oracle analysis complete',
        metadata,
        ddlMetadata: ddlResult
      });

    } else {
      return res.status(400).json({ error: `Unsupported migration type: ${project.migrationType}` });
    }

  } catch (error) {
    project.status = 'Error';
    throw error;
  }
});

// Get project metadata
app.get('/api/projects/:id/metadata', (req, res) => {
  const project = projects.get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (!project.metadata) {
    return res.status(404).json({ error: 'No metadata found. Run analysis first.' });
  }

  res.json({
    metadata: project.metadata,
    ddlMetadata: project.ddlMetadata
  });
});

// Generate document
app.post('/api/projects/:id/generate', async (req, res) => {
  const project = projects.get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (!project.metadata) {
    return res.status(400).json({ error: 'No metadata found. Run analysis first.' });
  }

  const { documentType, language = 'en' } = req.body;

  if (!documentType) {
    return res.status(400).json({ error: 'Document type is required' });
  }

  try {
    // Prepare document data based on migration type
    let data: any;

    if (project.migrationType === 'COBOL-Analysis') {
      // Special handling for COBOL Business Logic Analysis
      const { programIndex = 0 } = req.body;
      const businessLogicResults = project.metadata.businessLogicResults || [];

      if (businessLogicResults.length === 0) {
        return res.status(400).json({ error: 'No COBOL files analyzed' });
      }

      // Get specific program or first one
      const businessLogic = businessLogicResults[programIndex] || businessLogicResults[0];

      data = {
        project: {
          name: project.name,
          migration_type: project.migrationType
        },
        businessLogic,
        allPrograms: businessLogicResults.map((r: any, idx: number) => ({
          index: idx,
          programId: r.programId,
          fileName: r.fileName
        })),
        generated_date: new Date().toISOString().split('T')[0],
        version: '1.0',
        author: 'Auto-generated'
      };
    } else if (project.migrationType === 'COBOL-Project-Analysis') {
      // Special handling for COBOL Project-Level Analysis
      const projectAnalysis = project.metadata.projectAnalysis;

      if (!projectAnalysis) {
        return res.status(400).json({ error: 'No project analysis data found' });
      }

      data = {
        project: {
          name: project.name,
          migration_type: project.migrationType
        },
        projectAnalysis,
        generated_date: new Date().toISOString().split('T')[0],
        version: '1.0',
        author: 'Auto-generated'
      };
    } else {
      // Standard migration document data
      data = {
        project: {
          name: project.name,
          migration_type: project.migrationType
        },
        source: {
          language: project.sourceLanguage || 'COBOL',
          database: project.sourceDatabase || 'Oracle 11g',
          app_server: 'IBM WebSphere',
          os: 'z/OS'
        },
        target: {
          language: project.targetLanguage || 'Java 17',
          framework: 'Spring Boot 3.x',
          database: project.targetDatabase || 'PostgreSQL 15',
          deployment: 'Docker/Kubernetes'
        },
        metadata: project.metadata,
        ddl_metadata: project.ddlMetadata,
        generated_date: new Date().toISOString().split('T')[0],
        version: '1.0',
        author: 'Auto-generated'
      };
    }

    // Generate document
    const generator = new DocumentGenerator();
    const markdown = await generator.generate(documentType, data, language, project.migrationType);

    // Save document
    const docsDir = path.join(__dirname, '../../outputs', project.id, 'documents');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const docPath = path.join(docsDir, `${documentType}.md`);
    fs.writeFileSync(docPath, markdown);

    // Track generated document
    if (!project.generatedDocuments) {
      project.generatedDocuments = [];
    }
    if (!project.generatedDocuments.includes(documentType)) {
      project.generatedDocuments.push(documentType);
    }

    res.json({
      message: 'Document generated successfully',
      documentType,
      content: markdown,
      path: docPath
    });

  } catch (error) {
    throw error;
  }
});

// Get document
app.get('/api/projects/:id/documents/:docType', (req, res) => {
  const project = projects.get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const docPath = path.join(__dirname, '../../outputs', project.id, 'documents', `${req.params.docType}.md`);

  if (!fs.existsSync(docPath)) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const content = fs.readFileSync(docPath, 'utf-8');

  res.json({
    documentType: req.params.docType,
    content
  });
});

// Update document
app.put('/api/projects/:id/documents/:docType', (req, res) => {
  const project = projects.get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const docPath = path.join(__dirname, '../../outputs', project.id, 'documents', `${req.params.docType}.md`);
  fs.writeFileSync(docPath, content);

  res.json({ message: 'Document updated successfully' });
});

// Download a single document
app.get('/api/projects/:id/documents/:docType/download', (req, res) => {
  const project = projects.get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const docPath = path.join(__dirname, '../../outputs', project.id, 'documents', `${req.params.docType}.md`);

  if (!fs.existsSync(docPath)) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Set headers for file download
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.docType}.md"`);

  // Send file
  res.sendFile(docPath);
});

// Export documents as ZIP
app.get('/api/projects/:id/export', (req, res) => {
  const project = projects.get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const docsDir = path.join(__dirname, '../../outputs', project.id, 'documents');

  if (!fs.existsSync(docsDir)) {
    return res.status(404).json({ error: 'No documents found' });
  }

  // In production, create a ZIP file
  // For now, return list of documents
  const files = fs.readdirSync(docsDir);

  res.json({
    message: 'Export prepared',
    files: files.map(f => ({
      name: f,
      path: path.join(docsDir, f)
    }))
  });
});

// Delete project
app.delete('/api/projects/:id', (req, res) => {
  const project = projects.get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Delete files
  const uploadDir = path.join(__dirname, '../../outputs', project.id);
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }

  // Delete project
  projects.delete(req.params.id);

  res.json({ message: 'Project deleted successfully' });
});

// Error handling
app.use(errorHandler);

// Utility function - supports single extension or array of extensions
function getAllFiles(dirPath: string, extensions: string | string[]): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const extArray = Array.isArray(extensions) ? extensions : [extensions];
  const files: string[] = [];
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, extArray));
    } else {
      // Check if file ends with any of the extensions
      if (extArray.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// Start server
app.listen(PORT, () => {
  console.log(`=== Migration Documentation Tool - API Server ===`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  GET    /api/health`);
  console.log(`  GET    /api/projects`);
  console.log(`  POST   /api/projects`);
  console.log(`  GET    /api/projects/:id`);
  console.log(`  POST   /api/projects/:id/upload`);
  console.log(`  POST   /api/projects/:id/analyze`);
  console.log(`  POST   /api/projects/:id/generate`);
  console.log(`  GET    /api/projects/:id/documents/:docType`);
  console.log(`  PUT    /api/projects/:id/documents/:docType`);
  console.log(`\nReady to accept connections!`);
});

export default app;

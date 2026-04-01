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
import { SourceAnalyzer } from './analyzers/SourceAnalyzer.js';
import { DDLAnalyzer } from './analyzers/DDLAnalyzer.js';
import { JavaAnalyzer } from './analyzers/JavaAnalyzer.js';
import { PostgreSQLDDLAnalyzer } from './analyzers/PostgreSQLDDLAnalyzer.js';
import { ORMConfigAnalyzer } from './analyzers/ORMConfigAnalyzer.js';
import { MetadataExtractor } from './extractors/MetadataExtractor.js';
import { DocumentGenerator } from './generators/DocumentGenerator.js';
import { isValidFileForMigrationType, getAllowedExtensions } from './utils/fileFilters.js';
import { supabase } from './db/supabase.js';

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

const fileFilter = async (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const projectId = req.params.id;
  
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select('migration_type')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      cb(new Error('Project not found'));
      return;
    }

    // Validate file extension based on migration type
    if (!isValidFileForMigrationType(file.originalname, project.migration_type)) {
      const allowedExtensions = getAllowedExtensions(project.migration_type);
      cb(new Error(`File type not allowed for ${project.migration_type} migration. Allowed types: ${allowedExtensions.join(', ')}`));
      return;
    }

    cb(null, true);
  } catch (err) {
    cb(err as Error);
  }
};

const upload = multer({
  storage,
  fileFilter
});

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
app.get('/api/projects', async (req, res) => {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Chuyển đổi mapping để tương thích với frontend data model (camelCase vs snake_case)
  const formattedProjects = projects.map(p => ({
    ...p,
    migrationType: p.migration_type,
    sourceLanguage: p.source_language,
    sourceDatabase: p.source_database,
    targetLanguage: p.target_language,
    targetDatabase: p.target_database,
    createdAt: p.created_at
  }));

  res.json(formattedProjects);
});

// Get project by ID
app.get('/api/projects/:id', async (req, res) => {
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({
    ...project,
    migrationType: project.migration_type,
    sourceLanguage: project.source_language,
    sourceDatabase: project.source_database,
    targetLanguage: project.target_language,
    targetDatabase: project.target_database,
    createdAt: project.created_at
  });
});

// Create new project
app.post('/api/projects', async (req, res) => {
  const { name, migrationType, sourceLanguage, sourceDatabase, targetLanguage, targetDatabase } = req.body;

  if (!name || !migrationType) {
    return res.status(400).json({ error: 'Name and migration type are required' });
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert([{
      name,
      migration_type: migrationType,
      status: 'Created',
      source_language: sourceLanguage,
      source_database: sourceDatabase,
      target_language: targetLanguage,
      target_database: targetDatabase
    }])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({
    ...project,
    migrationType: project.migration_type,
    sourceLanguage: project.source_language,
    sourceDatabase: project.source_database,
    targetLanguage: project.target_language,
    targetDatabase: project.target_database,
    createdAt: project.created_at
  });
});

// Upload files to project
app.post('/api/projects/:id/upload', (req, res) => {
  upload.array('files')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { data: project, error: dbError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (dbError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const files = req.files as Express.Multer.File[] | undefined;
    const filePaths = req.body.filePaths; // Array of relative paths from folder upload

    if (!files || files.length === 0) {
      console.error('No files found in request. req.body:', req.body);
      return res.status(400).json({ error: 'No valid files received by backend' });
    }

    const uploadDir = path.join(__dirname, '../uploads', project.id);

    // Process files to preserve folder structure
    const processedFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let relativePath = file.originalname; // Multer saves originalname 

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
  const { data: project, error: dbError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (dbError || !project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    // Update status to Analyzing
    await supabase.from('projects').update({ status: 'Analyzing' }).eq('id', project.id);

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
          ddlResults = result;
        }
      }

      // Extract metadata
      const extractor = new MetadataExtractor();
      const metadata = extractor.extract(analysisResults, ddlResults);

      // Save to Supabase
      await supabase.from('projects').update({
        metadata,
        ddl_metadata: ddlResults,
        status: 'Analyzed'
      }).eq('id', project.id);

      res.json({
        message: 'Analysis complete',
        metadata,
        ddlMetadata: ddlResults
      });

    } else if (project.migration_type === 'Source-Analysis-COBOL') {
      // Source-level Evidence-Based Analysis — COBOL Online / Batch / JCL
      const sourceAnalyzer = new SourceAnalyzer();
      const sourceAnalysisResult = await sourceAnalyzer.analyzeSource(uploadDir, project.name);

      const eps = sourceAnalysisResult.executionPatternSummary;
      const inv = sourceAnalysisResult.section0_scopeSummary.fileInventory;

      // Store results in project metadata
      const newMetadata = {
        type: 'Source-Analysis-COBOL',
        sourceAnalysis: sourceAnalysisResult,
        analyzedAt: new Date().toISOString(),
        source_analysis: {
          total_files: sourceAnalysisResult.section1_programInventory.length,
          total_loc: inv.totalLinesOfCode,
          copybooks: inv.copybooks,
          // Online vs Batch classification
          online_programs: eps.onlinePrograms.length,
          batch_programs: eps.batchPrograms.length,
          undetermined: eps.undeterminedPrograms.length,
          // JCL
          jcl_jobs: eps.jclSummary.totalJobs,
          jcl_steps: eps.jclSummary.totalSteps,
          jcl_programs_invoked: eps.jclSummary.programsInvokedByJcl.length,
          // Data
          data_structures: sourceAnalysisResult.section2_persistentDataStructures.length,
          data_access_patterns: sourceAnalysisResult.section3_dataAccessPatterns.length,
          open_questions: sourceAnalysisResult.section5_observationsAndQuestions.openQuestions.length,
          observations: sourceAnalysisResult.section5_observationsAndQuestions.observations.length
        },
        migrationComplexity: {
          difficulty: 'N/A',
          overall: 0,
          description: 'Source-level COBOL analysis (evidence-based, no complexity scoring)'
        }
      };

      await supabase.from('projects').update({
        metadata: newMetadata,
        status: 'Analyzed'
      }).eq('id', project.id);

      res.json({
        message: 'Source-level COBOL analysis complete (evidence-based)',
        programs: sourceAnalysisResult.section1_programInventory.length,
        onlinePrograms: eps.onlinePrograms.length,
        batchPrograms: eps.batchPrograms.length,
        undeterminedPrograms: eps.undeterminedPrograms.length,
        jclJobs: eps.jclSummary.totalJobs,
        jclSteps: eps.jclSummary.totalSteps,
        dataStructures: sourceAnalysisResult.section2_persistentDataStructures.length,
        observations: sourceAnalysisResult.section5_observationsAndQuestions.observations.length,
        openQuestions: sourceAnalysisResult.section5_observationsAndQuestions.openQuestions.length
      });

    } else if (project.migration_type === 'PostgreSQL-to-Oracle') {
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

      // Save to Supabase
      await supabase.from('projects').update({
        metadata,
        ddl_metadata: ddlResult,
        status: 'Analyzed'
      }).eq('id', project.id);

      res.json({
        message: 'PostgreSQL-to-Oracle analysis complete',
        metadata,
        ddlMetadata: ddlResult
      });

    } else {
      return res.status(400).json({ error: `Unsupported migration type: ${project.migration_type}` });
    }

  } catch (error) {
    await supabase.from('projects').update({ status: 'Error' }).eq('id', project.id);
    throw error;
  }
});

// Get project metadata
app.get('/api/projects/:id/metadata', async (req, res) => {
  const { data: project, error } = await supabase
    .from('projects')
    .select('metadata, ddl_metadata')
    .eq('id', req.params.id)
    .single();

  if (error || !project) {
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
  const { data: project, error: dbError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (dbError || !project) {
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

    if (project.migration_type === 'Source-Analysis-COBOL') {
      const sourceAnalysis = project.metadata.sourceAnalysis;
      if (!sourceAnalysis) {
        return res.status(400).json({ error: 'No source analysis data found' });
      }
      data = {
        project: { name: project.name, migration_type: project.migration_type },
        sourceAnalysis,
        generated_date: new Date().toISOString().split('T')[0],
        version: '1.0',
        author: 'Auto-generated'
      };
    } else {
      // Standard migration document data (COBOL-to-Java, PostgreSQL-to-Oracle)
      data = {
        project: {
          name: project.name,
          migration_type: project.migration_type
        },
        source: {
          language: project.source_language || 'COBOL',
          database: project.source_database || 'Oracle 11g',
          app_server: 'IBM WebSphere',
          os: 'z/OS'
        },
        target: {
          language: project.target_language || 'Java 17',
          framework: 'Spring Boot 3.x',
          database: project.target_database || 'PostgreSQL 15',
          deployment: 'Docker/Kubernetes'
        },
        metadata: project.metadata,
        ddl_metadata: project.ddl_metadata,
        generated_date: new Date().toISOString().split('T')[0],
        version: '1.0',
        author: 'Auto-generated'
      };
    }

    // Generate document
    const generator = new DocumentGenerator();
    const markdown = await generator.generate(documentType, data, language, project.migration_type);

    // Save document to Supabase (Upsert based on unique constraint)
    const { error: upsertError } = await supabase
      .from('documents')
      .upsert({
        project_id: project.id,
        document_type: documentType,
        content: markdown
      }, { onConflict: 'project_id, document_type' });

    if (upsertError) {
      console.error('Error saving document to Supabase:', upsertError);
      throw upsertError;
    }

    res.json({
      message: 'Document generated successfully',
      documentType,
      content: markdown
    });

  } catch (error) {
    throw error;
  }
});

// Get document
app.get('/api/projects/:id/documents/:docType', async (req, res) => {
  const { data, error } = await supabase
    .from('documents')
    .select('content')
    .eq('project_id', req.params.id)
    .eq('document_type', req.params.docType)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json({
    documentType: req.params.docType,
    content: data.content
  });
});

// Update document
app.put('/api/projects/:id/documents/:docType', async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const { error } = await supabase
    .from('documents')
    .update({ content })
    .eq('project_id', req.params.id)
    .eq('document_type', req.params.docType);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Document updated successfully' });
});

// Download a single document
app.get('/api/projects/:id/documents/:docType/download', async (req, res) => {
  const { data, error } = await supabase
    .from('documents')
    .select('content')
    .eq('project_id', req.params.id)
    .eq('document_type', req.params.docType)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Set headers for file download
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.docType}.md"`);

  // Send content
  res.send(data.content);
});

// Export documents setup (Just returning basic list for now, to be implemented fully if needed)
app.get('/api/projects/:id/export', async (req, res) => {
  const { data, error } = await supabase
    .from('documents')
    .select('document_type')
    .eq('project_id', req.params.id);

  if (error || !data || data.length === 0) {
    return res.status(404).json({ error: 'No documents found' });
  }

  res.json({
    message: 'Export prepared',
    files: data.map(d => ({
      name: `${d.document_type}.md`
    }))
  });
});

// Delete project
app.delete('/api/projects/:id', async (req, res) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Delete local uploaded files if they exist
  const uploadDir = path.join(__dirname, '../uploads', req.params.id);
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }

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

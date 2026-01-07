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
import { DDLAnalyzer } from './analyzers/DDLAnalyzer.js';
import { MetadataExtractor } from './extractors/MetadataExtractor.js';
import { DocumentGenerator } from './generators/DocumentGenerator.js';

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

const upload = multer({ storage });

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
app.post('/api/projects/:id/upload', upload.array('files'), async (req, res) => {
  const project = projects.get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const files = req.files as Express.Multer.File[];

  res.json({
    message: 'Files uploaded successfully',
    files: files.map(f => ({
      filename: f.filename,
      size: f.size,
      path: f.path
    }))
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

    // Analyze COBOL files
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
    // Prepare document data
    const data = {
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

    // Generate document
    const generator = new DocumentGenerator();
    const markdown = await generator.generate(documentType, data, language);

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

// Utility function
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

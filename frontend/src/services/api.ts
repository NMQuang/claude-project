import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface CobolMigrationComplexityScore {
  overall: number;
  logicComplexity: number;
  dataComplexity: number;
  cobolSpecificRisk: number;
  difficulty: 'Low' | 'Medium' | 'High' | 'Very High';
  description: string;
  details: {
    logic: string[];
    data: string[];
    risk: string[];
  };
}

export interface PostgreSQLMigrationComplexityScore {
  overall: number;
  schemaDataTypeComplexity: number;
  sqlQueryRewriteComplexity: number;
  procedureFunctionTriggerComplexity: number;
  dataVolumeMigrationComplexity: number;
  applicationORMDependencyComplexity: number;
  operationalRuntimeRiskComplexity: number;
  difficulty: 'Low' | 'Medium' | 'High' | 'Very High';
  description: string;
  details: {
    schemaDataType: string[];
    sqlQueryRewrite: string[];
    procedureFunctionTrigger: string[];
    dataVolumeMigration: string[];
    applicationORMDependency: string[];
    operationalRuntimeRisk: string[];
  };
}

export interface Project {
  id: string;
  name: string;
  migrationType: string;
  status: string;
  createdAt: string;
  sourceLanguage?: string;
  sourceDatabase?: string;
  targetLanguage?: string;
  targetDatabase?: string;
  metadata?: {
    source_analysis?: {
      total_files?: number;
      total_loc?: number;
      database?: {
        tables?: number;
        procedures?: number;
        functions?: number;
      };
    };
    complexity_summary?: string;
    migrationComplexity?: CobolMigrationComplexityScore | PostgreSQLMigrationComplexityScore;
  };
  ddlMetadata?: any;
  generatedDocuments?: string[];
}

export interface CreateProjectRequest {
  name: string;
  migrationType: string;
  sourceLanguage?: string;
  sourceDatabase?: string;
  targetLanguage?: string;
  targetDatabase?: string;
}

export interface AnalysisResult {
  message: string;
  metadata: any;
  ddlMetadata?: any;
}

export interface GenerateDocumentRequest {
  documentType: string;
}

export interface DocumentResponse {
  documentType: string;
  content: string;
  message?: string;
  path?: string;
}

// Project APIs
export const getProjects = async (): Promise<Project[]> => {
  const response = await api.get<Project[]>('/projects');
  return response.data;
};

export const getProject = async (id: string): Promise<Project> => {
  const response = await api.get<Project>(`/projects/${id}`);
  return response.data;
};

export const createProject = async (data: CreateProjectRequest): Promise<Project> => {
  const response = await api.post<Project>('/projects', data);
  return response.data;
};

export const deleteProject = async (id: string): Promise<void> => {
  await api.delete(`/projects/${id}`);
};

// File Upload
export const uploadFiles = async (projectId: string, files: FileList, isFolder: boolean = false): Promise<any> => {
  const formData = new FormData();
  Array.from(files).forEach(file => {
    formData.append('files', file);
    // When uploading a folder, preserve the relative path structure
    if (isFolder && (file as any).webkitRelativePath) {
      formData.append('filePaths', (file as any).webkitRelativePath);
    }
  });

  const response = await api.post(`/projects/${projectId}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Analysis
export const analyzeProject = async (projectId: string): Promise<AnalysisResult> => {
  const response = await api.post<AnalysisResult>(`/projects/${projectId}/analyze`);
  return response.data;
};

export const getProjectMetadata = async (projectId: string): Promise<any> => {
  const response = await api.get(`/projects/${projectId}/metadata`);
  return response.data;
};

// Document Generation
export const generateDocument = async (
  projectId: string,
  documentType: string,
  language: string = 'en'
): Promise<DocumentResponse> => {
  const response = await api.post<DocumentResponse>(
    `/projects/${projectId}/generate`,
    { documentType, language }
  );
  return response.data;
};

export const getDocument = async (
  projectId: string,
  docType: string
): Promise<DocumentResponse> => {
  const response = await api.get<DocumentResponse>(`/projects/${projectId}/documents/${docType}`);
  return response.data;
};

export const updateDocument = async (
  projectId: string,
  docType: string,
  content: string
): Promise<any> => {
  const response = await api.put(`/projects/${projectId}/documents/${docType}`, { content });
  return response.data;
};

export const exportDocuments = async (projectId: string): Promise<any> => {
  const response = await api.get(`/projects/${projectId}/export`);
  return response.data;
};

export const downloadDocument = async (projectId: string, docType: string): Promise<void> => {
  const response = await api.get(`/projects/${projectId}/documents/${docType}/download`, {
    responseType: 'blob'
  });

  // Create a blob URL and trigger download
  const blob = new Blob([response.data], { type: 'text/markdown' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${docType}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default api;

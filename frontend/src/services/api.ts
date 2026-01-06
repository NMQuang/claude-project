import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  metadata?: any;
  ddlMetadata?: any;
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
export const uploadFiles = async (projectId: string, files: FileList): Promise<any> => {
  const formData = new FormData();
  Array.from(files).forEach(file => {
    formData.append('files', file);
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
  documentType: string
): Promise<DocumentResponse> => {
  const response = await api.post<DocumentResponse>(
    `/projects/${projectId}/generate`,
    { documentType }
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

export default api;

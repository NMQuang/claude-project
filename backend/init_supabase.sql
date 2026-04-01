-- ==========================================
-- Supabase Database Initialization Script
-- ==========================================
-- Run this script in the SQL Editor on your Supabase Dashboard

-- 1. Create table `projects`
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    migration_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Created',
    source_language TEXT,
    source_database TEXT,
    target_language TEXT,
    target_database TEXT,
    metadata JSONB,
    ddl_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) but set public access for anonymous API testing
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.projects FOR DELETE USING (true);

-- 2. Create table `documents`
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, document_type) -- Ensures one version per document type per project
);

-- Enable RLS and public access
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.documents FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.documents FOR DELETE USING (true);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

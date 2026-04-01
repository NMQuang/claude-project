-- ==========================================
-- Supabase Storage Initialization Script
-- ==========================================
-- Run this script in the SQL Editor on your Supabase Dashboard

-- 1. Insert a new storage bucket named 'source_files'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('source_files', 'source_files', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Security Policies for the new bucket

-- Allow all operations for anonymous users (for development/testing purposes)
-- Note: In production, you would restrict this to authenticated users only.
CREATE POLICY "Enable read access for all users on source_files" ON storage.objects
FOR SELECT USING (bucket_id = 'source_files');

CREATE POLICY "Enable insert access for all users on source_files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'source_files');

CREATE POLICY "Enable update access for all users on source_files" ON storage.objects
FOR UPDATE USING (bucket_id = 'source_files');

CREATE POLICY "Enable delete access for all users on source_files" ON storage.objects
FOR DELETE USING (bucket_id = 'source_files');

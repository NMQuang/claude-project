import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Missing SUPABASE_URL or SUPABASE_KEY in environment variables.');
}

// Khởi tạo Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Interface thống nhất với cấu trúc bảng Projects trên Supabase
 */
export interface ProjectRow {
  id: string;
  name: string;
  migration_type: string;
  status: string;
  source_language?: string;
  source_database?: string;
  target_language?: string;
  target_database?: string;
  metadata?: any;
  ddl_metadata?: any;
  created_at: string;
  updated_at: string;
}

/**
 * Interface thống nhất với bảng Documents trên Supabase
 */
export interface DocumentRow {
  id: string;
  project_id: string;
  document_type: string;
  content: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

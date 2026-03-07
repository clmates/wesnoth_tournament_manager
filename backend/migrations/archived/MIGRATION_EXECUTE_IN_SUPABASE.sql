-- =============================================================================
-- MIGRATION: Add Audit Logging and Account Lockout Security Features
-- Date: 2025-12-17
-- Description: Creates tables for audit logs and login attempt tracking,
--              adds columns to users table for account lockout functionality
-- =============================================================================

-- Step 1: Create audit_logs table for security event tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  username VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON public.audit_logs(ip_address);

-- Step 2: Create login_attempts table for account lockout tracking
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  username VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  success BOOLEAN NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes for login_attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON public.login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON public.login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON public.login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_timestamp ON public.login_attempts(timestamp);

-- Step 3: Add columns to users table for account lockout
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_attempt TIMESTAMP;

-- =============================================================================
-- VERIFICATION: Run these queries to verify the migration was successful
-- =============================================================================

-- Check if audit_logs table exists and has correct structure
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'audit_logs' ORDER BY ordinal_position;

-- Check if login_attempts table exists and has correct structure
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'login_attempts' ORDER BY ordinal_position;

-- Check if users table has the new columns
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'users' 
-- AND column_name IN ('failed_login_attempts', 'locked_until', 'last_login_attempt')
-- ORDER BY ordinal_position;

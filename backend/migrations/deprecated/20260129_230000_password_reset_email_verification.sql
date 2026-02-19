-- 20260129_230000_password_reset_email_verification.sql
-- Migración para password reset y verificación de email (Supabase Postgres)
-- Marca todos los usuarios existentes como email verificados

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP;

-- Marcar todos los usuarios existentes como email verificados
UPDATE users SET email_verified = TRUE;

-- Crear índices para búsquedas rápidas de tokens
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);

-- NOTA: Revisar compatibilidad de tipos y sintaxis según Supabase Postgres

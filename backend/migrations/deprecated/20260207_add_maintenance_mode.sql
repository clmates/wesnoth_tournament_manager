-- Create system_settings table for storing global system configurations
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id)
);

-- Add maintenance mode setting
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('maintenance_mode', 'false', 'Global maintenance mode flag. When true, only admins can login')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

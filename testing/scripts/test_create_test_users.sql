-- Test script: create 20 test users (moved out of migrations)
-- Run this manually when you need to seed test users

-- Ensure pgcrypto is available (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert test users
INSERT INTO users (nickname, email, password_hash, language, is_active, is_blocked, is_admin, created_at, updated_at)
VALUES
('test_user_01', 'test_user_01@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_02', 'test_user_02@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_03', 'test_user_03@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_04', 'test_user_04@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_05', 'test_user_05@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_06', 'test_user_06@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_07', 'test_user_07@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_08', 'test_user_08@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_09', 'test_user_09@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_10', 'test_user_10@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_11', 'test_user_11@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_12', 'test_user_12@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_13', 'test_user_13@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_14', 'test_user_14@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_15', 'test_user_15@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_16', 'test_user_16@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_17', 'test_user_17@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_18', 'test_user_18@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_19', 'test_user_19@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('test_user_20', 'test_user_20@example.com', crypt(<password>, gen_salt('bf')), 'en', true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (nickname) DO NOTHING;

-- Password for all users: Test123!

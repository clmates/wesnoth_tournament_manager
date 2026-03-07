-- Eliminar índices duplicados en matches y tournaments
DROP INDEX IF EXISTS idx_matches_created_at_desc;
DROP INDEX IF EXISTS idx_tournaments_creator;
DROP INDEX IF EXISTS idx_tournaments_status;
-- Habilitar Row Level Security (RLS) en todas las tablas principales
ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_round_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE faction_translations ENABLE ROW LEVEL SECURITY;
-- Si se prefiere conservar los otros nombres, intercambiar los nombres en los DROP INDEX
-- Revisar que no existan dependencias antes de ejecutar este script.
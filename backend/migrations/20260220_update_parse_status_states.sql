-- Fix parse_status to use new state system
-- new => nuevo fichero, no se ha hecho el quick parse
-- pending => se hizo el quick parse y se detectó el add on y está pendiente del parse completo
-- completed => se ha completado el parse (sea tournament o no)
-- error => el parse falló o el quick parse falló

-- Map old 'success' state to 'completed'
UPDATE replays SET parse_status = 'completed' WHERE parse_status = 'success';

-- Map old 'parsed' state to 'completed'
UPDATE replays SET parse_status = 'completed' WHERE parse_status = 'parsed';

-- Map old 'parsing' state to 'error' (stuck parsing)
UPDATE replays SET parse_status = 'error' WHERE parse_status = 'parsing';

-- Map old 'failed' state to 'error'
UPDATE replays SET parse_status = 'error' WHERE parse_status = 'failed';

-- Parsed replays without errors → 'completed'
UPDATE replays SET parse_status = 'completed' WHERE parsed = 1 AND parse_status NOT IN ('completed', 'error', 'pending');

-- Unparsed without errors → 'new'
UPDATE replays SET parse_status = 'new' WHERE parsed = 0 AND parse_error_message IS NULL AND parse_status NOT IN ('pending', 'error');

-- Any with error message → 'error'
UPDATE replays SET parse_status = 'error' WHERE parse_error_message IS NOT NULL AND parse_status != 'error';

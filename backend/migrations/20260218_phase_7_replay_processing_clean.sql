-- Phase 7: Automated Replay Detection and Processing

CREATE TABLE replays (
    id CHAR(36) PRIMARY KEY,
    replay_filename VARCHAR(500) NOT NULL UNIQUE,
    replay_path VARCHAR(1000) NOT NULL,
    file_size_bytes BIGINT,
    parsed TINYINT(1) NOT NULL DEFAULT 0,
    need_integration TINYINT(1) NOT NULL DEFAULT 0,
    match_id CHAR(36),
    parse_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    parse_error_message TEXT,
    parse_stage VARCHAR(20),
    detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    file_write_closed_at DATETIME,
    file_mtime DATETIME,
    parsing_started_at DATETIME,
    parsing_completed_at DATETIME,
    wesnoth_version VARCHAR(20),
    map_name VARCHAR(255),
    era_id VARCHAR(100),
    tournament_addon_id VARCHAR(100),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_parsed (parsed),
    INDEX idx_need_integration (need_integration),
    INDEX idx_match_id (match_id),
    INDEX idx_parse_status (parse_status),
    INDEX idx_detected_at (detected_at),
    INDEX idx_tournament_addon (tournament_addon_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE replay_parsing_logs (
    id CHAR(36) PRIMARY KEY,
    replay_id CHAR(36) NOT NULL,
    stage VARCHAR(50),
    status VARCHAR(20),
    duration_ms INT,
    error_message TEXT,
    details JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_replay_id (replay_id),
    INDEX idx_stage (stage),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


ALTER TABLE matches 
ADD COLUMN auto_reported TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
ADD COLUMN replay_id CHAR(36) AFTER auto_reported,
ADD COLUMN detected_from VARCHAR(20) NOT NULL DEFAULT 'manual' AFTER replay_id;


ALTER TABLE matches 
ADD INDEX idx_auto_reported (auto_reported),
ADD INDEX idx_replay_id (replay_id),
ADD INDEX idx_detected_from (detected_from);


ALTER TABLE replays 
ADD CONSTRAINT fk_replays_match_id 
    FOREIGN KEY (match_id) 
    REFERENCES matches(id) 
    ON DELETE SET NULL;


ALTER TABLE matches 
ADD CONSTRAINT fk_matches_replay_id 
    FOREIGN KEY (replay_id) 
    REFERENCES replays(id) 
    ON DELETE SET NULL;


ALTER TABLE replay_parsing_logs 
ADD CONSTRAINT fk_parsing_logs_replay_id 
    FOREIGN KEY (replay_id) 
    REFERENCES replays(id) 
    ON DELETE CASCADE;


ALTER TABLE users_extension 
ADD INDEX idx_nickname (nickname);


INSERT INTO system_settings (setting_key, setting_value, description) VALUES 
('replay_last_integration_timestamp', NULL, 'Last successful replay integration timestamp'),
('replay_last_check_timestamp', NULL, 'Last check for new replays timestamp'),
('replay_processing_enabled', 'true', 'Enable/disable automatic replay processing'),
('replay_max_concurrent_parses', '3', 'Maximum concurrent replay parsing jobs')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

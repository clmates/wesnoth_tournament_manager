-- MariaDB structure migration script (CORRECTED)
-- Adapted from PostgreSQL full_database_export_testenvironment.txt
-- Includes all columns from the PostgreSQL schema
-- Table users renamed to users_extension with selected columns preserved

-- Drop existing tables if they exist (in dependency order)
DROP TABLE IF EXISTS tournament_unranked_maps;
DROP TABLE IF EXISTS tournament_unranked_factions;
DROP TABLE IF EXISTS tournament_round_matches;
DROP TABLE IF EXISTS tournament_matches;
DROP TABLE IF EXISTS tournament_rounds;
DROP TABLE IF EXISTS tournament_participants;
DROP TABLE IF EXISTS tournament_teams;
DROP TABLE IF EXISTS team_substitutes;
DROP TABLE IF EXISTS tournaments;
DROP TABLE IF EXISTS player_match_statistics;
DROP TABLE IF EXISTS faction_map_statistics_history;
DROP TABLE IF EXISTS faction_map_statistics;
DROP TABLE IF EXISTS player_of_month;
DROP TABLE IF EXISTS balance_events;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS password_history;
DROP TABLE IF EXISTS password_policy;
DROP TABLE IF EXISTS news;
DROP TABLE IF EXISTS faq;
DROP TABLE IF EXISTS map_translations;
DROP TABLE IF EXISTS faction_translations;
DROP TABLE IF EXISTS game_maps;
DROP TABLE IF EXISTS factions;
DROP TABLE IF EXISTS countries;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS migrations;
DROP TABLE IF EXISTS users_extension;

-- Table: users_extension
-- Users table renamed with login control columns
CREATE TABLE users_extension (
    id CHAR(36) PRIMARY KEY,
    nickname VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    language VARCHAR(2) DEFAULT 'en',
    discord_id VARCHAR(255),
    elo_rating INT DEFAULT 1400,
    level VARCHAR(50) DEFAULT 'novato',
    is_active TINYINT(1) DEFAULT 0,
    is_blocked TINYINT(1) DEFAULT 0,
    is_admin TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_rated TINYINT(1) DEFAULT 0,
    matches_played INT DEFAULT 0,
    elo_provisional TINYINT(1) DEFAULT 0,
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    trend VARCHAR(10) DEFAULT '-',
    failed_login_attempts INT DEFAULT 0,
    locked_until DATETIME NULL,
    last_login_attempt DATETIME NULL,
    password_must_change TINYINT(1) DEFAULT 0,
    country VARCHAR(2),
    avatar VARCHAR(255),
    email_verified TINYINT(1) DEFAULT 0,
    password_reset_token VARCHAR(255),
    password_reset_expires DATETIME,
    email_verification_token VARCHAR(255),
    email_verification_expires DATETIME
);

-- Table: audit_logs
-- Stores user login and admin actions for auditing
CREATE TABLE audit_logs (
    id CHAR(36) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id CHAR(36),
    username VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: balance_events
-- Records significant balance changes (nerfs, buffs, reworks)
CREATE TABLE balance_events (
    id CHAR(36) PRIMARY KEY,
    event_date DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    patch_version VARCHAR(20),
    event_type VARCHAR(50) NOT NULL,
    faction_id CHAR(36),
    map_id CHAR(36),
    description TEXT NOT NULL,
    notes TEXT,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    snapshot_before_date DATE,
    snapshot_after_date DATE,
    INDEX idx_event_type (event_type)
);

-- Table: countries
-- Stores country codes, names, and flags
CREATE TABLE countries (
    code VARCHAR(2) PRIMARY KEY,
    names_json JSON DEFAULT '{}',
    flag_emoji VARCHAR(10),
    official_name VARCHAR(255),
    region VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: faction_map_statistics
-- Cube/fact table for analytical queries on faction balance
CREATE TABLE faction_map_statistics (
    id CHAR(36) PRIMARY KEY,
    map_id CHAR(36) NOT NULL,
    faction_id CHAR(36) NOT NULL,
    opponent_faction_id CHAR(36) NOT NULL,
    total_games INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    winrate DECIMAL(5,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_faction_map_opponent (map_id, faction_id, opponent_faction_id)
);

-- Table: faction_map_statistics_history
-- Daily snapshots of faction/map balance statistics
CREATE TABLE faction_map_statistics_history (
    id CHAR(36) PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    snapshot_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    map_id CHAR(36) NOT NULL,
    faction_id CHAR(36) NOT NULL,
    opponent_faction_id CHAR(36) NOT NULL,
    total_games INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    winrate DECIMAL(5,2),
    sample_size_category VARCHAR(20),
    confidence_level DECIMAL(5,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_snapshot_date (snapshot_date),
    INDEX idx_map_faction (map_id, faction_id)
);

-- Table: faction_translations
-- Stores translations for faction names
CREATE TABLE faction_translations (
    id CHAR(36) PRIMARY KEY,
    faction_id CHAR(36) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_faction_lang (faction_id, language_code)
);

-- Table: factions
-- Stores available factions
CREATE TABLE factions (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_path VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active TINYINT(1) DEFAULT 1,
    is_ranked TINYINT(1) DEFAULT 1,
    INDEX idx_is_ranked (is_ranked)
);

-- Table: faq
-- Frequently asked questions
CREATE TABLE faq (
    id CHAR(36) PRIMARY KEY,
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    translations JSON DEFAULT '{"de": {}, "en": {}, "es": {}, "zh": {}}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    language_code VARCHAR(10) DEFAULT 'en',
    `order` INT DEFAULT 0
);

-- Table: game_maps
-- Stores available maps
CREATE TABLE game_maps (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    usage_count INT DEFAULT 1,
    is_active TINYINT(1) DEFAULT 1,
    is_ranked TINYINT(1) DEFAULT 1,
    INDEX idx_is_ranked (is_ranked)
);

-- Table: map_translations
-- Stores translations for map names
CREATE TABLE map_translations (
    id CHAR(36) PRIMARY KEY,
    map_id CHAR(36) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_map_lang (map_id, language_code)
);

-- Table: matches
-- Stores match results
CREATE TABLE matches (
    id CHAR(36) PRIMARY KEY,
    winner_id CHAR(36) NOT NULL,
    loser_id CHAR(36) NOT NULL,
    map VARCHAR(255) NOT NULL,
    winner_faction VARCHAR(255) NOT NULL,
    loser_faction VARCHAR(255) NOT NULL,
    winner_comments TEXT,
    winner_rating INT,
    loser_comments TEXT,
    loser_rating INT,
    loser_confirmed TINYINT(1) DEFAULT 0,
    replay_file_path VARCHAR(500),
    tournament_id CHAR(36),
    elo_change INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'unconfirmed',
    admin_reviewed TINYINT(1) DEFAULT 0,
    admin_reviewed_at DATETIME,
    admin_reviewed_by CHAR(36),
    winner_elo_before INT DEFAULT 1600,
    winner_elo_after INT DEFAULT 1600,
    loser_elo_before INT DEFAULT 1600,
    loser_elo_after INT DEFAULT 1600,
    winner_level_before VARCHAR(50) DEFAULT 'novato',
    winner_level_after VARCHAR(50) DEFAULT 'novato',
    loser_level_before VARCHAR(50) DEFAULT 'novato',
    loser_level_after VARCHAR(50) DEFAULT 'novato',
    replay_downloads INT DEFAULT 0,
    winner_ranking_pos INT,
    winner_ranking_change INT,
    loser_ranking_pos INT,
    loser_ranking_change INT,
    round_id CHAR(36),
    tournament_type VARCHAR(20),
    tournament_mode VARCHAR(20),
    INDEX idx_winner_id (winner_id),
    INDEX idx_tournament_id (tournament_id),
    INDEX idx_created_at (created_at)
);

-- Table: migrations
-- Tracks database schema migrations
CREATE TABLE migrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: news
-- News and announcements
CREATE TABLE news (
    id CHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    translations JSON DEFAULT '{"de": {}, "en": {}, "es": {}, "zh": {}}',
    author_id CHAR(36) NOT NULL,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    language_code VARCHAR(10) DEFAULT 'en'
);

-- Table: password_history
-- Stores previous password hashes for users
CREATE TABLE password_history (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
);

-- Table: password_policy
-- Stores password policy settings
CREATE TABLE password_policy (
    id CHAR(36) PRIMARY KEY,
    min_length INT DEFAULT 8,
    require_uppercase TINYINT(1) DEFAULT 1,
    require_lowercase TINYINT(1) DEFAULT 1,
    require_numbers TINYINT(1) DEFAULT 1,
    require_symbols TINYINT(1) DEFAULT 1,
    previous_passwords_count INT DEFAULT 5,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: player_match_statistics
-- Stores per-player match statistics
CREATE TABLE player_match_statistics (
    id CHAR(36) PRIMARY KEY,
    player_id CHAR(36) NOT NULL,
    opponent_id CHAR(36),
    map_id CHAR(36),
    faction_id CHAR(36),
    opponent_faction_id CHAR(36),
    total_games INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    winrate DECIMAL(5,2),
    avg_elo_change DECIMAL(8,2),
    last_elo_against_me DECIMAL(8,2),
    elo_gained DECIMAL(8,2) DEFAULT 0,
    elo_lost DECIMAL(8,2) DEFAULT 0,
    last_match_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_player_id (player_id),
    INDEX idx_opponent_id (opponent_id)
);

-- Table: player_of_month
-- Stores player of the month awards
CREATE TABLE player_of_month (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_id CHAR(36) NOT NULL,
    nickname VARCHAR(255) NOT NULL,
    elo_rating INT NOT NULL,
    ranking_position INT NOT NULL,
    elo_gained INT DEFAULT 0,
    positions_gained INT DEFAULT 0,
    month_year DATE NOT NULL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: system_settings
-- Stores system-wide settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by CHAR(36)
);

-- Table: team_substitutes
-- Substitute/backup players for a team
CREATE TABLE team_substitutes (
    id CHAR(36) PRIMARY KEY,
    team_id CHAR(36) NOT NULL,
    player_id CHAR(36) NOT NULL,
    substitute_order SMALLINT DEFAULT 1,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_team_id (team_id)
);

-- Table: tournament_matches
-- Individual tournament matches
CREATE TABLE tournament_matches (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    round_id CHAR(36) NOT NULL,
    player1_id CHAR(36) NOT NULL,
    player2_id CHAR(36) NOT NULL,
    winner_id CHAR(36),
    loser_id CHAR(36),
    match_id CHAR(36),
    match_status VARCHAR(20) DEFAULT 'pending',
    played_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    tournament_round_match_id CHAR(36),
    organizer_action VARCHAR(50),
    map VARCHAR(255),
    winner_faction VARCHAR(255),
    loser_faction VARCHAR(255),
    winner_comments TEXT,
    winner_rating INT,
    loser_comments TEXT,
    loser_rating INT,
    replay_file_path VARCHAR(500),
    status VARCHAR(20) DEFAULT 'unconfirmed',
    replay_downloads INT DEFAULT 0,
    INDEX idx_tournament_id (tournament_id),
    INDEX idx_round_id (round_id),
    INDEX idx_player1_id (player1_id),
    INDEX idx_player2_id (player2_id)
);

-- Table: tournament_participants
-- Tournament participants with optional team support
CREATE TABLE tournament_participants (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    current_round INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    participation_status VARCHAR(20) DEFAULT 'pending',
    tournament_ranking INT,
    tournament_wins INT DEFAULT 0,
    tournament_losses INT DEFAULT 0,
    tournament_points INT DEFAULT 0,
    omp DECIMAL(8,2) DEFAULT 0,
    gwp DECIMAL(5,2) DEFAULT 0,
    ogp DECIMAL(5,2) DEFAULT 0,
    team_id CHAR(36),
    team_position SMALLINT,
    INDEX idx_tournament_id (tournament_id),
    INDEX idx_user_id (user_id),
    INDEX idx_team_id (team_id)
);

-- Table: tournament_round_matches
-- Tournament round matches (best-of series)
CREATE TABLE tournament_round_matches (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    round_id CHAR(36) NOT NULL,
    player1_id CHAR(36) NOT NULL,
    player2_id CHAR(36) NOT NULL,
    best_of INT NOT NULL,
    wins_required INT NOT NULL,
    player1_wins INT DEFAULT 0,
    player2_wins INT DEFAULT 0,
    matches_scheduled INT DEFAULT 0,
    series_status VARCHAR(50) DEFAULT 'in_progress',
    winner_id CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tournament_id (tournament_id),
    INDEX idx_round_id (round_id)
);

-- Table: tournament_rounds
-- Stores rounds for tournaments
CREATE TABLE tournament_rounds (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    round_number INT NOT NULL,
    match_format VARCHAR(10) NOT NULL,
    round_status VARCHAR(20) DEFAULT 'pending',
    round_start_date DATETIME,
    round_end_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    round_type VARCHAR(20) DEFAULT 'general',
    round_classification VARCHAR(50) DEFAULT 'standard',
    players_remaining INT,
    players_advancing_to_next INT,
    round_phase_label VARCHAR(100),
    round_phase_description VARCHAR(255),
    INDEX idx_tournament_id (tournament_id)
);

-- Table: tournament_teams
-- Teams within a team tournament
CREATE TABLE tournament_teams (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_by CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    tournament_wins INT DEFAULT 0,
    tournament_losses INT DEFAULT 0,
    tournament_points INT DEFAULT 0,
    omp DECIMAL(10,2) DEFAULT 0,
    gwp DECIMAL(5,2) DEFAULT 0,
    ogp DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    current_round INT DEFAULT 1,
    tournament_ranking INT,
    team_elo INT DEFAULT 0,
    INDEX idx_tournament_id (tournament_id)
);

-- Table: tournament_unranked_factions
-- Stores unranked factions for tournaments
CREATE TABLE tournament_unranked_factions (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    faction_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tournament_id (tournament_id)
);

-- Table: tournament_unranked_maps
-- Stores unranked maps for tournaments
CREATE TABLE tournament_unranked_maps (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    map_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tournament_id (tournament_id)
);

-- Table: tournaments
-- Stores tournament information
CREATE TABLE tournaments (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    creator_id CHAR(36) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    approved_at DATETIME,
    started_at DATETIME,
    finished_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    general_rounds INT DEFAULT 0,
    final_rounds INT DEFAULT 0,
    registration_closed_at DATETIME,
    prepared_at DATETIME,
    tournament_type VARCHAR(50),
    max_participants INT,
    round_duration_days INT DEFAULT 7,
    auto_advance_round TINYINT(1) DEFAULT 0,
    current_round INT DEFAULT 0,
    total_rounds INT DEFAULT 0,
    general_rounds_format VARCHAR(10) DEFAULT 'bo3',
    final_rounds_format VARCHAR(10) DEFAULT 'bo5',
    discord_thread_id VARCHAR(255),
    tournament_mode VARCHAR(20) DEFAULT 'ranked',
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

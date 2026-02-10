-- MariaDB structure migration script
-- Adapted from PostgreSQL export, for Tournament Manager
-- Table users renamed to users_extension, with selected columns removed as per instructions

-- Example: Adapted users_extension table
CREATE TABLE users_extension (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    nickname VARCHAR(255),
    country VARCHAR(2),
    avatar VARCHAR(255),
    language VARCHAR(10) DEFAULT 'en',
    discord_id VARCHAR(255),
    elo_rating INT DEFAULT 1200,
    level VARCHAR(50),
    is_rated TINYINT(1) DEFAULT 0,
    elo_provisional TINYINT(1) DEFAULT 0,
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    trend VARCHAR(5) DEFAULT '-',
    matches_played INT DEFAULT 0,
    failed_login_attempts INT DEFAULT 0,
    locked_until DATETIME NULL,
    last_login_attempt DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- Table: audit_logs
-- Stores user login and admin actions for auditing
CREATE TABLE audit_logs (
    id CHAR(36) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id CHAR(36),
    username VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: balance_events
-- Stores balance change events for the game
CREATE TABLE balance_events (
    id CHAR(36) PRIMARY KEY,
    event_date DATE NOT NULL,
    patch_version VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    faction_id CHAR(36),
    map_id CHAR(36),
    description TEXT,
    notes TEXT,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    snapshot_before_date DATE,
    snapshot_after_date DATE
);

-- Table: countries
-- Stores country codes, names, and flags
CREATE TABLE countries (
    code CHAR(2) PRIMARY KEY,
    names_json JSON NOT NULL,
    flag_emoji VARCHAR(8),
    official_name VARCHAR(255),
    region VARCHAR(50),
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: faction_map_statistics
-- Stores win/loss statistics for each faction on each map
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
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: faction_map_statistics_history
-- Historical win/loss statistics for factions on maps
CREATE TABLE faction_map_statistics_history (
    id CHAR(36) PRIMARY KEY,
    map_id CHAR(36) NOT NULL,
    faction_id CHAR(36) NOT NULL,
    opponent_faction_id CHAR(36) NOT NULL,
    total_games INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    winrate DECIMAL(5,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: faction_translations
-- Stores translations for faction names
CREATE TABLE faction_translations (
    id CHAR(36) PRIMARY KEY,
    faction_id CHAR(36) NOT NULL,
    language VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL
);

-- Table: factions
-- Stores available factions
CREATE TABLE factions (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

-- Table: faq
-- Frequently asked questions
CREATE TABLE faq (
    id CHAR(36) PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    language VARCHAR(10) NOT NULL
);

-- Table: game_maps
-- Stores available maps
CREATE TABLE game_maps (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: map_translations
-- Stores translations for map names
CREATE TABLE map_translations (
    id CHAR(36) PRIMARY KEY,
    map_id CHAR(36) NOT NULL,
    language VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL
);

-- Table: matches
-- Stores match results
CREATE TABLE matches (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36),
    round INT,
    player1_id CHAR(36),
    player2_id CHAR(36),
    winner_id CHAR(36),
    status VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: migrations
-- Tracks database schema migrations
CREATE TABLE migrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    run_on DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: news
-- News and announcements
CREATE TABLE news (
    id CHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: password_history
-- Stores previous password hashes for users
CREATE TABLE password_history (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: password_policy
-- Stores password policy settings
CREATE TABLE password_policy (
    id CHAR(36) PRIMARY KEY,
    min_length INT DEFAULT 8,
    require_uppercase TINYINT(1) DEFAULT 1,
    require_number TINYINT(1) DEFAULT 1,
    require_special TINYINT(1) DEFAULT 1
);

-- Table: player_match_statistics
-- Stores per-player match statistics
CREATE TABLE player_match_statistics (
    id CHAR(36) PRIMARY KEY,
    player_id CHAR(36) NOT NULL,
    match_id CHAR(36) NOT NULL,
    result VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: player_of_month
-- Stores player of the month awards
CREATE TABLE player_of_month (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_id CHAR(36) NOT NULL,
    month YEAR NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: system_settings
-- Stores system-wide settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(255) NOT NULL,
    setting_value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: team_substitutes
-- Stores substitute players for teams
CREATE TABLE team_substitutes (
    id CHAR(36) PRIMARY KEY,
    team_id CHAR(36) NOT NULL,
    substitute_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: tournament_matches
-- Stores matches for tournaments
CREATE TABLE tournament_matches (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    round INT NOT NULL,
    match_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: tournament_participants
-- Stores participants in tournaments
CREATE TABLE tournament_participants (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: tournament_round_matches
-- Stores matches for each round in tournaments
CREATE TABLE tournament_round_matches (
    id CHAR(36) PRIMARY KEY,
    round_id CHAR(36) NOT NULL,
    match_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: tournament_rounds
-- Stores rounds for tournaments
CREATE TABLE tournament_rounds (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    round_number INT NOT NULL,
    start_date DATE,
    end_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: tournament_teams
-- Stores teams in tournaments
CREATE TABLE tournament_teams (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: tournament_unranked_factions
-- Stores unranked factions for tournaments
CREATE TABLE tournament_unranked_factions (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    faction_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: tournament_unranked_maps
-- Stores unranked maps for tournaments
CREATE TABLE tournament_unranked_maps (
    id CHAR(36) PRIMARY KEY,
    tournament_id CHAR(36) NOT NULL,
    map_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    tournament_mode VARCHAR(20) DEFAULT 'ranked'
);

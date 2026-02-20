-- Fix replay_participants table structure
-- Changed player_id from INT to CHAR(36) to properly reference users_extension.id
-- Added proper foreign key constraint

DROP TABLE IF EXISTS replay_participants;

CREATE TABLE replay_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    replay_id VARCHAR(36) NOT NULL,
    player_id CHAR(36),
    player_name VARCHAR(255),
    side INT,
    faction_name VARCHAR(255),
    result_side INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (replay_id) REFERENCES replays(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users_extension(id) ON DELETE SET NULL,
    INDEX idx_replay (replay_id),
    INDEX idx_player (player_id)
);

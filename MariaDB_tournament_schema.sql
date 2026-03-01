/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.8.3-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: 192.168.1.3    Database: tournament
-- ------------------------------------------------------
-- Server version	10.11.14-MariaDB-0+deb12u2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` char(36) NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `user_id` char(36) DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_user_id` (`user_id`),
  KEY `idx_audit_logs_event_type` (`event_type`),
  KEY `idx_audit_logs_created_at` (`created_at`),
  KEY `idx_audit_logs_ip_address` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `balance_events`
--

DROP TABLE IF EXISTS `balance_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `balance_events` (
  `id` char(36) NOT NULL,
  `event_date` datetime NOT NULL DEFAULT current_timestamp(),
  `patch_version` varchar(20) DEFAULT NULL,
  `event_type` varchar(50) NOT NULL,
  `faction_id` char(36) DEFAULT NULL,
  `map_id` char(36) DEFAULT NULL,
  `description` text NOT NULL,
  `notes` text DEFAULT NULL,
  `created_by` char(36) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `snapshot_before_date` date DEFAULT NULL,
  `snapshot_after_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_event_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `countries`
--

DROP TABLE IF EXISTS `countries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `countries` (
  `code` varchar(2) NOT NULL,
  `names_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '{}' CHECK (json_valid(`names_json`)),
  `flag_emoji` varchar(10) DEFAULT NULL,
  `official_name` varchar(255) DEFAULT NULL,
  `region` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `faction_map_statistics`
--

DROP TABLE IF EXISTS `faction_map_statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `faction_map_statistics` (
  `id` char(36) NOT NULL,
  `map_id` char(36) NOT NULL,
  `faction_id` char(36) NOT NULL,
  `opponent_faction_id` char(36) NOT NULL,
  `total_games` int(11) DEFAULT 0,
  `wins` int(11) DEFAULT 0,
  `losses` int(11) DEFAULT 0,
  `winrate` decimal(5,2) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `last_updated` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `faction_side` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0=unknown, 1=played as side 1, 2=played as side 2',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_faction_map_opponent_side` (`map_id`,`faction_id`,`opponent_faction_id`,`faction_side`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `faction_map_statistics_history`
--

DROP TABLE IF EXISTS `faction_map_statistics_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `faction_map_statistics_history` (
  `id` char(36) NOT NULL,
  `snapshot_date` date NOT NULL,
  `snapshot_timestamp` datetime NOT NULL DEFAULT current_timestamp(),
  `map_id` char(36) NOT NULL,
  `faction_id` char(36) NOT NULL,
  `opponent_faction_id` char(36) NOT NULL,
  `total_games` int(11) DEFAULT 0,
  `wins` int(11) DEFAULT 0,
  `losses` int(11) DEFAULT 0,
  `winrate` decimal(5,2) DEFAULT NULL,
  `sample_size_category` varchar(20) DEFAULT NULL,
  `confidence_level` decimal(5,2) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_snapshot_date` (`snapshot_date`),
  KEY `idx_map_faction` (`map_id`,`faction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `faction_translations`
--

DROP TABLE IF EXISTS `faction_translations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `faction_translations` (
  `id` char(36) NOT NULL,
  `faction_id` char(36) NOT NULL,
  `language_code` varchar(10) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_faction_lang` (`faction_id`,`language_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `factions`
--

DROP TABLE IF EXISTS `factions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `factions` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `icon_path` varchar(500) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `is_active` tinyint(1) DEFAULT 1,
  `is_ranked` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_is_ranked` (`is_ranked`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `faq`
--

DROP TABLE IF EXISTS `faq`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `faq` (
  `id` char(36) NOT NULL,
  `question` varchar(500) NOT NULL,
  `answer` text NOT NULL,
  `translations` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '{"de": {}, "en": {}, "es": {}, "zh": {}}' CHECK (json_valid(`translations`)),
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `language_code` varchar(10) DEFAULT 'en',
  `order` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `game_maps`
--

DROP TABLE IF EXISTS `game_maps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `game_maps` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `usage_count` int(11) DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `is_ranked` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_is_ranked` (`is_ranked`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `map_translations`
--

DROP TABLE IF EXISTS `map_translations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `map_translations` (
  `id` char(36) NOT NULL,
  `map_id` char(36) NOT NULL,
  `language_code` varchar(10) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_map_lang` (`map_id`,`language_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matches`
--

DROP TABLE IF EXISTS `matches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `matches` (
  `id` char(36) NOT NULL,
  `winner_id` char(36) NOT NULL,
  `loser_id` char(36) NOT NULL,
  `map` varchar(255) NOT NULL,
  `winner_faction` varchar(255) NOT NULL,
  `loser_faction` varchar(255) NOT NULL,
  `winner_comments` text DEFAULT NULL,
  `winner_rating` int(11) DEFAULT NULL,
  `loser_comments` text DEFAULT NULL,
  `loser_rating` int(11) DEFAULT NULL,
  `loser_confirmed` tinyint(1) DEFAULT 0,
  `replay_file_path` varchar(1000) DEFAULT NULL,
  `tournament_id` char(36) DEFAULT NULL,
  `elo_change` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` varchar(50) DEFAULT 'unconfirmed',
  `auto_reported` tinyint(1) NOT NULL DEFAULT 0,
  `replay_id` char(36) DEFAULT NULL,
  `admin_reviewed` tinyint(1) DEFAULT 0,
  `admin_reviewed_at` datetime DEFAULT NULL,
  `admin_reviewed_by` char(36) DEFAULT NULL,
  `winner_elo_before` int(11) DEFAULT 1600,
  `winner_elo_after` int(11) DEFAULT 1600,
  `loser_elo_before` int(11) DEFAULT 1600,
  `loser_elo_after` int(11) DEFAULT 1600,
  `winner_level_before` varchar(50) DEFAULT 'novato',
  `winner_level_after` varchar(50) DEFAULT 'novato',
  `loser_level_before` varchar(50) DEFAULT 'novato',
  `loser_level_after` varchar(50) DEFAULT 'novato',
  `replay_downloads` int(11) DEFAULT 0,
  `winner_ranking_pos` int(11) DEFAULT NULL,
  `winner_ranking_change` int(11) DEFAULT NULL,
  `loser_ranking_pos` int(11) DEFAULT NULL,
  `loser_ranking_change` int(11) DEFAULT NULL,
  `round_id` char(36) DEFAULT NULL,
  `tournament_type` varchar(20) DEFAULT NULL,
  `tournament_mode` varchar(20) DEFAULT NULL,
  `winner_side` tinyint(1) DEFAULT NULL COMMENT '1 or 2 — which side the winner played',
  `game_id` int(11) DEFAULT NULL COMMENT 'wesnothd game_id from forum',
  `wesnoth_version` varchar(20) DEFAULT NULL COMMENT 'e.g. 1.18.0',
  `instance_uuid` char(36) DEFAULT NULL COMMENT 'wesnothd instance UUID from forum',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_replay_game` (`instance_uuid`,`game_id`),
  KEY `idx_winner_id` (`winner_id`),
  KEY `idx_tournament_id` (`tournament_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_auto_reported` (`auto_reported`),
  KEY `idx_replay_id` (`replay_id`),
  CONSTRAINT `fk_matches_replay` FOREIGN KEY (`replay_id`) REFERENCES `replays` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_matches_replay_id` FOREIGN KEY (`replay_id`) REFERENCES `replays` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `executed_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=84 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `news`
--

DROP TABLE IF EXISTS `news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `news` (
  `id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `translations` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '{"de": {}, "en": {}, "es": {}, "zh": {}}' CHECK (json_valid(`translations`)),
  `author_id` char(36) NOT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `language_code` varchar(10) DEFAULT 'en',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `password_history`
--

DROP TABLE IF EXISTS `password_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_history` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `password_policy`
--

DROP TABLE IF EXISTS `password_policy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_policy` (
  `id` char(36) NOT NULL,
  `min_length` int(11) DEFAULT 8,
  `require_uppercase` tinyint(1) DEFAULT 1,
  `require_lowercase` tinyint(1) DEFAULT 1,
  `require_numbers` tinyint(1) DEFAULT 1,
  `require_symbols` tinyint(1) DEFAULT 1,
  `previous_passwords_count` int(11) DEFAULT 5,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `player_match_statistics`
--

DROP TABLE IF EXISTS `player_match_statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `player_match_statistics` (
  `id` char(36) NOT NULL,
  `player_id` char(36) NOT NULL,
  `opponent_id` char(36) DEFAULT NULL,
  `map_id` char(36) DEFAULT NULL,
  `faction_id` char(36) DEFAULT NULL,
  `opponent_faction_id` char(36) DEFAULT NULL,
  `total_games` int(11) DEFAULT 0,
  `wins` int(11) DEFAULT 0,
  `losses` int(11) DEFAULT 0,
  `winrate` decimal(5,2) DEFAULT NULL,
  `avg_elo_change` decimal(8,2) DEFAULT NULL,
  `last_elo_against_me` decimal(8,2) DEFAULT NULL,
  `elo_gained` decimal(8,2) DEFAULT 0.00,
  `elo_lost` decimal(8,2) DEFAULT 0.00,
  `last_match_date` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `last_updated` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_player_id` (`player_id`),
  KEY `idx_opponent_id` (`opponent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `player_of_month`
--

DROP TABLE IF EXISTS `player_of_month`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `player_of_month` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `player_id` char(36) NOT NULL,
  `nickname` varchar(255) NOT NULL,
  `elo_rating` int(11) NOT NULL,
  `ranking_position` int(11) NOT NULL,
  `elo_gained` int(11) DEFAULT 0,
  `positions_gained` int(11) DEFAULT 0,
  `month_year` date NOT NULL,
  `calculated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `replay_parsing_logs`
--

DROP TABLE IF EXISTS `replay_parsing_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `replay_parsing_logs` (
  `id` char(36) NOT NULL,
  `replay_id` char(36) NOT NULL,
  `stage` varchar(50) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `duration_ms` int(11) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_replay_id` (`replay_id`),
  KEY `idx_stage` (`stage`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_parsing_logs_replay_id` FOREIGN KEY (`replay_id`) REFERENCES `replays` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `replay_participants`
--

DROP TABLE IF EXISTS `replay_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `replay_participants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `replay_id` varchar(36) NOT NULL,
  `player_id` char(36) DEFAULT NULL,
  `player_name` varchar(255) DEFAULT NULL,
  `side` int(11) DEFAULT NULL,
  `faction_name` varchar(255) DEFAULT NULL,
  `result_side` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_replay` (`replay_id`),
  KEY `idx_player` (`player_id`),
  CONSTRAINT `replay_participants_ibfk_1` FOREIGN KEY (`replay_id`) REFERENCES `replays` (`id`) ON DELETE CASCADE,
  CONSTRAINT `replay_participants_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `users_extension` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=187 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `replays`
--

DROP TABLE IF EXISTS `replays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `replays` (
  `id` char(36) NOT NULL,
  `replay_filename` varchar(500) NOT NULL,
  `replay_path` varchar(1000) NOT NULL,
  `file_size_bytes` bigint(20) DEFAULT NULL,
  `parsed` tinyint(1) NOT NULL DEFAULT 0,
  `need_integration` tinyint(1) NOT NULL DEFAULT 0,
  `integration_confidence` tinyint(1) DEFAULT 0,
  `match_id` char(36) DEFAULT NULL,
  `tournament_round_match_id` char(36) DEFAULT NULL,
  `parse_status` varchar(50) NOT NULL DEFAULT 'pending',
  `parse_error_message` text DEFAULT NULL,
  `parse_stage` varchar(20) DEFAULT NULL,
  `parse_summary` text DEFAULT NULL,
  `detected_at` datetime NOT NULL DEFAULT current_timestamp(),
  `file_write_closed_at` datetime DEFAULT NULL,
  `file_mtime` datetime DEFAULT NULL,
  `parsing_started_at` datetime DEFAULT NULL,
  `parsing_completed_at` datetime DEFAULT NULL,
  `wesnoth_version` varchar(20) DEFAULT NULL,
  `map_name` varchar(255) DEFAULT NULL,
  `era_id` varchar(100) DEFAULT NULL,
  `tournament_addon_id` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `game_id` int(10) unsigned DEFAULT NULL,
  `start_time` timestamp NULL DEFAULT NULL,
  `end_time` timestamp NULL DEFAULT NULL,
  `is_reload` tinyint(1) DEFAULT 0,
  `detected_from` varchar(50) DEFAULT 'manual',
  `instance_uuid` char(36) DEFAULT NULL,
  `game_name` varchar(255) DEFAULT NULL,
  `oos` tinyint(1) DEFAULT 0,
  `replay_url` varchar(1000) DEFAULT NULL,
  `last_checked_at` datetime DEFAULT NULL,
  `discard_vote_1` char(36) DEFAULT NULL COMMENT 'First player user_id who voted to discard this replay',
  `discard_vote_2` char(36) DEFAULT NULL COMMENT 'Second player user_id who voted to discard this replay',
  `cancel_requested_by` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `replay_filename` (`replay_filename`),
  UNIQUE KEY `uq_instance_game` (`instance_uuid`,`game_id`),
  KEY `idx_parsed` (`parsed`),
  KEY `idx_need_integration` (`need_integration`),
  KEY `idx_match_id` (`match_id`),
  KEY `idx_parse_status` (`parse_status`),
  KEY `idx_detected_at` (`detected_at`),
  KEY `idx_tournament_addon` (`tournament_addon_id`),
  KEY `idx_parsed_status` (`parsed`,`parse_status`),
  KEY `idx_parse_summary` (`parse_summary`(100)),
  KEY `idx_match_link` (`match_id`),
  KEY `idx_last_checked` (`last_checked_at`),
  KEY `idx_end_time` (`end_time`),
  KEY `idx_detected_from` (`detected_from`),
  KEY `idx_cancel_requested_by` (`cancel_requested_by`),
  KEY `idx_replay_trm_id` (`tournament_round_match_id`),
  CONSTRAINT `fk_replays_match_id` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `team_substitutes`
--

DROP TABLE IF EXISTS `team_substitutes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_substitutes` (
  `id` char(36) NOT NULL,
  `team_id` char(36) NOT NULL,
  `player_id` char(36) NOT NULL,
  `substitute_order` smallint(6) DEFAULT 1,
  `added_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_team_id` (`team_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tournament_matches`
--

DROP TABLE IF EXISTS `tournament_matches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_matches` (
  `id` char(36) NOT NULL,
  `tournament_id` char(36) NOT NULL,
  `round_id` char(36) NOT NULL,
  `player1_id` char(36) NOT NULL,
  `player2_id` char(36) NOT NULL,
  `winner_id` char(36) DEFAULT NULL,
  `loser_id` char(36) DEFAULT NULL,
  `match_id` char(36) DEFAULT NULL,
  `match_status` varchar(20) DEFAULT 'pending',
  `played_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `tournament_round_match_id` char(36) DEFAULT NULL,
  `organizer_action` varchar(50) DEFAULT NULL,
  `map` varchar(255) DEFAULT NULL,
  `winner_faction` varchar(255) DEFAULT NULL,
  `loser_faction` varchar(255) DEFAULT NULL,
  `winner_comments` text DEFAULT NULL,
  `winner_rating` int(11) DEFAULT NULL,
  `loser_comments` text DEFAULT NULL,
  `loser_rating` int(11) DEFAULT NULL,
  `replay_file_path` varchar(500) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'unconfirmed',
  `replay_downloads` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_tournament_id` (`tournament_id`),
  KEY `idx_round_id` (`round_id`),
  KEY `idx_player1_id` (`player1_id`),
  KEY `idx_player2_id` (`player2_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tournament_participants`
--

DROP TABLE IF EXISTS `tournament_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_participants` (
  `id` char(36) NOT NULL,
  `tournament_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `current_round` int(11) DEFAULT 1,
  `status` varchar(20) DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `participation_status` varchar(20) DEFAULT 'pending',
  `tournament_ranking` int(11) DEFAULT NULL,
  `tournament_wins` int(11) DEFAULT 0,
  `tournament_losses` int(11) DEFAULT 0,
  `tournament_points` int(11) DEFAULT 0,
  `omp` decimal(8,2) DEFAULT 0.00,
  `gwp` decimal(5,2) DEFAULT 0.00,
  `ogp` decimal(5,2) DEFAULT 0.00,
  `team_id` char(36) DEFAULT NULL,
  `team_position` smallint(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tournament_id` (`tournament_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_team_id` (`team_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tournament_round_matches`
--

DROP TABLE IF EXISTS `tournament_round_matches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_round_matches` (
  `id` char(36) NOT NULL,
  `tournament_id` char(36) NOT NULL,
  `round_id` char(36) NOT NULL,
  `player1_id` char(36) NOT NULL,
  `player2_id` char(36) NOT NULL,
  `best_of` int(11) NOT NULL,
  `wins_required` int(11) NOT NULL,
  `player1_wins` int(11) DEFAULT 0,
  `player2_wins` int(11) DEFAULT 0,
  `matches_scheduled` int(11) DEFAULT 0,
  `series_status` varchar(50) DEFAULT 'in_progress',
  `winner_id` char(36) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tournament_id` (`tournament_id`),
  KEY `idx_round_id` (`round_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tournament_rounds`
--

DROP TABLE IF EXISTS `tournament_rounds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_rounds` (
  `id` char(36) NOT NULL,
  `tournament_id` char(36) NOT NULL,
  `round_number` int(11) NOT NULL,
  `match_format` varchar(10) NOT NULL,
  `round_status` varchar(20) DEFAULT 'pending',
  `round_start_date` datetime DEFAULT NULL,
  `round_end_date` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `round_type` varchar(20) DEFAULT 'general',
  `round_classification` varchar(50) DEFAULT 'standard',
  `players_remaining` int(11) DEFAULT NULL,
  `players_advancing_to_next` int(11) DEFAULT NULL,
  `round_phase_label` varchar(100) DEFAULT NULL,
  `round_phase_description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tournament_id` (`tournament_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tournament_teams`
--

DROP TABLE IF EXISTS `tournament_teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_teams` (
  `id` char(36) NOT NULL,
  `tournament_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_by` char(36) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `tournament_wins` int(11) DEFAULT 0,
  `tournament_losses` int(11) DEFAULT 0,
  `tournament_points` int(11) DEFAULT 0,
  `omp` decimal(10,2) DEFAULT 0.00,
  `gwp` decimal(5,2) DEFAULT 0.00,
  `ogp` decimal(5,2) DEFAULT 0.00,
  `status` varchar(20) DEFAULT 'active',
  `current_round` int(11) DEFAULT 1,
  `tournament_ranking` int(11) DEFAULT NULL,
  `team_elo` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_tournament_id` (`tournament_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tournament_unranked_factions`
--

DROP TABLE IF EXISTS `tournament_unranked_factions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_unranked_factions` (
  `id` char(36) NOT NULL,
  `tournament_id` char(36) NOT NULL,
  `faction_id` char(36) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tournament_id` (`tournament_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tournament_unranked_maps`
--

DROP TABLE IF EXISTS `tournament_unranked_maps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_unranked_maps` (
  `id` char(36) NOT NULL,
  `tournament_id` char(36) NOT NULL,
  `map_id` char(36) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tournament_id` (`tournament_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tournaments`
--

DROP TABLE IF EXISTS `tournaments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournaments` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `creator_id` char(36) NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `approved_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `general_rounds` int(11) DEFAULT 0,
  `final_rounds` int(11) DEFAULT 0,
  `registration_closed_at` datetime DEFAULT NULL,
  `prepared_at` datetime DEFAULT NULL,
  `tournament_type` varchar(50) DEFAULT NULL,
  `max_participants` int(11) DEFAULT NULL,
  `round_duration_days` int(11) DEFAULT 7,
  `auto_advance_round` tinyint(1) DEFAULT 0,
  `current_round` int(11) DEFAULT 0,
  `total_rounds` int(11) DEFAULT 0,
  `general_rounds_format` varchar(10) DEFAULT 'bo3',
  `final_rounds_format` varchar(10) DEFAULT 'bo5',
  `discord_thread_id` varchar(255) DEFAULT NULL,
  `tournament_mode` varchar(20) DEFAULT 'ranked',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_extension`
--

DROP TABLE IF EXISTS `users_extension`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_extension` (
  `id` char(36) NOT NULL,
  `nickname` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `language` varchar(2) DEFAULT 'en',
  `discord_id` varchar(255) DEFAULT NULL,
  `elo_rating` int(11) DEFAULT 1400,
  `level` varchar(50) DEFAULT 'novato',
  `is_active` tinyint(1) DEFAULT 0,
  `is_blocked` tinyint(1) DEFAULT 0,
  `is_admin` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_rated` tinyint(1) DEFAULT 0,
  `matches_played` int(11) DEFAULT 0,
  `elo_provisional` tinyint(1) DEFAULT 0,
  `total_wins` int(11) DEFAULT 0,
  `total_losses` int(11) DEFAULT 0,
  `trend` varchar(10) DEFAULT '-',
  `failed_login_attempts` int(11) DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `last_login_attempt` datetime DEFAULT NULL,
  `password_must_change` tinyint(1) DEFAULT 0,
  `country` varchar(2) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `email_verified` tinyint(1) DEFAULT 0,
  `password_reset_token` varchar(255) DEFAULT NULL,
  `password_reset_expires` datetime DEFAULT NULL,
  `email_verification_token` varchar(255) DEFAULT NULL,
  `email_verification_expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_nickname` (`nickname`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-03-01 11:07:54

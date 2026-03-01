/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.8.3-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: 192.168.1.3    Database: forum
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
-- Table structure for table `phpbb3_users`
--

DROP TABLE IF EXISTS `phpbb3_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `phpbb3_users` (
  `user_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_type` tinyint(2) NOT NULL DEFAULT 0,
  `group_id` mediumint(8) unsigned NOT NULL DEFAULT 3,
  `user_permissions` mediumtext NOT NULL,
  `user_perm_from` mediumint(8) unsigned NOT NULL DEFAULT 0,
  `user_ip` varchar(40) NOT NULL DEFAULT '',
  `user_regdate` int(11) unsigned NOT NULL DEFAULT 0,
  `username` varchar(255) NOT NULL DEFAULT '',
  `username_clean` varchar(255) NOT NULL DEFAULT '',
  `user_password` varchar(255) NOT NULL DEFAULT '',
  `user_passchg` int(11) unsigned NOT NULL DEFAULT 0,
  `user_email` varchar(100) NOT NULL DEFAULT '',
  `user_birthday` varchar(10) NOT NULL DEFAULT '',
  `user_lastvisit` int(11) unsigned NOT NULL DEFAULT 0,
  `user_lastmark` int(11) unsigned NOT NULL DEFAULT 0,
  `user_lastpost_time` int(11) unsigned NOT NULL DEFAULT 0,
  `user_lastpage` varchar(200) NOT NULL DEFAULT '',
  `user_last_confirm_key` varchar(10) NOT NULL DEFAULT '',
  `user_last_search` int(11) unsigned NOT NULL DEFAULT 0,
  `user_warnings` tinyint(4) NOT NULL DEFAULT 0,
  `user_last_warning` int(11) unsigned NOT NULL DEFAULT 0,
  `user_login_attempts` tinyint(4) NOT NULL DEFAULT 0,
  `user_inactive_reason` tinyint(2) NOT NULL DEFAULT 0,
  `user_inactive_time` int(11) unsigned NOT NULL DEFAULT 0,
  `user_posts` mediumint(8) unsigned NOT NULL DEFAULT 0,
  `user_lang` varchar(30) NOT NULL DEFAULT '',
  `user_timezone` varchar(100) NOT NULL DEFAULT '',
  `user_dateformat` varchar(64) NOT NULL DEFAULT 'd M Y H:i',
  `user_style` mediumint(8) unsigned NOT NULL DEFAULT 0,
  `user_rank` mediumint(8) unsigned NOT NULL DEFAULT 0,
  `user_colour` varchar(6) NOT NULL DEFAULT '',
  `user_new_privmsg` int(4) NOT NULL DEFAULT 0,
  `user_unread_privmsg` int(4) NOT NULL DEFAULT 0,
  `user_last_privmsg` int(11) unsigned NOT NULL DEFAULT 0,
  `user_message_rules` tinyint(1) unsigned NOT NULL DEFAULT 0,
  `user_full_folder` int(11) NOT NULL DEFAULT -3,
  `user_emailtime` int(11) unsigned NOT NULL DEFAULT 0,
  `user_topic_show_days` smallint(4) unsigned NOT NULL DEFAULT 0,
  `user_topic_sortby_type` varchar(1) NOT NULL DEFAULT 't',
  `user_topic_sortby_dir` varchar(1) NOT NULL DEFAULT 'd',
  `user_post_show_days` smallint(4) unsigned NOT NULL DEFAULT 0,
  `user_post_sortby_type` varchar(1) NOT NULL DEFAULT 't',
  `user_post_sortby_dir` varchar(1) NOT NULL DEFAULT 'a',
  `user_notify` tinyint(1) unsigned NOT NULL DEFAULT 0,
  `user_notify_pm` tinyint(1) unsigned NOT NULL DEFAULT 1,
  `user_notify_type` tinyint(4) NOT NULL DEFAULT 0,
  `user_allow_pm` tinyint(1) unsigned NOT NULL DEFAULT 1,
  `user_allow_viewonline` tinyint(1) unsigned NOT NULL DEFAULT 1,
  `user_allow_viewemail` tinyint(1) unsigned NOT NULL DEFAULT 1,
  `user_allow_massemail` tinyint(1) unsigned NOT NULL DEFAULT 1,
  `user_options` int(11) unsigned NOT NULL DEFAULT 230271,
  `user_avatar` varchar(255) NOT NULL DEFAULT '',
  `user_avatar_type` varchar(255) NOT NULL DEFAULT '',
  `user_avatar_width` smallint(4) unsigned NOT NULL DEFAULT 0,
  `user_avatar_height` smallint(4) unsigned NOT NULL DEFAULT 0,
  `user_sig` mediumtext NOT NULL,
  `user_sig_bbcode_uid` varchar(8) NOT NULL DEFAULT '',
  `user_sig_bbcode_bitfield` varchar(255) NOT NULL DEFAULT '',
  `user_jabber` varchar(255) NOT NULL DEFAULT '',
  `user_actkey` varchar(32) NOT NULL DEFAULT '',
  `reset_token` varchar(64) NOT NULL DEFAULT '',
  `reset_token_expiration` int(11) unsigned NOT NULL DEFAULT 0,
  `user_newpasswd` varchar(255) NOT NULL DEFAULT '',
  `user_form_salt` varchar(32) NOT NULL DEFAULT '',
  `user_new` tinyint(1) unsigned NOT NULL DEFAULT 1,
  `user_reminded` tinyint(4) NOT NULL DEFAULT 0,
  `user_reminded_time` int(11) unsigned NOT NULL DEFAULT 0,
  `board_announcements_status` tinyint(1) unsigned NOT NULL DEFAULT 1,
  `user_topic_preview` tinyint(1) unsigned NOT NULL DEFAULT 1,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username_clean` (`username_clean`),
  KEY `user_birthday` (`user_birthday`),
  KEY `user_type` (`user_type`),
  KEY `user_email` (`user_email`)
) ENGINE=MyISAM AUTO_INCREMENT=293795 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wesnothd_game_content_info`
--

DROP TABLE IF EXISTS `wesnothd_game_content_info`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `wesnothd_game_content_info` (
  `INSTANCE_UUID` char(36) NOT NULL,
  `GAME_ID` int(10) unsigned NOT NULL,
  `TYPE` varchar(100) NOT NULL,
  `ID` varchar(100) NOT NULL,
  `ADDON_ID` varchar(100) NOT NULL,
  `ADDON_VERSION` varchar(255) NOT NULL,
  `NAME` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`INSTANCE_UUID`,`GAME_ID`,`TYPE`,`ID`,`ADDON_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wesnothd_game_player_info`
--

DROP TABLE IF EXISTS `wesnothd_game_player_info`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `wesnothd_game_player_info` (
  `INSTANCE_UUID` char(36) NOT NULL,
  `GAME_ID` int(10) unsigned NOT NULL,
  `USER_ID` int(11) NOT NULL,
  `SIDE_NUMBER` smallint(5) unsigned NOT NULL,
  `IS_HOST` bit(1) NOT NULL,
  `FACTION` varchar(255) NOT NULL,
  `CLIENT_VERSION` varchar(255) NOT NULL DEFAULT '',
  `CLIENT_SOURCE` varchar(255) NOT NULL DEFAULT '',
  `USER_NAME` varchar(255) NOT NULL DEFAULT '',
  `LEADERS` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`INSTANCE_UUID`,`GAME_ID`,`SIDE_NUMBER`),
  KEY `USER_ID_IDX` (`USER_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wesnothd_game_info`
--

DROP TABLE IF EXISTS `wesnothd_game_info`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `wesnothd_game_info` (
  `INSTANCE_UUID` char(36) NOT NULL,
  `GAME_ID` int(10) unsigned NOT NULL,
  `INSTANCE_VERSION` varchar(255) NOT NULL,
  `GAME_NAME` varchar(255) NOT NULL,
  `START_TIME` timestamp NOT NULL DEFAULT current_timestamp(),
  `END_TIME` timestamp NULL DEFAULT NULL,
  `REPLAY_NAME` varchar(255) DEFAULT NULL,
  `OOS` bit(1) NOT NULL DEFAULT b'0',
  `RELOAD` bit(1) NOT NULL,
  `OBSERVERS` bit(1) NOT NULL,
  `PASSWORD` bit(1) NOT NULL,
  `PUBLIC` bit(1) NOT NULL,
  PRIMARY KEY (`INSTANCE_UUID`,`GAME_ID`),
  KEY `START_TIME_IDX` (`START_TIME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wesnothd_extra_data`
--

DROP TABLE IF EXISTS `wesnothd_extra_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `wesnothd_extra_data` (
  `username` varchar(255) NOT NULL,
  `user_lastvisit` int(11) unsigned DEFAULT 0,
  `user_is_moderator` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`username`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-03-01 11:07:21

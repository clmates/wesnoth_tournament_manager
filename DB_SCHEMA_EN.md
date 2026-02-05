# Database Schema (Live)

**Last updated:** 2025-12-24  
*Update this date each time changes are incorporated into the file.*

Extracted: 2025-12-09T19:10:34.431Z

## Complete database schema (updated 2025-12-24)

### Table Columns

| Table                    | Column                    | Data Type                    | Null | Default                                       |
|--------------------------|---------------------------|------------------------------|------|-----------------------------------------------|
| audit_logs               | id                        | uuid                         | NO   | gen_random_uuid()                             |
| audit_logs               | event_type                | character varying            | NO   | null                                          |
| audit_logs               | user_id                   | uuid                         | YES  | null                                          |
| audit_logs               | username                  | character varying            | YES  | null                                          |
| audit_logs               | ip_address                | character varying            | YES  | null                                          |
| audit_logs               | user_agent                | text                         | YES  | null                                          |
| audit_logs               | details                   | jsonb                        | YES  | null                                          |
| audit_logs               | created_at                | timestamp without time zone  | YES  | now()                                         |
| chat_messages            | id                        | uuid                         | NO   | gen_random_uuid()                             |
| chat_messages            | sender_id                 | uuid                         | NO   | null                                          |
| chat_messages            | receiver_id               | uuid                         | NO   | null                                          |
| chat_messages            | message                   | text                         | NO   | null                                          |
| chat_messages            | is_read                   | boolean                      | YES  | false                                         |
| chat_messages            | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| faction_translations     | id                        | uuid                         | NO   | gen_random_uuid()                             |
| faction_translations     | faction_id                | uuid                         | NO   | null                                          |
| faction_translations     | language_code             | character varying            | NO   | null                                          |
| faction_translations     | name                      | character varying            | NO   | null                                          |
| faction_translations     | description               | text                         | YES  | null                                          |
| faction_translations     | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| faction_translations     | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| factions                 | id                        | uuid                         | NO   | gen_random_uuid()                             |
| factions                 | name                      | character varying            | NO   | null                                          |
| factions                 | description               | text                         | YES  | null                                          |
| factions                 | icon_path                 | character varying            | YES  | null                                          |
| factions                 | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| factions                 | is_active                 | boolean                      | YES  | true                                          |
| faq                      | id                        | uuid                         | NO   | gen_random_uuid()                             |
| faq                      | question                  | character varying            | NO   | null                                          |
| faq                      | answer                    | text                         | NO   | null                                          |
| faq                      | translations              | jsonb                        | YES  | '{"de": {}, "en": {}, "es": {}, "zh": {}}'::jsonb |
| faq                      | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| faq                      | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| faq                      | language_code             | character varying            | YES  | 'en'::character varying                       |
| faq                      | order                     | integer                      | YES  | 0                                             |
| game_maps                | id                        | uuid                         | NO   | gen_random_uuid()                             |
| game_maps                | name                      | character varying            | NO   | null                                          |
| game_maps                | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| game_maps                | usage_count               | integer                      | YES  | 1                                             |
| game_maps                | is_active                 | boolean                      | YES  | true                                          |
| login_attempts           | id                        | uuid                         | NO   | gen_random_uuid()                             |
| login_attempts           | user_id                   | uuid                         | YES  | null                                          |
| login_attempts           | username                  | character varying            | NO   | null                                          |
| login_attempts           | ip_address                | character varying            | NO   | null                                          |
| login_attempts           | success                   | boolean                      | NO   | null                                          |
| login_attempts           | timestamp                 | timestamp without time zone  | YES  | now()                                         |
| map_translations         | id                        | uuid                         | NO   | gen_random_uuid()                             |
| map_translations         | map_id                    | uuid                         | NO   | null                                          |
| map_translations         | language_code             | character varying            | NO   | null                                          |
| map_translations         | name                      | character varying            | NO   | null                                          |
| map_translations         | description               | text                         | YES  | null                                          |
| map_translations         | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| map_translations         | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| matches                  | id                        | uuid                         | NO   | gen_random_uuid()                             |
| matches                  | winner_id                 | uuid                         | NO   | null                                          |
| matches                  | loser_id                  | uuid                         | NO   | null                                          |
| matches                  | map                       | character varying            | NO   | null                                          |
| matches                  | winner_faction            | character varying            | NO   | null                                          |
| matches                  | loser_faction             | character varying            | NO   | null                                          |
| matches                  | winner_comments           | text                         | YES  | null                                          |
| matches                  | winner_rating             | integer                      | YES  | null                                          |
| matches                  | loser_comments            | text                         | YES  | null                                          |
| matches                  | loser_rating              | integer                      | YES  | null                                          |
| matches                  | loser_confirmed           | boolean                      | YES  | false                                         |
| matches                  | replay_file_path          | character varying            | YES  | null                                          |
| matches                  | tournament_id             | uuid                         | YES  | null                                          |
| matches                  | elo_change                | integer                      | YES  | null                                          |
| matches                  | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| matches                  | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| matches                  | status                    | character varying            | YES  | 'unconfirmed'::character varying              |
| matches                  | admin_reviewed            | boolean                      | YES  | false                                         |
| matches                  | admin_reviewed_at         | timestamp without time zone  | YES  | null                                          |
| matches                  | admin_reviewed_by         | uuid                         | YES  | null                                          |
| matches                  | winner_elo_before         | integer                      | YES  | 1600                                          |
| matches                  | winner_elo_after          | integer                      | YES  | 1600                                          |
| matches                  | loser_elo_before          | integer                      | YES  | 1600                                          |
| matches                  | loser_elo_after           | integer                      | YES  | 1600                                          |
| matches                  | winner_level_before       | character varying            | YES  | 'novice'::character varying                   |
| matches                  | winner_level_after        | character varying            | YES  | 'novice'::character varying                   |
| matches                  | loser_level_before        | character varying            | YES  | 'novice'::character varying                   |
| matches                  | loser_level_after         | character varying            | YES  | 'novice'::character varying                   |
| matches                  | replay_downloads          | integer                      | YES  | 0                                             |
| matches                  | winner_ranking_pos        | integer                      | YES  | null                                          |
| matches                  | winner_ranking_change     | integer                      | YES  | null                                          |
| matches                  | loser_ranking_pos         | integer                      | YES  | null                                          |
| matches                  | loser_ranking_change      | integer                      | YES  | null                                          |
| matches                  | round_id                  | uuid                         | YES  | null                                          |
| migrations               | id                        | integer                      | NO   | nextval('migrations_id_seq'::regclass)        |
| migrations               | name                      | character varying            | NO   | null                                          |
| migrations               | executed_at               | timestamp without time zone  | YES  | now()                                         |
| news                     | id                        | uuid                         | NO   | gen_random_uuid()                             |
| news                     | title                     | character varying            | NO   | null                                          |
| news                     | content                   | text                         | NO   | null                                          |
| news                     | translations              | jsonb                        | YES  | '{"de": {}, "en": {}, "es": {}, "zh": {}}'::jsonb |
| news                     | author_id                 | uuid                         | NO   | null                                          |
| news                     | published_at              | timestamp without time zone  | YES  | null                                          |
| news                     | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| news                     | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| news                     | language_code             | character varying            | YES  | 'en'::character varying                       |
| online_users             | id                        | uuid                         | NO   | gen_random_uuid()                             |
| online_users             | user_id                   | uuid                         | NO   | null                                          |
| online_users             | last_seen                 | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| password_history         | id                        | uuid                         | NO   | gen_random_uuid()                             |
| password_history         | user_id                   | uuid                         | NO   | null                                          |
| password_history         | password_hash             | character varying            | NO   | null                                          |
| password_history         | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| password_policy          | id                        | uuid                         | NO   | gen_random_uuid()                             |
| password_policy          | min_length                | integer                      | YES  | 8                                             |
| password_policy          | require_uppercase         | boolean                      | YES  | true                                          |
| password_policy          | require_lowercase         | boolean                      | YES  | true                                          |
| password_policy          | require_numbers           | boolean                      | YES  | true                                          |
| password_policy          | require_symbols           | boolean                      | YES  | true                                          |
| password_policy          | previous_passwords_count  | integer                      | YES  | 5                                             |
| password_policy          | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| registration_requests    | id                        | uuid                         | NO   | gen_random_uuid()                             |
| registration_requests    | nickname                  | character varying            | NO   | null                                          |
| registration_requests    | email                     | character varying            | NO   | null                                          |
| registration_requests    | language                  | character varying            | YES  | null                                          |
| registration_requests    | discord_id                | character varying            | YES  | null                                          |
| registration_requests    | status                    | character varying            | YES  | 'pending'::character varying                  |
| registration_requests    | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| registration_requests    | reviewed_at               | timestamp without time zone  | YES  | null                                          |
| registration_requests    | reviewed_by               | uuid                         | YES  | null                                          |
| tournament_matches       | id                        | uuid                         | NO   | gen_random_uuid()                             |
| tournament_matches       | tournament_id             | uuid                         | NO   | null                                          |
| tournament_matches       | round_id                  | uuid                         | NO   | null                                          |
| tournament_matches       | player1_id                | uuid                         | NO   | null                                          |
| tournament_matches       | player2_id                | uuid                         | NO   | null                                          |
| tournament_matches       | winner_id                 | uuid                         | YES  | null                                          |
| tournament_matches       | match_id                  | uuid                         | YES  | null                                          |
| tournament_matches       | match_status              | character varying            | YES  | 'pending'::character varying                  |
| tournament_matches       | played_at                 | timestamp without time zone  | YES  | null                                          |
| tournament_matches       | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| tournament_matches       | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| tournament_matches       | tournament_round_match_id | uuid                         | YES  | null                                          |
| tournament_matches       | organizer_action          | character varying            | YES  | NULL::character varying                       |
| tournament_participants  | id                        | uuid                         | NO   | gen_random_uuid()                             |
| tournament_participants  | tournament_id             | uuid                         | NO   | null                                          |
| tournament_participants  | user_id                   | uuid                         | NO   | null                                          |
| tournament_participants  | current_round             | integer                      | YES  | 1                                             |
| tournament_participants  | status                    | character varying            | YES  | 'active'::character varying                   |
| tournament_participants  | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| tournament_participants  | participation_status      | character varying            | YES  | 'pending'::character varying                  |
| tournament_participants  | tournament_ranking        | integer                      | YES  | null                                          |
| tournament_participants  | tournament_wins           | integer                      | YES  | 0                                             |
| tournament_participants  | tournament_losses         | integer                      | YES  | 0                                             |
| tournament_participants  | tournament_points         | integer                      | YES  | 0                                             |
| tournament_round_matches | id                        | uuid                         | NO   | gen_random_uuid()                             |
| tournament_round_matches | tournament_id             | uuid                         | NO   | null                                          |
| tournament_round_matches | round_id                  | uuid                         | NO   | null                                          |
| tournament_round_matches | player1_id                | uuid                         | NO   | null                                          |
| tournament_round_matches | player2_id                | uuid                         | NO   | null                                          |
| tournament_round_matches | best_of                   | integer                      | NO   | null                                          |
| tournament_round_matches | wins_required             | integer                      | NO   | null                                          |
| tournament_round_matches | player1_wins              | integer                      | NO   | 0                                             |
| tournament_round_matches | player2_wins              | integer                      | NO   | 0                                             |
| tournament_round_matches | matches_scheduled         | integer                      | NO   | 0                                             |
| tournament_round_matches | series_status             | character varying            | NO   | 'in_progress'::character varying              |
| tournament_round_matches | winner_id                 | uuid                         | YES  | null                                          |
| tournament_round_matches | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| tournament_round_matches | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| tournament_rounds        | id                        | uuid                         | NO   | gen_random_uuid()                             |
| tournament_rounds        | tournament_id             | uuid                         | NO   | null                                          |
| tournament_rounds        | round_number              | integer                      | NO   | null                                          |
| tournament_rounds        | match_format              | character varying            | NO   | null                                          |
| tournament_rounds        | round_status              | character varying            | YES  | 'pending'::character varying                  |
| tournament_rounds        | round_start_date          | timestamp without time zone  | YES  | null                                          |
| tournament_rounds        | round_end_date            | timestamp without time zone  | YES  | null                                          |
| tournament_rounds        | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| tournament_rounds        | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| tournament_rounds        | round_type                | character varying            | YES  | 'general'::character varying                  |
| tournament_rounds        | round_classification      | character varying            | YES  | 'standard'::character varying                 |
| tournament_rounds        | players_remaining         | integer                      | YES  | null                                          |
| tournament_rounds        | players_advancing_to_next | integer                      | YES  | null                                          |
| tournament_rounds        | round_phase_label         | character varying            | YES  | null                                          |
| tournament_rounds        | round_phase_description   | character varying            | YES  | null                                          |
| tournaments              | id                        | uuid                         | NO   | gen_random_uuid()                             |
| tournaments              | name                      | character varying            | NO   | null                                          |
| tournaments              | description               | text                         | NO   | null                                          |
| tournaments              | creator_id                | uuid                         | NO   | null                                          |
| tournaments              | status                    | character varying            | YES  | 'pending'::character varying                  |
| tournaments              | approved_at               | timestamp without time zone  | YES  | null                                          |
| tournaments              | started_at                | timestamp without time zone  | YES  | null                                          |
| tournaments              | finished_at               | timestamp without time zone  | YES  | null                                          |
| tournaments              | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| tournaments              | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| tournaments              | general_rounds            | integer                      | YES  | 0                                             |
| tournaments              | final_rounds              | integer                      | YES  | 0                                             |
| tournaments              | registration_closed_at    | timestamp without time zone  | YES  | null                                          |
| tournaments              | prepared_at               | timestamp without time zone  | YES  | null                                          |
| tournaments              | tournament_type           | character varying            | YES  | null                                          |
| tournaments              | max_participants          | integer                      | YES  | null                                          |
| tournaments              | round_duration_days       | integer                      | YES  | 7                                             |
| tournaments              | auto_advance_round        | boolean                      | YES  | false                                         |
| tournaments              | current_round             | integer                      | YES  | 0                                             |
| tournaments              | total_rounds              | integer                      | YES  | 0                                             |
| tournaments              | general_rounds_format     | character varying            | YES  | 'bo3'::character varying                      |
| tournaments              | final_rounds_format       | character varying            | YES  | 'bo5'::character varying                      |
| tournaments              | discord_thread_id         | character varying            | YES  | null                                          |
| users                    | id                        | uuid                         | NO   | gen_random_uuid()                             |
| users                    | nickname                  | character varying            | NO   | null                                          |
| users                    | email                     | character varying            | NO   | null                                          |
| users                    | password_hash             | character varying            | NO   | null                                          |
| users                    | language                  | character varying            | YES  | 'en'::character varying                       |
| users                    | discord_id                | character varying            | YES  | null                                          |
| users                    | elo_rating                | integer                      | YES  | 1600                                          |
| users                    | level                     | character varying            | YES  | 'novice'::character varying                   |
| users                    | is_active                 | boolean                      | YES  | false                                         |
| users                    | is_blocked                | boolean                      | YES  | false                                         |
| users                    | is_admin                  | boolean                      | YES  | false                                         |
| users                    | created_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| users                    | updated_at                | timestamp without time zone  | YES  | CURRENT_TIMESTAMP                             |
| users                    | is_rated                  | boolean                      | YES  | false                                         |
| users                    | matches_played            | integer                      | YES  | 0                                             |
| users                    | elo_provisional           | boolean                      | YES  | false                                         |
| users                    | total_wins                | integer                      | YES  | 0                                             |
| users                    | total_losses              | integer                      | YES  | 0                                             |
| users                    | trend                     | character varying            | YES  | '-'::character varying                        |
| users                    | failed_login_attempts     | integer                      | YES  | 0                                             |
| users                    | locked_until              | timestamp without time zone  | YES  | null                                          |
| users                    | last_login_attempt        | timestamp without time zone  | YES  | null                                          |
| users                    | password_must_change      | boolean                      | YES  | false                                         |

### Indexes

The database includes comprehensive indexes to optimize query performance across all tables. Key indexes are defined for:
- Primary keys (unique, btree)
- Foreign key columns
- Frequently queried columns (created_at, status, user_id, tournament_id, etc.)
- Multi-column indexes for complex queries

### Foreign Keys

All relationships between tables are maintained through foreign key constraints:
- Users are referenced by: audit_logs, chat_messages, matches, news, online_users, password_history, registration_requests, tournament_matches, tournament_participants, tournament_round_matches, tournaments
- Tournaments are referenced by: tournament_matches, tournament_participants, tournament_rounds
- Matches are referenced by: tournament_matches
- Game maps and factions have translation tables

## Update Instructions

To keep this file updated:

1. **After executing SQL migrations**: Run the SQL queries provided at the beginning of this document to extract the current database schema.
2. **Update the date**: Change the date in "Last updated" to today.
3. **Verify consistency**: Ensure that all tables, columns, indexes and foreign keys are documented.
4. **Format**: Maintain tables in Markdown format for maximum readability.

## Recent Changes to Existing Tables

- **users**: Added `failed_login_attempts`, `locked_until`, `last_login_attempt`, `password_must_change`
- **tournaments**: Added `discord_thread_id`
- **tournament_matches**: Added `organizer_action`
- **game_maps** and **factions**: Added `is_active`
- **faq**: Added `order`

## Table: factions

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| name | character varying | NO |  |
| description | text | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| is_active | boolean | YES | true |

**Primary key**: id

**Constraints:**
- factions_name_not_null [n]: NOT NULL name
- factions_name_key [u]: UNIQUE (name)

## Table: faq

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| question | character varying | NO |  |
| answer | text | NO |  |
| translations | jsonb | YES | '{"de": {}, "en": {}, "es": {}, "zh": {}}'::jsonb |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| language_code | character varying | YES | 'en'::character varying |
| order | integer | YES | 0 |

**Primary key**: id

**Constraints:**
- faq_id_not_null [n]: NOT NULL id
- faq_question_not_null [n]: NOT NULL question
- faq_answer_not_null [n]: NOT NULL answer
- faq_pkey [p]: PRIMARY KEY (id)

## Table: game_maps

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| name | character varying | NO |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| usage_count | integer | YES | 1 |
| is_active | boolean | YES | true |

**Primary key**: id

**Unique columns**: name

**Constraints:**
- game_maps_name_key [u]: UNIQUE (name)
- game_maps_id_not_null [n]: NOT NULL id
- game_maps_name_not_null [n]: NOT NULL name
- game_maps_pkey [p]: PRIMARY KEY (id)

## Table: matches

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| winner_id | uuid | NO |  |
| loser_id | uuid | NO |  |
| map | character varying | NO |  |
| winner_faction | character varying | NO |  |
| loser_faction | character varying | NO |  |
| winner_comments | text | YES |  |
| winner_rating | integer | YES |  |
| loser_comments | text | YES |  |
| loser_rating | integer | YES |  |
| loser_confirmed | boolean | YES | false |
| replay_file_path | character varying | YES |  |
| tournament_id | uuid | YES |  |
| elo_change | integer | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| status | character varying | YES | 'unconfirmed'::character varying |
| admin_reviewed | boolean | YES | false |
| admin_reviewed_at | timestamp without time zone | YES |  |
| admin_reviewed_by | uuid | YES |  |
| winner_elo_before | integer | YES | 1600 |
| winner_elo_after | integer | YES | 1600 |
| loser_elo_before | integer | YES | 1600 |
| loser_elo_after | integer | YES | 1600 |
| winner_level_before | character varying | YES | 'novice'::character varying |
| winner_level_after | character varying | YES | 'novice'::character varying |
| loser_level_before | character varying | YES | 'novice'::character varying |
| loser_level_after | character varying | YES | 'novice'::character varying |
| replay_downloads | integer | YES | 0 |
| winner_ranking_pos | integer | YES |  |
| winner_ranking_change | integer | YES |  |
| loser_ranking_pos | integer | YES |  |
| loser_ranking_change | integer | YES |  |
| round_id | uuid | YES |  |

**Primary key**: id

**Foreign keys:**
- winner_id → users(id)
- loser_id → users(id)
- admin_reviewed_by → users(id)
- round_id → tournament_rounds(id)

## Table: news

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| title | character varying | NO |  |
| content | text | NO |  |
| translations | jsonb | YES | '{"de": {}, "en": {}, "es": {}, "zh": {}}'::jsonb |
| author_id | uuid | NO |  |
| published_at | timestamp without time zone | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary key**: id

**Foreign keys:**
- author_id → users(id)

## Table: online_users

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO |  |
| last_seen | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary key**: id

**Unique columns**: user_id

**Foreign keys:**
- user_id → users(id)

## Table: password_history

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO |  |
| password_hash | character varying | NO |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary key**: id

**Foreign keys:**
- user_id → users(id)

## Table: password_policy

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| min_length | integer | YES | 8 |
| require_uppercase | boolean | YES | true |
| require_lowercase | boolean | YES | true |
| require_numbers | boolean | YES | true |
| require_symbols | boolean | YES | true |
| previous_passwords_count | integer | YES | 5 |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary key**: id

## Table: registration_requests

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| nickname | character varying | NO |  |
| email | character varying | NO |  |
| language | character varying | YES |  |
| discord_id | character varying | YES |  |
| status | character varying | YES | 'pending'::character varying |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| reviewed_at | timestamp without time zone | YES |  |
| reviewed_by | uuid | YES |  |

**Primary key**: id

**Unique columns**: nickname

**Foreign keys:**
- reviewed_by → users(id)

## Table: tournament_matches

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| tournament_id | uuid | NO |  |
| round_id | uuid | NO |  |
| player1_id | uuid | NO |  |
| player2_id | uuid | NO |  |
| winner_id | uuid | YES |  |
| match_id | uuid | YES |  |
| match_status | character varying | YES | 'pending'::character varying |
| played_at | timestamp without time zone | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| tournament_round_match_id | uuid | YES |  |
| organizer_action | jsonb | YES | '{}'::jsonb |

**Primary key**: id

**Foreign keys:**
- tournament_id → tournaments(id)
- round_id → tournament_rounds(id)
- player1_id → users(id)
- player2_id → users(id)
- winner_id → users(id)
- match_id → matches(id)
- tournament_round_match_id → tournament_round_matches(id)

## Table: tournament_participants

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| tournament_id | uuid | NO |  |
| user_id | uuid | NO |  |
| current_round | integer | YES | 1 |
| status | character varying | YES | 'active'::character varying |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| participation_status | character varying | YES | 'pending'::character varying |
| tournament_ranking | integer | YES |  |
| tournament_wins | integer | YES | 0 |
| tournament_losses | integer | YES | 0 |
| tournament_points | integer | YES | 0 |

**Primary key**: id

**Unique columns**: tournament_id, user_id

**Foreign keys:**
- tournament_id → tournaments(id)
- user_id → users(id)

## Table: tournament_round_matches

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| tournament_id | uuid | NO |  |
| round_id | uuid | NO |  |
| player1_id | uuid | NO |  |
| player2_id | uuid | NO |  |
| best_of | integer | NO |  |
| wins_required | integer | NO |  |
| player1_wins | integer | NO | 0 |
| player2_wins | integer | NO | 0 |
| matches_scheduled | integer | NO | 0 |
| series_status | character varying | NO | 'in_progress'::character varying |
| winner_id | uuid | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary key**: id

**Unique columns**: tournament_id, round_id, player1_id, player2_id

**Foreign keys:**
- tournament_id → tournaments(id)
- round_id → tournament_rounds(id)
- player1_id → users(id)
- player2_id → users(id)
- winner_id → users(id)

## Table: tournament_rounds

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| tournament_id | uuid | NO |  |
| round_number | integer | NO |  |
| match_format | character varying | NO |  |
| round_status | character varying | YES | 'pending'::character varying |
| round_start_date | timestamp without time zone | YES |  |
| round_end_date | timestamp without time zone | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| round_type | character varying | YES | 'general'::character varying |
| round_classification | character varying | YES | 'standard'::character varying |
| players_remaining | integer | YES |  |
| players_advancing_to_next | integer | YES |  |
| round_phase_label | character varying | YES |  |
| round_phase_description | character varying | YES |  |

**Primary key**: id

**Unique columns**: tournament_id, round_number

**Foreign keys:**
- tournament_id → tournaments(id)

## Table: tournaments

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| name | character varying | NO |  |
| description | text | NO |  |
| creator_id | uuid | NO |  |
| status | character varying | YES | 'pending'::character varying |
| approved_at | timestamp without time zone | YES |  |
| started_at | timestamp without time zone | YES |  |
| finished_at | timestamp without time zone | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| general_rounds | integer | YES | 0 |
| final_rounds | integer | YES | 0 |
| registration_closed_at | timestamp without time zone | YES |  |
| prepared_at | timestamp without time zone | YES |  |
| tournament_type | character varying | YES |  |
| max_participants | integer | YES |  |
| round_duration_days | integer | YES | 7 |
| auto_advance_round | boolean | YES | false |
| current_round | integer | YES | 0 |
| total_rounds | integer | YES | 0 |
| general_rounds_format | character varying | YES | 'bo3'::character varying |
| final_rounds_format | character varying | YES | 'bo5'::character varying |
| discord_thread_id | character varying | YES |  |

**Primary key**: id

**Foreign keys:**
- creator_id → users(id)

## Table: users

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| nickname | character varying | NO |  |
| email | character varying | NO |  |
| password_hash | character varying | NO |  |
| language | character varying | YES | 'en'::character varying |
| discord_id | character varying | YES |  |
| elo_rating | integer | YES | 1600 |
| level | character varying | YES | 'novice'::character varying |
| is_active | boolean | YES | false |
| is_blocked | boolean | YES | false |
| is_admin | boolean | YES | false |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| is_rated | boolean | YES | false |
| matches_played | integer | YES | 0 |
| elo_provisional | boolean | YES | false |
| total_wins | integer | YES | 0 |
| total_losses | integer | YES | 0 |
| trend | character varying | YES | '-'::character varying |
| failed_login_attempts | integer | YES | 0 |
| locked_until | timestamp without time zone | YES |  |
| last_login_attempt | timestamp without time zone | YES |  |
| password_must_change | boolean | YES | false |

**Primary key**: id

**Unique columns**: nickname, email

## Table: audit_logs

Columns:
| Column      | Type         | Nullable | Default           |
|------------|--------------|----------|-------------------|
| id         | uuid         | NO       | gen_random_uuid() |
| event_type | varchar(50)  | NO       |                   |
| user_id    | uuid         | YES      |                   |
| username   | varchar(255) | YES      |                   |
| ip_address | varchar(45)  | YES      |                   |
| user_agent | text         | YES      |                   |
| details    | jsonb        | YES      |                   |
| created_at | timestamp    | YES      | NOW()             |

**Primary key**: id
**Foreign keys**: user_id → users(id)

## Table: login_attempts

Columns:
| Column    | Type         | Nullable | Default           |
|-----------|--------------|----------|-------------------|
| id        | uuid         | NO       | gen_random_uuid() |
| user_id   | uuid         | YES      |                   |
| username  | varchar(255) | NO       |                   |
| ip_address| varchar(45)  | NO       |                   |
| success   | boolean      | NO       |                   |
| timestamp | timestamp    | YES      | NOW()             |

**Primary key**: id
**Foreign keys**: user_id → users(id)

## Table: map_translations

Columns:
| Column        | Type                | Nullable | Default           |
|---------------|---------------------|----------|-------------------|
| id            | uuid                | NO       | gen_random_uuid() |
| map_id        | uuid                | NO       |                   |
| language_code | varchar(10)         | NO       |                   |
| name          | varchar(255)        | NO       |                   |
| description   | text                | YES      |                   |
| created_at    | timestamp           | YES      | CURRENT_TIMESTAMP |
| updated_at    | timestamp           | YES      | CURRENT_TIMESTAMP |

**Primary key**: id
**Foreign keys**: map_id → game_maps(id)
**Unique**: map_id, language_code

## Table: faction_translations

Columns:
| Column        | Type                | Nullable | Default           |
|---------------|---------------------|----------|-------------------|
| id            | uuid                | NO       | gen_random_uuid() |
| faction_id    | uuid                | NO       |                   |
| language_code | varchar(10)         | NO       |                   |
| name          | varchar(255)        | NO       |                   |
| description   | text                | YES      |                   |
| created_at    | timestamp           | YES      | CURRENT_TIMESTAMP |
| updated_at    | timestamp           | YES      | CURRENT_TIMESTAMP |

**Primary key**: id
**Foreign keys**: faction_id → factions(id)
**Unique**: faction_id, language_code

## Table: migrations

Columns:
| Column      | Type         | Nullable | Default |
|-------------|--------------|----------|---------|
| id          | integer      | NO       |         |
| name        | varchar(255) | NO       |         |
| run_on      | timestamp    | YES      |         |

**Primary key**: id

## Recent Changes to Existing Tables

- users: Added failed_login_attempts, locked_until, last_login_attempt
- tournaments: Added discord_thread_id
- tournament_matches: Added organizer_action
- game_maps and factions: Added is_active
- faq: Added order

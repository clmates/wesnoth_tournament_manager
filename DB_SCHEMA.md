# Database Schema (Live)

**Última actualización:** 2025-12-24  
*Actualiza esta fecha cada vez que se incorporen cambios al fichero.*

Extraído el: 2025-12-09T19:10:34.431Z

## Esquema completo de la base de datos (actualizado al 2025-12-24)

### Columnas de tablas

| Tabla                    | Columna                   | Tipo de dato                 | Nulo | Default                                       |
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
| matches                  | winner_level_before       | character varying            | YES  | 'novato'::character varying                   |
| matches                  | winner_level_after        | character varying            | YES  | 'novato'::character varying                   |
| matches                  | loser_level_before        | character varying            | YES  | 'novato'::character varying                   |
| matches                  | loser_level_after         | character varying            | YES  | 'novato'::character varying                   |
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
| users                    | elo_rating                | integer                      | YES  | 1200                                          |
| users                    | level                     | character varying            | YES  | 'novato'::character varying                   |
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

### Índices

| Tabla                    | Índice                          | Columna                   | Único | Primario |
|--------------------------|---------------------------------|---------------------------|-------|----------|
| audit_logs               | audit_logs_pkey                 | id                        | true  | true     |
| audit_logs               | idx_audit_logs_created_at       | created_at                | false | false    |
| audit_logs               | idx_audit_logs_event_type       | event_type                | false | false    |
| audit_logs               | idx_audit_logs_ip_address       | ip_address                | false | false    |
| audit_logs               | idx_audit_logs_user_id          | user_id                   | false | false    |
| chat_messages            | chat_messages_pkey              | id                        | true  | true     |
| chat_messages            | idx_chat_receiver               | receiver_id               | false | false    |
| chat_messages            | idx_chat_sender                 | sender_id                 | false | false    |
| faction_translations     | faction_translations_faction_id_language_code_key | faction_id | true  | false    |
| faction_translations     | faction_translations_faction_id_language_code_key | language_code | true  | false    |
| faction_translations     | faction_translations_pkey       | id                        | true  | true     |
| faction_translations     | idx_faction_translations_faction_id | faction_id             | false | false    |
| faction_translations     | idx_faction_translations_language | language_code            | false | false    |
| factions                 | factions_name_key               | name                      | true  | false    |
| factions                 | factions_pkey                   | id                        | true  | true     |
| factions                 | idx_factions_active             | is_active                 | false | false    |
| faq                      | faq_pkey                        | id                        | true  | true     |
| faq                      | idx_faq_order                   | order                     | false | false    |
| game_maps                | game_maps_name_key              | name                      | true  | false    |
| game_maps                | game_maps_pkey                  | id                        | true  | true     |
| game_maps                | idx_game_maps_active            | is_active                 | false | false    |
| login_attempts           | idx_login_attempts_ip_address   | ip_address                | false | false    |
| login_attempts           | idx_login_attempts_timestamp    | timestamp                 | false | false    |
| login_attempts           | idx_login_attempts_user_id      | user_id                   | false | false    |
| login_attempts           | idx_login_attempts_username     | username                  | false | false    |
| login_attempts           | login_attempts_pkey             | id                        | true  | true     |
| map_translations         | idx_map_translations_language   | language_code             | false | false    |
| map_translations         | idx_map_translations_map_id     | map_id                    | false | false    |
| map_translations         | map_translations_map_id_language_code_key | map_id         | true  | false    |
| map_translations         | map_translations_map_id_language_code_key | language_code   | true  | false    |
| map_translations         | map_translations_pkey           | id                        | true  | true     |
| matches                  | idx_matches_admin_reviewed      | admin_reviewed            | false | false    |
| matches                  | idx_matches_created_at          | created_at                | false | false    |
| matches                  | idx_matches_loser               | loser_id                  | false | false    |
| matches                  | idx_matches_round               | round_id                  | false | false    |
| matches                  | idx_matches_status              | status                    | false | false    |
| matches                  | idx_matches_tournament          | tournament_id             | false | false    |
| matches                  | idx_matches_winner              | winner_id                 | false | false    |
| matches                  | matches_pkey                    | id                        | true  | true     |
| migrations               | migrations_name_key             | name                      | true  | false    |
| migrations               | migrations_pkey                 | id                        | true  | true     |
| news                     | idx_news_author                 | author_id                 | false | false    |
| news                     | idx_news_language_code          | language_code             | false | false    |
| news                     | news_pkey                       | id                        | true  | true     |
| online_users             | online_users_pkey               | id                        | true  | true     |
| online_users             | online_users_user_id_key        | user_id                   | true  | false    |
| password_history         | password_history_pkey           | id                        | true  | true     |
| password_policy          | password_policy_pkey            | id                        | true  | true     |
| registration_requests    | registration_requests_nickname_key | nickname                | true  | false    |
| registration_requests    | registration_requests_pkey      | id                        | true  | true     |
| tournament_matches       | idx_tournament_matches_match    | match_id                  | false | false    |
| tournament_matches       | idx_tournament_matches_organizer_action | organizer_action   | false | false    |
| tournament_matches       | idx_tournament_matches_player1  | player1_id                | false | false    |
| tournament_matches       | idx_tournament_matches_player2  | player2_id                | false | false    |
| tournament_matches       | idx_tournament_matches_round    | round_id                  | false | false    |
| tournament_matches       | idx_tournament_matches_round_match | tournament_round_match_id | false | false    |
| tournament_matches       | idx_tournament_matches_status   | match_status              | false | false    |
| tournament_matches       | idx_tournament_matches_tournament | tournament_id             | false | false    |
| tournament_matches       | idx_tournament_matches_winner   | winner_id                 | false | false    |
| tournament_matches       | tournament_matches_pkey         | id                        | true  | true     |
| tournament_participants  | tournament_participants_pkey    | id                        | true  | true     |
| tournament_participants  | tournament_participants_tournament_id_user_id_key | tournament_id | true  | false    |
| tournament_participants  | tournament_participants_tournament_id_user_id_key | user_id      | true  | false    |
| tournament_round_matches | idx_tournament_round_matches_players | player1_id            | false | false    |
| tournament_round_matches | idx_tournament_round_matches_players | player2_id            | false | false    |
| tournament_round_matches | idx_tournament_round_matches_round | round_id               | false | false    |
| tournament_round_matches | idx_tournament_round_matches_status | series_status          | false | false    |
| tournament_round_matches | idx_tournament_round_matches_tournament | tournament_id       | false | false    |
| tournament_round_matches | tournament_round_matches_pkey   | id                        | true  | true     |
| tournament_round_matches | tournament_round_matches_tournament_id_round_id_player1_id__key | tournament_id | true | false |
| tournament_round_matches | tournament_round_matches_tournament_id_round_id_player1_id__key | player1_id    | true | false |
| tournament_round_matches | tournament_round_matches_tournament_id_round_id_player1_id__key | player2_id    | true | false |
| tournament_round_matches | tournament_round_matches_tournament_id_round_id_player1_id__key | round_id      | true | false |
| tournament_rounds        | idx_tournament_rounds_classification | round_classification  | false | false    |
| tournament_rounds        | idx_tournament_rounds_status    | round_status              | false | false    |
| tournament_rounds        | idx_tournament_rounds_tournament | tournament_id             | false | false    |
| tournament_rounds        | idx_tournament_rounds_type      | round_type                | false | false    |
| tournament_rounds        | tournament_rounds_pkey          | id                        | true  | true     |
| tournament_rounds        | tournament_rounds_tournament_id_round_number_key | tournament_id | true | false    |
| tournament_rounds        | tournament_rounds_tournament_id_round_number_key | round_number  | true | false    |
| tournaments              | idx_discord_thread_id           | discord_thread_id         | false | false    |
| tournaments              | idx_tournament_creator          | creator_id                | false | false    |
| tournaments              | idx_tournament_status           | status                    | false | false    |
| tournaments              | idx_tournaments_formats         | general_rounds_format     | false | false    |
| tournaments              | idx_tournaments_formats         | final_rounds_format       | false | false    |
| tournaments              | tournaments_pkey                | id                        | true  | true     |
| users                    | idx_users_elo_rating            | elo_rating                | false | false    |
| users                    | idx_users_email                 | email                     | false | false    |
| users                    | idx_users_is_rated              | is_rated                  | false | false    |
| users                    | idx_users_matches_played        | matches_played            | false | false    |
| users                    | idx_users_nickname              | nickname                  | false | false    |
| users                    | idx_users_password_must_change  | password_must_change      | false | false    |
| users                    | idx_users_total_losses          | total_losses              | false | false    |
| users                    | idx_users_total_wins            | total_wins                | false | false    |
| users                    | idx_users_trend                 | trend                     | false | false    |
| users                    | users_email_key                 | email                     | true  | false    |
| users                    | users_nickname_key              | nickname                  | true  | false    |
| users                    | users_pkey                      | id                        | true  | true     |

### Claves foráneas

| Tabla                    | Columna                   | Tabla foránea               | Columna foránea |
|--------------------------|---------------------------|-----------------------------|-----------------|
| audit_logs               | user_id                   | users                       | id              |
| chat_messages            | receiver_id               | users                       | id              |
| chat_messages            | sender_id                 | users                       | id              |
| faction_translations     | faction_id                | factions                    | id              |
| login_attempts           | user_id                   | users                       | id              |
| map_translations         | map_id                    | game_maps                   | id              |
| matches                  | admin_reviewed_by         | users                       | id              |
| matches                  | loser_id                  | users                       | id              |
| matches                  | round_id                  | tournament_rounds           | id              |
| matches                  | winner_id                 | users                       | id              |
| news                     | author_id                 | users                       | id              |
| online_users             | user_id                   | users                       | id              |
| password_history         | user_id                   | users                       | id              |
| registration_requests    | reviewed_by               | users                       | id              |
| tournament_matches       | match_id                  | matches                     | id              |
| tournament_matches       | player1_id                | users                       | id              |
| tournament_matches       | player2_id                | users                       | id              |
| tournament_matches       | round_id                  | tournament_rounds           | id              |
| tournament_matches       | tournament_id             | tournaments                 | id              |
| tournament_matches       | tournament_round_match_id | tournament_round_matches    | id              |
| tournament_matches       | winner_id                 | users                       | id              |
| tournament_participants  | tournament_id             | tournaments                 | id              |
| tournament_participants  | user_id                   | users                       | id              |
| tournament_round_matches | player1_id                | users                       | id              |
| tournament_round_matches | player2_id                | users                       | id              |
| tournament_round_matches | round_id                  | tournament_rounds           | id              |
| tournament_round_matches | tournament_id             | tournaments                 | id              |
| tournament_round_matches | winner_id                 | users                       | id              |
| tournament_rounds        | tournament_id             | tournaments                 | id              |
| tournaments              | creator_id                | users                       | id              |

## Instrucciones de actualización

Para mantener este archivo actualizado:

1. **Después de ejecutar migraciones SQL**: Ejecuta las consultas SQL proporcionadas al inicio de este documento para extraer el esquema actual de la base de datos.
2. **Actualiza la fecha**: Cambia la fecha en "Última actualización" al día actual.
3. **Verifica consistencia**: Asegúrate de que todas las tablas, columnas, índices y claves foráneas estén documentadas.
4. **Formato**: Mantén las tablas en formato Markdown para máxima legibilidad.

## Cambios recientes en tablas existentes

- **users**: Añadidos `failed_login_attempts`, `locked_until`, `last_login_attempt`, `password_must_change`
- **tournaments**: Añadido `discord_thread_id`
- **tournament_matches**: Añadido `organizer_action`
- **game_maps** y **factions**: Añadido `is_active`
- **faq**: Añadido `order`

## Table: factions

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| name | character varying | NO |  |
| description | text | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| is_active | boolean | YES | true |
- factions_name_not_null [n]: NOT NULL name
- factions_name_key [u]: UNIQUE (name)

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

**Indexes:**
- faq_pkey: `CREATE UNIQUE INDEX faq_pkey ON public.faq USING btree (id)`

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

**Indexes:**
- game_maps_name_key: `CREATE UNIQUE INDEX game_maps_name_key ON public.game_maps USING btree (name)`
- game_maps_pkey: `CREATE UNIQUE INDEX game_maps_pkey ON public.game_maps USING btree (id)`

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
| winner_level_before | character varying | YES | 'novato'::character varying |
| winner_level_after | character varying | YES | 'novato'::character varying |
| loser_level_before | character varying | YES | 'novato'::character varying |
| loser_level_after | character varying | YES | 'novato'::character varying |
| replay_downloads | integer | YES | 0 |
| winner_ranking_pos | integer | YES |  |
| winner_ranking_change | integer | YES |  |
| loser_ranking_pos | integer | YES |  |
| loser_ranking_change | integer | YES |  |
| round_id | uuid | YES |  |

**Primary key**: id

**Foreign keys:**
- winner_id -> users(id)
- loser_id -> users(id)
- admin_reviewed_by -> users(id)
- round_id -> tournament_rounds(id)

**Constraints:**
- matches_loser_id_fkey [f]: FOREIGN KEY (loser_id) REFERENCES users(id)
- matches_winner_rating_check [c]: CHECK (((winner_rating >= 1) AND (winner_rating <= 5)))
- matches_loser_rating_check [c]: CHECK (((loser_rating >= 1) AND (loser_rating <= 5)))
- matches_id_not_null [n]: NOT NULL id
- matches_winner_id_not_null [n]: NOT NULL winner_id
- matches_loser_id_not_null [n]: NOT NULL loser_id
- matches_map_not_null [n]: NOT NULL map
- matches_winner_faction_not_null [n]: NOT NULL winner_faction
- matches_loser_faction_not_null [n]: NOT NULL loser_faction
- matches_pkey [p]: PRIMARY KEY (id)
- matches_admin_reviewed_by_fkey [f]: FOREIGN KEY (admin_reviewed_by) REFERENCES users(id)
- matches_round_id_fkey [f]: FOREIGN KEY (round_id) REFERENCES tournament_rounds(id) ON DELETE SET NULL
- matches_winner_id_fkey [f]: FOREIGN KEY (winner_id) REFERENCES users(id)

**Indexes:**
- idx_matches_tournament: `CREATE INDEX idx_matches_tournament ON public.matches USING btree (tournament_id)`
- idx_matches_admin_reviewed: `CREATE INDEX idx_matches_admin_reviewed ON public.matches USING btree (admin_reviewed)`
- matches_pkey: `CREATE UNIQUE INDEX matches_pkey ON public.matches USING btree (id)`
- idx_matches_status: `CREATE INDEX idx_matches_status ON public.matches USING btree (status)`
- idx_matches_round: `CREATE INDEX idx_matches_round ON public.matches USING btree (round_id)`
- idx_matches_created_at: `CREATE INDEX idx_matches_created_at ON public.matches USING btree (created_at DESC)`
- idx_matches_winner: `CREATE INDEX idx_matches_winner ON public.matches USING btree (winner_id)`
- idx_matches_loser: `CREATE INDEX idx_matches_loser ON public.matches USING btree (loser_id)`
- idx_matches_created_at_desc: `CREATE INDEX idx_matches_created_at_desc ON public.matches USING btree (created_at DESC)`

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
- author_id -> users(id)

**Constraints:**
- news_author_id_fkey [f]: FOREIGN KEY (author_id) REFERENCES users(id)
- news_id_not_null [n]: NOT NULL id
- news_title_not_null [n]: NOT NULL title
- news_content_not_null [n]: NOT NULL content
- news_author_id_not_null [n]: NOT NULL author_id
- news_pkey [p]: PRIMARY KEY (id)

**Indexes:**
- idx_news_author: `CREATE INDEX idx_news_author ON public.news USING btree (author_id)`
- news_pkey: `CREATE UNIQUE INDEX news_pkey ON public.news USING btree (id)`

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
- user_id -> users(id)

**Constraints:**
- online_users_user_id_not_null [n]: NOT NULL user_id
- online_users_id_not_null [n]: NOT NULL id
- online_users_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES users(id)
- online_users_user_id_key [u]: UNIQUE (user_id)
- online_users_pkey [p]: PRIMARY KEY (id)

**Indexes:**
- online_users_pkey: `CREATE UNIQUE INDEX online_users_pkey ON public.online_users USING btree (id)`
- online_users_user_id_key: `CREATE UNIQUE INDEX online_users_user_id_key ON public.online_users USING btree (user_id)`

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
- user_id -> users(id)

**Constraints:**
- password_history_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
- password_history_user_id_not_null [n]: NOT NULL user_id
- password_history_password_hash_not_null [n]: NOT NULL password_hash
- password_history_pkey [p]: PRIMARY KEY (id)
- password_history_id_not_null [n]: NOT NULL id

**Indexes:**
- password_history_pkey: `CREATE UNIQUE INDEX password_history_pkey ON public.password_history USING btree (id)`

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

**Constraints:**
- password_policy_id_not_null [n]: NOT NULL id
- password_policy_pkey [p]: PRIMARY KEY (id)

**Indexes:**
- password_policy_pkey: `CREATE UNIQUE INDEX password_policy_pkey ON public.password_policy USING btree (id)`

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
- reviewed_by -> users(id)

**Constraints:**
- registration_requests_nickname_not_null [n]: NOT NULL nickname
- registration_requests_id_not_null [n]: NOT NULL id
- registration_requests_email_not_null [n]: NOT NULL email
- registration_requests_pkey [p]: PRIMARY KEY (id)
- registration_requests_nickname_key [u]: UNIQUE (nickname)
- registration_requests_reviewed_by_fkey [f]: FOREIGN KEY (reviewed_by) REFERENCES users(id)

**Indexes:**
- registration_requests_nickname_key: `CREATE UNIQUE INDEX registration_requests_nickname_key ON public.registration_requests USING btree (nickname)`
- registration_requests_pkey: `CREATE UNIQUE INDEX registration_requests_pkey ON public.registration_requests USING btree (id)`

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
| loser_id | uuid | YES |  |
| match_id | uuid | YES |  |
| match_status | character varying | YES | 'pending'::character varying |
| map | character varying | YES |  |
| winner_faction | character varying | YES |  |
| loser_faction | character varying | YES |  |
| winner_comments | text | YES |  |
| winner_rating | integer | YES |  |
| loser_comments | text | YES |  |
| loser_rating | integer | YES |  |
| replay_file_path | character varying | YES |  |
| status | character varying | YES | 'unconfirmed'::character varying |
| played_at | timestamp without time zone | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| tournament_round_match_id | uuid | YES |  |
| organizer_action | jsonb | YES | '{}'::jsonb |

**Primary key**: id

**Foreign keys:**
- tournament_id -> tournaments(id)
- round_id -> tournament_rounds(id)
- player1_id -> users(id)
- player2_id -> users(id)
- winner_id -> users(id)
- match_id -> matches(id)
- tournament_round_match_id -> tournament_round_matches(id)
- tournament_round_match_id -> tournament_round_matches(id)

**Constraints:**
- tournament_matches_id_not_null [n]: NOT NULL id
- tournament_matches_tournament_id_fkey [f]: FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
- tournament_matches_pkey [p]: PRIMARY KEY (id)
- tournament_matches_player2_id_not_null [n]: NOT NULL player2_id
- tournament_matches_player1_id_not_null [n]: NOT NULL player1_id
- tournament_matches_round_id_not_null [n]: NOT NULL round_id
- tournament_matches_tournament_id_not_null [n]: NOT NULL tournament_id
- tournament_matches_match_status_check [c]: CHECK (((match_status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
- fk_tournament_round_match_id [f]: FOREIGN KEY (tournament_round_match_id) REFERENCES tournament_round_matches(id) ON DELETE SET NULL
- tournament_matches_tournament_round_match_id_fkey [f]: FOREIGN KEY (tournament_round_match_id) REFERENCES tournament_round_matches(id) ON DELETE SET NULL
- tournament_matches_match_id_fkey [f]: FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL
- tournament_matches_winner_id_fkey [f]: FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
- tournament_matches_player2_id_fkey [f]: FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE
- tournament_matches_player1_id_fkey [f]: FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE
- tournament_matches_round_id_fkey [f]: FOREIGN KEY (round_id) REFERENCES tournament_rounds(id) ON DELETE CASCADE

**Indexes:**
- idx_tournament_matches_player2: `CREATE INDEX idx_tournament_matches_player2 ON public.tournament_matches USING btree (player2_id)`
- idx_tournament_matches_round_match: `CREATE INDEX idx_tournament_matches_round_match ON public.tournament_matches USING btree (tournament_round_match_id)`
- tournament_matches_pkey: `CREATE UNIQUE INDEX tournament_matches_pkey ON public.tournament_matches USING btree (id)`
- idx_tournament_matches_tournament: `CREATE INDEX idx_tournament_matches_tournament ON public.tournament_matches USING btree (tournament_id)`
- idx_tournament_matches_round: `CREATE INDEX idx_tournament_matches_round ON public.tournament_matches USING btree (round_id)`
- idx_tournament_matches_status: `CREATE INDEX idx_tournament_matches_status ON public.tournament_matches USING btree (match_status)`
- idx_tournament_matches_match: `CREATE INDEX idx_tournament_matches_match ON public.tournament_matches USING btree (match_id)`
- idx_tournament_matches_winner: `CREATE INDEX idx_tournament_matches_winner ON public.tournament_matches USING btree (winner_id)`
- idx_tournament_matches_player1: `CREATE INDEX idx_tournament_matches_player1 ON public.tournament_matches USING btree (player1_id)`

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
- tournament_id -> tournaments(id)
- user_id -> users(id)

**Constraints:**
- tournament_participants_tournament_id_fkey [f]: FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
- tournament_participants_tournament_id_user_id_key [u]: UNIQUE (tournament_id, user_id)
- tournament_participants_pkey [p]: PRIMARY KEY (id)
- tournament_participants_user_id_not_null [n]: NOT NULL user_id
- tournament_participants_tournament_id_not_null [n]: NOT NULL tournament_id
- tournament_participants_id_not_null [n]: NOT NULL id
- tournament_participants_user_id_fkey [f]: FOREIGN KEY (user_id) REFERENCES users(id)

**Indexes:**
- tournament_participants_tournament_id_user_id_key: `CREATE UNIQUE INDEX tournament_participants_tournament_id_user_id_key ON public.tournament_participants USING btree (tournament_id, user_id)`
- tournament_participants_pkey: `CREATE UNIQUE INDEX tournament_participants_pkey ON public.tournament_participants USING btree (id)`

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
- tournament_id -> tournaments(id)
- round_id -> tournament_rounds(id)
- player1_id -> users(id)
- player2_id -> users(id)
- winner_id -> users(id)

**Constraints:**
- tournament_round_matches_pkey [p]: PRIMARY KEY (id)
- tournament_round_matches_best_of_check [c]: CHECK ((best_of = ANY (ARRAY[1, 3, 5])))
- tournament_round_matches_series_status_check [c]: CHECK (((series_status)::text = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying])::text[])))
- tournament_round_matches_id_not_null [n]: NOT NULL id
- tournament_round_matches_tournament_id_not_null [n]: NOT NULL tournament_id
- tournament_round_matches_round_id_not_null [n]: NOT NULL round_id
- tournament_round_matches_player1_id_not_null [n]: NOT NULL player1_id
- tournament_round_matches_player2_id_not_null [n]: NOT NULL player2_id
- tournament_round_matches_best_of_not_null [n]: NOT NULL best_of
- tournament_round_matches_wins_required_not_null [n]: NOT NULL wins_required
- tournament_round_matches_player1_wins_not_null [n]: NOT NULL player1_wins
- tournament_round_matches_player2_wins_not_null [n]: NOT NULL player2_wins
- tournament_round_matches_matches_scheduled_not_null [n]: NOT NULL matches_scheduled
- tournament_round_matches_series_status_not_null [n]: NOT NULL series_status
- tournament_round_matches_tournament_id_round_id_player1_id__key [u]: UNIQUE (tournament_id, round_id, player1_id, player2_id)
- tournament_round_matches_tournament_id_fkey [f]: FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
- tournament_round_matches_round_id_fkey [f]: FOREIGN KEY (round_id) REFERENCES tournament_rounds(id) ON DELETE CASCADE
- tournament_round_matches_player1_id_fkey [f]: FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE
- tournament_round_matches_player2_id_fkey [f]: FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE
- tournament_round_matches_winner_id_fkey [f]: FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL

**Indexes:**
- tournament_round_matches_pkey: `CREATE UNIQUE INDEX tournament_round_matches_pkey ON public.tournament_round_matches USING btree (id)`
- tournament_round_matches_tournament_id_round_id_player1_id__key: `CREATE UNIQUE INDEX tournament_round_matches_tournament_id_round_id_player1_id__key ON public.tournament_round_matches USING btree (tournament_id, round_id, player1_id, player2_id)`
- idx_tournament_round_matches_tournament: `CREATE INDEX idx_tournament_round_matches_tournament ON public.tournament_round_matches USING btree (tournament_id)`
- idx_tournament_round_matches_round: `CREATE INDEX idx_tournament_round_matches_round ON public.tournament_round_matches USING btree (round_id)`
- idx_tournament_round_matches_players: `CREATE INDEX idx_tournament_round_matches_players ON public.tournament_round_matches USING btree (player1_id, player2_id)`
- idx_tournament_round_matches_status: `CREATE INDEX idx_tournament_round_matches_status ON public.tournament_round_matches USING btree (series_status)`

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

**Primary key**: id

**Unique columns**: tournament_id, round_number

**Foreign keys:**
- tournament_id -> tournaments(id)

**Constraints:**
- tournament_rounds_round_status_check [c]: CHECK (((round_status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[])))
- tournament_rounds_match_format_not_null [n]: NOT NULL match_format
- tournament_rounds_pkey [p]: PRIMARY KEY (id)
- tournament_rounds_tournament_id_round_number_key [u]: UNIQUE (tournament_id, round_number)
- tournament_rounds_tournament_id_fkey [f]: FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
- tournament_rounds_round_type_check [c]: CHECK (((round_type)::text = ANY ((ARRAY['general'::character varying, 'final'::character varying])::text[])))
- tournament_rounds_tournament_id_not_null [n]: NOT NULL tournament_id
- tournament_rounds_id_not_null [n]: NOT NULL id
- tournament_rounds_match_format_check [c]: CHECK (((match_format)::text = ANY ((ARRAY['bo1'::character varying, 'bo3'::character varying, 'bo5'::character varying])::text[])))
- tournament_rounds_round_number_not_null [n]: NOT NULL round_number

**Indexes:**
- tournament_rounds_pkey: `CREATE UNIQUE INDEX tournament_rounds_pkey ON public.tournament_rounds USING btree (id)`
- tournament_rounds_tournament_id_round_number_key: `CREATE UNIQUE INDEX tournament_rounds_tournament_id_round_number_key ON public.tournament_rounds USING btree (tournament_id, round_number)`
- idx_tournament_rounds_type: `CREATE INDEX idx_tournament_rounds_type ON public.tournament_rounds USING btree (round_type)`
- idx_tournament_rounds_tournament: `CREATE INDEX idx_tournament_rounds_tournament ON public.tournament_rounds USING btree (tournament_id)`
- idx_tournament_rounds_status: `CREATE INDEX idx_tournament_rounds_status ON public.tournament_rounds USING btree (round_status)`

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
- creator_id -> users(id)

**Constraints:**
- tournaments_description_not_null [n]: NOT NULL description
- tournaments_creator_id_fkey [f]: FOREIGN KEY (creator_id) REFERENCES users(id)
- tournaments_creator_id_not_null [n]: NOT NULL creator_id
- tournaments_pkey [p]: PRIMARY KEY (id)
- tournaments_name_not_null [n]: NOT NULL name
- tournaments_id_not_null [n]: NOT NULL id
- tournaments_general_rounds_format_check [c]: CHECK (((general_rounds_format)::text = ANY ((ARRAY['bo1'::character varying, 'bo3'::character varying, 'bo5'::character varying])::text[])))
- tournaments_final_rounds_format_check [c]: CHECK (((final_rounds_format)::text = ANY ((ARRAY['bo1'::character varying, 'bo3'::character varying, 'bo5'::character varying])::text[])))

**Indexes:**
- idx_tournament_creator: `CREATE INDEX idx_tournament_creator ON public.tournaments USING btree (creator_id)`
- idx_tournaments_status: `CREATE INDEX idx_tournaments_status ON public.tournaments USING btree (status)`
- idx_tournaments_formats: `CREATE INDEX idx_tournaments_formats ON public.tournaments USING btree (general_rounds_format, final_rounds_format)`
- tournaments_pkey: `CREATE UNIQUE INDEX tournaments_pkey ON public.tournaments USING btree (id)`
- idx_tournament_status: `CREATE INDEX idx_tournament_status ON public.tournaments USING btree (status)`
- idx_tournaments_creator: `CREATE INDEX idx_tournaments_creator ON public.tournaments USING btree (creator_id)`

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
| level | character varying | YES | 'novato'::character varying |
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

**Primary key**: id

**Unique columns**: nickname, email

**Constraints:**
- users_id_not_null [n]: NOT NULL id
- users_nickname_not_null [n]: NOT NULL nickname
- users_email_not_null [n]: NOT NULL email
- users_password_hash_not_null [n]: NOT NULL password_hash
- users_pkey [p]: PRIMARY KEY (id)
- users_nickname_key [u]: UNIQUE (nickname)
- users_email_key [u]: UNIQUE (email)

**Indexes:**
- idx_users_elo_rating: `CREATE INDEX idx_users_elo_rating ON public.users USING btree (elo_rating)`
- idx_users_is_rated: `CREATE INDEX idx_users_is_rated ON public.users USING btree (is_rated)`
- idx_users_email: `CREATE INDEX idx_users_email ON public.users USING btree (email)`
- idx_users_nickname: `CREATE INDEX idx_users_nickname ON public.users USING btree (nickname)`
- users_email_key: `CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)`
- users_nickname_key: `CREATE UNIQUE INDEX users_nickname_key ON public.users USING btree (nickname)`
- users_pkey: `CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)`
- idx_users_trend: `CREATE INDEX idx_users_trend ON public.users USING btree (trend)`
- idx_users_total_losses: `CREATE INDEX idx_users_total_losses ON public.users USING btree (total_losses)`
- idx_users_total_wins: `CREATE INDEX idx_users_total_wins ON public.users USING btree (total_wins DESC)`
- idx_users_matches_played: `CREATE INDEX idx_users_matches_played ON public.users USING btree (matches_played)`

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

Primary key: id
Foreign keys: user_id -> users(id)
Indexes: idx_audit_logs_user_id, idx_audit_logs_event_type, idx_audit_logs_created_at, idx_audit_logs_ip_address

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

Primary key: id
Foreign keys: user_id -> users(id)
Indexes: idx_login_attempts_user_id, idx_login_attempts_username, idx_login_attempts_ip_address, idx_login_attempts_timestamp

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

Primary key: id
Foreign keys: map_id -> game_maps(id)
Unique: map_id, language_code
Indexes: idx_map_translations_language, idx_map_translations_map_id

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

Primary key: id
Foreign keys: faction_id -> factions(id)
Unique: faction_id, language_code
Indexes: idx_faction_translations_language, idx_faction_translations_faction_id

## Table: migrations
Columns:
| Column      | Type         | Nullable | Default |
|-------------|--------------|----------|---------|
| id          | integer      | NO       |         |
| name        | varchar(255) | NO       |         |
| run_on      | timestamp    | YES      |         |

Primary key: id

## Cambios recientes en tablas existentes
- users: Añadidos failed_login_attempts, locked_until, last_login_attempt
- tournaments: Añadido discord_thread_id
- tournament_matches: Añadido organizer_action
- game_maps y factions: Añadido is_active
- faq: Añadido order
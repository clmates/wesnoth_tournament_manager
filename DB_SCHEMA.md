# Database schema (live)

Extracted on: 2025-12-09T19:10:34.431Z

## Table: chat_messages

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| sender_id | uuid | NO |  |
| receiver_id | uuid | NO |  |
| message | text | NO |  |
| is_read | boolean | YES | false |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary key**: id

**Foreign keys:**
- sender_id -> users(id)
- receiver_id -> users(id)

**Constraints:**
- chat_messages_pkey [p]: PRIMARY KEY (id)
- chat_messages_sender_id_fkey [f]: FOREIGN KEY (sender_id) REFERENCES users(id)
- chat_messages_receiver_id_fkey [f]: FOREIGN KEY (receiver_id) REFERENCES users(id)
- chat_messages_receiver_id_not_null [n]: NOT NULL receiver_id
- chat_messages_message_not_null [n]: NOT NULL message
- chat_messages_id_not_null [n]: NOT NULL id
- chat_messages_sender_id_not_null [n]: NOT NULL sender_id

**Indexes:**
- idx_chat_sender: `CREATE INDEX idx_chat_sender ON public.chat_messages USING btree (sender_id)`
- idx_chat_receiver: `CREATE INDEX idx_chat_receiver ON public.chat_messages USING btree (receiver_id)`
- chat_messages_pkey: `CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id)`

## Table: factions

Columns:
| Column | Type | Nullable | Default |
|---|---|---:|---|
| id | uuid | NO | gen_random_uuid() |
| name | character varying | NO |  |
| description | text | YES |  |
| icon_path | character varying | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary key**: id

**Unique columns**: name

**Constraints:**
- factions_pkey [p]: PRIMARY KEY (id)
- factions_id_not_null [n]: NOT NULL id
- factions_name_not_null [n]: NOT NULL name
- factions_name_key [u]: UNIQUE (name)

**Indexes:**
- factions_pkey: `CREATE UNIQUE INDEX factions_pkey ON public.factions USING btree (id)`
- factions_name_key: `CREATE UNIQUE INDEX factions_name_key ON public.factions USING btree (name)`

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
| match_id | uuid | YES |  |
| match_status | character varying | YES | 'pending'::character varying |
| played_at | timestamp without time zone | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| tournament_round_match_id | uuid | YES |  |

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

## Application-defined Functions (public schema)

No application-defined functions found in the `public` schema.

*Note: extension functions (typically implemented in C) are present in the schema; the full function list (including extension functions) is available in `backend/tmp/db_schema_full.json`.*

## Rules (pg_rules for public schema)

No rules found in `public` schema.
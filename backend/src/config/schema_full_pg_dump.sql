--
-- PostgreSQL database dump
--

\restrict DFw0ySZgmDArJQESq7p1gEQ5AeNuCElW4yjz0DJoPVUUpgKtwZLG0du9K0VtZXv

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- Name: factions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.factions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    icon_path character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.factions OWNER TO postgres;

--
-- Name: faq; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.faq (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question character varying(500) NOT NULL,
    answer text NOT NULL,
    translations jsonb DEFAULT '{"de": {}, "en": {}, "es": {}, "zh": {}}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    language_code character varying(10) DEFAULT 'en'::character varying
);


ALTER TABLE public.faq OWNER TO postgres;

--
-- Name: game_maps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.game_maps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    usage_count integer DEFAULT 1
);


ALTER TABLE public.game_maps OWNER TO postgres;

--
-- Name: matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    winner_id uuid NOT NULL,
    loser_id uuid NOT NULL,
    map character varying(255) NOT NULL,
    winner_faction character varying(255) NOT NULL,
    loser_faction character varying(255) NOT NULL,
    winner_comments text,
    winner_rating integer,
    loser_comments text,
    loser_rating integer,
    loser_confirmed boolean DEFAULT false,
    replay_file_path character varying(500),
    tournament_id uuid,
    elo_change integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(50) DEFAULT 'unconfirmed'::character varying,
    admin_reviewed boolean DEFAULT false,
    admin_reviewed_at timestamp without time zone,
    admin_reviewed_by uuid,
    winner_elo_before integer DEFAULT 1600,
    winner_elo_after integer DEFAULT 1600,
    loser_elo_before integer DEFAULT 1600,
    loser_elo_after integer DEFAULT 1600,
    winner_level_before character varying(50) DEFAULT 'novato'::character varying,
    winner_level_after character varying(50) DEFAULT 'novato'::character varying,
    loser_level_before character varying(50) DEFAULT 'novato'::character varying,
    loser_level_after character varying(50) DEFAULT 'novato'::character varying,
    replay_downloads integer DEFAULT 0,
    winner_ranking_pos integer,
    winner_ranking_change integer,
    loser_ranking_pos integer,
    loser_ranking_change integer,
    round_id uuid,
    CONSTRAINT matches_loser_rating_check CHECK (((loser_rating >= 1) AND (loser_rating <= 5))),
    CONSTRAINT matches_winner_rating_check CHECK (((winner_rating >= 1) AND (winner_rating <= 5)))
);


ALTER TABLE public.matches OWNER TO postgres;

--
-- Name: news; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    translations jsonb DEFAULT '{"de": {}, "en": {}, "es": {}, "zh": {}}'::jsonb,
    author_id uuid NOT NULL,
    published_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    language_code character varying(10) DEFAULT 'en'::character varying
);


ALTER TABLE public.news OWNER TO postgres;

--
-- Name: online_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.online_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    last_seen timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.online_users OWNER TO postgres;

--
-- Name: password_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_history OWNER TO postgres;

--
-- Name: password_policy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_policy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    min_length integer DEFAULT 8,
    require_uppercase boolean DEFAULT true,
    require_lowercase boolean DEFAULT true,
    require_numbers boolean DEFAULT true,
    require_symbols boolean DEFAULT true,
    previous_passwords_count integer DEFAULT 5,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_policy OWNER TO postgres;

--
-- Name: registration_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registration_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nickname character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    language character varying(2),
    discord_id character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed_at timestamp without time zone,
    reviewed_by uuid
);


ALTER TABLE public.registration_requests OWNER TO postgres;

--
-- Name: tournament_matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    round_id uuid NOT NULL,
    player1_id uuid NOT NULL,
    player2_id uuid NOT NULL,
    winner_id uuid,
    match_id uuid,
    match_status character varying(20) DEFAULT 'pending'::character varying,
    played_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tournament_round_match_id uuid,
    CONSTRAINT tournament_matches_match_status_check CHECK (((match_status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.tournament_matches OWNER TO postgres;

--
-- Name: TABLE tournament_matches; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tournament_matches IS 'Tracks all matches for tournament rounds. Matches are generated when a round becomes active, based on tournament type and participant count.';


--
-- Name: COLUMN tournament_matches.player1_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_matches.player1_id IS 'First player in the match';


--
-- Name: COLUMN tournament_matches.player2_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_matches.player2_id IS 'Second player in the match';


--
-- Name: COLUMN tournament_matches.winner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_matches.winner_id IS 'Player who won the match (null until match is played)';


--
-- Name: COLUMN tournament_matches.match_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_matches.match_id IS 'Reference to the actual match report in matches table';


--
-- Name: COLUMN tournament_matches.match_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_matches.match_status IS 'Status: pending (not played), in_progress (being played), completed (results recorded), cancelled';


--
-- Name: COLUMN tournament_matches.played_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_matches.played_at IS 'Timestamp when the match was actually played';


--
-- Name: tournament_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    current_round integer DEFAULT 1,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    participation_status character varying(20) DEFAULT 'pending'::character varying,
    tournament_ranking integer,
    tournament_wins integer DEFAULT 0,
    tournament_losses integer DEFAULT 0,
    tournament_points integer DEFAULT 0
);


ALTER TABLE public.tournament_participants OWNER TO postgres;

--
-- Name: tournament_round_matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_round_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    round_id uuid NOT NULL,
    player1_id uuid NOT NULL,
    player2_id uuid NOT NULL,
    best_of integer NOT NULL,
    wins_required integer NOT NULL,
    player1_wins integer DEFAULT 0 NOT NULL,
    player2_wins integer DEFAULT 0 NOT NULL,
    matches_scheduled integer DEFAULT 0 NOT NULL,
    series_status character varying(50) DEFAULT 'in_progress'::character varying NOT NULL,
    winner_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tournament_round_matches_best_of_check CHECK ((best_of = ANY (ARRAY[1, 3, 5]))),
    CONSTRAINT tournament_round_matches_series_status_check CHECK (((series_status)::text = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.tournament_round_matches OWNER TO postgres;

--
-- Name: tournament_rounds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_rounds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    round_number integer NOT NULL,
    match_format character varying(10) NOT NULL,
    round_status character varying(20) DEFAULT 'pending'::character varying,
    round_start_date timestamp without time zone,
    round_end_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    round_type character varying(20) DEFAULT 'general'::character varying,
    round_classification character varying(50) DEFAULT 'standard'::character varying,
    players_remaining integer,
    players_advancing_to_next integer,
    round_phase_label character varying(100),
    round_phase_description character varying(255),
    CONSTRAINT tournament_rounds_match_format_check CHECK (((match_format)::text = ANY ((ARRAY['bo1'::character varying, 'bo3'::character varying, 'bo5'::character varying])::text[]))),
    CONSTRAINT tournament_rounds_round_classification_check CHECK (((round_classification)::text = ANY ((ARRAY['standard'::character varying, 'swiss'::character varying, 'general'::character varying, 'elimination'::character varying, 'quarterfinals'::character varying, 'semifinals'::character varying, 'final'::character varying])::text[]))),
    CONSTRAINT tournament_rounds_round_status_check CHECK (((round_status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[]))),
    CONSTRAINT tournament_rounds_round_type_check CHECK (((round_type)::text = ANY ((ARRAY['general'::character varying, 'final'::character varying])::text[])))
);


ALTER TABLE public.tournament_rounds OWNER TO postgres;

--
-- Name: COLUMN tournament_rounds.round_classification; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_rounds.round_classification IS 'Semantic classification of round type based on tournament format';


--
-- Name: COLUMN tournament_rounds.players_remaining; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_rounds.players_remaining IS 'Number of players in this round at start';


--
-- Name: COLUMN tournament_rounds.players_advancing_to_next; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tournament_rounds.players_advancing_to_next IS 'Number of players advancing to next round';


--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournaments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    creator_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    approved_at timestamp without time zone,
    started_at timestamp without time zone,
    finished_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    general_rounds integer DEFAULT 0,
    final_rounds integer DEFAULT 0,
    registration_closed_at timestamp without time zone,
    prepared_at timestamp without time zone,
    tournament_type character varying(50),
    max_participants integer,
    round_duration_days integer DEFAULT 7,
    auto_advance_round boolean DEFAULT false,
    current_round integer DEFAULT 0,
    total_rounds integer DEFAULT 0,
    general_rounds_format character varying(10) DEFAULT 'bo3'::character varying,
    final_rounds_format character varying(10) DEFAULT 'bo5'::character varying,
    CONSTRAINT tournaments_final_rounds_format_check CHECK (((final_rounds_format)::text = ANY ((ARRAY['bo1'::character varying, 'bo3'::character varying, 'bo5'::character varying])::text[]))),
    CONSTRAINT tournaments_general_rounds_format_check CHECK (((general_rounds_format)::text = ANY ((ARRAY['bo1'::character varying, 'bo3'::character varying, 'bo5'::character varying])::text[])))
);


ALTER TABLE public.tournaments OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nickname character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    language character varying(2) DEFAULT 'en'::character varying,
    discord_id character varying(255),
    elo_rating integer DEFAULT 1600,
    level character varying(50) DEFAULT 'novato'::character varying,
    is_active boolean DEFAULT false,
    is_blocked boolean DEFAULT false,
    is_admin boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_rated boolean DEFAULT false,
    matches_played integer DEFAULT 0,
    elo_provisional boolean DEFAULT false,
    total_wins integer DEFAULT 0,
    total_losses integer DEFAULT 0,
    trend character varying(10) DEFAULT '-'::character varying
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: factions factions_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factions
    ADD CONSTRAINT factions_name_key UNIQUE (name);


--
-- Name: factions factions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factions
    ADD CONSTRAINT factions_pkey PRIMARY KEY (id);


--
-- Name: faq faq_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq
    ADD CONSTRAINT faq_pkey PRIMARY KEY (id);


--
-- Name: game_maps game_maps_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_maps
    ADD CONSTRAINT game_maps_name_key UNIQUE (name);


--
-- Name: game_maps game_maps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_maps
    ADD CONSTRAINT game_maps_pkey PRIMARY KEY (id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: online_users online_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_users
    ADD CONSTRAINT online_users_pkey PRIMARY KEY (id);


--
-- Name: online_users online_users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_users
    ADD CONSTRAINT online_users_user_id_key UNIQUE (user_id);


--
-- Name: password_history password_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_history
    ADD CONSTRAINT password_history_pkey PRIMARY KEY (id);


--
-- Name: password_policy password_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_policy
    ADD CONSTRAINT password_policy_pkey PRIMARY KEY (id);


--
-- Name: registration_requests registration_requests_nickname_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration_requests
    ADD CONSTRAINT registration_requests_nickname_key UNIQUE (nickname);


--
-- Name: registration_requests registration_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration_requests
    ADD CONSTRAINT registration_requests_pkey PRIMARY KEY (id);


--
-- Name: tournament_matches tournament_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_pkey PRIMARY KEY (id);


--
-- Name: tournament_participants tournament_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_pkey PRIMARY KEY (id);


--
-- Name: tournament_participants tournament_participants_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_id_user_id_key UNIQUE (tournament_id, user_id);


--
-- Name: tournament_round_matches tournament_round_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_round_matches
    ADD CONSTRAINT tournament_round_matches_pkey PRIMARY KEY (id);


--
-- Name: tournament_round_matches tournament_round_matches_tournament_id_round_id_player1_id__key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_round_matches
    ADD CONSTRAINT tournament_round_matches_tournament_id_round_id_player1_id__key UNIQUE (tournament_id, round_id, player1_id, player2_id);


--
-- Name: tournament_rounds tournament_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_pkey PRIMARY KEY (id);


--
-- Name: tournament_rounds tournament_rounds_tournament_id_round_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_tournament_id_round_number_key UNIQUE (tournament_id, round_number);


--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_nickname_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_nickname_key UNIQUE (nickname);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_chat_receiver; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_receiver ON public.chat_messages USING btree (receiver_id);


--
-- Name: idx_chat_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_sender ON public.chat_messages USING btree (sender_id);


--
-- Name: idx_matches_admin_reviewed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_admin_reviewed ON public.matches USING btree (admin_reviewed);


--
-- Name: idx_matches_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_created_at ON public.matches USING btree (created_at DESC);


--
-- Name: idx_matches_created_at_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_created_at_desc ON public.matches USING btree (created_at DESC);


--
-- Name: idx_matches_loser; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_loser ON public.matches USING btree (loser_id);


--
-- Name: idx_matches_round; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_round ON public.matches USING btree (round_id);


--
-- Name: idx_matches_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_status ON public.matches USING btree (status);


--
-- Name: idx_matches_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_tournament ON public.matches USING btree (tournament_id);


--
-- Name: idx_matches_winner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_winner ON public.matches USING btree (winner_id);


--
-- Name: idx_news_author; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_news_author ON public.news USING btree (author_id);


--
-- Name: idx_news_language_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_news_language_code ON public.news USING btree (language_code);


--
-- Name: idx_tournament_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_creator ON public.tournaments USING btree (creator_id);


--
-- Name: idx_tournament_matches_match; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_matches_match ON public.tournament_matches USING btree (match_id);


--
-- Name: idx_tournament_matches_player1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_matches_player1 ON public.tournament_matches USING btree (player1_id);


--
-- Name: idx_tournament_matches_player2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_matches_player2 ON public.tournament_matches USING btree (player2_id);


--
-- Name: idx_tournament_matches_round; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_matches_round ON public.tournament_matches USING btree (round_id);


--
-- Name: idx_tournament_matches_round_match; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_matches_round_match ON public.tournament_matches USING btree (tournament_round_match_id);


--
-- Name: idx_tournament_matches_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_matches_status ON public.tournament_matches USING btree (match_status);


--
-- Name: idx_tournament_matches_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_matches_tournament ON public.tournament_matches USING btree (tournament_id);


--
-- Name: idx_tournament_matches_winner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_matches_winner ON public.tournament_matches USING btree (winner_id);


--
-- Name: idx_tournament_round_matches_players; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_round_matches_players ON public.tournament_round_matches USING btree (player1_id, player2_id);


--
-- Name: idx_tournament_round_matches_round; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_round_matches_round ON public.tournament_round_matches USING btree (round_id);


--
-- Name: idx_tournament_round_matches_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_round_matches_status ON public.tournament_round_matches USING btree (series_status);


--
-- Name: idx_tournament_round_matches_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_round_matches_tournament ON public.tournament_round_matches USING btree (tournament_id);


--
-- Name: idx_tournament_rounds_classification; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_rounds_classification ON public.tournament_rounds USING btree (round_classification);


--
-- Name: idx_tournament_rounds_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_rounds_status ON public.tournament_rounds USING btree (round_status);


--
-- Name: idx_tournament_rounds_tournament; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_rounds_tournament ON public.tournament_rounds USING btree (tournament_id);


--
-- Name: idx_tournament_rounds_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_rounds_type ON public.tournament_rounds USING btree (round_type);


--
-- Name: idx_tournament_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournament_status ON public.tournaments USING btree (status);


--
-- Name: idx_tournaments_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_creator ON public.tournaments USING btree (creator_id);


--
-- Name: idx_tournaments_formats; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_formats ON public.tournaments USING btree (general_rounds_format, final_rounds_format);


--
-- Name: idx_tournaments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tournaments_status ON public.tournaments USING btree (status);


--
-- Name: idx_users_elo_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_elo_rating ON public.users USING btree (elo_rating);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_is_rated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_is_rated ON public.users USING btree (is_rated);


--
-- Name: idx_users_matches_played; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_matches_played ON public.users USING btree (matches_played);


--
-- Name: idx_users_nickname; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_nickname ON public.users USING btree (nickname);


--
-- Name: idx_users_total_losses; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_total_losses ON public.users USING btree (total_losses);


--
-- Name: idx_users_total_wins; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_total_wins ON public.users USING btree (total_wins DESC);


--
-- Name: idx_users_trend; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_trend ON public.users USING btree (trend);


--
-- Name: chat_messages chat_messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id);


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: tournament_matches fk_tournament_round_match_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT fk_tournament_round_match_id FOREIGN KEY (tournament_round_match_id) REFERENCES public.tournament_round_matches(id) ON DELETE SET NULL;


--
-- Name: matches matches_admin_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_admin_reviewed_by_fkey FOREIGN KEY (admin_reviewed_by) REFERENCES public.users(id);


--
-- Name: matches matches_loser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_loser_id_fkey FOREIGN KEY (loser_id) REFERENCES public.users(id);


--
-- Name: matches matches_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.tournament_rounds(id) ON DELETE SET NULL;


--
-- Name: matches matches_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.users(id);


--
-- Name: news news_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: online_users online_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_users
    ADD CONSTRAINT online_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: password_history password_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_history
    ADD CONSTRAINT password_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: registration_requests registration_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration_requests
    ADD CONSTRAINT registration_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: tournament_matches tournament_matches_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL;


--
-- Name: tournament_matches tournament_matches_player1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tournament_matches tournament_matches_player2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tournament_matches tournament_matches_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.tournament_rounds(id) ON DELETE CASCADE;


--
-- Name: tournament_matches tournament_matches_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: tournament_matches tournament_matches_tournament_round_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_tournament_round_match_id_fkey FOREIGN KEY (tournament_round_match_id) REFERENCES public.tournament_round_matches(id) ON DELETE SET NULL;


--
-- Name: tournament_matches tournament_matches_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tournament_participants tournament_participants_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: tournament_participants tournament_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_participants
    ADD CONSTRAINT tournament_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tournament_round_matches tournament_round_matches_player1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_round_matches
    ADD CONSTRAINT tournament_round_matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tournament_round_matches tournament_round_matches_player2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_round_matches
    ADD CONSTRAINT tournament_round_matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tournament_round_matches tournament_round_matches_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_round_matches
    ADD CONSTRAINT tournament_round_matches_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.tournament_rounds(id) ON DELETE CASCADE;


--
-- Name: tournament_round_matches tournament_round_matches_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_round_matches
    ADD CONSTRAINT tournament_round_matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: tournament_round_matches tournament_round_matches_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_round_matches
    ADD CONSTRAINT tournament_round_matches_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tournament_rounds tournament_rounds_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: tournaments tournaments_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict DFw0ySZgmDArJQESq7p1gEQ5AeNuCElW4yjz0DJoPVUUpgKtwZLG0du9K0VtZXv


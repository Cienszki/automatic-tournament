CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "bot";
--> statement-breakpoint
CREATE TABLE "app"."audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" text,
	"tournament_id" text,
	"organization_id" text,
	"action" text NOT NULL,
	"target_kind" text,
	"target_id" text,
	"reason" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."dm_log" (
	"discord_id" text NOT NULL,
	"key" text NOT NULL,
	"dm_status" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dm_log_discord_id_key_pk" PRIMARY KEY("discord_id","key"),
	CONSTRAINT "dm_log_dm_status_check" CHECK ("dm_status" in ('sent', 'blocked', 'failed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "app"."dm_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."inbox" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"tournament_id" text,
	"dm_status" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "inbox_dm_status_check" CHECK ("dm_status" in ('sent', 'blocked', 'failed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "app"."inbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"type" text NOT NULL,
	"tournament_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"max_attempts" smallint DEFAULT 5 NOT NULL,
	"dedupe_key" text,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_status_check" CHECK ("status" in ('waiting', 'running', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "app"."jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."platform_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."players" (
	"steam_id64" text PRIMARY KEY NOT NULL,
	"nickname" text,
	"persona_name" text,
	"avatar_url" text,
	"avatar_medium_url" text,
	"avatar_full_url" text,
	"top_heroes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_steam_id64_check" CHECK ("steam_id64" ~ '^[0-9]{17}$')
);
--> statement-breakpoint
ALTER TABLE "app"."players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."rate_limits" (
	"bucket" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."user_links" (
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"user_id" text NOT NULL,
	"username" text,
	"display_name" text,
	"avatar_url" text,
	"source" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_links_provider_external_id_pk" PRIMARY KEY("provider","external_id"),
	CONSTRAINT "user_links_provider_check" CHECK ("provider" in ('discord', 'steam')),
	CONSTRAINT "user_links_source_check" CHECK ("source" in ('discord', 'inhouse', 'steam')),
	CONSTRAINT "user_links_steam_id_check" CHECK ("provider" <> 'steam' or "external_id" ~ '^[0-9]{17}$')
);
--> statement-breakpoint
ALTER TABLE "app"."user_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"nickname" text,
	"photo_url" text,
	"avatar_source" text,
	"avatar_url" text,
	"stream_url" text,
	"platform_role" text,
	"can_create_tournaments" boolean DEFAULT false NOT NULL,
	"notify_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dm_problem" text,
	"is_stub" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_avatar_source_check" CHECK ("avatar_source" in ('google', 'discord', 'steam', 'url')),
	CONSTRAINT "users_platform_role_check" CHECK ("platform_role" in ('admin'))
);
--> statement-breakpoint
ALTER TABLE "app"."users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."organization_members" (
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"added_by" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id"),
	CONSTRAINT "organization_members_role_check" CHECK ("role" in ('owner', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "app"."organization_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"description" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."series" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."series" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."domains" (
	"hostname" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"tournament_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domains_one_target_check" CHECK (num_nonnulls("organization_id", "tournament_id") = 1),
	CONSTRAINT "domains_status_check" CHECK ("status" in ('pending', 'verified', 'failed')),
	CONSTRAINT "domains_hostname_lower_check" CHECK ("hostname" = lower("hostname"))
);
--> statement-breakpoint
ALTER TABLE "app"."domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."groups" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"stage_id" text NOT NULL,
	"name" text NOT NULL,
	"position" smallint NOT NULL,
	"tier" smallint,
	"color" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "groups_position_unique" UNIQUE("tournament_id","stage_id","position")
);
--> statement-breakpoint
ALTER TABLE "app"."groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."stages" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"position" smallint NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"default_best_of" smallint NOT NULL,
	"settings" jsonb NOT NULL,
	"state" jsonb DEFAULT '{"tieDecisions":[]}'::jsonb NOT NULL,
	"ranking" jsonb,
	"advancement" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stages_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "stages_position_unique" UNIQUE("tournament_id","position"),
	CONSTRAINT "stages_kind_check" CHECK ("kind" in ('round_robin', 'swiss', 'bracket')),
	CONSTRAINT "stages_status_check" CHECK ("status" in ('planned', 'active', 'complete')),
	CONSTRAINT "stages_default_best_of_check" CHECK ("default_best_of" in (1, 2, 3, 5, 7)),
	CONSTRAINT "stages_position_check" CHECK ("position" > 0)
);
--> statement-breakpoint
ALTER TABLE "app"."stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."tournament_members" (
	"tournament_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"added_by" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_members_tournament_id_user_id_role_pk" PRIMARY KEY("tournament_id","user_id","role"),
	CONSTRAINT "tournament_members_role_check" CHECK ("role" in ('admin', 'referee', 'caster'))
);
--> statement-breakpoint
ALTER TABLE "app"."tournament_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"series_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"description" text,
	"format_preset" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"visibility" text DEFAULT 'active' NOT NULL,
	"serving" text DEFAULT 'live' NOT NULL,
	"locale" text DEFAULT 'pl' NOT NULL,
	"time_zone" text DEFAULT 'Europe/Warsaw' NOT NULL,
	"league_id" bigint,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"redirect_to_tournament_id" text,
	"preview_token" text,
	"fantasy_preset" text,
	"theme" jsonb NOT NULL,
	"presentation" jsonb NOT NULL,
	"settings" jsonb NOT NULL,
	"features" jsonb NOT NULL,
	"bot_settings" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_format_preset_check" CHECK ("format_preset" in ('league', 'mmr-limited', 'swiss')),
	CONSTRAINT "tournaments_status_check" CHECK ("status" in ('draft', 'registration', 'active', 'completed', 'archived')),
	CONSTRAINT "tournaments_visibility_check" CHECK ("visibility" in ('active', 'inactive', 'archived')),
	CONSTRAINT "tournaments_serving_check" CHECK ("serving" in ('mirror', 'live')),
	CONSTRAINT "tournaments_slug_check" CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
	CONSTRAINT "tournaments_no_self_redirect_check" CHECK ("redirect_to_tournament_id" <> "id")
);
--> statement-breakpoint
ALTER TABLE "app"."tournaments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."captain_change_codes" (
	"tournament_id" text NOT NULL,
	"code" text NOT NULL,
	"team_id" text NOT NULL,
	"previous_captain_user_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"redeemed_by" text,
	"redeemed_at" timestamp with time zone,
	CONSTRAINT "captain_change_codes_tournament_id_code_pk" PRIMARY KEY("tournament_id","code")
);
--> statement-breakpoint
ALTER TABLE "app"."captain_change_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."group_teams" (
	"tournament_id" text NOT NULL,
	"group_id" text NOT NULL,
	"team_id" text NOT NULL,
	"seed" smallint,
	CONSTRAINT "group_teams_tournament_id_group_id_team_id_pk" PRIMARY KEY("tournament_id","group_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "app"."group_teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."standin_registrations" (
	"tournament_id" text NOT NULL,
	"user_id" text NOT NULL,
	"steam_id64" text NOT NULL,
	"nickname" text NOT NULL,
	"discord_username" text,
	"mmr" integer,
	"mmr_proof_url" text,
	"positions" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standin_registrations_tournament_id_user_id_pk" PRIMARY KEY("tournament_id","user_id"),
	CONSTRAINT "standin_registrations_status_check" CHECK ("status" in ('pending', 'verified')),
	CONSTRAINT "standin_registrations_description_check" CHECK (char_length("description") <= 300)
);
--> statement-breakpoint
ALTER TABLE "app"."standin_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."team_members" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"team_id" text NOT NULL,
	"steam_id64" text,
	"kind" text DEFAULT 'player' NOT NULL,
	"position" text,
	"nickname" text NOT NULL,
	"mmr" integer,
	"mmr_proof_url" text,
	"profile_url" text,
	"smurf_accounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"left_reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "team_members_kind_check" CHECK ("kind" in ('player', 'substitute', 'coach')),
	CONSTRAINT "team_members_position_check" CHECK ("position" in ('carry', 'mid', 'offlane', 'soft_support', 'hard_support')),
	CONSTRAINT "team_members_left_reason_check" CHECK ("left_reason" in ('transfer', 'removed', 'captain_change')),
	CONSTRAINT "team_members_steam_check" CHECK ("steam_id64" is not null or "kind" = 'coach')
);
--> statement-breakpoint
ALTER TABLE "app"."team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."teams" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"tag" text,
	"logo_url" text,
	"motto" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"captain_user_id" text,
	"captain_discord" text,
	"seed_mmr" integer,
	"mmr_cap_at_registration" integer,
	"banned_at" timestamp with time zone,
	"banned_by" text,
	"ban_reason" text,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "teams_status_check" CHECK ("status" in ('pending', 'verified', 'rejected', 'warning', 'banned', 'eliminated'))
);
--> statement-breakpoint
ALTER TABLE "app"."teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."games" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"match_id" text NOT NULL,
	"number" smallint NOT NULL,
	"dota_match_id" bigint,
	"radiant_team_id" text,
	"dire_team_id" text,
	"radiant_win" boolean,
	"is_forfeit" boolean DEFAULT false NOT NULL,
	"forfeit_team_id" text,
	"started_at" timestamp with time zone,
	"duration_seconds" integer,
	"first_blood_seconds" integer,
	"picks_bans" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parsed" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"imported_by" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "games_source_check" CHECK ("source" in ('league-sync', 'bot', 'manual', 'opendota-id')),
	CONSTRAINT "games_number_check" CHECK ("number" > 0),
	CONSTRAINT "games_forfeit_check" CHECK ("is_forfeit" = ("dota_match_id" is null))
);
--> statement-breakpoint
ALTER TABLE "app"."games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."ignored_dota_matches" (
	"tournament_id" text NOT NULL,
	"dota_match_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"ignored_by" text,
	"ignored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ignored_dota_matches_tournament_id_dota_match_id_pk" PRIMARY KEY("tournament_id","dota_match_id")
);
--> statement-breakpoint
ALTER TABLE "app"."ignored_dota_matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."match_casters" (
	"tournament_id" text NOT NULL,
	"match_id" text NOT NULL,
	"user_id" text NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_casters_tournament_id_match_id_user_id_pk" PRIMARY KEY("tournament_id","match_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "app"."match_casters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."match_coaches" (
	"tournament_id" text NOT NULL,
	"match_id" text NOT NULL,
	"team_id" text NOT NULL,
	"steam_id64" text,
	"profile_url" text,
	"nickname" text NOT NULL,
	"assigned_by" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_coaches_tournament_id_match_id_team_id_pk" PRIMARY KEY("tournament_id","match_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "app"."match_coaches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."matches" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"stage_id" text NOT NULL,
	"group_id" text,
	"round" smallint NOT NULL,
	"matchday" smallint,
	"kind" text DEFAULT 'regular' NOT NULL,
	"kind_note" text,
	"replaces_match_id" text,
	"tie_ref" text,
	"team_a_id" text,
	"team_b_id" text,
	"best_of" smallint NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"schedule_state" text DEFAULT 'unscheduled' NOT NULL,
	"scheduling_method" text,
	"scheduled_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"reschedule_latest_at" timestamp with time zone,
	"reschedule_max_hours_later" smallint,
	"score_a" smallint,
	"score_b" smallint,
	"winner_team_id" text,
	"completed_at" timestamp with time zone,
	"forfeit_team_id" text,
	"forfeit_scope" text,
	"forfeit_reason" text,
	"bracket_side" text,
	"bracket_position" smallint,
	"code" text,
	"next_winner_match_id" text,
	"next_winner_slot" text,
	"next_loser_match_id" text,
	"next_loser_slot" text,
	"draft_penalties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "matches_kind_check" CHECK ("kind" in ('regular', 'tiebreak', 'rematch', 'showmatch', 'other')),
	CONSTRAINT "matches_status_check" CHECK ("status" in ('scheduled', 'live', 'completed', 'bye', 'void')),
	CONSTRAINT "matches_schedule_state_check" CHECK ("schedule_state" in ('unscheduled', 'proposed', 'confirmed')),
	CONSTRAINT "matches_scheduling_method_check" CHECK ("scheduling_method" in ('captain', 'admin', 'fixed')),
	CONSTRAINT "matches_forfeit_scope_check" CHECK ("forfeit_scope" in ('series', 'games')),
	CONSTRAINT "matches_bracket_side_check" CHECK ("bracket_side" in ('upper', 'lower', 'final', 'wildcard', 'third_place')),
	CONSTRAINT "matches_next_winner_slot_check" CHECK ("next_winner_slot" in ('a', 'b')),
	CONSTRAINT "matches_next_loser_slot_check" CHECK ("next_loser_slot" in ('a', 'b')),
	CONSTRAINT "matches_best_of_check" CHECK ("best_of" in (1, 2, 3, 5, 7)),
	CONSTRAINT "matches_two_teams_check" CHECK ("team_a_id" is null or "team_b_id" is null or "team_a_id" <> "team_b_id"),
	CONSTRAINT "matches_next_winner_pair_check" CHECK (("next_winner_match_id" is null) = ("next_winner_slot" is null)),
	CONSTRAINT "matches_next_loser_pair_check" CHECK (("next_loser_match_id" is null) = ("next_loser_slot" is null)),
	CONSTRAINT "matches_rematch_check" CHECK ("replaces_match_id" is null or "kind" = 'rematch')
);
--> statement-breakpoint
ALTER TABLE "app"."matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."performances" (
	"tournament_id" text NOT NULL,
	"game_id" text NOT NULL,
	"steam_id64" text NOT NULL,
	"player_slot" smallint,
	"team_id" text,
	"hero_id" smallint,
	"kills" smallint DEFAULT 0 NOT NULL,
	"deaths" smallint DEFAULT 0 NOT NULL,
	"assists" smallint DEFAULT 0 NOT NULL,
	"last_hits" smallint DEFAULT 0 NOT NULL,
	"denies" smallint DEFAULT 0 NOT NULL,
	"gpm" smallint DEFAULT 0 NOT NULL,
	"xpm" smallint DEFAULT 0 NOT NULL,
	"net_worth" integer DEFAULT 0 NOT NULL,
	"total_gold" integer DEFAULT 0 NOT NULL,
	"gold_spent" integer DEFAULT 0 NOT NULL,
	"hero_damage" integer DEFAULT 0 NOT NULL,
	"tower_damage" integer DEFAULT 0 NOT NULL,
	"hero_healing" integer DEFAULT 0 NOT NULL,
	"obs_placed" smallint DEFAULT 0 NOT NULL,
	"sen_placed" smallint DEFAULT 0 NOT NULL,
	"observer_kills" smallint DEFAULT 0 NOT NULL,
	"sentry_kills" smallint DEFAULT 0 NOT NULL,
	"courier_kills" smallint DEFAULT 0 NOT NULL,
	"roshan_kills" smallint DEFAULT 0 NOT NULL,
	"tower_kills" smallint DEFAULT 0 NOT NULL,
	"neutral_kills" smallint DEFAULT 0 NOT NULL,
	"lane_kills" smallint DEFAULT 0 NOT NULL,
	"hero_kills" smallint DEFAULT 0 NOT NULL,
	"camps_stacked" smallint DEFAULT 0 NOT NULL,
	"runes_picked_up" smallint DEFAULT 0 NOT NULL,
	"buybacks" smallint DEFAULT 0 NOT NULL,
	"first_blood" boolean DEFAULT false NOT NULL,
	"highest_kill_streak" smallint DEFAULT 0 NOT NULL,
	"double_kills" smallint DEFAULT 0 NOT NULL,
	"triple_kills" smallint DEFAULT 0 NOT NULL,
	"ultra_kills" smallint DEFAULT 0 NOT NULL,
	"rampages" smallint DEFAULT 0 NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "performances_tournament_id_game_id_steam_id64_pk" PRIMARY KEY("tournament_id","game_id","steam_id64"),
	CONSTRAINT "performances_player_slot_check" CHECK ("player_slot" between 0 and 4 or "player_slot" between 128 and 132)
);
--> statement-breakpoint
ALTER TABLE "app"."performances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."reschedule_requests" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"match_id" text NOT NULL,
	"team_id" text NOT NULL,
	"requested_by" text,
	"original_at" timestamp with time zone,
	"proposed_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_by" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reschedule_requests_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "reschedule_requests_status_check" CHECK ("status" in ('pending', 'approved', 'rejected', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "app"."reschedule_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."standin_requests" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"match_id" text NOT NULL,
	"team_id" text NOT NULL,
	"requested_by" text,
	"replaced_member_id" text,
	"replaced_mmr" integer,
	"standin_steam_id64" text,
	"standin_profile_url" text,
	"standin_nickname" text NOT NULL,
	"standin_mmr" integer,
	"standin_registration_user_id" text,
	"game_numbers" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_by" text,
	"responded_at" timestamp with time zone,
	"rejection_reason" text,
	"appealed_at" timestamp with time zone,
	"appeal_resolved_by" text,
	"appeal_resolved_at" timestamp with time zone,
	"appeal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standin_requests_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "standin_requests_status_check" CHECK ("status" in ('pending', 'approved', 'rejected', 'appeal_pending', 'appeal_approved', 'appeal_rejected'))
);
--> statement-breakpoint
ALTER TABLE "app"."standin_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."announcements" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"excerpt" text,
	"image_url" text,
	"tone" text DEFAULT 'info' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_important" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"author_user_id" text,
	"author_name" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcements_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "announcements_tone_check" CHECK ("tone" in ('info', 'success', 'warning'))
);
--> statement-breakpoint
ALTER TABLE "app"."announcements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."fantasy_lineups" (
	"tournament_id" text NOT NULL,
	"round_id" text NOT NULL,
	"user_id" text NOT NULL,
	"position" text NOT NULL,
	"steam_id64" text NOT NULL,
	"team_id" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fantasy_lineups_tournament_id_round_id_user_id_position_pk" PRIMARY KEY("tournament_id","round_id","user_id","position"),
	CONSTRAINT "fantasy_lineups_position_check" CHECK ("position" in ('carry', 'mid', 'offlane', 'soft_support', 'hard_support'))
);
--> statement-breakpoint
ALTER TABLE "app"."fantasy_lineups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."fantasy_rounds" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"position" smallint NOT NULL,
	"lock_at" timestamp with time zone,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fantasy_rounds_tournament_id_id_pk" PRIMARY KEY("tournament_id","id")
);
--> statement-breakpoint
ALTER TABLE "app"."fantasy_rounds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."pickem_picks" (
	"tournament_id" text NOT NULL,
	"user_id" text NOT NULL,
	"predictions" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickem_picks_tournament_id_user_id_pk" PRIMARY KEY("tournament_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "app"."pickem_picks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."prizes" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"details" text,
	"position" smallint NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prizes_tournament_id_id_pk" PRIMARY KEY("tournament_id","id")
);
--> statement-breakpoint
ALTER TABLE "app"."prizes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."rule_paragraphs" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"section_id" text NOT NULL,
	"parent_id" text,
	"position" smallint NOT NULL,
	"body" text NOT NULL,
	"commentary" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_paragraphs_tournament_id_id_pk" PRIMARY KEY("tournament_id","id")
);
--> statement-breakpoint
ALTER TABLE "app"."rule_paragraphs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."rule_sections" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"position" smallint NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_sections_tournament_id_id_pk" PRIMARY KEY("tournament_id","id")
);
--> statement-breakpoint
ALTER TABLE "app"."rule_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."scrim_slots" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"team_id" text NOT NULL,
	"group_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"best_of" smallint NOT NULL,
	"contact" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scrim_slots_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "scrim_slots_status_check" CHECK ("status" in ('active', 'taken', 'cancelled')),
	CONSTRAINT "scrim_slots_time_check" CHECK ("ends_at" >= "starts_at")
);
--> statement-breakpoint
ALTER TABLE "app"."scrim_slots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."card_activity" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_beat_at" timestamp with time zone,
	"day" date,
	"minutes" smallint DEFAULT 0 NOT NULL,
	"finds" timestamp with time zone[] DEFAULT '{}'::timestamptz[] NOT NULL,
	"pending_find" jsonb
);
--> statement-breakpoint
ALTER TABLE "app"."card_activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."card_collections" (
	"tournament_id" text NOT NULL,
	"user_id" text NOT NULL,
	"packs" smallint NOT NULL,
	"packs_opened" integer DEFAULT 0 NOT NULL,
	"cards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deck_slots" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_collections_tournament_id_user_id_pk" PRIMARY KEY("tournament_id","user_id"),
	CONSTRAINT "card_collections_packs_check" CHECK ("packs" >= 0)
);
--> statement-breakpoint
ALTER TABLE "app"."card_collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."card_duel_moves" (
	"tournament_id" text NOT NULL,
	"duel_id" text NOT NULL,
	"seq" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"side" smallint NOT NULL,
	"action" jsonb NOT NULL,
	CONSTRAINT "card_duel_moves_tournament_id_duel_id_seq_pk" PRIMARY KEY("tournament_id","duel_id","seq"),
	CONSTRAINT "card_duel_moves_side_check" CHECK ("side" in (0, 1))
);
--> statement-breakpoint
ALTER TABLE "app"."card_duel_moves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."card_duel_views" (
	"tournament_id" text NOT NULL,
	"duel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"view" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_duel_views_tournament_id_duel_id_user_id_pk" PRIMARY KEY("tournament_id","duel_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "app"."card_duel_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."card_duels" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"pace" text DEFAULT 'normal' NOT NULL,
	"host_user_id" text NOT NULL,
	"guest_user_id" text,
	"invited_user_id" text,
	"side0_user_id" text,
	"side1_user_id" text,
	"people" jsonb NOT NULL,
	"host_seen_at" timestamp with time zone NOT NULL,
	"seat_until" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"game" jsonb,
	"initial_game" jsonb,
	"rated" boolean DEFAULT false NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_duels_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "card_duels_kind_check" CHECK ("kind" in ('open', 'direct')),
	CONSTRAINT "card_duels_status_check" CHECK ("status" in ('open', 'seated', 'play', 'done', 'cancelled', 'expired')),
	CONSTRAINT "card_duels_pace_check" CHECK ("pace" in ('fast', 'normal', 'calm', 'none'))
);
--> statement-breakpoint
ALTER TABLE "app"."card_duels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."card_grants" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"kind" text NOT NULL,
	"round_key" text,
	"label" text,
	"packs" smallint NOT NULL,
	"reason" text,
	"recipient_user_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"recipient_count" integer NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_grants_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "card_grants_kind_check" CHECK ("kind" in ('round', 'admin')),
	CONSTRAINT "card_grants_packs_check" CHECK ("packs" > 0)
);
--> statement-breakpoint
ALTER TABLE "app"."card_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."card_ratings" (
	"tournament_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" smallint DEFAULT 1000 NOT NULL,
	"games" smallint DEFAULT 0 NOT NULL,
	"wins" smallint DEFAULT 0 NOT NULL,
	"losses" smallint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_ratings_tournament_id_user_id_pk" PRIMARY KEY("tournament_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "app"."card_ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."card_reports" (
	"tournament_id" text NOT NULL,
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"url" text,
	"mode" text,
	"duel_id" text,
	"client" jsonb,
	"log" jsonb,
	"context" jsonb,
	"duel_snapshot" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_reports_tournament_id_id_pk" PRIMARY KEY("tournament_id","id"),
	CONSTRAINT "card_reports_status_check" CHECK ("status" in ('new', 'done'))
);
--> statement-breakpoint
ALTER TABLE "app"."card_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."card_reward_rounds" (
	"tournament_id" text NOT NULL,
	"round_key" text NOT NULL,
	"status" text NOT NULL,
	"ready_since" timestamp with time zone,
	"granted_at" timestamp with time zone,
	CONSTRAINT "card_reward_rounds_tournament_id_round_key_pk" PRIMARY KEY("tournament_id","round_key"),
	CONSTRAINT "card_reward_rounds_status_check" CHECK ("status" in ('past', 'ready', 'granted'))
);
--> statement-breakpoint
ALTER TABLE "app"."card_reward_rounds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bot"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_encrypted" "bytea" NOT NULL,
	"guard_secret_encrypted" "bytea",
	"steam_id64" text NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"leased_session_id" text,
	"leased_by_worker" text,
	"lease_heartbeat_at" timestamp with time zone,
	"cooldown_until" timestamp with time zone,
	"last_error" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_status_check" CHECK ("status" in ('idle', 'assigned', 'connecting', 'in_lobby', 'in_game', 'error', 'offline')),
	CONSTRAINT "accounts_steam_id64_check" CHECK ("steam_id64" ~ '^[0-9]{17}$')
);
--> statement-breakpoint
ALTER TABLE "bot"."accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bot"."lobby_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"match_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"request" jsonb NOT NULL,
	"create_lobby_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"state" text DEFAULT 'pending' NOT NULL,
	"worker_id" text,
	"account_id" text,
	"claimed_at" timestamp with time zone,
	"current_game_number" smallint DEFAULT 1 NOT NULL,
	"dota_lobby_id" text,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lobby_sessions_state_check" CHECK ("state" in ('pending', 'claimed', 'lobby_creating', 'lobby_open', 'ready_check', 'requirements_met', 'coin_toss', 'in_game', 'post_game', 'between_games', 'completed', 'cancelled', 'error'))
);
--> statement-breakpoint
ALTER TABLE "bot"."lobby_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bot"."workers" (
	"id" text PRIMARY KEY NOT NULL,
	"host" text,
	"version" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"capacity" smallint NOT NULL,
	"active_sessions" smallint DEFAULT 0 NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bot"."workers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."inbox" ADD CONSTRAINT "inbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_links" ADD CONSTRAINT "user_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."organization_members" ADD CONSTRAINT "organization_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."series" ADD CONSTRAINT "series_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."domains" ADD CONSTRAINT "domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."domains" ADD CONSTRAINT "domains_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."groups" ADD CONSTRAINT "groups_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."groups" ADD CONSTRAINT "groups_stage_fk" FOREIGN KEY ("tournament_id","stage_id") REFERENCES "app"."stages"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stages" ADD CONSTRAINT "stages_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tournament_members" ADD CONSTRAINT "tournament_members_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tournament_members" ADD CONSTRAINT "tournament_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tournament_members" ADD CONSTRAINT "tournament_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tournaments" ADD CONSTRAINT "tournaments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tournaments" ADD CONSTRAINT "tournaments_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "app"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tournaments" ADD CONSTRAINT "tournaments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tournaments" ADD CONSTRAINT "tournaments_redirect_fk" FOREIGN KEY ("redirect_to_tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."captain_change_codes" ADD CONSTRAINT "captain_change_codes_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."captain_change_codes" ADD CONSTRAINT "captain_change_codes_previous_captain_user_id_users_id_fk" FOREIGN KEY ("previous_captain_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."captain_change_codes" ADD CONSTRAINT "captain_change_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."captain_change_codes" ADD CONSTRAINT "captain_change_codes_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."captain_change_codes" ADD CONSTRAINT "captain_change_codes_team_fk" FOREIGN KEY ("tournament_id","team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."group_teams" ADD CONSTRAINT "group_teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."group_teams" ADD CONSTRAINT "group_teams_group_fk" FOREIGN KEY ("tournament_id","group_id") REFERENCES "app"."groups"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."group_teams" ADD CONSTRAINT "group_teams_team_fk" FOREIGN KEY ("tournament_id","team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_registrations" ADD CONSTRAINT "standin_registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_registrations" ADD CONSTRAINT "standin_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_registrations" ADD CONSTRAINT "standin_registrations_steam_id64_players_steam_id64_fk" FOREIGN KEY ("steam_id64") REFERENCES "app"."players"("steam_id64") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."team_members" ADD CONSTRAINT "team_members_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."team_members" ADD CONSTRAINT "team_members_steam_id64_players_steam_id64_fk" FOREIGN KEY ("steam_id64") REFERENCES "app"."players"("steam_id64") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."team_members" ADD CONSTRAINT "team_members_team_fk" FOREIGN KEY ("tournament_id","team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teams" ADD CONSTRAINT "teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teams" ADD CONSTRAINT "teams_captain_user_id_users_id_fk" FOREIGN KEY ("captain_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teams" ADD CONSTRAINT "teams_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."games" ADD CONSTRAINT "games_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."games" ADD CONSTRAINT "games_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."games" ADD CONSTRAINT "games_match_fk" FOREIGN KEY ("tournament_id","match_id") REFERENCES "app"."matches"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."games" ADD CONSTRAINT "games_radiant_team_fk" FOREIGN KEY ("tournament_id","radiant_team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."games" ADD CONSTRAINT "games_dire_team_fk" FOREIGN KEY ("tournament_id","dire_team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."games" ADD CONSTRAINT "games_forfeit_team_fk" FOREIGN KEY ("tournament_id","forfeit_team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ignored_dota_matches" ADD CONSTRAINT "ignored_dota_matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ignored_dota_matches" ADD CONSTRAINT "ignored_dota_matches_ignored_by_users_id_fk" FOREIGN KEY ("ignored_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_casters" ADD CONSTRAINT "match_casters_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_casters" ADD CONSTRAINT "match_casters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_casters" ADD CONSTRAINT "match_casters_match_fk" FOREIGN KEY ("tournament_id","match_id") REFERENCES "app"."matches"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_coaches" ADD CONSTRAINT "match_coaches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_coaches" ADD CONSTRAINT "match_coaches_steam_id64_players_steam_id64_fk" FOREIGN KEY ("steam_id64") REFERENCES "app"."players"("steam_id64") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_coaches" ADD CONSTRAINT "match_coaches_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_coaches" ADD CONSTRAINT "match_coaches_match_fk" FOREIGN KEY ("tournament_id","match_id") REFERENCES "app"."matches"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_coaches" ADD CONSTRAINT "match_coaches_team_fk" FOREIGN KEY ("tournament_id","team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_stage_fk" FOREIGN KEY ("tournament_id","stage_id") REFERENCES "app"."stages"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_group_fk" FOREIGN KEY ("tournament_id","group_id") REFERENCES "app"."groups"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_team_a_fk" FOREIGN KEY ("tournament_id","team_a_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_team_b_fk" FOREIGN KEY ("tournament_id","team_b_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_winner_fk" FOREIGN KEY ("tournament_id","winner_team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_forfeit_team_fk" FOREIGN KEY ("tournament_id","forfeit_team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_replaces_fk" FOREIGN KEY ("tournament_id","replaces_match_id") REFERENCES "app"."matches"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_next_winner_fk" FOREIGN KEY ("tournament_id","next_winner_match_id") REFERENCES "app"."matches"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_next_loser_fk" FOREIGN KEY ("tournament_id","next_loser_match_id") REFERENCES "app"."matches"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."performances" ADD CONSTRAINT "performances_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."performances" ADD CONSTRAINT "performances_steam_id64_players_steam_id64_fk" FOREIGN KEY ("steam_id64") REFERENCES "app"."players"("steam_id64") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."performances" ADD CONSTRAINT "performances_game_fk" FOREIGN KEY ("tournament_id","game_id") REFERENCES "app"."games"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."performances" ADD CONSTRAINT "performances_team_fk" FOREIGN KEY ("tournament_id","team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reschedule_requests" ADD CONSTRAINT "reschedule_requests_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reschedule_requests" ADD CONSTRAINT "reschedule_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reschedule_requests" ADD CONSTRAINT "reschedule_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reschedule_requests" ADD CONSTRAINT "reschedule_requests_match_fk" FOREIGN KEY ("tournament_id","match_id") REFERENCES "app"."matches"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reschedule_requests" ADD CONSTRAINT "reschedule_requests_team_fk" FOREIGN KEY ("tournament_id","team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_requests" ADD CONSTRAINT "standin_requests_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_requests" ADD CONSTRAINT "standin_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_requests" ADD CONSTRAINT "standin_requests_standin_steam_id64_players_steam_id64_fk" FOREIGN KEY ("standin_steam_id64") REFERENCES "app"."players"("steam_id64") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_requests" ADD CONSTRAINT "standin_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_requests" ADD CONSTRAINT "standin_requests_appeal_resolved_by_users_id_fk" FOREIGN KEY ("appeal_resolved_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_requests" ADD CONSTRAINT "standin_requests_match_fk" FOREIGN KEY ("tournament_id","match_id") REFERENCES "app"."matches"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_requests" ADD CONSTRAINT "standin_requests_team_fk" FOREIGN KEY ("tournament_id","team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_requests" ADD CONSTRAINT "standin_requests_member_fk" FOREIGN KEY ("tournament_id","replaced_member_id") REFERENCES "app"."team_members"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standin_requests" ADD CONSTRAINT "standin_requests_registration_fk" FOREIGN KEY ("tournament_id","standin_registration_user_id") REFERENCES "app"."standin_registrations"("tournament_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcements" ADD CONSTRAINT "announcements_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcements" ADD CONSTRAINT "announcements_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fantasy_lineups" ADD CONSTRAINT "fantasy_lineups_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fantasy_lineups" ADD CONSTRAINT "fantasy_lineups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fantasy_lineups" ADD CONSTRAINT "fantasy_lineups_steam_id64_players_steam_id64_fk" FOREIGN KEY ("steam_id64") REFERENCES "app"."players"("steam_id64") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fantasy_lineups" ADD CONSTRAINT "fantasy_lineups_round_fk" FOREIGN KEY ("tournament_id","round_id") REFERENCES "app"."fantasy_rounds"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fantasy_lineups" ADD CONSTRAINT "fantasy_lineups_team_fk" FOREIGN KEY ("tournament_id","team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fantasy_rounds" ADD CONSTRAINT "fantasy_rounds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."pickem_picks" ADD CONSTRAINT "pickem_picks_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."pickem_picks" ADD CONSTRAINT "pickem_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."prizes" ADD CONSTRAINT "prizes_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."rule_paragraphs" ADD CONSTRAINT "rule_paragraphs_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."rule_paragraphs" ADD CONSTRAINT "rule_paragraphs_section_fk" FOREIGN KEY ("tournament_id","section_id") REFERENCES "app"."rule_sections"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."rule_paragraphs" ADD CONSTRAINT "rule_paragraphs_parent_fk" FOREIGN KEY ("tournament_id","parent_id") REFERENCES "app"."rule_paragraphs"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."rule_sections" ADD CONSTRAINT "rule_sections_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."scrim_slots" ADD CONSTRAINT "scrim_slots_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."scrim_slots" ADD CONSTRAINT "scrim_slots_team_fk" FOREIGN KEY ("tournament_id","team_id") REFERENCES "app"."teams"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."scrim_slots" ADD CONSTRAINT "scrim_slots_group_fk" FOREIGN KEY ("tournament_id","group_id") REFERENCES "app"."groups"("tournament_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_activity" ADD CONSTRAINT "card_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_collections" ADD CONSTRAINT "card_collections_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_collections" ADD CONSTRAINT "card_collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duel_moves" ADD CONSTRAINT "card_duel_moves_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duel_moves" ADD CONSTRAINT "card_duel_moves_duel_fk" FOREIGN KEY ("tournament_id","duel_id") REFERENCES "app"."card_duels"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duel_views" ADD CONSTRAINT "card_duel_views_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duel_views" ADD CONSTRAINT "card_duel_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duel_views" ADD CONSTRAINT "card_duel_views_duel_fk" FOREIGN KEY ("tournament_id","duel_id") REFERENCES "app"."card_duels"("tournament_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duels" ADD CONSTRAINT "card_duels_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duels" ADD CONSTRAINT "card_duels_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duels" ADD CONSTRAINT "card_duels_guest_user_id_users_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duels" ADD CONSTRAINT "card_duels_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duels" ADD CONSTRAINT "card_duels_side0_user_id_users_id_fk" FOREIGN KEY ("side0_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_duels" ADD CONSTRAINT "card_duels_side1_user_id_users_id_fk" FOREIGN KEY ("side1_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_grants" ADD CONSTRAINT "card_grants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_grants" ADD CONSTRAINT "card_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_ratings" ADD CONSTRAINT "card_ratings_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_ratings" ADD CONSTRAINT "card_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_reports" ADD CONSTRAINT "card_reports_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_reports" ADD CONSTRAINT "card_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."card_reward_rounds" ADD CONSTRAINT "card_reward_rounds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "app"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot"."accounts" ADD CONSTRAINT "accounts_session_fk" FOREIGN KEY ("leased_session_id") REFERENCES "bot"."lobby_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot"."accounts" ADD CONSTRAINT "accounts_worker_fk" FOREIGN KEY ("leased_by_worker") REFERENCES "bot"."workers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot"."lobby_sessions" ADD CONSTRAINT "lobby_sessions_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "bot"."workers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_tournament_at_idx" ON "app"."audit_log" USING btree ("tournament_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "app"."audit_log" USING btree ("target_kind","target_id");--> statement-breakpoint
CREATE INDEX "inbox_user_created_idx" ON "app"."inbox" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_waiting_dedupe_unique" ON "app"."jobs" USING btree ("dedupe_key") WHERE "status" = 'waiting';--> statement-breakpoint
CREATE INDEX "jobs_waiting_run_at_idx" ON "app"."jobs" USING btree ("run_at") WHERE "status" = 'waiting';--> statement-breakpoint
CREATE INDEX "jobs_tournament_status_idx" ON "app"."jobs" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE INDEX "rate_limits_expires_at_idx" ON "app"."rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_links_user_provider_unique" ON "app"."user_links" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "app"."users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "app"."organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "app"."organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "series_organization_idx" ON "app"."series" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tournament_members_user_idx" ON "app"."tournament_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_slug_unique" ON "app"."tournaments" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_preview_token_unique" ON "app"."tournaments" USING btree ("preview_token");--> statement-breakpoint
CREATE INDEX "tournaments_organization_idx" ON "app"."tournaments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tournaments_status_visibility_idx" ON "app"."tournaments" USING btree ("status","visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "captain_change_codes_code_unique" ON "app"."captain_change_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "captain_change_codes_live_unique" ON "app"."captain_change_codes" USING btree ("tournament_id","team_id") WHERE "redeemed_at" is null;--> statement-breakpoint
CREATE INDEX "group_teams_team_idx" ON "app"."group_teams" USING btree ("tournament_id","team_id");--> statement-breakpoint
CREATE INDEX "standin_registrations_status_mmr_idx" ON "app"."standin_registrations" USING btree ("tournament_id","status","mmr" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_one_roster_unique" ON "app"."team_members" USING btree ("tournament_id","steam_id64") WHERE "left_at" is null and "kind" <> 'coach';--> statement-breakpoint
CREATE INDEX "team_members_team_idx" ON "app"."team_members" USING btree ("tournament_id","team_id");--> statement-breakpoint
CREATE INDEX "team_members_steam_idx" ON "app"."team_members" USING btree ("steam_id64");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_name_unique" ON "app"."teams" USING btree ("tournament_id",lower("name"));--> statement-breakpoint
CREATE INDEX "teams_captain_idx" ON "app"."teams" USING btree ("tournament_id","captain_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "games_match_number_unique" ON "app"."games" USING btree ("tournament_id","match_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "games_dota_match_unique" ON "app"."games" USING btree ("tournament_id","dota_match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_casters_one_main_unique" ON "app"."match_casters" USING btree ("tournament_id","match_id") WHERE "is_main";--> statement-breakpoint
CREATE INDEX "match_casters_user_idx" ON "app"."match_casters" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_replaces_unique" ON "app"."matches" USING btree ("tournament_id","replaces_match_id");--> statement-breakpoint
CREATE INDEX "matches_stage_group_round_idx" ON "app"."matches" USING btree ("tournament_id","stage_id","group_id","round");--> statement-breakpoint
CREATE INDEX "matches_scheduled_idx" ON "app"."matches" USING btree ("tournament_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "matches_team_a_idx" ON "app"."matches" USING btree ("tournament_id","team_a_id");--> statement-breakpoint
CREATE INDEX "matches_team_b_idx" ON "app"."matches" USING btree ("tournament_id","team_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "performances_slot_unique" ON "app"."performances" USING btree ("tournament_id","game_id","player_slot") WHERE "player_slot" is not null;--> statement-breakpoint
CREATE INDEX "performances_player_idx" ON "app"."performances" USING btree ("tournament_id","steam_id64");--> statement-breakpoint
CREATE UNIQUE INDEX "reschedule_requests_one_pending_unique" ON "app"."reschedule_requests" USING btree ("tournament_id","match_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "standin_requests_match_idx" ON "app"."standin_requests" USING btree ("tournament_id","match_id");--> statement-breakpoint
CREATE INDEX "standin_requests_standin_idx" ON "app"."standin_requests" USING btree ("tournament_id","standin_steam_id64");--> statement-breakpoint
CREATE INDEX "announcements_published_idx" ON "app"."announcements" USING btree ("tournament_id","published","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "fantasy_rounds_one_current_unique" ON "app"."fantasy_rounds" USING btree ("tournament_id") WHERE "is_current";--> statement-breakpoint
CREATE INDEX "rule_paragraphs_section_idx" ON "app"."rule_paragraphs" USING btree ("tournament_id","section_id","position");--> statement-breakpoint
CREATE INDEX "scrim_slots_starts_idx" ON "app"."scrim_slots" USING btree ("tournament_id","starts_at");--> statement-breakpoint
CREATE INDEX "card_duels_playing_idx" ON "app"."card_duels" USING btree ("tournament_id","status","updated_at") WHERE "status" = 'play';--> statement-breakpoint
CREATE INDEX "card_duels_host_idx" ON "app"."card_duels" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "card_duels_invited_idx" ON "app"."card_duels" USING btree ("invited_user_id");--> statement-breakpoint
CREATE INDEX "card_duels_side0_idx" ON "app"."card_duels" USING btree ("side0_user_id");--> statement-breakpoint
CREATE INDEX "card_duels_side1_idx" ON "app"."card_duels" USING btree ("side1_user_id");--> statement-breakpoint
CREATE INDEX "card_duels_rated_pair_idx" ON "app"."card_duels" USING btree ("tournament_id","side0_user_id","side1_user_id","updated_at") WHERE "rated";--> statement-breakpoint
CREATE INDEX "card_grants_granted_idx" ON "app"."card_grants" USING btree ("tournament_id","granted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "card_ratings_rating_idx" ON "app"."card_ratings" USING btree ("tournament_id","rating" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "card_reports_status_idx" ON "app"."card_reports" USING btree ("tournament_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_username_unique" ON "bot"."accounts" USING btree ("username");--> statement-breakpoint
CREATE INDEX "accounts_enabled_status_idx" ON "bot"."accounts" USING btree ("enabled","status");--> statement-breakpoint
CREATE UNIQUE INDEX "lobby_sessions_live_match_unique" ON "bot"."lobby_sessions" USING btree ("tournament_id","match_id") WHERE "state" not in ('completed', 'cancelled', 'error');--> statement-breakpoint
CREATE INDEX "lobby_sessions_due_idx" ON "bot"."lobby_sessions" USING btree ("create_lobby_at") WHERE "state" = 'pending' and "cancelled_at" is null;--> statement-breakpoint
CREATE INDEX "workers_heartbeat_idx" ON "bot"."workers" USING btree ("heartbeat_at");
-- Who may use which tables (SCHEMA.md section 1, "Roles and row-level security").
--
-- The role that runs the migrations owns every table, and the web app connects as that role
-- (DATABASE_URL). A table's owner is not subject to its row-level security, so the app reads and
-- writes freely. Every other role is: RLS is enabled on every table in 0000_init, and the only
-- policies are the ones below, for bot_worker. Supabase's anon and authenticated roles therefore
-- see nothing even if a grant slipped through, and the grants are revoked as well.
--
-- bot_worker is created without a password (NOLOGIN). Each environment gives it one by hand:
--   ALTER ROLE bot_worker WITH LOGIN PASSWORD '...';
-- The password is never in git.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bot_worker') THEN
    CREATE ROLE bot_worker NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON SCHEMA app, bot FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA app, bot FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app, bot FROM PUBLIC;
--> statement-breakpoint
-- Supabase's API roles exist only on Supabase; on plain PostgreSQL this does nothing.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA app, bot FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA app, bot FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA app, bot FROM %I', r);
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint
-- The bot: everything in schema bot, and inserting the two job types it reports with.
GRANT USAGE ON SCHEMA bot TO bot_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA bot TO bot_worker;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA bot GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bot_worker;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO bot_worker;
--> statement-breakpoint
GRANT INSERT ON app.jobs TO bot_worker;
--> statement-breakpoint
CREATE POLICY bot_worker_all ON bot.workers FOR ALL TO bot_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY bot_worker_all ON bot.lobby_sessions FOR ALL TO bot_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY bot_worker_all ON bot.accounts FOR ALL TO bot_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
-- The bot reports facts ("game N ended", "team T did not show"); the website decides the rest.
-- It cannot read jobs, so it inserts without RETURNING and deduplicates with a plain
-- ON CONFLICT DO NOTHING (naming a conflict target would need SELECT on that column).
CREATE POLICY bot_worker_insert_reports ON app.jobs FOR INSERT TO bot_worker
  WITH CHECK (type IN ('import-results', 'apply-forfeit') AND status = 'waiting');

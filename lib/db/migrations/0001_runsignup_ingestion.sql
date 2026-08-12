ALTER TABLE runners ADD COLUMN IF NOT EXISTS runsignup_id text;
CREATE UNIQUE INDEX IF NOT EXISTS runners_runsignup_id_unique ON runners (runsignup_id) WHERE runsignup_id IS NOT NULL;

ALTER TABLE races ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE races ADD COLUMN IF NOT EXISTS source_race_id text;
ALTER TABLE races ADD COLUMN IF NOT EXISTS source_event_id text;
ALTER TABLE races ADD COLUMN IF NOT EXISTS source_modified_at timestamp;
ALTER TABLE races ADD COLUMN IF NOT EXISTS distance_label text;
CREATE UNIQUE INDEX IF NOT EXISTS races_source_event_unique ON races (source, source_race_id, source_event_id)
  WHERE source IS NOT NULL AND source_race_id IS NOT NULL AND source_event_id IS NOT NULL;

ALTER TABLE results ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE results ADD COLUMN IF NOT EXISTS source_result_id text;
ALTER TABLE results ADD COLUMN IF NOT EXISTS source_registration_id text;
ALTER TABLE results ADD COLUMN IF NOT EXISTS source_modified_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS results_runner_race_unique ON results (runner_id, race_id);
CREATE UNIQUE INDEX IF NOT EXISTS results_source_result_unique ON results (source, source_result_id)
  WHERE source IS NOT NULL AND source_result_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sync_jobs (
  id serial PRIMARY KEY, source text NOT NULL, organizer_id integer REFERENCES organizers(id) ON DELETE SET NULL, mode text NOT NULL,
  status text NOT NULL DEFAULT 'pending', requested_identifier text,
  discovery_page integer NOT NULL DEFAULT 1, current_race_id text,
  current_event_id text, result_page integer NOT NULL DEFAULT 1,
  checkpoint_timestamp integer, summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb, error text,
  pause_requested_at timestamp, started_at timestamp, finished_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now(), created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_jobs_source_status_idx ON sync_jobs (source, status);

-- Research leads are staff-only. They never grant character/image usage rights.
CREATE TABLE IF NOT EXISTS talent_leads (
 id text PRIMARY KEY,
 profile_url text UNIQUE NOT NULL,
 account_name text NOT NULL,
 platform text NOT NULL CHECK(platform IN ('小红书','抖音')),
 observed_on date NOT NULL,
 payload jsonb NOT NULL,
 verification_status text NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','verified','rejected')),
 rights_status text NOT NULL DEFAULT 'unknown' CHECK(rights_status IN ('unknown','confirmed','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS talent_lead_snapshots (
 id text PRIMARY KEY,
 lead_id text NOT NULL REFERENCES talent_leads(id),
 source_url text NOT NULL,
 source_kind text NOT NULL,
 metric_note text NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE talent_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_lead_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON talent_leads, talent_lead_snapshots FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON talent_leads, talent_lead_snapshots FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON talent_leads, talent_lead_snapshots FROM authenticated;
 END IF;
END $$;

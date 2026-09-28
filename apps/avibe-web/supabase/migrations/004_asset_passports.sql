CREATE TABLE IF NOT EXISTS asset_passports (
 id text PRIMARY KEY, serial bigserial UNIQUE NOT NULL,
 character_id text UNIQUE REFERENCES characters(id), lead_id text UNIQUE REFERENCES talent_leads(id),
 registered_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((character_id IS NOT NULL)::int + (lead_id IS NOT NULL)::int = 1)
);
CREATE TABLE IF NOT EXISTS passport_evidence (
 id text PRIMARY KEY, passport_id text NOT NULL REFERENCES asset_passports(id),
 uploader_id text NOT NULL REFERENCES users(id), filename text NOT NULL,
 storage_key text UNIQUE NOT NULL, mime text NOT NULL, bytes integer NOT NULL, sha256 text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS passport_claims (
 id text PRIMARY KEY, passport_id text NOT NULL REFERENCES asset_passports(id),
 submitter_id text NOT NULL REFERENCES users(id), kind text NOT NULL,
 identity_version integer NOT NULL CHECK(identity_version>0), look_id text REFERENCES looks(id),
 title text NOT NULL, declarant text NOT NULL, private_notes text NOT NULL,
 public_summary text NOT NULL, claimed_created_at date,
 valid_from timestamptz, valid_until timestamptz,
 evidence_ids jsonb NOT NULL, status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','rejected','revoked')),
 revision integer NOT NULL DEFAULT 1, reviewed_by text REFERENCES users(id), review_note text,
 submitted_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 CHECK(valid_until IS NULL OR valid_from IS NULL OR valid_until>valid_from)
);
CREATE TABLE IF NOT EXISTS passport_events (
 id text PRIMARY KEY, passport_id text NOT NULL REFERENCES asset_passports(id),
 actor_id text NOT NULL REFERENCES users(id), event text NOT NULL,
 payload jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_claims_subject ON passport_claims(passport_id,identity_version);
ALTER TABLE asset_passports ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON asset_passports,passport_evidence,passport_claims,passport_events FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON asset_passports,passport_evidence,passport_claims,passport_events FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON asset_passports,passport_evidence,passport_claims,passport_events FROM authenticated;
 END IF;
END $$;

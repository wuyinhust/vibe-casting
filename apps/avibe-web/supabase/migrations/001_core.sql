CREATE TABLE IF NOT EXISTS users (
 id text PRIMARY KEY, email text UNIQUE NOT NULL, role text NOT NULL DEFAULT 'creator' CHECK(role IN ('creator','staff','admin')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS api_tokens (id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),token_hash text UNIQUE NOT NULL,name text NOT NULL,scopes jsonb NOT NULL DEFAULT '["read","download"]',revoked_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS characters (
 id text PRIMARY KEY, owner_id text REFERENCES users(id), identity_version integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'private' CHECK(status IN ('private','pending','published','rejected')), name jsonb NOT NULL, age integer NOT NULL CHECK(age BETWEEN 1 AND 110), gender text NOT NULL CHECK(gender IN ('woman','man','nonbinary')), style text NOT NULL DEFAULT 'realistic', personality jsonb NOT NULL, background jsonb NOT NULL, anchors jsonb NOT NULL DEFAULT '{}', tags jsonb NOT NULL DEFAULT '[]', cover text NOT NULL DEFAULT '', sprite_index integer, license text NOT NULL DEFAULT 'negotiation' CHECK(license IN ('commercial','noncommercial','negotiation')), commercial boolean NOT NULL DEFAULT false, brand_collaboration boolean NOT NULL DEFAULT false, license_text jsonb NOT NULL DEFAULT '{}', demo boolean NOT NULL DEFAULT false, embedding jsonb, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS looks (
 id text PRIMARY KEY, character_id text NOT NULL REFERENCES characters(id), owner_id text REFERENCES users(id), visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','pending','published')), identity_version integer NOT NULL DEFAULT 1, version integer NOT NULL DEFAULT 1, name jsonb NOT NULL, description jsonb NOT NULL, state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','preview','ready')), source_look_id text REFERENCES looks(id), garment_ids jsonb NOT NULL DEFAULT '[]', inferred_back boolean NOT NULL DEFAULT false, approved_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assets (
 id text PRIMARY KEY, owner_id text REFERENCES users(id), character_id text REFERENCES characters(id), look_id text REFERENCES looks(id), role text NOT NULL CHECK(role IN ('identity','front','back','side','sheet','showcase','garment','chat')), storage_key text UNIQUE NOT NULL, mime text NOT NULL, sha256 text NOT NULL, width integer NOT NULL, height integer NOT NULL, bytes integer NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS packages (
 id text PRIMARY KEY, character_id text NOT NULL REFERENCES characters(id), identity_version integer NOT NULL, look_id text NOT NULL REFERENCES looks(id), look_version integer NOT NULL, manifest jsonb NOT NULL, license_snapshot jsonb NOT NULL, files jsonb NOT NULL, state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','withdrawn')), created_at timestamptz DEFAULT now(), UNIQUE(look_id,look_version)
);
CREATE TABLE IF NOT EXISTS grants (id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),character_id text NOT NULL REFERENCES characters(id),purpose text NOT NULL CHECK(purpose IN ('personal','commercial','brand')),expires_at timestamptz,created_at timestamptz DEFAULT now(), UNIQUE(user_id,character_id,purpose));
CREATE TABLE IF NOT EXISTS likes (user_id text REFERENCES users(id), character_id text REFERENCES characters(id),PRIMARY KEY(user_id,character_id));
CREATE TABLE IF NOT EXISTS boards (id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),name text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS board_entries (id text PRIMARY KEY,board_id text REFERENCES boards(id) ON DELETE CASCADE,character_id text REFERENCES characters(id),look_id text REFERENCES looks(id),package_id text REFERENCES packages(id),role_name text NOT NULL DEFAULT '',created_at timestamptz DEFAULT now(),UNIQUE(board_id,character_id,look_id));
CREATE TABLE IF NOT EXISTS wallets (user_id text PRIMARY KEY REFERENCES users(id),balance integer NOT NULL DEFAULT 0 CHECK(balance>=0),held integer NOT NULL DEFAULT 0 CHECK(held>=0 AND held<=balance));
CREATE TABLE IF NOT EXISTS credit_ledger (id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),event_key text UNIQUE NOT NULL,kind text NOT NULL,amount integer NOT NULL,description text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS pricing (kind text PRIMARY KEY,credits integer NOT NULL CHECK(credits>0),version integer NOT NULL DEFAULT 1,active boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS plans (id text PRIMARY KEY,name text NOT NULL,amount_fen integer NOT NULL CHECK(amount_fen>0),credits integer NOT NULL CHECK(credits>0),active boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS generation_jobs (
 id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),idempotency_key text NOT NULL,kind text NOT NULL CHECK(kind IN ('candidates','views','showcase','tryon','complete-look','redo')),status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','review','succeeded','failed','cancelled')), input jsonb NOT NULL,output jsonb NOT NULL DEFAULT '{}',quote integer NOT NULL,price_version integer NOT NULL,credits_settled boolean NOT NULL DEFAULT false,queue_dispatched boolean NOT NULL DEFAULT false,error text,usage jsonb NOT NULL DEFAULT '{}',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(user_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS payment_orders (id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),provider text NOT NULL CHECK(provider IN ('wechat','alipay')),amount_fen integer NOT NULL,credits integer NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','closed','refund_pending','refunded')),provider_transaction text UNIQUE,checkout jsonb,created_at timestamptz DEFAULT now(),paid_at timestamptz);
CREATE TABLE IF NOT EXISTS payment_events (id text PRIMARY KEY,provider text NOT NULL,payload_hash text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS conversations (id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),character_id text REFERENCES characters(id),look_id text REFERENCES looks(id),assigned_to text REFERENCES users(id),status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','negotiating','won','closed')),created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS messages (id text PRIMARY KEY,conversation_id text NOT NULL REFERENCES conversations(id),sender_id text NOT NULL REFERENCES users(id),body text NOT NULL DEFAULT '',asset_id text REFERENCES assets(id),client_id text NOT NULL,internal boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(conversation_id,sender_id,client_id));
CREATE TABLE IF NOT EXISTS conversation_reads (conversation_id text REFERENCES conversations(id),user_id text REFERENCES users(id),read_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(conversation_id,user_id));
CREATE TABLE IF NOT EXISTS events (id text PRIMARY KEY,user_id text REFERENCES users(id),name text NOT NULL,data jsonb NOT NULL DEFAULT '{}',created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY,count integer NOT NULL,expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS characters_public ON characters(status,age,gender);
CREATE INDEX IF NOT EXISTS looks_character ON looks(character_id);
CREATE INDEX IF NOT EXISTS assets_look ON assets(look_id);
CREATE INDEX IF NOT EXISTS messages_history ON messages(conversation_id,created_at,id);
CREATE INDEX IF NOT EXISTS jobs_owner ON generation_jobs(user_id,created_at);
CREATE INDEX IF NOT EXISTS payments_pending ON payment_orders(status,created_at);

CREATE TABLE IF NOT EXISTS identity_versions (character_id text REFERENCES characters(id),version integer NOT NULL CHECK(version>0),snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(character_id,version));
INSERT INTO pricing(kind,credits,active) VALUES ('candidates',8,false),('views',24,false),('showcase',8,false),('tryon',10,false),('complete-look',18,false),('redo',8,false) ON CONFLICT DO NOTHING;

ALTER TABLE identity_versions ADD COLUMN IF NOT EXISTS showcase_asset_id text REFERENCES assets(id);
ALTER TABLE looks ADD COLUMN IF NOT EXISTS search_tags jsonb NOT NULL DEFAULT '[]';

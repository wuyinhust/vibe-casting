-- Run only in the dedicated Supabase project, after 001_core.sql.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE OR REPLACE FUNCTION public.avibe_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid()::text AND role IN ('staff','admin'));
$$;
REVOKE ALL ON FUNCTION public.avibe_is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avibe_is_staff() TO authenticated;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['identity_versions','users','sessions','api_tokens','characters','looks','assets','packages','grants','likes','boards','board_entries','wallets','credit_ledger','pricing','plans','generation_jobs','payment_orders','payment_events','conversations','messages','conversation_reads','events','rate_limits'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
 END LOOP;
END $$;

-- Browser access is deliberately read-only and limited to authorized chat records.
-- All writes and all image/package access go through the server-side API.
GRANT SELECT ON public.conversations, public.messages TO authenticated;
CREATE POLICY conversations_read ON public.conversations FOR SELECT TO authenticated
 USING(user_id=auth.uid()::text OR public.avibe_is_staff());
CREATE POLICY messages_read ON public.messages FOR SELECT TO authenticated
 USING((NOT internal OR public.avibe_is_staff()) AND EXISTS(SELECT 1 FROM public.conversations c WHERE c.id=conversation_id AND (c.user_id=auth.uid()::text OR public.avibe_is_staff())));

CREATE POLICY avibe_conversation_broadcast_read ON realtime.messages FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.conversations c WHERE 'conversation:'||c.id=realtime.topic() AND (c.user_id=auth.uid()::text OR public.avibe_is_staff())));
CREATE OR REPLACE FUNCTION public.avibe_notify_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT NEW.internal THEN
  PERFORM realtime.send(jsonb_build_object('id',NEW.id),'message','conversation:'||NEW.conversation_id,true);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER avibe_message_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.avibe_notify_message();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('avibe-private','avibe-private',false,20971520,ARRAY['image/png','image/jpeg','image/webp'])
 ON CONFLICT(id) DO UPDATE SET public=false;
-- No browser storage policies are granted. The API streams authorized bytes.


CREATE TABLE public.publishers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publisher_id text NOT NULL,
  name text,
  tier text CHECK (tier IN ('A','B','C','D')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, publisher_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publishers TO authenticated;
GRANT ALL ON public.publishers TO service_role;
ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own publishers" ON public.publishers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_publishers_updated_at BEFORE UPDATE ON public.publishers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.publisher_daily_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publisher_uuid uuid NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  note_date date NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publisher_uuid, note_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publisher_daily_notes TO authenticated;
GRANT ALL ON public.publisher_daily_notes TO service_role;
ALTER TABLE public.publisher_daily_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own publisher notes" ON public.publisher_daily_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_publisher_notes_updated_at BEFORE UPDATE ON public.publisher_daily_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX publisher_daily_notes_date_idx ON public.publisher_daily_notes (user_id, note_date DESC);

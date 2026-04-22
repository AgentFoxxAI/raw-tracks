
-- PROFILES TABLE (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  email TEXT,
  avatar_url TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','paid')),
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- OFFCUTS TABLE
CREATE TABLE public.offcuts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds NUMERIC,
  instrument_tag TEXT NOT NULL DEFAULT 'other',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  license_type TEXT NOT NULL DEFAULT 'collaborate' CHECK (license_type IN ('collaborate','free_to_use','private')),
  waveform_data JSONB,
  play_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.offcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public offcuts are viewable by everyone"
  ON public.offcuts FOR SELECT USING (visibility = 'public' OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own offcuts"
  ON public.offcuts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own offcuts"
  ON public.offcuts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own offcuts"
  ON public.offcuts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_offcuts_created_at ON public.offcuts(created_at DESC);
CREATE INDEX idx_offcuts_user_id ON public.offcuts(user_id);
CREATE INDEX idx_offcuts_instrument ON public.offcuts(instrument_tag);

-- STACKS TABLE
CREATE TABLE public.stacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_offcut_id UUID NOT NULL REFERENCES public.offcuts(id) ON DELETE CASCADE,
  child_offcut_id UUID NOT NULL REFERENCES public.offcuts(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_offcut_id, child_offcut_id)
);

ALTER TABLE public.stacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stacks are viewable by everyone"
  ON public.stacks FOR SELECT USING (true);

CREATE POLICY "Users can create stacks"
  ON public.stacks FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own stacks"
  ON public.stacks FOR DELETE USING (auth.uid() = created_by_user_id);

CREATE INDEX idx_stacks_parent ON public.stacks(parent_offcut_id);
CREATE INDEX idx_stacks_child ON public.stacks(child_offcut_id);

-- INTERACTIONS TABLE
CREATE TABLE public.interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offcut_id UUID NOT NULL REFERENCES public.offcuts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('comment','rating','suggestion')),
  content TEXT,
  timestamp_ref NUMERIC,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interactions are viewable by everyone"
  ON public.interactions FOR SELECT USING (true);

CREATE POLICY "Users can create their own interactions"
  ON public.interactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions"
  ON public.interactions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions"
  ON public.interactions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_interactions_offcut ON public.interactions(offcut_id);

-- DOWNLOADS TABLE
CREATE TABLE public.downloads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offcut_id UUID NOT NULL REFERENCES public.offcuts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('mp3','wav')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own downloads"
  ON public.downloads FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own downloads"
  ON public.downloads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- TIMESTAMP UPDATE TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- INCREMENT PLAY COUNT FUNCTION
CREATE OR REPLACE FUNCTION public.increment_play_count(offcut_id_input UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.offcuts SET play_count = play_count + 1 WHERE id = offcut_id_input;
END;
$$;

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- AUDIO BUCKET POLICIES
CREATE POLICY "Audio files are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'audio');

CREATE POLICY "Authenticated users can upload audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own audio"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own audio"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- AVATAR BUCKET POLICIES
CREATE POLICY "Avatars are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

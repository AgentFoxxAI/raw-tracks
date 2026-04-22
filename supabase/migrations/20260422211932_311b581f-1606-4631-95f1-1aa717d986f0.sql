
-- =========================================================
-- 1. RENAME offcuts -> posts and extend
-- =========================================================
ALTER TABLE public.offcuts RENAME TO posts;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'audio',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS quote_of_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill media_url from existing audio_url
UPDATE public.posts SET media_url = audio_url WHERE media_url IS NULL;

-- Make media_url required going forward
ALTER TABLE public.posts ALTER COLUMN media_url SET NOT NULL;

-- Constrain media_type and visibility
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_media_type_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_media_type_check CHECK (media_type IN ('audio','video'));

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_visibility_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_visibility_check
  CHECK (visibility IN ('private','public','followers','collaborators'));

-- Drop and recreate RLS policies under new table name
DROP POLICY IF EXISTS "Public offcuts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own offcuts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert their own offcuts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own offcuts" ON public.posts;

CREATE POLICY "Posts viewable when public or owned"
  ON public.posts FOR SELECT
  USING (visibility = 'public' OR auth.uid() = user_id);

CREATE POLICY "Users insert their own posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own posts"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger on posts
DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. PROFILES — add social/identity fields
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS instruments text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS influences text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS collab_status text NOT NULL DEFAULT 'closed',
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_collab_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_collab_status_check
  CHECK (collab_status IN ('open','selective','closed'));

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3. FOLLOWS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are public"
  ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users follow as themselves"
  ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users unfollow themselves"
  ON public.follows FOR DELETE USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows(following_id);

-- Counter triggers
CREATE OR REPLACE FUNCTION public.handle_follow_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE public.profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    UPDATE public.profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS follows_after_insert ON public.follows;
CREATE TRIGGER follows_after_insert
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.handle_follow_change();

DROP TRIGGER IF EXISTS follows_after_delete ON public.follows;
CREATE TRIGGER follows_after_delete
  AFTER DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.handle_follow_change();

-- =========================================================
-- 4. LIKES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes are public" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users like as themselves" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike themselves" ON public.likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS likes_post_idx ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS likes_user_idx ON public.likes(user_id);

-- =========================================================
-- 5. COMMENTS (X-style nested replies)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are public" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users create their own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS comments_post_idx ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON public.comments(parent_comment_id);

DROP TRIGGER IF EXISTS comments_set_updated_at ON public.comments;
CREATE TRIGGER comments_set_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 6. REPOSTS (with optional quote text)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  quote_text text CHECK (quote_text IS NULL OR length(quote_text) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reposts are public" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "Users repost as themselves" ON public.reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own reposts" ON public.reposts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS reposts_post_idx ON public.reposts(post_id);
CREATE INDEX IF NOT EXISTS reposts_user_idx ON public.reposts(user_id);

-- =========================================================
-- 7. SAVES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own saves" ON public.saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users save as themselves" ON public.saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own saves" ON public.saves FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS saves_user_idx ON public.saves(user_id);

-- =========================================================
-- 8. handle_new_user — also seed display_name
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, username, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$function$;

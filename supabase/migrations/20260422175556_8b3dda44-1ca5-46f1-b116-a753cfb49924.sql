
-- Drop overly broad public SELECT policies and replace with owner-folder listing.
-- Files are still loadable via direct public URL because the buckets are marked public,
-- so audio playback and avatar display continue to work for everyone.
DROP POLICY IF EXISTS "Audio files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

CREATE POLICY "Users can list their own audio folder"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can list their own avatar folder"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

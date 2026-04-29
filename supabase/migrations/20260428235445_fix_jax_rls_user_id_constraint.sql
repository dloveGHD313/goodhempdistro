-- Fix: constrain user_id to only be the authenticated caller's ID or NULL
-- Drop the existing permissive insert policy
drop policy if exists "Anyone can submit jax feature application"
  on public.jax_feature_applications;

-- Recreate with proper user_id constraint
create policy "Anyone can submit jax feature application"
  on public.jax_feature_applications
  for insert
  to anon, authenticated
  with check (
    -- user_id must be either null (guest) or match the authenticated caller
    user_id is null
    or user_id = auth.uid()
  );

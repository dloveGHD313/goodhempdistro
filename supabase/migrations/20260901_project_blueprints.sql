-- Blueprint/plan uploads on project submissions + private storage bucket.

alter table public.project_submissions
  add column if not exists blueprint_object_path text,
  add column if not exists blueprint_filename text;

-- Private bucket; only service_role reads/writes (uploads go through the
-- server action, admin views via short-lived signed URLs).
insert into storage.buckets (id, name, public)
values ('project-blueprints', 'project-blueprints', false)
on conflict (id) do nothing;

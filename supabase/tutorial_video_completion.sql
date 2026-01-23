create table if not exists public.tutorial_video_completion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_slug text not null,
  video_id text not null,
  is_completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, topic_slug, video_id)
);

alter table public.tutorial_video_completion enable row level security;

create policy "VA can read their tutorial completion"
on public.tutorial_video_completion
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from profiles
    where profiles.id = auth.uid()
      and profiles.role = 'va'
  )
);

create policy "VA can insert their tutorial completion"
on public.tutorial_video_completion
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from profiles
    where profiles.id = auth.uid()
      and profiles.role = 'va'
  )
);

create policy "VA can update their tutorial completion"
on public.tutorial_video_completion
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from profiles
    where profiles.id = auth.uid()
      and profiles.role = 'va'
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from profiles
    where profiles.id = auth.uid()
      and profiles.role = 'va'
  )
);

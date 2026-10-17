-- Conversations table for grouping chat sessions
-- Run this migration in your Supabase project

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists conversations_user_id_idx on public.conversations (user_id);
create index if not exists conversations_user_created_idx on public.conversations (user_id, created_at desc);

-- Row Level Security
alter table public.conversations enable row level security;

-- Policies: users can only manage their own conversations
create policy conversations_select_own
  on public.conversations
  for select
  using (auth.uid() = user_id);

create policy conversations_insert_own
  on public.conversations
  for insert
  with check (auth.uid() = user_id);

create policy conversations_update_own
  on public.conversations
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy conversations_delete_own
  on public.conversations
  for delete
  using (auth.uid() = user_id);

-- Optional: if you want to enforce unique titles per user, uncomment:
-- create unique index if not exists conversations_user_title_unique
--   on public.conversations (user_id, title) where title is not null;
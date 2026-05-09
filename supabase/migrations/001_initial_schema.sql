-- Cortex MVP schema baseline (Agent D)
-- Scope intentionally limited to immediate integration tables:
-- profiles, app_shortcuts, file_activity, ai_conversations, ai_messages, user_settings

create extension if not exists pgcrypto;

-- Keep updated_at current without relying on client code.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic trigger function to update updated_at timestamps.';

-- User profile and shell-level preferences.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'America/Chicago',
  pin_hash text,
  theme text not null default 'dark-neon',
  idle_lock_minutes integer not null default 5 check (idle_lock_minutes between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user with desktop shell profile settings.';
comment on column public.profiles.pin_hash is
  'Hashed PIN for quick unlock; never store plaintext PIN values.';

create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Pinned and organized app launcher entries.
create table if not exists public.app_shortcuts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  app_name text not null,
  exe_path text not null,
  icon_path text,
  category text not null default 'general',
  position integer not null default 0 check (position >= 0),
  is_pinned boolean not null default false,
  launch_count integer not null default 0 check (launch_count >= 0),
  last_launched timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_shortcuts is
  'User-scoped app launcher metadata and pin state.';

create index if not exists idx_app_shortcuts_user_id
  on public.app_shortcuts(user_id);
create index if not exists idx_app_shortcuts_user_position
  on public.app_shortcuts(user_id, position);
create unique index if not exists uq_app_shortcuts_user_exe_path
  on public.app_shortcuts(user_id, exe_path);

create trigger trg_app_shortcuts_set_updated_at
before update on public.app_shortcuts
for each row
execute function public.set_updated_at();

-- File organizer audit trail to support preview/undo and history UI.
create table if not exists public.file_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text,
  original_path text,
  new_path text,
  action text not null check (action in ('moved', 'categorized', 'cleaned', 'restored')),
  created_at timestamptz not null default now()
);

comment on table public.file_activity is
  'Immutable log of file organizer actions for user history and undo flows.';

create index if not exists idx_file_activity_user_created_at
  on public.file_activity(user_id, created_at desc);

-- Root record for AI chat sessions.
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_conversations is
  'User-owned conversation threads for persistent assistant context.';

create index if not exists idx_ai_conversations_user_id
  on public.ai_conversations(user_id);
create index if not exists idx_ai_conversations_user_updated_at
  on public.ai_conversations(user_id, updated_at desc);

create trigger trg_ai_conversations_set_updated_at
before update on public.ai_conversations
for each row
execute function public.set_updated_at();

-- Individual messages within a conversation.
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

comment on table public.ai_messages is
  'Message history rows tied to ai_conversations.';
comment on column public.ai_messages.tool_calls is
  'Serialized tool call metadata captured for assistant/tool messages.';

create index if not exists idx_ai_messages_conversation_created_at
  on public.ai_messages(conversation_id, created_at asc);

-- User-scoped configuration for module defaults.
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_auto_sort boolean not null default true,
  email_summary_frequency text not null default 'hourly',
  file_auto_organize boolean not null default true,
  file_scan_paths text[] not null default array['Desktop', 'Downloads']::text[],
  news_sources text[] not null default array['hackernews', 'techcrunch']::text[],
  ai_personality text not null default 'concise',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email_summary_frequency in ('off', 'hourly', 'daily')),
  check (ai_personality in ('concise', 'detailed', 'casual'))
);

comment on table public.user_settings is
  'Per-user module defaults and AI behavior preferences.';

create trigger trg_user_settings_set_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

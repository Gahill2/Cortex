-- Cortex MVP RLS baseline (Agent D)
-- Principle: deny by default, allow only authenticated owner access.

-- Enable RLS on all MVP tables.
alter table public.profiles enable row level security;
alter table public.app_shortcuts enable row level security;
alter table public.file_activity enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.user_settings enable row level security;

-- Enforce RLS for all access paths, including table owners.
alter table public.profiles force row level security;
alter table public.app_shortcuts force row level security;
alter table public.file_activity force row level security;
alter table public.ai_conversations force row level security;
alter table public.ai_messages force row level security;
alter table public.user_settings force row level security;

-- Remove broad grants and re-grant minimum required for app roles.
revoke all on public.profiles from anon, authenticated;
revoke all on public.app_shortcuts from anon, authenticated;
revoke all on public.file_activity from anon, authenticated;
revoke all on public.ai_conversations from anon, authenticated;
revoke all on public.ai_messages from anon, authenticated;
revoke all on public.user_settings from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.app_shortcuts to authenticated;
grant select, insert on public.file_activity to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.ai_messages to authenticated;
grant select, insert, update on public.user_settings to authenticated;

-- Profiles: users can access only their own profile row.
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- App shortcuts: full CRUD constrained to owner.
create policy app_shortcuts_select_own
on public.app_shortcuts
for select
to authenticated
using (auth.uid() = user_id);

create policy app_shortcuts_insert_own
on public.app_shortcuts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy app_shortcuts_update_own
on public.app_shortcuts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy app_shortcuts_delete_own
on public.app_shortcuts
for delete
to authenticated
using (auth.uid() = user_id);

-- File activity: append-only audit log scoped to owner.
create policy file_activity_select_own
on public.file_activity
for select
to authenticated
using (auth.uid() = user_id);

create policy file_activity_insert_own
on public.file_activity
for insert
to authenticated
with check (auth.uid() = user_id);

-- Conversations: full CRUD on user-owned threads.
create policy ai_conversations_select_own
on public.ai_conversations
for select
to authenticated
using (auth.uid() = user_id);

create policy ai_conversations_insert_own
on public.ai_conversations
for insert
to authenticated
with check (auth.uid() = user_id);

create policy ai_conversations_update_own
on public.ai_conversations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy ai_conversations_delete_own
on public.ai_conversations
for delete
to authenticated
using (auth.uid() = user_id);

-- Messages: access only when parent conversation belongs to current user.
create policy ai_messages_select_own
on public.ai_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy ai_messages_insert_own
on public.ai_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy ai_messages_update_own
on public.ai_messages
for update
to authenticated
using (
  exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy ai_messages_delete_own
on public.ai_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

-- User settings: one row per user, owned by auth.uid().
create policy user_settings_select_own
on public.user_settings
for select
to authenticated
using (auth.uid() = user_id);

create policy user_settings_insert_own
on public.user_settings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy user_settings_update_own
on public.user_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

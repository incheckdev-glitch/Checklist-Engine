-- InCheck 360 AI Checklist Engine
-- Run with: supabase db push

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180),
  description text not null default '',
  industry text not null default '',
  purpose text not null default '',
  assigned_role text not null default '',
  frequency text not null default 'As needed',
  estimated_minutes integer not null default 10 check (estimated_minutes between 1 and 1440),
  scoring_enabled boolean not null default true,
  status text not null default 'draft' check (status in ('draft','under_review','published','archived')),
  current_version integer not null default 0 check (current_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_sections (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  instructions text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  section_id uuid not null references public.checklist_sections(id) on delete cascade,
  type text not null check (type in (
    'checkmark','yes_no','signature','staff_member','multiple_choice','video','picture',
    'qr','barcode','measurement','rating_1_5','rating_1_10','rating_custom','formula',
    'date_time','date','time','stopwatch','long_entry','short_entry','instructions','title','sub_checklist'
  )),
  label text not null check (char_length(label) between 1 and 500),
  description text not null default '',
  required boolean not null default false,
  weight numeric(8,2) not null default 0 check (weight >= 0),
  critical boolean not null default false,
  allow_na boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  config jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb check (jsonb_typeof(conditions) = 'array'),
  corrective_action jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_versions (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  change_notes text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz not null default now(),
  unique(checklist_id, version_number)
);

create table if not exists public.ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_summary text not null default '',
  model text not null default '',
  status text not null check (status in ('success','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists checklists_owner_idx on public.checklists(owner_id, updated_at desc);
create index if not exists checklist_sections_checklist_idx on public.checklist_sections(checklist_id, sort_order);
create index if not exists checklist_items_checklist_idx on public.checklist_items(checklist_id, section_id, sort_order);
create index if not exists checklist_versions_checklist_idx on public.checklist_versions(checklist_id, version_number desc);
create index if not exists ai_generation_logs_user_idx on public.ai_generation_logs(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists checklists_set_updated_at on public.checklists;
create trigger checklists_set_updated_at before update on public.checklists for each row execute function public.set_updated_at();
drop trigger if exists checklist_sections_set_updated_at on public.checklist_sections;
create trigger checklist_sections_set_updated_at before update on public.checklist_sections for each row execute function public.set_updated_at();
drop trigger if exists checklist_items_set_updated_at on public.checklist_items;
create trigger checklist_items_set_updated_at before update on public.checklist_items for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_sections enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_versions enable row level security;
alter table public.ai_generation_logs enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Checklists
create policy "checklists_select_own" on public.checklists for select using (owner_id = auth.uid());
create policy "checklists_insert_own" on public.checklists for insert with check (owner_id = auth.uid());
create policy "checklists_update_own" on public.checklists for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "checklists_delete_own" on public.checklists for delete using (owner_id = auth.uid());

-- Sections inherit ownership from their checklist.
create policy "sections_select_own" on public.checklist_sections for select using (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
);
create policy "sections_insert_own" on public.checklist_sections for insert with check (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
);
create policy "sections_update_own" on public.checklist_sections for update using (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
) with check (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
);
create policy "sections_delete_own" on public.checklist_sections for delete using (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
);

-- Items inherit ownership from their checklist.
create policy "items_select_own" on public.checklist_items for select using (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
);
create policy "items_insert_own" on public.checklist_items for insert with check (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
  and exists (select 1 from public.checklist_sections s where s.id = section_id and s.checklist_id = checklist_id)
);
create policy "items_update_own" on public.checklist_items for update using (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
) with check (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
  and exists (select 1 from public.checklist_sections s where s.id = section_id and s.checklist_id = checklist_id)
);
create policy "items_delete_own" on public.checklist_items for delete using (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
);

create policy "versions_select_own" on public.checklist_versions for select using (
  exists (select 1 from public.checklists c where c.id = checklist_id and c.owner_id = auth.uid())
);

create policy "generation_logs_select_own" on public.ai_generation_logs for select using (user_id = auth.uid());
create policy "generation_logs_insert_own" on public.ai_generation_logs for insert with check (user_id = auth.uid());

create or replace function public.publish_checklist(
  p_checklist_id uuid,
  p_change_notes text default ''
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_next_version integer;
  v_snapshot jsonb;
begin
  select owner_id, current_version + 1
    into v_owner, v_next_version
  from public.checklists
  where id = p_checklist_id
  for update;

  if v_owner is null then
    raise exception 'Checklist not found.';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'You do not have permission to publish this checklist.';
  end if;

  select jsonb_build_object(
    'checklist', to_jsonb(c) - 'owner_id',
    'sections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'instructions', s.instructions,
          'sort_order', s.sort_order,
          'items', coalesce((
            select jsonb_agg(to_jsonb(i) - 'checklist_id' - 'created_at' - 'updated_at' order by i.sort_order)
            from public.checklist_items i
            where i.section_id = s.id
          ), '[]'::jsonb)
        ) order by s.sort_order
      )
      from public.checklist_sections s
      where s.checklist_id = c.id
    ), '[]'::jsonb)
  )
  into v_snapshot
  from public.checklists c
  where c.id = p_checklist_id;

  insert into public.checklist_versions(checklist_id, version_number, snapshot, change_notes, created_by)
  values (p_checklist_id, v_next_version, v_snapshot, coalesce(p_change_notes, ''), auth.uid());

  update public.checklists
  set current_version = v_next_version,
      status = 'published',
      updated_at = now()
  where id = p_checklist_id;

  return v_next_version;
end;
$$;

revoke all on function public.publish_checklist(uuid, text) from public;
grant execute on function public.publish_checklist(uuid, text) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.checklists to authenticated;
grant select, insert, update, delete on public.checklist_sections to authenticated;
grant select, insert, update, delete on public.checklist_items to authenticated;
grant select on public.checklist_versions to authenticated;
grant select, insert on public.ai_generation_logs to authenticated;

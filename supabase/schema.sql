-- ================================================================
-- English for professionals — схема базы данных
-- ----------------------------------------------------------------
-- Выполните этот файл целиком в Supabase: SQL Editor → New query.
-- Скрипт можно запускать повторно, он не ломает существующие данные.
-- ================================================================

-- ---------------------------------------------------------------
-- 1. Таблицы
-- ---------------------------------------------------------------

-- Профиль пользователя. Создаётся автоматически при регистрации.
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'student' check (role in ('student', 'teacher')),
  created_at  timestamptz not null default now()
);

-- Учебные группы преподавателя.
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Состав групп.
create table if not exists public.group_members (
  group_id    uuid not null references public.groups(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (group_id, student_id)
);

-- Прогресс по теме: одна строка на пару «пользователь + тема».
-- state хранит ответы студента, чтобы восстановить их при возврате в тему.
create table if not exists public.topic_progress (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  topic_key      text not null,                        -- 'medical/anatomy/1'
  course_key     text not null,                        -- 'medical'
  subcourse_key  text not null,                        -- 'anatomy'
  percent        int  not null default 0 check (percent between 0 and 100),
  state          jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  primary key (user_id, topic_key)
);

create index if not exists topic_progress_user_idx on public.topic_progress (user_id);
create index if not exists group_members_student_idx on public.group_members (student_id);
create index if not exists groups_teacher_idx on public.groups (teacher_id);
create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------
-- 2. Автосоздание профиля при регистрации
-- ---------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    case
      when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher'
      else 'student'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- 3. Вспомогательные функции
-- ---------------------------------------------------------------
-- security definer — чтобы проверка роли не упиралась в собственные
-- же правила доступа к таблице profiles (иначе получится рекурсия).

create or replace function public.is_teacher()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

-- Преподаватель ведёт студента, если тот состоит хотя бы в одной его группе.
create or replace function public.teaches_student(sid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.student_id = sid and g.teacher_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------
-- 4. Разграничение доступа (Row Level Security)
-- ---------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.topic_progress enable row level security;

-- ---- profiles ----
drop policy if exists "profiles: свой профиль виден"        on public.profiles;
drop policy if exists "profiles: преподаватель видит всех"  on public.profiles;
drop policy if exists "profiles: свой профиль изменяем"     on public.profiles;
drop policy if exists "profiles: свой профиль создаём"      on public.profiles;

create policy "profiles: свой профиль виден"
  on public.profiles for select
  using (id = auth.uid());

-- Нужно для поиска студентов преподавателем.
create policy "profiles: преподаватель видит всех"
  on public.profiles for select
  using (public.is_teacher());

create policy "profiles: свой профиль создаём"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles: свой профиль изменяем"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---- groups ----
drop policy if exists "groups: преподаватель распоряжается своими" on public.groups;
drop policy if exists "groups: студент видит свои"                 on public.groups;

create policy "groups: преподаватель распоряжается своими"
  on public.groups for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "groups: студент видит свои"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id and gm.student_id = auth.uid()
    )
  );

-- ---- group_members ----
drop policy if exists "участники: преподаватель управляет составом" on public.group_members;
drop policy if exists "участники: студент видит своё участие"        on public.group_members;

create policy "участники: преподаватель управляет составом"
  on public.group_members for all
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.teacher_id = auth.uid()
    )
  );

create policy "участники: студент видит своё участие"
  on public.group_members for select
  using (student_id = auth.uid());

-- ---- topic_progress ----
drop policy if exists "прогресс: свой доступен полностью"      on public.topic_progress;
drop policy if exists "прогресс: преподаватель видит студентов" on public.topic_progress;

create policy "прогресс: свой доступен полностью"
  on public.topic_progress for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "прогресс: преподаватель видит студентов"
  on public.topic_progress for select
  using (public.teaches_student(user_id));

-- ---------------------------------------------------------------
-- 5. Отметка времени последнего изменения прогресса
-- ---------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists topic_progress_touch on public.topic_progress;
create trigger topic_progress_touch
  before update on public.topic_progress
  for each row execute function public.touch_updated_at();

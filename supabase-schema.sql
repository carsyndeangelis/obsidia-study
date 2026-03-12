-- ═══════════════════════════════════════════════════
-- Obsidia Study — Supabase Database Schema
-- Run this in your Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  display_name text default 'Student',
  avatar_url text,
  grade_level text default '11th Grade',
  created_at timestamptz default now(),
  -- Stats
  total_sessions integer default 0,
  total_xp integer default 0,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_active_date date default current_date,
  level integer default 1,
  -- Preferences
  ai_response_style text default 'Balanced',
  auto_humanizer boolean default true,
  sound_effects boolean default true,
  streak_reminders boolean default true,
  theme text default 'dark',
  test_prep_mode text default 'None',
  focus_subjects text default 'All Subjects',
  daily_goal integer default 5,
  weekly_xp_target integer default 1000,
  onboarding_complete boolean default false
);

-- 2. Chat sessions table (tracks each AI conversation)
create table public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  page text not null,
  title text,
  message_count integer default 1,
  xp_earned integer default 0,
  created_at timestamptz default now()
);

-- 3. Achievements table
create table public.achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  achievement_id text not null,
  earned_at timestamptz default now(),
  unique(user_id, achievement_id)
);

-- 4. Indexes for performance
create index idx_sessions_user on public.chat_sessions(user_id, created_at desc);
create index idx_achievements_user on public.achievements(user_id);

-- 5. Row Level Security — users can only see/edit their own data
alter table public.profiles enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.achievements enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can view own sessions"
  on public.chat_sessions for select using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.chat_sessions for insert with check (auth.uid() = user_id);

create policy "Users can view own achievements"
  on public.achievements for select using (auth.uid() = user_id);

create policy "Users can insert own achievements"
  on public.achievements for insert with check (auth.uid() = user_id);

-- 6. Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Function to record a session and update stats
create or replace function public.record_session(
  p_page text,
  p_title text default null,
  p_message_count integer default 1
)
returns json as $$
declare
  v_xp integer;
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_last_active date;
  v_streak integer;
  v_level integer;
begin
  -- Calculate XP (base 10 + 3 per message, max 50)
  v_xp := least(10 + (p_message_count * 3), 50);

  -- Insert session
  insert into public.chat_sessions (user_id, page, title, message_count, xp_earned)
  values (v_user_id, p_page, p_title, p_message_count, v_xp);

  -- Get current streak info
  select last_active_date, current_streak into v_last_active, v_streak
  from public.profiles where id = v_user_id;

  -- Update streak
  if v_last_active = v_today then
    -- Same day, no streak change
    null;
  elsif v_last_active = v_today - 1 then
    -- Consecutive day, increment streak
    v_streak := v_streak + 1;
  else
    -- Streak broken, reset to 1
    v_streak := 1;
  end if;

  -- Calculate level (every 500 XP = 1 level)
  select total_xp + v_xp into v_level from public.profiles where id = v_user_id;
  v_level := greatest(1, v_level / 500 + 1);

  -- Update profile
  update public.profiles set
    total_sessions = total_sessions + 1,
    total_xp = total_xp + v_xp,
    current_streak = v_streak,
    longest_streak = greatest(longest_streak, v_streak),
    last_active_date = v_today,
    level = v_level
  where id = v_user_id;

  return json_build_object(
    'xp_earned', v_xp,
    'new_streak', v_streak,
    'new_level', v_level
  );
end;
$$ language plpgsql security definer;

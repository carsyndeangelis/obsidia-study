-- ═══════════════════════════════════════════════════
-- Obsidia Study v6.3 — Schema Additions
-- Run AFTER the original supabase-schema.sql
-- ═══════════════════════════════════════════════════

-- 1. Add role column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'student';

-- 2. Classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  subject text DEFAULT 'General',
  join_code text UNIQUE NOT NULL,
  max_students integer DEFAULT 40,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Class members
CREATE TABLE IF NOT EXISTS public.class_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(class_id, user_id)
);

-- 4. Assignments
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  tool text NOT NULL DEFAULT 'general',
  prompt text,
  due_date timestamptz,
  xp_reward integer DEFAULT 25,
  created_at timestamptz DEFAULT now()
);

-- 5. Assignment submissions
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES public.chat_sessions(id),
  status text DEFAULT 'pending',
  submitted_at timestamptz,
  grade text,
  feedback text,
  UNIQUE(assignment_id, user_id)
);

-- 6. Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tier text NOT NULL DEFAULT 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  seats integer DEFAULT 1,
  status text DEFAULT 'active',
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 7. Usage tracking for tier limits
CREATE TABLE IF NOT EXISTS public.daily_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date date DEFAULT CURRENT_DATE,
  session_count integer DEFAULT 0,
  UNIQUE(user_id, date)
);

-- RLS policies
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own classes
CREATE POLICY "Teachers manage own classes" ON public.classes
  FOR ALL USING (auth.uid() = teacher_id);

-- Students can view classes they're in
CREATE POLICY "Students view joined classes" ON public.classes
  FOR SELECT USING (id IN (SELECT class_id FROM public.class_members WHERE user_id = auth.uid()));

-- Class members policies
CREATE POLICY "View own memberships" ON public.class_members
  FOR SELECT USING (user_id = auth.uid() OR class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid()));

CREATE POLICY "Join classes" ON public.class_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Teachers manage assignments
CREATE POLICY "Teachers manage assignments" ON public.assignments
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Students view class assignments" ON public.assignments
  FOR SELECT USING (class_id IN (SELECT class_id FROM public.class_members WHERE user_id = auth.uid()));

-- Submissions
CREATE POLICY "Students manage own submissions" ON public.submissions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Teachers view class submissions" ON public.submissions
  FOR SELECT USING (assignment_id IN (SELECT id FROM public.assignments WHERE teacher_id = auth.uid()));

-- Subscriptions
CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR ALL USING (user_id = auth.uid());

-- Daily usage
CREATE POLICY "Users manage own usage" ON public.daily_usage
  FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_members_class ON public.class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_user ON public.class_members(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON public.assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON public.daily_usage(user_id, date);

-- Helper function: generate unique 6-char join code
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text AS $$
DECLARE
  code text;
  exists boolean;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.classes WHERE join_code = code) INTO exists;
    IF NOT exists THEN RETURN code; END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Helper: increment daily usage and check limits
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(p_user_id uuid, p_limit integer DEFAULT 5)
RETURNS json AS $$
DECLARE
  v_count integer;
  v_today date := CURRENT_DATE;
BEGIN
  INSERT INTO public.daily_usage (user_id, date, session_count)
  VALUES (p_user_id, v_today, 1)
  ON CONFLICT (user_id, date) DO UPDATE SET session_count = daily_usage.session_count + 1
  RETURNING session_count INTO v_count;

  RETURN json_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'limit', p_limit,
    'remaining', GREATEST(0, p_limit - v_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

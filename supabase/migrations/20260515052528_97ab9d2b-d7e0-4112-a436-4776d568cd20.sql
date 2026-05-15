-- Hired AI employees per user
CREATE TABLE public.user_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  description TEXT,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  salary NUMERIC NOT NULL DEFAULT 0,
  avatar_emoji TEXT DEFAULT '🤖',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | paused
  current_task TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own employees select" ON public.user_employees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own employees insert" ON public.user_employees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own employees update" ON public.user_employees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own employees delete" ON public.user_employees FOR DELETE USING (auth.uid() = user_id);

-- Permissions granted per employee
CREATE TABLE public.employee_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.user_employees(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL, -- google_maps | gmail | calendar
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, permission_key)
);

ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own perms select" ON public.employee_permissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own perms insert" ON public.employee_permissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own perms update" ON public.employee_permissions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own perms delete" ON public.employee_permissions FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_user_employees_updated
BEFORE UPDATE ON public.user_employees
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.employee_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_emp_chat_msgs_employee ON public.employee_chat_messages(employee_id, created_at);

ALTER TABLE public.employee_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own chat select" ON public.employee_chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own chat insert" ON public.employee_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own chat delete" ON public.employee_chat_messages FOR DELETE USING (auth.uid() = user_id);
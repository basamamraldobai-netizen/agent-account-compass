CREATE TABLE public.receipt_allocations (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  source_id text NOT NULL,
  shares jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_allocations TO authenticated;
GRANT ALL ON public.receipt_allocations TO service_role;
ALTER TABLE public.receipt_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.receipt_allocations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
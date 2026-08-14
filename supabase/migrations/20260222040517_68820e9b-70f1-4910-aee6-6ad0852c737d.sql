
-- Add price_on_enquiry and car_parks columns to properties
ALTER TABLE public.properties 
  ADD COLUMN IF NOT EXISTS price_on_enquiry boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS car_parks integer DEFAULT 0;

-- Create property_private_notes table
CREATE TABLE IF NOT EXISTS public.property_private_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.profiles(id),
  owner_bottom_price numeric,
  reason_for_selling text,
  owner_urgency text,
  private_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.property_private_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own private notes"
  ON public.property_private_notes FOR ALL
  USING (auth.uid() = agent_id)
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Admin access private notes"
  ON public.property_private_notes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create property_price_history table
CREATE TABLE IF NOT EXISTS public.property_price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  old_price numeric,
  new_price numeric,
  change_pct numeric,
  changed_at timestamptz DEFAULT now(),
  changed_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.property_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents see own property price history"
  ON public.property_price_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = property_price_history.property_id 
      AND properties.agent_id = auth.uid()
    )
  );

CREATE POLICY "Admin access price history"
  ON public.property_price_history FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at on property_private_notes
CREATE TRIGGER set_private_notes_updated_at
  BEFORE UPDATE ON public.property_private_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

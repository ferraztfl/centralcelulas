CREATE TABLE public.neighborhood_adjacencies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  neighborhood_a text NOT NULL,
  neighborhood_b text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- normalize: store both lowercased, and enforce a < b to prevent duplicates
CREATE OR REPLACE FUNCTION public.normalize_adjacency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  a text;
  b text;
BEGIN
  a := lower(btrim(NEW.neighborhood_a));
  b := lower(btrim(NEW.neighborhood_b));
  IF a = '' OR b = '' OR a = b THEN
    RAISE EXCEPTION 'Bairros inválidos';
  END IF;
  IF a < b THEN
    NEW.neighborhood_a := a;
    NEW.neighborhood_b := b;
  ELSE
    NEW.neighborhood_a := b;
    NEW.neighborhood_b := a;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_adjacency
BEFORE INSERT OR UPDATE ON public.neighborhood_adjacencies
FOR EACH ROW EXECUTE FUNCTION public.normalize_adjacency();

CREATE UNIQUE INDEX neighborhood_adjacencies_pair_uniq
  ON public.neighborhood_adjacencies (neighborhood_a, neighborhood_b);

GRANT SELECT ON public.neighborhood_adjacencies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.neighborhood_adjacencies TO authenticated;
GRANT ALL ON public.neighborhood_adjacencies TO service_role;

ALTER TABLE public.neighborhood_adjacencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads adjacencies" ON public.neighborhood_adjacencies
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins insert adjacencies" ON public.neighborhood_adjacencies
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update adjacencies" ON public.neighborhood_adjacencies
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete adjacencies" ON public.neighborhood_adjacencies
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
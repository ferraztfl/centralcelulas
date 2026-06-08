
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ NETWORKS ============
CREATE TABLE public.networks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,           -- hex
  color_name TEXT NOT NULL,
  min_age INT,                   -- NULL = sem mínimo
  max_age INT,                   -- NULL = sem máximo
  is_couples BOOLEAN NOT NULL DEFAULT FALSE,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  is_kids BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.networks TO anon, authenticated;
GRANT ALL ON public.networks TO service_role;
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads networks" ON public.networks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage networks" ON public.networks
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.networks (id, name, color, color_name, min_age, max_age, is_couples, is_fallback, is_kids, sort_order) VALUES
  ('decolar',    'Rede Decolar',    '#2563eb', 'Azul',     0,   11,  FALSE, FALSE, TRUE,  1),
  ('start',      'Rede Start',      '#16a34a', 'Verde',    12,  18,  FALSE, FALSE, FALSE, 2),
  ('connect',    'Rede Connect',    '#eab308', 'Amarelo',  18,  25,  FALSE, FALSE, FALSE, 3),
  ('connect_up', 'Rede Connect Up', '#7c4a1e', 'Marrom',   26,  NULL,FALSE, FALSE, FALSE, 4),
  ('acelere',    'Rede Acelere',    '#f97316', 'Laranja',  NULL,NULL,FALSE, TRUE,  FALSE, 5),
  ('impulse',    'Rede Impulse',    '#9333ea', 'Roxo',     NULL,NULL,FALSE, TRUE,  FALSE, 6),
  ('amor_a2',    'Rede Amor A2',    '#dc2626', 'Vermelho', NULL,NULL,TRUE,  FALSE, FALSE, 7);

-- ============ CELLS ============
CREATE TYPE public.cell_gender AS ENUM ('masculina','feminina','mista');

CREATE TABLE public.cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  network_id TEXT NOT NULL REFERENCES public.networks(id),
  gender cell_gender NOT NULL DEFAULT 'mista',
  address TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  leader_name TEXT NOT NULL,
  leader_whatsapp TEXT NOT NULL,
  leader_instagram TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cells TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cells TO authenticated;
GRANT ALL ON public.cells TO service_role;
ALTER TABLE public.cells ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads cells" ON public.cells FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert cells" ON public.cells FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update cells" ON public.cells FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete cells" ON public.cells FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_cells_updated BEFORE UPDATE ON public.cells
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ APP SETTINGS (key/value) ============
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- Public read so the map widget can fetch the maps key client-side
CREATE POLICY "Anyone reads settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins write settings" ON public.app_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value) VALUES ('google_maps_api_key', '');

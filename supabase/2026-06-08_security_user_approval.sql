-- ================================================================
-- IACÉLULAS — Blindagem de usuários, aprovação de acesso e RLS
-- Rode este arquivo UMA VEZ no Supabase > SQL Editor.
-- ================================================================

-- 1) Profiles: status de aprovação
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_access_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_access_status_check
      CHECK (access_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- 2) Quem já é admin hoje continua aprovado.
UPDATE public.profiles
SET access_status = 'approved',
    approved_at = COALESCE(approved_at, now())
WHERE id IN (
  SELECT user_id
  FROM public.user_roles
  WHERE role = 'admin'
);

-- 3) Se por algum motivo não houver admin aprovado, promove o perfil mais antigo.
DO $$
DECLARE
  first_profile_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin'
      AND p.access_status = 'approved'
  ) THEN
    SELECT id INTO first_profile_id
    FROM public.profiles
    ORDER BY created_at ASC
    LIMIT 1;

    IF first_profile_id IS NOT NULL THEN
      UPDATE public.profiles
      SET access_status = 'approved',
          approved_at = COALESCE(approved_at, now())
      WHERE id = first_profile_id;

      INSERT INTO public.user_roles (user_id, role)
      VALUES (first_profile_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
END $$;

-- 4) Trigger de novo usuário:
--    - primeiro usuário do sistema: approved + admin
--    - demais usuários: pending e sem role admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  ) INTO has_admin;

  IF NOT has_admin THEN
    INSERT INTO public.profiles (
      id,
      display_name,
      access_status,
      approved_at
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
      'approved',
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
        access_status = 'approved',
        approved_at = COALESCE(public.profiles.approved_at, now());

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.profiles (
      id,
      display_name,
      access_status
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
      'pending'
    )
    ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5) Proteção de grants diretos
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.app_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.cells FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cells TO authenticated;
GRANT ALL ON public.cells TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.neighborhood_adjacencies FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.neighborhood_adjacencies TO authenticated;
GRANT ALL ON public.neighborhood_adjacencies TO service_role;

-- 6) RLS obrigatório
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhood_adjacencies ENABLE ROW LEVEL SECURITY;

-- 7) Policies seguras para profiles
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 8) Policies seguras para user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 9) Policies de cells: apenas admin autenticado gerencia.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cells' AND policyname='Admins read cells') THEN
    CREATE POLICY "Admins read cells" ON public.cells
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cells' AND policyname='Admins insert cells') THEN
    CREATE POLICY "Admins insert cells" ON public.cells
      FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cells' AND policyname='Admins update cells') THEN
    CREATE POLICY "Admins update cells" ON public.cells
      FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cells' AND policyname='Admins delete cells') THEN
    CREATE POLICY "Admins delete cells" ON public.cells
      FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- 10) Policies de networks: leitura pública, escrita só admin.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='networks' AND policyname='Anyone reads networks') THEN
    CREATE POLICY "Anyone reads networks" ON public.networks
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='networks' AND policyname='Admins manage networks') THEN
    CREATE POLICY "Admins manage networks" ON public.networks
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- 11) Policies de app_settings: admin apenas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='Admins read settings') THEN
    CREATE POLICY "Admins read settings" ON public.app_settings
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='Admins write settings') THEN
    CREATE POLICY "Admins write settings" ON public.app_settings
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- 12) Policies de bairros vizinhos: leitura pública, escrita só admin.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='neighborhood_adjacencies' AND policyname='Anyone reads adjacencies') THEN
    CREATE POLICY "Anyone reads adjacencies" ON public.neighborhood_adjacencies
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='neighborhood_adjacencies' AND policyname='Admins insert adjacencies') THEN
    CREATE POLICY "Admins insert adjacencies" ON public.neighborhood_adjacencies
      FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='neighborhood_adjacencies' AND policyname='Admins delete adjacencies') THEN
    CREATE POLICY "Admins delete adjacencies" ON public.neighborhood_adjacencies
      FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- 13) Confirmação rápida
SELECT 'security_user_approval_applied' AS status;

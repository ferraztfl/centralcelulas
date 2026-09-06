BEGIN;

-- ================================================================
-- CENTRAL DE CÉLULAS
-- Hardening de autenticação, autorização e dados sensíveis
-- ================================================================

-- ------------------------------------------------
-- Helpers de autorização usados pelas policies RLS
-- ------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_approved_member(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _user_id
        AND p.access_status = 'approved'
    )
    AND
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role IN (
          'admin'::public.app_role,
          'user'::public.app_role
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _user_id
        AND p.access_status = 'approved'
    )
    AND
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = 'admin'::public.app_role
    );
$$;

REVOKE ALL ON FUNCTION public.is_approved_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_approved_admin(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_approved_member(UUID)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_approved_admin(UUID)
  TO authenticated, service_role;


-- ------------------------------------------------
-- Administrador inicial único
-- ------------------------------------------------

-- Retira função ADMIN de qualquer outra conta.
DELETE FROM public.user_roles ur
USING auth.users u
WHERE ur.user_id = u.id
  AND ur.role = 'admin'::public.app_role
  AND lower(COALESCE(u.email, '')) <> 'thiagoferrazdm@gmail.com';

-- Garante aprovação do administrador principal, se a conta existir.
UPDATE public.profiles p
SET
  access_status = 'approved',
  approved_at = COALESCE(p.approved_at, now()),
  rejected_at = NULL,
  rejected_by = NULL
FROM auth.users u
WHERE p.id = u.id
  AND lower(COALESCE(u.email, '')) = 'thiagoferrazdm@gmail.com';

-- Remove eventual role de consulta duplicada do administrador.
DELETE FROM public.user_roles ur
USING auth.users u
WHERE ur.user_id = u.id
  AND ur.role = 'user'::public.app_role
  AND lower(COALESCE(u.email, '')) = 'thiagoferrazdm@gmail.com';

-- Garante a role ADMIN do administrador principal.
INSERT INTO public.user_roles (user_id, role)
SELECT
  id,
  'admin'::public.app_role
FROM auth.users
WHERE lower(COALESCE(email, '')) = 'thiagoferrazdm@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;


-- ------------------------------------------------
-- Novas contas sempre começam PENDENTES
-- Ninguém vira admin automaticamente.
-- ------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    access_status
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.email
    ),
    'pending'
  )
  ON CONFLICT (id) DO UPDATE
  SET display_name =
    COALESCE(EXCLUDED.display_name, public.profiles.display_name);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ================================================================
-- CELLS
-- Dados de endereço, líder e telefone NÃO podem ser públicos.
-- Consulta comum ocorre somente pelo server function protegido.
-- Acesso direto à tabela fica restrito a ADMIN aprovado.
-- ================================================================

ALTER TABLE public.cells ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cells FROM anon;

REVOKE INSERT, UPDATE, DELETE
ON public.cells
FROM authenticated;

GRANT SELECT
ON public.cells
TO authenticated;

GRANT INSERT, UPDATE, DELETE
ON public.cells
TO authenticated;

GRANT ALL
ON public.cells
TO service_role;

DROP POLICY IF EXISTS "Anyone reads cells" ON public.cells;
DROP POLICY IF EXISTS "Admins read cells" ON public.cells;
DROP POLICY IF EXISTS "Approved admins read cells" ON public.cells;
DROP POLICY IF EXISTS "Admins insert cells" ON public.cells;
DROP POLICY IF EXISTS "Admins update cells" ON public.cells;
DROP POLICY IF EXISTS "Admins delete cells" ON public.cells;

CREATE POLICY "Approved admins read cells"
ON public.cells
FOR SELECT
TO authenticated
USING (
  public.is_approved_admin(auth.uid())
);

CREATE POLICY "Approved admins insert cells"
ON public.cells
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_approved_admin(auth.uid())
);

CREATE POLICY "Approved admins update cells"
ON public.cells
FOR UPDATE
TO authenticated
USING (
  public.is_approved_admin(auth.uid())
)
WITH CHECK (
  public.is_approved_admin(auth.uid())
);

CREATE POLICY "Approved admins delete cells"
ON public.cells
FOR DELETE
TO authenticated
USING (
  public.is_approved_admin(auth.uid())
);


-- ================================================================
-- PROFILES
-- ================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE
ON public.profiles
FROM anon, authenticated;

GRANT SELECT
ON public.profiles
TO authenticated;

GRANT ALL
ON public.profiles
TO service_role;

DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Approved admins can read all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
);

CREATE POLICY "Approved admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_approved_admin(auth.uid())
);


-- ================================================================
-- USER ROLES
-- ================================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE
ON public.user_roles
FROM anon, authenticated;

GRANT SELECT
ON public.user_roles
TO authenticated;

GRANT ALL
ON public.user_roles
TO service_role;

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Approved admins can view all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

CREATE POLICY "Approved admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.is_approved_admin(auth.uid())
);


-- ================================================================
-- APP SETTINGS
-- Nunca disponibilizar configurações internas ao visitante anônimo.
-- ================================================================

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.app_settings
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.app_settings
TO authenticated;

GRANT ALL
ON public.app_settings
TO service_role;

DROP POLICY IF EXISTS "Anyone reads settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins write settings" ON public.app_settings;
DROP POLICY IF EXISTS "Approved admins read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Approved admins write settings" ON public.app_settings;

CREATE POLICY "Approved admins read settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  public.is_approved_admin(auth.uid())
);

CREATE POLICY "Approved admins write settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (
  public.is_approved_admin(auth.uid())
)
WITH CHECK (
  public.is_approved_admin(auth.uid())
);


-- ================================================================
-- NEIGHBORHOOD ADJACENCIES
-- Informações internas do mecanismo de recomendação.
-- ================================================================

ALTER TABLE public.neighborhood_adjacencies ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.neighborhood_adjacencies
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.neighborhood_adjacencies
TO authenticated;

GRANT ALL
ON public.neighborhood_adjacencies
TO service_role;

DROP POLICY IF EXISTS "Anyone reads adjacencies"
ON public.neighborhood_adjacencies;

DROP POLICY IF EXISTS "Admins insert adjacencies"
ON public.neighborhood_adjacencies;

DROP POLICY IF EXISTS "Admins delete adjacencies"
ON public.neighborhood_adjacencies;

DROP POLICY IF EXISTS "Approved admins manage adjacencies"
ON public.neighborhood_adjacencies;

CREATE POLICY "Approved admins manage adjacencies"
ON public.neighborhood_adjacencies
FOR ALL
TO authenticated
USING (
  public.is_approved_admin(auth.uid())
)
WITH CHECK (
  public.is_approved_admin(auth.uid())
);


-- ================================================================
-- NETWORKS
-- Dados institucionais não sensíveis podem continuar públicos,
-- mas alterações exigem ADMIN aprovado.
-- ================================================================

DROP POLICY IF EXISTS "Admins manage networks"
ON public.networks;

DROP POLICY IF EXISTS "Approved admins manage networks"
ON public.networks;

CREATE POLICY "Approved admins manage networks"
ON public.networks
FOR ALL
TO authenticated
USING (
  public.is_approved_admin(auth.uid())
)
WITH CHECK (
  public.is_approved_admin(auth.uid())
);

COMMIT;


-- Diagnóstico final.
SELECT
  u.email,
  p.access_status,
  COALESCE(
    string_agg(ur.role::text, ', ' ORDER BY ur.role::text),
    'sem role'
  ) AS roles
FROM auth.users u
LEFT JOIN public.profiles p
  ON p.id = u.id
LEFT JOIN public.user_roles ur
  ON ur.user_id = u.id
GROUP BY
  u.id,
  u.email,
  p.access_status
ORDER BY
  u.email;

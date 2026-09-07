BEGIN;

-- ================================================================
-- CENTRAL DE CÉLULAS
-- Limpeza definitiva de policies antigas de escrita em user_roles
-- ================================================================

DROP POLICY IF EXISTS "Admins insert roles"
ON public.user_roles;

DROP POLICY IF EXISTS "Admins update roles"
ON public.user_roles;

DROP POLICY IF EXISTS "Admins delete roles"
ON public.user_roles;

DROP POLICY IF EXISTS "Admins manage roles"
ON public.user_roles;

DROP POLICY IF EXISTS "Users insert roles"
ON public.user_roles;

DROP POLICY IF EXISTS "Users update roles"
ON public.user_roles;

DROP POLICY IF EXISTS "Users delete roles"
ON public.user_roles;

-- Usuários autenticados só podem consultar roles.
REVOKE INSERT, UPDATE, DELETE
ON public.user_roles
FROM anon, authenticated;

GRANT SELECT
ON public.user_roles
TO authenticated;

-- Backend administrativo continua podendo alterar roles.
GRANT ALL
ON public.user_roles
TO service_role;

COMMIT;

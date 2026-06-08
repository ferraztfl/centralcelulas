-- ================================================================
-- MIGRATION: is_active toggle + segundo líder (leader2)
-- Execute no Supabase → SQL Editor
-- ================================================================

-- 1) Campo is_active (ativo/inativo na busca pública)
ALTER TABLE public.cells
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.cells.is_active IS 'TRUE = aparece na busca pública; FALSE = oculta';

-- 2) Segundo líder (co-liderança)
ALTER TABLE public.cells
  ADD COLUMN IF NOT EXISTS leader2_name TEXT,
  ADD COLUMN IF NOT EXISTS leader2_whatsapp TEXT;

COMMENT ON COLUMN public.cells.leader2_name IS 'Nome do segundo líder (opcional)';
COMMENT ON COLUMN public.cells.leader2_whatsapp IS 'WhatsApp do segundo líder (opcional)';

-- ================================================================
-- Garante que SELECT de anon está desabilitado para cells
-- (busca pública usa service_role via server action)
-- ================================================================
REVOKE SELECT ON public.cells FROM anon;

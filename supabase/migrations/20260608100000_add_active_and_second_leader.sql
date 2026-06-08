-- ============================================================
-- Adiciona: is_active (toggle ativo/inativo) e segundo líder
-- ============================================================

ALTER TABLE public.cells
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS leader2_name TEXT,
  ADD COLUMN IF NOT EXISTS leader2_whatsapp TEXT;

COMMENT ON COLUMN public.cells.is_active IS 'Se TRUE, a célula aparece na busca pública';
COMMENT ON COLUMN public.cells.leader2_name IS 'Nome do segundo líder (opcional)';
COMMENT ON COLUMN public.cells.leader2_whatsapp IS 'WhatsApp do segundo líder (opcional)';

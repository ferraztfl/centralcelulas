BEGIN;

ALTER TABLE public.cells
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text;

COMMENT ON COLUMN public.cells.street IS
  'Logradouro estruturado da célula. Registros antigos podem permanecer nulos até revisão.';

COMMENT ON COLUMN public.cells.street_number IS
  'Número do imóvel. Mantido como texto para aceitar valores como S/N.';

COMMENT ON COLUMN public.cells.address_complement IS
  'Complemento opcional do endereço, como apartamento, bloco, casa ou referência.';

COMMENT ON COLUMN public.cells.city IS
  'Cidade do endereço estruturado.';

COMMENT ON COLUMN public.cells.state IS
  'UF brasileira em formato de duas letras.';

COMMENT ON COLUMN public.cells.postal_code IS
  'CEP do endereço, preferencialmente no formato 00000-000.';

COMMIT;

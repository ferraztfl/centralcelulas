# Migração: Supabase + Vercel + Geoapify + Leaflet/OpenStreetMap

Este pacote remove a dependência de Google Maps e Lovable para mapas/geocodificação.

## Variáveis antigas que devem ser removidas

Remova do `.env` local e da Vercel:

```env
LOVABLE_API_KEY=
GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_MAPS_BROWSER_KEY=
VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY=
VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID=
VITE_GEOAPIFY_API_KEY=
```

## Variável nova

Adicione no `.env` local e na Vercel somente:

```env
GEOAPIFY_API_KEY="SUA_CHAVE_GEOAPIFY"
```

## Por que não existe `VITE_GEOAPIFY_API_KEY`?

Toda variável que começa com `VITE_` é enviada para o navegador. Para não expor sua chave Geoapify, este projeto usa Geoapify somente em funções server:

- `src/lib/geocode.functions.ts`
- `src/lib/search.functions.ts`
- `src/lib/cells-import.functions.ts`

Os mapas usam Leaflet + OpenStreetMap e não precisam de chave no front-end.

## Instalação das dependências

Rode dentro do projeto:

```bash
npm install leaflet @types/leaflet --legacy-peer-deps
```

Ou substitua o `package.json` pelo deste pacote e rode:

```bash
npm install --legacy-peer-deps
```

## Arquivos alterados

- `src/components/CellMap.tsx`
- `src/components/admin/DashboardMap.tsx`
- `src/lib/geocode.functions.ts`
- `src/lib/search.functions.ts`
- `src/lib/cells-import.functions.ts`
- `src/routes/_authenticated/admin.settings.tsx`
- `package.json`
- `.env.example`

## Depois de aplicar

Rode:

```bash
npm run dev
npm run build
```

Teste:

- `/admin/dashboard`
- `/admin/import`
- busca pública
- mapa público
- importação CSV com geocodificação ligada

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = !!process.env.VERCEL;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts.
    server: { entry: "server" },
  },

  // Fora do Lovable, force-enable Nitro.
  // Na Vercel, gera especificamente o output compatível com Vercel.
  nitro: isVercel
    ? {
        preset: "vercel",
      }
    : true,
});

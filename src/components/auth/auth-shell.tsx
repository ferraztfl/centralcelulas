import { Link } from "@tanstack/react-router";
import { ArrowLeft, HeartHandshake, MapPin, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.06fr_0.94fr]">
      <aside className="relative hidden min-h-screen overflow-hidden lg:flex">
        <picture className="absolute inset-0">
          <img
            src="/culto-adoracao-igreja-do-amor-background.webp"
            width={1672}
            height={941}
            alt=""
            aria-hidden="true"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
        </picture>

        <div className="absolute inset-0 bg-slate-950/65" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/92 via-slate-950/70 to-blue-950/55" />

        <div className="relative z-10 flex w-full flex-col justify-between px-12 py-10 xl:px-20 xl:py-14">
          <div>
            <Link
              to="/"
              className="inline-flex rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur"
            >
              <img
                src="/central-logo.png"
                alt="Central de Células"
                className="h-14 w-auto object-contain"
              />
            </Link>
          </div>

          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              <MapPin className="size-3.5 text-blue-300" />
              Campus Zona Norte
            </div>

            <h1 className="text-5xl font-bold leading-[1.06] tracking-tight text-white xl:text-6xl">
              Encontre conexão.
              <br />
              <span className="text-blue-300">Viva comunhão.</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-white/75">
              Uma experiência criada para aproximar pessoas, fortalecer relacionamentos e facilitar
              o encontro com uma célula da Igreja do Amor.
            </p>

            <div className="mt-8 grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <HeartHandshake className="mt-0.5 size-5 shrink-0 text-blue-300" />

                <p className="text-sm leading-6 text-white/75">
                  Conexão, cuidado e crescimento através da vida em células.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-300" />

                <p className="text-sm leading-6 text-white/75">
                  Endereços, líderes e contatos ficam disponíveis apenas para usuários autenticados
                  e aprovados.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t border-white/10 pt-6">
            <img
              src="/logoigrejadoamor.png"
              alt="Igreja do Amor"
              className="h-10 w-auto rounded-lg bg-white/95 px-2 py-1 object-contain"
            />

            <div>
              <p className="text-sm font-semibold text-white">Igreja do Amor</p>
              <p className="text-xs text-white/55">Campus Zona Norte</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-8 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-blue-50/70" />
        <div className="absolute right-[-12rem] top-[-12rem] -z-10 size-[30rem] rounded-full bg-primary/5 blur-3xl" />

        <div className="w-full max-w-[470px]">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar ao início
          </Link>

          <div className="mb-8 flex justify-center lg:hidden">
            <Link to="/">
              <img
                src="/central-logo.png"
                alt="Central de Células"
                className="h-16 w-auto object-contain"
              />
            </Link>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}

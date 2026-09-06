import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  HeartHandshake,
  LockKeyhole,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Central de Células | Igreja do Amor - Campus Zona Norte",
      },
      {
        name: "description",
        content:
          "Central de Células da Igreja do Amor - Campus Zona Norte. Área protegida para localização e gestão de células.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const professionalWhatsapp = `https://wa.me/5581997451960?text=${encodeURIComponent(
    "Olá, Thiago! Estou entrando em contato através da página da Central de Células da Igreja do Amor – Campus Zona Norte. Gostaria de conversar sobre um projeto de desenvolvimento web, sistema ou outra solução digital.",
  )}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/central-logo.png"
              alt="Central de Células"
              className="h-12 w-auto object-contain md:h-14"
            />
          </Link>

          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <LockKeyhole className="size-4" />
            Área de Membros
          </Link>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <picture className="absolute inset-0 -z-30 block">
            <source
              media="(max-width: 767px)"
              srcSet="/culto-adoracao-igreja-do-amor-background-960.webp"
              type="image/webp"
            />

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

          <div className="absolute inset-0 -z-20 bg-black/50" />

          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/88 via-slate-950/68 to-slate-950/30 md:from-slate-950/84 md:via-slate-950/60 md:to-slate-950/20" />

          <div className="absolute inset-x-0 bottom-0 -z-10 h-16 bg-gradient-to-t from-background/95 via-background/35 to-transparent md:h-20" />

          <div className="mx-auto grid min-h-[720px] max-w-7xl items-center gap-12 px-5 py-16 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/85 shadow-sm backdrop-blur-md">
                <MapPin className="size-3.5 text-primary" />
                Campus Zona Norte
              </div>

              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] md:text-6xl lg:text-7xl">
                Central de <span className="text-blue-300">Células</span>
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/85 md:text-xl">
                Uma plataforma da Igreja do Amor para conectar pessoas, fortalecer relacionamentos e
                facilitar o encontro da célula mais adequada para cada perfil.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/auth"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
                >
                  Entrar na Área de Membros
                  <ArrowRight className="size-4" />
                </Link>

                <Link
                  to="/solicitar-acesso"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border bg-background px-6 py-3 font-semibold transition hover:bg-accent"
                >
                  Solicitar acesso
                </Link>
              </div>

              <p className="mt-4 max-w-xl text-sm leading-6 text-white/75">
                Por segurança e privacidade, endereços, contatos e informações de líderes estão
                disponíveis somente para usuários autenticados e aprovados.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-8 -z-10 rounded-full bg-primary/10 blur-3xl" />

              <div className="rounded-[2rem] border border-white/10 bg-card/85 p-8 shadow-2xl backdrop-blur-md md:p-10">
                <div className="flex items-center justify-between border-b pb-7">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Igreja do Amor</p>
                    <p className="mt-1 text-2xl font-bold">Campus Zona Norte</p>
                  </div>

                  <img
                    src="/logoigrejadoamor.png"
                    alt="Igreja do Amor"
                    className="h-14 w-auto object-contain"
                  />
                </div>

                <div className="mt-8 space-y-6">
                  <Feature
                    icon={Users}
                    title="Conexão"
                    description="Encontre células de acordo com perfil, localização e disponibilidade."
                  />

                  <Feature
                    icon={HeartHandshake}
                    title="Comunhão"
                    description="Facilitamos o caminho para relacionamentos, cuidado e crescimento."
                  />

                  <Feature
                    icon={ShieldCheck}
                    title="Privacidade"
                    description="Os dados das células ficam protegidos dentro da Área de Membros."
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-muted/30">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-12 md:grid-cols-3 md:px-8">
            <InfoCard
              number="01"
              title="Crie sua conta"
              text="Solicite acesso usando seu e-mail e uma senha segura."
            />
            <InfoCard
              number="02"
              title="Aguarde aprovação"
              text="Um administrador valida o cadastro antes de liberar informações internas."
            />
            <InfoCard
              number="03"
              title="Encontre sua célula"
              text="Depois de aprovado, use o localizador inteligente dentro da Área de Membros."
            />
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/20">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:grid-cols-[1fr_auto] md:items-center md:px-8">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Central de Células · Igreja do Amor · Campus Zona Norte
            </p>

            <p className="text-xs text-muted-foreground">Área institucional de acesso controlado</p>
          </div>

          <a
            href={professionalWhatsapp}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-all hover:border-primary/40 hover:shadow-md"
            aria-label="Entrar em contato profissional com Thiago F. de Lima pelo WhatsApp"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <MessageCircle className="size-5" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Projeto e desenvolvimento</p>

              <p className="text-sm font-semibold text-foreground">Thiago F. de Lima</p>

              <p className="mt-0.5 text-xs text-muted-foreground">
                Desenvolvimento Web · Sistemas · Soluções Digitais
              </p>

              <p className="mt-1 text-xs font-medium text-primary">
                Contato profissional · (81) 99745-1960
              </p>
            </div>
          </a>
        </div>
      </footer>
    </div>
  );
}

type IconType = typeof Users;

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: IconType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>

      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function InfoCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-background p-6">
      <span className="text-sm font-bold text-primary">{number}</span>
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

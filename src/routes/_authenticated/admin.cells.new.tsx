import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CirclePlus } from "lucide-react";
import { CellForm } from "@/components/admin/CellForm";

export const Route = createFileRoute("/_authenticated/admin/cells/new")({
  head: () => ({
    meta: [
      {
        title: "Nova célula • Central de Células",
      },
    ],
  }),
  component: NewCell,
});

function NewCell() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-5xl space-y-7 p-5 md:p-8 lg:p-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-7 text-white shadow-xl md:px-8 lg:px-10 lg:py-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
          <CirclePlus className="size-3.5" />
          Cadastro de célula
        </div>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Nova célula</h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
          Cadastre identificação, localização, reunião e liderança. Os dados serão usados pela
          Central de Células nas recomendações.
        </p>
      </section>

      <CellForm onDone={() => navigate({ to: "/admin" })} />
    </div>
  );
}

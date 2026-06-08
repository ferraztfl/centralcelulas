import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CellForm } from "@/components/admin/CellForm";

export const Route = createFileRoute("/_authenticated/admin/cells/new")({
  head: () => ({ meta: [{ title: "Nova célula • Admin" }] }),
  component: NewCell,
});

function NewCell() {
  const navigate = useNavigate();
  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Nova célula</h1>
      <CellForm onDone={() => navigate({ to: "/admin" })} />
    </div>
  );
}

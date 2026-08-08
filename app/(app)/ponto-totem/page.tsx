import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { TotemTabs } from "./totem-tabs";

export default async function PontoTotemPage() {
  await requirePermission("canManageFuncionarios");

  const employees = await prisma.employee.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, faceDescriptor: true },
  });

  const list = employees.map((e) => ({
    id: e.id,
    name: e.name,
    hasFace: e.faceDescriptor !== null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Ponto por Facial</h1>
        <p className="text-sm text-neutral-500">
          Deixe esse aparelho na loja: os funcionários batem o ponto só mostrando o rosto na câmera.
        </p>
      </div>

      <TotemTabs employees={list} />
    </div>
  );
}

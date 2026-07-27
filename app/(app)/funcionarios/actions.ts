"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const employeeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  role: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  baseSalary: z.coerce.number().min(0, "O salário não pode ser negativo."),
  dependents: z.coerce.number().int().min(0, "Não pode ser negativo.").default(0),
  hireDate: z.string().trim().optional(),
  scheduledStart: z
    .string()
    .trim()
    .refine((v) => v === "" || timePattern.test(v), "Horário de entrada inválido."),
  scheduledEnd: z
    .string()
    .trim()
    .refine((v) => v === "" || timePattern.test(v), "Horário de saída inválido."),
  weeklyDayOff: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === "none" ? null : Number(value)))
    .nullable()
    .optional(),
  active: z.coerce.boolean(),
  userId: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === "none" ? null : value))
    .nullable()
    .optional(),
  storeId: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === "none" ? null : value))
    .nullable()
    .optional(),
});

export type EmployeeFormState = { error?: string } | undefined;

function parseEmployeeForm(formData: FormData) {
  return employeeSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role") || undefined,
    phone: formData.get("phone") || undefined,
    baseSalary: formData.get("baseSalary"),
    dependents: formData.get("dependents") || 0,
    hireDate: formData.get("hireDate") || undefined,
    scheduledStart: formData.get("scheduledStart") || "",
    scheduledEnd: formData.get("scheduledEnd") || "",
    weeklyDayOff: formData.get("weeklyDayOff"),
    active: formData.get("active") === "on",
    userId: formData.get("userId"),
    storeId: formData.get("storeId"),
  });
}

export async function createEmployee(
  _prevState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await prisma.employee.create({
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        phone: parsed.data.phone,
        baseSalary: parsed.data.baseSalary,
        dependents: parsed.data.dependents,
        hireDate: parsed.data.hireDate ? new Date(`${parsed.data.hireDate}T00:00:00`) : null,
        scheduledStart: parsed.data.scheduledStart || null,
        scheduledEnd: parsed.data.scheduledEnd || null,
        weeklyDayOff: parsed.data.weeklyDayOff ?? null,
        active: parsed.data.active,
        userId: parsed.data.userId ?? null,
        storeId: parsed.data.storeId ?? null,
      },
    });
  } catch {
    return { error: "Essa conta de acesso já está vinculada a outro funcionário." };
  }

  revalidatePath("/funcionarios");
}

export async function updateEmployee(
  id: string,
  _prevState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await prisma.employee.update({
      where: { id },
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        phone: parsed.data.phone,
        baseSalary: parsed.data.baseSalary,
        dependents: parsed.data.dependents,
        hireDate: parsed.data.hireDate ? new Date(`${parsed.data.hireDate}T00:00:00`) : null,
        scheduledStart: parsed.data.scheduledStart || null,
        scheduledEnd: parsed.data.scheduledEnd || null,
        weeklyDayOff: parsed.data.weeklyDayOff ?? null,
        active: parsed.data.active,
        userId: parsed.data.userId ?? null,
        storeId: parsed.data.storeId ?? null,
      },
    });
  } catch {
    return { error: "Essa conta de acesso já está vinculada a outro funcionário." };
  }

  revalidatePath("/funcionarios");
  revalidatePath(`/funcionarios/${id}`);
}

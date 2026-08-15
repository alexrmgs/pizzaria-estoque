import { prisma } from "@/lib/prisma";

export async function getAppSettings(companyId: string) {
  return prisma.appSettings.upsert({
    where: { companyId },
    update: {},
    create: { companyId },
  });
}

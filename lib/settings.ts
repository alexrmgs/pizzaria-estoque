import { prisma } from "@/lib/prisma";

export async function getAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: "settings" },
    update: {},
    create: { id: "settings" },
  });
}

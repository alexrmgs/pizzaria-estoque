import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Em serverless (Vercel), cada instância pode abrir seu próprio pool de
// conexões — sem um limite baixo aqui, vários funcionários batendo ponto ao
// mesmo tempo podem esgotar o limite de conexões do Postgres (Supabase) e
// derrubar a página com um erro genérico.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5 });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

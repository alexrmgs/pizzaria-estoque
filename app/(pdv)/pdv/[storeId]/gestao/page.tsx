import { redirect } from "next/navigation";

export default async function GestaoPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  redirect(`/pdv/${storeId}/gestao/produtos`);
}
